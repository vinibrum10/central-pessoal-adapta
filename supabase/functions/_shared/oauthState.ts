// Geração e validação do `state` CSRF de uso único do Authorization Code Flow.
// Lógica pura (sem I/O de banco) — a leitura/escrita em
// public.youtube_oauth_states acontece no index.ts de cada Edge Function,
// que chama estas funções para decidir o que fazer com o registro encontrado.

const STATE_BYTE_LENGTH = 32;
export const OAUTH_STATE_TTL_MS = 5 * 60 * 1000; // 5 minutos — janela curta de propósito

export function generateStateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(STATE_BYTE_LENGTH));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface OAuthStateRecord {
  state: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
}

export type StateValidationResult =
  | { kind: 'valid'; userId: string }
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'already_used' };

/**
 * Validação pura: dado o registro (ou null, se a busca no banco não encontrou
 * nada) e o instante atual, decide se o state é aceitável. NÃO marca o state
 * como usado — isso é responsabilidade do chamador (index.ts), que deve
 * marcar `used_at` no MESMO passo/transação em que aceita o state, para
 * eliminar a janela de corrida de reuso (replay).
 */
export function validateStateRecord(record: OAuthStateRecord | null, now: Date): StateValidationResult {
  if (!record) return { kind: 'not_found' };
  if (record.used_at !== null) return { kind: 'already_used' };
  if (new Date(record.expires_at).getTime() <= now.getTime()) return { kind: 'expired' };
  return { kind: 'valid', userId: record.user_id };
}
