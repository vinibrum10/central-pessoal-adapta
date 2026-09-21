/**
 * Carrega automaticamente as variáveis dos arquivos .env do projeto ANTES de
 * qualquer outra coisa.
 *
 * POR QUÊ: o agente roda em Node (via tsx), e o Node — diferente do Vite — não
 * lê arquivos .env sozinho. Sem isso, você teria que exportar GEMINI_API_KEY e
 * GITHUB_TOKEN na mão no terminal a cada vez. Aqui usamos o
 * `process.loadEnvFile` nativo do Node (>=20.6) para puxar suas chaves já
 * existentes automaticamente.
 *
 * Ordem de precedência (o último vence): .env  →  .env.local
 * Chaves já definidas no ambiente real do terminal continuam tendo prioridade
 * máxima (não são sobrescritas).
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CANDIDATES = ['.env', '.env.local'];

export function loadDotEnv(root: string = process.cwd()): void {
  // Guarda o que já veio do terminal para não deixar o arquivo sobrescrever.
  const fromShell = new Set(Object.keys(process.env));

  for (const file of CANDIDATES) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    // Snapshot antes de carregar, para restaurar as chaves do shell depois.
    const before: Record<string, string | undefined> = {};
    for (const k of fromShell) before[k] = process.env[k];

    try {
      // API nativa do Node: lê o arquivo e injeta em process.env.
      (process as unknown as { loadEnvFile: (p: string) => void }).loadEnvFile(path);
    } catch {
      // Arquivo mal-formado ou versão antiga do Node — ignora silenciosamente.
      continue;
    }

    // Restaura as variáveis que já vinham do terminal (elas têm prioridade).
    for (const k of fromShell) {
      if (before[k] !== undefined) process.env[k] = before[k];
    }
  }
}
