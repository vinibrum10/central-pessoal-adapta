/**
 * MODO AUDITORIA (determinístico, sem IA, sem cota, sem risco).
 *
 * POR QUÊ: "fazer uma auditoria" é ANÁLISE, não edição de código. Depender de
 * um modelo de IA para isso é caro (cota), lento e pouco confiável (o modelo
 * local gera relatórios genéricos). Aqui a análise é feita por REGRAS de código
 * que olham o SEU projeto de verdade:
 *   - dependências instaladas que não são usadas em lugar nenhum;
 *   - ausência de code-splitting (tudo num bundle só);
 *   - bibliotecas pesadas carregadas estaticamente (poderiam ser sob demanda);
 *   - arquivos muito grandes (difíceis de manter, re-render caro);
 *   - tamanho do bundle de produção (se já houver build).
 *
 * Resultado: um relatório em docs/AUDITORIA.md — rápido, gratuito e reprodutível.
 *
 * Rode com:  npm run agent:audit
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();

/** Bibliotecas conhecidas por serem "pesadas" — boas candidatas a import dinâmico. */
const HEAVY_LIBS = ['xlsx', 'recharts', '@azure/msal-browser', '@google/genai'];

function gitGrepCount(needle: string): number {
  try {
    const out = execFileSync(
      'git',
      ['grep', '-l', '--fixed-strings', '-e', needle, '--', 'src', 'api'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    return out.split('\n').filter(Boolean).length;
  } catch {
    return 0; // git grep retorna status 1 quando não acha nada
  }
}

/** Conta quantos arquivos (fora de testes) importam a dependência nos escopos dados. */
function usageCount(dep: string, scopes: string[]): number {
  try {
    const out = execFileSync(
      'git',
      ['grep', '-l', '--fixed-strings', '-e', dep, '--', ...scopes],
      { cwd: ROOT, encoding: 'utf8' },
    );
    return out
      .split('\n')
      .filter(Boolean)
      .filter((f) => !f.includes('__tests__') && !f.includes('.test.')).length;
  } catch {
    return 0;
  }
}

/** Uso em qualquer código de produção (cliente + servidor). */
function nonTestUsageCount(dep: string): number {
  return usageCount(dep, ['src', 'api']);
}

function walkSource(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'agent'].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkSource(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function countLines(file: string): number {
  return readFileSync(file, 'utf8').split('\n').length;
}

function human(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(0)} kB`;
}

function auditUnusedDeps(): { name: string }[] {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  const deps = Object.keys(pkg.dependencies ?? {});
  // react/react-dom são infra e podem aparecer via JSX runtime — nunca marcar.
  const alwaysKeep = new Set(['react', 'react-dom']);
  return deps
    .filter((d) => !alwaysKeep.has(d))
    .filter((d) => nonTestUsageCount(d) === 0)
    .map((name) => ({ name }));
}

function auditHeavyStatic(): { lib: string; files: number }[] {
  // Só o código do CLIENTE (src/) importa para o bundle do navegador; api/ é servidor.
  return HEAVY_LIBS.map((lib) => ({ lib, files: usageCount(lib, ['src']) })).filter((r) => r.files > 0);
}

function auditLargeFiles(topN: number): { file: string; lines: number }[] {
  return walkSource(join(ROOT, 'src'))
    .map((f) => ({ file: f.replace(ROOT + '/', '').replace(ROOT + '\\', ''), lines: countLines(f) }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, topN);
}

function auditBundle(): { file: string; size: number }[] {
  const assets = join(ROOT, 'dist', 'assets');
  if (!existsSync(assets)) return [];
  return readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ file: `dist/assets/${f}`, size: statSync(join(assets, f)).size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);
}

function main(): void {
  const hasLazy = gitGrepCount('React.lazy') + gitGrepCount('lazy(') > 0;
  const unused = auditUnusedDeps();
  const heavy = auditHeavyStatic();
  const large = auditLargeFiles(8);
  const bundle = auditBundle();

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const lines: string[] = [];
  lines.push('# 📋 Auditoria automática do SGP');
  lines.push('');
  lines.push(`> Gerado em ${now} por \`npm run agent:audit\` (análise determinística, sem IA).`);
  lines.push('');

  lines.push('## 1. Dependências instaladas e não usadas');
  if (unused.length) {
    lines.push('Nenhuma importação encontrada em `src/` ou `api/` (fora de testes):');
    lines.push('');
    for (const u of unused) lines.push(`- \`${u.name}\` → **candidata a remoção**`);
    lines.push('');
    lines.push('**Por quê:** peso morto no `package.json` e no `npm install`. Remover é seguro se nada as importa.');
  } else {
    lines.push('✅ Nenhuma dependência de produção aparece sem uso.');
  }
  lines.push('');

  lines.push('## 2. Code-splitting (carregamento sob demanda)');
  if (hasLazy) {
    lines.push('✅ O projeto já usa `React.lazy` / carregamento dinâmico em algum ponto.');
  } else {
    lines.push('⚠️ **Não há code-splitting** (`React.lazy`/`import()` dinâmico não encontrado).');
    lines.push('');
    lines.push(
      '**Por quê:** todas as páginas entram no mesmo bundle e são baixadas juntas na primeira ' +
        'visita, deixando o carregamento inicial mais lento (especialmente no celular). ' +
        'Transformar as rotas em `React.lazy(() => import("./pages/X"))` com `<Suspense>` faz o ' +
        'Vite gerar um arquivo por página, carregado só quando acessada.',
    );
  }
  lines.push('');

  lines.push('## 3. Bibliotecas pesadas carregadas estaticamente');
  if (heavy.length) {
    lines.push('Estas libs são grandes e entram no bundle mesmo quando o recurso não é usado:');
    lines.push('');
    for (const h of heavy) lines.push(`- \`${h.lib}\` — usada em ${h.files} arquivo(s)`);
    lines.push('');
    lines.push(
      '**Por quê:** carregá-las sob demanda (com `import()` dinâmico no momento do uso — ex.: no ' +
        'clique de "exportar Excel") tira centenas de KB da primeira carga.',
    );
  } else {
    lines.push('✅ Nenhuma biblioteca pesada conhecida em uso estático.');
  }
  lines.push('');

  lines.push('## 4. Arquivos muito grandes');
  lines.push('Os maiores arquivos de código (linhas):');
  lines.push('');
  for (const f of large) {
    const flag = f.lines > 800 ? ' ⚠️' : '';
    lines.push(`- \`${f.file}\` — ${f.lines} linhas${flag}`);
  }
  lines.push('');
  lines.push(
    '**Por quê:** arquivos acima de ~800 linhas costumam concentrar muito estado e re-renderizar ' +
      'blocos grandes a cada mudança (custo de performance) e são difíceis de manter. Vale quebrar ' +
      'em subcomponentes aos poucos — tarefa maior, feita com revisão.',
  );
  lines.push('');

  lines.push('## 5. Tamanho do bundle de produção');
  if (bundle.length) {
    for (const b of bundle) {
      const flag = b.size > 500 * 1024 ? ' ⚠️ (>500 kB)' : '';
      lines.push(`- \`${b.file}\` — ${human(b.size)}${flag}`);
    }
  } else {
    lines.push('ℹ️ Nenhum build encontrado em `dist/`. Rode `npm run build` e depois `npm run agent:audit` para medir.');
  }
  lines.push('');

  lines.push('---');
  lines.push('## Como agir (do mais seguro ao mais delicado)');
  lines.push('');
  lines.push('| Ação | Risco | Cabe ao agente? |');
  lines.push('|---|---|---|');
  lines.push('| Remover dependências não usadas | Baixíssimo | ✅ tarefa pequena e específica |');
  lines.push('| Lazy-load das rotas | Baixo | ✅ um PR focado |');
  lines.push('| Lazy-load de libs pesadas | Baixo-médio | ✅ uma por vez |');
  lines.push('| Quebrar arquivos gigantes | Médio-alto | ⚠️ só com revisão |');

  const outDir = join(ROOT, 'docs');
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, 'AUDITORIA.md');
  writeFileSync(outFile, lines.join('\n'), 'utf8');

  // Resumo no terminal.
  console.log('\n✅ Auditoria concluída → docs/AUDITORIA.md\n');
  console.log(`  • Dependências não usadas: ${unused.length ? unused.map((u) => u.name).join(', ') : 'nenhuma'}`);
  console.log(`  • Code-splitting: ${hasLazy ? 'presente' : 'AUSENTE (recomendado adicionar)'}`);
  console.log(`  • Libs pesadas em uso estático: ${heavy.length ? heavy.map((h) => h.lib).join(', ') : 'nenhuma'}`);
  console.log(`  • Maior arquivo: ${large[0] ? `${large[0].file} (${large[0].lines} linhas)` : 'n/d'}`);
  console.log('\nAbra docs/AUDITORIA.md para o relatório completo.\n');
}

main();
