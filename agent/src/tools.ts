/**
 * Ferramentas que o agente pode CHAMAR de forma autônoma (tool calling do AI SDK).
 *
 * FILOSOFIA DE SEGURANÇA (importante — o agente edita código de verdade):
 *  - Toda escrita/leitura é confinada à raiz do repositório. Qualquer caminho
 *    que "escape" (../.., caminho absoluto para fora) é rejeitado.
 *  - Nada de shell arbitrário. A única execução permitida é `run_check`, que só
 *    roda scripts npm de uma WHITELIST (test/build/lint). Assim o modelo não
 *    consegue rodar comandos perigosos mesmo que "queira".
 *  - Cada arquivo tocado é registrado num ChangeSet, que vira o corpo do PR.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname, isAbsolute, join } from 'node:path';

export interface ChangeSet {
  written: Set<string>;
  deleted: Set<string>;
  summary: string | null;
  prTitle: string | null;
  prBody: string | null;
  finished: boolean;
}

export function newChangeSet(): ChangeSet {
  return { written: new Set(), deleted: new Set(), summary: null, prTitle: null, prBody: null, finished: false };
}

type Logger = (msg: string) => void;

/** Garante que `p` fica dentro de `root`; devolve o caminho absoluto seguro. */
function safeResolve(root: string, p: string): string {
  const abs = isAbsolute(p) ? p : resolve(root, p);
  const rel = relative(root, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Caminho fora do repositório não é permitido: ${p}`);
  }
  return abs;
}

const CHECK_WHITELIST = ['test', 'build', 'lint', 'typecheck'] as const;

export function createTools(root: string, changes: ChangeSet, log: Logger) {
  return {
    list_dir: tool({
      description:
        'Lista arquivos e subpastas de um diretório do repositório. Use para explorar a estrutura antes de editar.',
      inputSchema: z.object({
        path: z.string().describe('Caminho relativo à raiz do repo. Use "." para a raiz.'),
      }),
      execute: async ({ path }) => {
        const abs = safeResolve(root, path);
        if (!existsSync(abs)) return `Diretório não existe: ${path}`;
        const entries = readdirSync(abs, { withFileTypes: true })
          .filter((e) => e.name !== 'node_modules' && e.name !== '.git')
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .sort();
        return entries.join('\n') || '(vazio)';
      },
    }),

    read_file: tool({
      description: 'Lê o conteúdo de um arquivo. SEMPRE leia um arquivo antes de reescrevê-lo.',
      inputSchema: z.object({
        path: z.string().describe('Caminho relativo à raiz do repo.'),
      }),
      execute: async ({ path }) => {
        const abs = safeResolve(root, path);
        if (!existsSync(abs)) return `Arquivo não existe: ${path}`;
        const st = statSync(abs);
        if (st.size > 200_000) return `Arquivo grande demais (${st.size} bytes). Prefira ler em partes menores.`;
        log(`  📖 leu ${path}`);
        return readFileSync(abs, 'utf8');
      },
    }),

    write_file: tool({
      description:
        'Cria ou sobrescreve um arquivo com o conteúdo COMPLETO fornecido. ' +
        'Passe o arquivo inteiro, não um diff. Cria pastas intermediárias automaticamente.',
      inputSchema: z.object({
        path: z.string().describe('Caminho relativo à raiz do repo.'),
        content: z.string().describe('Conteúdo COMPLETO do arquivo.'),
      }),
      execute: async ({ path, content }) => {
        const abs = safeResolve(root, path);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, content, 'utf8');
        changes.written.add(relative(root, abs));
        changes.deleted.delete(relative(root, abs));
        log(`  ✏️  escreveu ${path} (${content.length} chars)`);
        return `Arquivo salvo: ${path}`;
      },
    }),

    delete_file: tool({
      description:
        'Remove um arquivo que não é mais necessário. Use com critério — só apague o que você tem certeza que virou código morto.',
      inputSchema: z.object({
        path: z.string().describe('Caminho relativo à raiz do repo.'),
      }),
      execute: async ({ path }) => {
        const abs = safeResolve(root, path);
        if (!existsSync(abs)) return `Nada para apagar (arquivo não existe): ${path}`;
        rmSync(abs);
        changes.deleted.add(relative(root, abs));
        changes.written.delete(relative(root, abs));
        log(`  🗑️  apagou ${path}`);
        return `Arquivo removido: ${path}`;
      },
    }),

    search_code: tool({
      description:
        'Procura um texto/padrão em todos os arquivos versionados (como um "grep"). ' +
        'Use para achar onde algo é usado antes de mudar ou remover.',
      inputSchema: z.object({
        query: z.string().describe('Texto literal ou regex simples a procurar.'),
      }),
      execute: async ({ query }) => {
        try {
          const out = execSync(`git grep -n --fixed-strings -e ${JSON.stringify(query)} -- . ':!agent/'`, {
            cwd: root,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024,
          });
          const lines = out.split('\n').slice(0, 80);
          return lines.join('\n') || 'Nenhuma ocorrência.';
        } catch {
          return 'Nenhuma ocorrência.';
        }
      },
    }),

    run_check: tool({
      description:
        'Roda uma verificação do projeto para validar suas mudanças. ' +
        'Valores permitidos: "test" (vitest), "build" (tsc + vite build), "lint", "typecheck". ' +
        'SEMPRE rode "build" e "test" depois de editar código, antes de chamar finish.',
      inputSchema: z.object({
        kind: z.enum(CHECK_WHITELIST).describe('Qual verificação rodar.'),
      }),
      execute: async ({ kind }) => {
        const pkgPath = join(root, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
        if (!pkg.scripts?.[kind]) {
          return `O projeto não tem o script "${kind}" no package.json. Verificações disponíveis: ${Object.keys(
            pkg.scripts ?? {},
          ).join(', ')}`;
        }
        log(`  🔎 rodando "npm run ${kind}"…`);
        try {
          const out = execSync(`npm run ${kind} 2>&1`, {
            cwd: root,
            encoding: 'utf8',
            maxBuffer: 8 * 1024 * 1024,
            timeout: 5 * 60 * 1000,
          });
          const tail = out.split('\n').slice(-40).join('\n');
          log(`  ✅ ${kind} passou`);
          return `SUCESSO (${kind}):\n${tail}`;
        } catch (err: unknown) {
          const e = err as { stdout?: string; stderr?: string; message?: string };
          const raw = `${e.stdout ?? ''}\n${e.stderr ?? ''}\n${e.message ?? ''}`.trim();
          const tail = raw.split('\n').slice(-60).join('\n');
          log(`  ❌ ${kind} FALHOU`);
          return `FALHA (${kind}). Corrija os erros abaixo e rode de novo:\n${tail}`;
        }
      },
    }),

    finish: tool({
      description:
        'Chame quando a tarefa estiver COMPLETA e as verificações (build/test) tiverem passado. ' +
        'Forneça um resumo do que foi feito e o título/corpo sugeridos para o Pull Request.',
      inputSchema: z.object({
        summary: z.string().describe('Resumo em português do que foi alterado e por quê.'),
        prTitle: z.string().describe('Título curto para o Pull Request (imperativo, ex: "Melhora X").'),
        prBody: z.string().describe('Corpo do PR em markdown: o que mudou, por quê, e como testar.'),
      }),
      execute: async ({ summary, prTitle, prBody }) => {
        changes.summary = summary;
        changes.prTitle = prTitle;
        changes.prBody = prBody;
        changes.finished = true;
        return 'Tarefa marcada como concluída.';
      },
    }),
  };
}
