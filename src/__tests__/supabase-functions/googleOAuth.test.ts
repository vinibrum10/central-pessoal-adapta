import { describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizationUrl,
  classifyTokenResponse,
  exchangeCodeForTokens,
  refreshAccessToken,
} from '../../../supabase/functions/_shared/googleOAuth';

describe('buildAuthorizationUrl', () => {
  it('inclui access_type=offline e prompt=consent (obrigatórios para reemissão de refresh_token)', () => {
    const url = buildAuthorizationUrl({ clientId: 'cid', redirectUri: 'https://app/callback', state: 'st' });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('access_type')).toBe('offline');
    expect(parsed.searchParams.get('prompt')).toBe('consent');
    expect(parsed.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/youtube.readonly');
    expect(parsed.searchParams.get('state')).toBe('st');
    expect(parsed.searchParams.get('client_id')).toBe('cid');
  });

  it('nunca inclui client_secret na URL de autorização (é pública, vai para o navegador)', () => {
    const url = buildAuthorizationUrl({ clientId: 'cid', redirectUri: 'https://app/callback', state: 'st' });
    expect(url).not.toMatch(/client_secret/i);
  });
});

describe('classifyTokenResponse', () => {
  it('classifica access_denied como "denied"', () => {
    expect(classifyTokenResponse(400, { error: 'access_denied' })).toEqual({
      kind: 'denied',
      message: 'Acesso negado pelo usuário.',
    });
  });

  it('classifica invalid_grant como "invalid_grant" (refresh_token morto — só reautorizar resolve)', () => {
    const result = classifyTokenResponse(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
    expect(result.kind).toBe('invalid_grant');
  });

  it('sucesso extrai access_token, refresh_token e escopos concedidos', () => {
    const result = classifyTokenResponse(200, {
      access_token: 'at-123',
      refresh_token: 'rt-456',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
    });
    expect(result).toEqual({
      kind: 'success',
      accessToken: 'at-123',
      refreshToken: 'rt-456',
      expiresInSeconds: 3600,
      grantedScopes: ['https://www.googleapis.com/auth/youtube.readonly'],
    });
  });

  it('sucesso sem refresh_token no corpo (renovação via refresh_token normalmente não devolve um novo) mapeia refreshToken para null', () => {
    const result = classifyTokenResponse(200, { access_token: 'at-123', expires_in: 3600 });
    expect(result.kind === 'success' && result.refreshToken).toBeNull();
  });

  it('resposta sem access_token e sem error é um erro genérico, nunca sucesso silencioso', () => {
    expect(classifyTokenResponse(200, {})).toEqual({
      kind: 'error',
      message: 'O Google não retornou um access_token.',
      status: 200,
    });
  });
});

describe('exchangeCodeForTokens / refreshAccessToken', () => {
  it('exchangeCodeForTokens nunca inclui o client_secret na URL (vai só no body do POST)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
    });

    await exchangeCodeForTokens(fetchImpl, {
      code: 'auth-code',
      clientId: 'cid',
      clientSecret: 'super-secreto',
      redirectUri: 'https://app/callback',
    });

    const [calledUrl, calledInit] = fetchImpl.mock.calls[0];
    expect(calledUrl).not.toMatch(/super-secreto/);
    expect(calledInit.body).toMatch(/super-secreto/);
  });

  it('refreshAccessToken propaga invalid_grant quando o refresh_token foi revogado', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 400,
      json: async () => ({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }),
    });

    const result = await refreshAccessToken(fetchImpl, {
      refreshToken: 'rt-morto',
      clientId: 'cid',
      clientSecret: 'segredo',
    });

    expect(result.kind).toBe('invalid_grant');
  });

  it('refreshAccessToken em sucesso nunca loga nem retorna o refresh_token usado na chamada', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ access_token: 'novo-at', expires_in: 3600 }),
    });

    const result = await refreshAccessToken(fetchImpl, {
      refreshToken: 'rt-original',
      clientId: 'cid',
      clientSecret: 'segredo',
    });

    expect(JSON.stringify(result)).not.toMatch(/rt-original/);
  });
});
