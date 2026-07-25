import { describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  invokeResult: { data: null as unknown, error: null as unknown },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.resolve(mockState.invokeResult)),
    },
  },
}));

import { getYoutubeConnectionStatus } from './youtubeServerConnection';

describe('getYoutubeConnectionStatus', () => {
  it('active → connected: já convertido pela Edge Function, o cliente só repassa', async () => {
    mockState.invokeResult = {
      data: { connected: true, status: 'connected', grantedScopes: ['https://www.googleapis.com/auth/youtube.readonly'], lastRefreshedAt: '2026-07-25T17:12:10.000Z' },
      error: null,
    };

    const state = await getYoutubeConnectionStatus();

    expect(state.status).toBe('connected');
    expect(state.grantedScopes).toEqual(['https://www.googleapis.com/auth/youtube.readonly']);
    expect(state.lastRefreshedAt).toBe('2026-07-25T17:12:10.000Z');
    expect(state.errorMessage).toBeNull();
  });

  it('revoked/invalid → reconnect_required: a Edge Function já entrega "reconnect_required"', async () => {
    mockState.invokeResult = {
      data: { connected: false, status: 'reconnect_required', grantedScopes: [], lastRefreshedAt: null },
      error: null,
    };

    const state = await getYoutubeConnectionStatus();

    expect(state.status).toBe('reconnect_required');
  });

  it('ausência de conexão ("none") → not_connected', async () => {
    mockState.invokeResult = {
      data: { connected: false, status: 'none', grantedScopes: [], lastRefreshedAt: null },
      error: null,
    };

    const state = await getYoutubeConnectionStatus();

    expect(state.status).toBe('not_connected');
  });

  it('valor de status desconhecido/inesperado (ex.: vazamento do vocabulário do banco, "active") vira "error" em vez de ser confiado como válido', async () => {
    mockState.invokeResult = {
      data: { connected: true, status: 'active', grantedScopes: [], lastRefreshedAt: null },
      error: null,
    };

    const state = await getYoutubeConnectionStatus();

    expect(state.status).toBe('error');
    expect(state.errorMessage).toMatch(/inesperado/i);
  });

  it('corpo malformado (não é um objeto, ou status não é string) também vira "error" — nunca lança exceção nem finge sucesso', async () => {
    mockState.invokeResult = { data: null, error: null };

    const state = await getYoutubeConnectionStatus();

    expect(state.status).toBe('error');
  });

  it('erro de rede/invoke vira "error" com a mensagem do erro, sem tentar interpretar o corpo', async () => {
    mockState.invokeResult = { data: null, error: { message: 'network failure' } };

    const state = await getYoutubeConnectionStatus();

    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe('network failure');
  });

  it('nunca retorna um status fora do vocabulário do frontend (checagem geral de segurança do tipo)', async () => {
    const validStatuses = ['checking', 'not_connected', 'connected', 'reconnect_required', 'authorization_denied', 'error'];
    mockState.invokeResult = { data: { connected: true, status: 'connected', grantedScopes: [], lastRefreshedAt: null }, error: null };

    const state = await getYoutubeConnectionStatus();

    expect(validStatuses).toContain(state.status);
  });
});
