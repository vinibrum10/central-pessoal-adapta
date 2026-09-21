/**
 * Coleta um "retrato" leve do repositório para dar contexto ao modelo sem
 * despejar o projeto inteiro no prompt (o que estouraria tokens e cota).
 *
 * A ideia: o system prompt recebe a árvore de arquivos + trechos-chave
 * (README, package.json). Detalhes o próprio agente busca com a ferramenta
 * `read_file` quando precisar. É o padrão "contexto raso + leitura sob demanda".
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface RepoContext {
  root: string;
  tree: string;
  readmeHead: string;
  packageJson: string;
}

/** Lista arquivos versionados (respeita .gitignore) e ignora ruído. */
function gitTrackedFiles(root: string): string[] {
  try {
    const out = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((f) => !f.startsWith('agent/')) // o próprio agente não é alvo de edição
      .filter((f) => !/\.(png|jpe?g|gif|ico|svg|webp|lock)$/i.test(f))
      .filter((f) => f !== 'package-lock.json');
  } catch {
    return [];
  }
}

function head(path: string, maxChars: number): string {
  if (!existsSync(path)) return '(arquivo ausente)';
  const content = readFileSync(path, 'utf8');
  return content.length > maxChars ? `${content.slice(0, maxChars)}\n… (truncado)` : content;
}

export function gatherRepoContext(root: string): RepoContext {
  const files = gitTrackedFiles(root);
  // Agrupa por diretório de topo para um retrato compacto e legível.
  const tree = files.slice(0, 400).join('\n');
  return {
    root,
    tree,
    readmeHead: head(join(root, 'README.md'), 3500),
    packageJson: head(join(root, 'package.json'), 2000),
  };
}
