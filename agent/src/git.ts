/**
 * Operações Git. O agente NUNCA escreve na branch principal: ele cria uma
 * branch dedicada, commita ali e empurra. O merge fica sempre sob seu controle,
 * via Pull Request.
 */

import { execFileSync } from 'node:child_process';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

export function currentBranch(root: string): string {
  return git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
}

export function hasUncommittedChanges(root: string): boolean {
  return git(root, ['status', '--porcelain']).length > 0;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

export function createBranch(root: string, base: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6);
  const name = `agent/${base || 'melhoria'}-${stamp}-${rand}`;
  git(root, ['checkout', '-b', name]);
  return name;
}

export function commitAll(root: string, message: string): void {
  git(root, ['add', '-A']);
  // Usa -F - para permitir mensagens multilinha sem problemas de escaping.
  execFileSync('git', ['commit', '-F', '-'], { cwd: root, input: message, encoding: 'utf8' });
}

export function push(root: string, branch: string): void {
  // Retry com backoff exponencial para falhas de rede.
  const delays = [0, 2000, 4000, 8000, 16000];
  let lastErr: unknown;
  for (const d of delays) {
    if (d) execFileSync('sleep', [String(d / 1000)]);
    try {
      git(root, ['push', '-u', 'origin', branch]);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/** Descobre owner/repo a partir do remote origin (suporta https e ssh). */
export function parseOriginRepo(root: string): { owner: string; repo: string } | null {
  let url: string;
  try {
    url = git(root, ['remote', 'get-url', 'origin']);
  } catch {
    return null;
  }
  const m =
    url.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/) ||
    url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
}
