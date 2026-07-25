// Lógica pura (sem chamadas de rede reais) do Authorization Code Flow do
// Google: construção da URL de autorização e classificação de respostas do
// endpoint de token. As funções que fazem fetch de verdade (exchangeCodeForTokens,
// refreshAccessToken) recebem `fetchImpl` injetado para permanecerem
// testáveis sem depender de rede/Google real.

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const YOUTUBE_READONLY_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

export interface BuildAuthorizationUrlOptions {
  clientId: string;
  redirectUri: string;
  state: string;
}

/**
 * `access_type=offline` + `prompt=consent` juntos garantem que o Google emita
 * um refresh_token mesmo em reautorizações (sem isso, o Google só reemite o
 * refresh_token na primeiríssima concessão de um client_id).
 */
export function buildAuthorizationUrl(options: BuildAuthorizationUrlOptions): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: YOUTUBE_READONLY_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: options.state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export type TokenExchangeResult =
  | { kind: 'success'; accessToken: string; refreshToken: string | null; expiresInSeconds: number; grantedScopes: string[] }
  | { kind: 'denied'; message: string }
  | { kind: 'invalid_grant'; message: string }
  | { kind: 'error'; message: string; status?: number };

/** Classifica a resposta do endpoint de token — usada tanto na troca do
 * authorization code quanto na renovação via refresh_token. */
export function classifyTokenResponse(status: number, body: GoogleTokenResponse): TokenExchangeResult {
  if (body.error) {
    if (body.error === 'access_denied') {
      return { kind: 'denied', message: body.error_description ?? 'Acesso negado pelo usuário.' };
    }
    if (body.error === 'invalid_grant') {
      // refresh_token expirado/revogado/inválido — a única saída é reautorizar do zero.
      return { kind: 'invalid_grant', message: body.error_description ?? 'Autorização inválida, expirada ou revogada.' };
    }
    return { kind: 'error', message: body.error_description ?? `Erro do Google: ${body.error}`, status };
  }
  if (!body.access_token) {
    return { kind: 'error', message: 'O Google não retornou um access_token.', status };
  }
  return {
    kind: 'success',
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresInSeconds: body.expires_in ?? 3600,
    grantedScopes: body.scope ? body.scope.split(/\s+/).filter(Boolean) : [],
  };
}

export interface FetchLike {
  (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{
    status: number;
    json: () => Promise<unknown>;
  }>;
}

export async function exchangeCodeForTokens(
  fetchImpl: FetchLike,
  params: { code: string; clientId: string; clientSecret: string; redirectUri: string },
): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });
  const resp = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await resp.json()) as GoogleTokenResponse;
  return classifyTokenResponse(resp.status, json);
}

export async function refreshAccessToken(
  fetchImpl: FetchLike,
  params: { refreshToken: string; clientId: string; clientSecret: string },
): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: 'refresh_token',
  });
  const resp = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await resp.json()) as GoogleTokenResponse;
  return classifyTokenResponse(resp.status, json);
}
