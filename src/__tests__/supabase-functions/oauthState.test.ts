import { describe, expect, it } from 'vitest';
import {
  generateStateToken,
  validateStateRecord,
  type OAuthStateRecord,
} from '../../../supabase/functions/_shared/oauthState';

function makeRecord(overrides: Partial<OAuthStateRecord> = {}): OAuthStateRecord {
  return {
    state: 'abc',
    user_id: 'user-1',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    used_at: null,
    ...overrides,
  };
}

describe('generateStateToken', () => {
  it('gera tokens diferentes a cada chamada (imprevisível, sem colisão prática)', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateStateToken()));
    expect(tokens.size).toBe(50);
  });

  it('gera um token seguro para uso em URL (sem +, / ou =)', () => {
    const token = generateStateToken();
    expect(token).not.toMatch(/[+/=]/);
  });
});

describe('validateStateRecord', () => {
  it('rejeita quando o registro não existe (state nunca emitido por nós)', () => {
    expect(validateStateRecord(null, new Date())).toEqual({ kind: 'not_found' });
  });

  it('rejeita um state já usado (proteção contra reuso/replay)', () => {
    const record = makeRecord({ used_at: new Date().toISOString() });
    expect(validateStateRecord(record, new Date())).toEqual({ kind: 'already_used' });
  });

  it('rejeita um state expirado', () => {
    const record = makeRecord({ expires_at: new Date(Date.now() - 1000).toISOString() });
    expect(validateStateRecord(record, new Date())).toEqual({ kind: 'expired' });
  });

  it('aceita um state válido, não usado e dentro da validade, retornando o user_id associado', () => {
    const record = makeRecord({ user_id: 'user-42' });
    expect(validateStateRecord(record, new Date())).toEqual({ kind: 'valid', userId: 'user-42' });
  });

  it('a expiração é avaliada contra o instante `now` recebido, não Date.now() interno (determinístico em teste)', () => {
    const record = makeRecord({ expires_at: '2026-01-01T00:05:00.000Z' });
    expect(validateStateRecord(record, new Date('2026-01-01T00:04:59.000Z'))).toEqual({ kind: 'valid', userId: 'user-1' });
    expect(validateStateRecord(record, new Date('2026-01-01T00:05:00.001Z'))).toEqual({ kind: 'expired' });
  });
});
