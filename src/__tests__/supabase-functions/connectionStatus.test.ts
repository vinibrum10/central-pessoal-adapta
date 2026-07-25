import { describe, expect, it } from 'vitest';
import { toFrontendConnectionStatus } from '../../../supabase/functions/_shared/connectionStatus';

describe('toFrontendConnectionStatus', () => {
  it('active → connected', () => {
    expect(toFrontendConnectionStatus('active')).toBe('connected');
  });

  it('revoked → reconnect_required', () => {
    expect(toFrontendConnectionStatus('revoked')).toBe('reconnect_required');
  });

  it('invalid → reconnect_required', () => {
    expect(toFrontendConnectionStatus('invalid')).toBe('reconnect_required');
  });

  it('nunca devolve o valor cru do banco — só os três valores do vocabulário de conexão', () => {
    const possibleFrontendValues = ['connected', 'reconnect_required'];
    for (const dbStatus of ['active', 'revoked', 'invalid', 'algo-inesperado']) {
      expect(possibleFrontendValues).toContain(toFrontendConnectionStatus(dbStatus));
    }
  });
});
