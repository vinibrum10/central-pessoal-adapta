import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetYoutubeAuthStateForTests,
  authorizeYoutube,
  authorizeYoutubeWithConsent,
  getInMemoryYoutubeAccessToken,
  getYoutubeAuthState,
  notifyYoutubeTokenRejected,
  subscribeToYoutubeAuthState,
} from './youtubeAuth';

type MockTokenClientConfig = {
  client_id: string;
  scope: string;
  callback: (resp: { access_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string }) => void;
  error_callback?: (error: { type?: string }) => void;
};

function installMockGis(options: {
  hasGrantedAllScopes?: boolean;
  onRequestAccessToken?: (override: { prompt?: string } | undefined, config: MockTokenClientConfig) => void;
} = {}) {
  const initTokenClient = vi.fn((config: MockTokenClientConfig) => ({
    requestAccessToken: vi.fn((override?: { prompt?: string }) => {
      options.onRequestAccessToken?.(override, config);
    }),
  }));
  const hasGrantedAllScopes = vi.fn().mockReturnValue(options.hasGrantedAllScopes ?? true);

  (window as unknown as { google: unknown }).google = {
    accounts: { oauth2: { initTokenClient, hasGrantedAllScopes } },
  };

  return { initTokenClient, hasGrantedAllScopes };
}

describe('youtubeAuth', () => {
  beforeEach(() => {
    __resetYoutubeAuthStateForTests();
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client.apps.googleusercontent.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    delete (window as unknown as { google?: unknown }).google;
  });

  it('fica em config_error quando VITE_GOOGLE_CLIENT_ID não está configurado', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    installMockGis();

    const state = await authorizeYoutube();

    expect(state.status).toBe('config_error');
    expect(getInMemoryYoutubeAccessToken()).toBeNull();
  });

  it('autoriza com sucesso quando o token vem com o escopo concedido (hasGrantedAllScopes = true)', async () => {
    installMockGis({
      hasGrantedAllScopes: true,
      onRequestAccessToken: (_override, config) => {
        config.callback({ access_token: 'abc123', expires_in: 3600, scope: 'https://www.googleapis.com/auth/youtube.readonly' });
      },
    });

    const state = await authorizeYoutube();

    expect(state.status).toBe('authorized');
    expect(getInMemoryYoutubeAccessToken()).toBe('abc123');
  });

  it('vai para insufficient_scope quando hasGrantedAllScopes retorna false, mesmo com access_token presente', async () => {
    installMockGis({
      hasGrantedAllScopes: false,
      onRequestAccessToken: (_override, config) => {
        config.callback({ access_token: 'abc123', expires_in: 3600, scope: 'openid' });
      },
    });

    const state = await authorizeYoutube();

    expect(state.status).toBe('insufficient_scope');
    expect(getInMemoryYoutubeAccessToken()).toBeNull();
  });

  // -----------------------------------------------------------------
  // error_callback: canal REAL do GIS para falhas do próprio popup (nunca
  // chega a emitir token). Distinto de `callback`, que só recebe TokenResponse
  // (sucesso ou erro OAuth, ex.: 'access_denied' — ver teste logo abaixo).
  // -----------------------------------------------------------------
  it('error_callback com type "popup_failed_to_open" move o estado para popup_failed_to_open, resolve a Promise de authorizeYoutube() e não abre outro popup automaticamente', async () => {
    const { initTokenClient } = installMockGis({
      onRequestAccessToken: (_override, config) => config.error_callback!({ type: 'popup_failed_to_open' }),
    });

    const state = await authorizeYoutube();

    expect(state.status).toBe('popup_failed_to_open');
    expect(getInMemoryYoutubeAccessToken()).toBeNull();
    expect(initTokenClient).toHaveBeenCalledTimes(1);
  });

  it('error_callback com type "popup_closed" move o estado para popup_closed, resolve a Promise de authorizeYoutube() e não abre outro popup automaticamente', async () => {
    const { initTokenClient } = installMockGis({
      onRequestAccessToken: (_override, config) => config.error_callback!({ type: 'popup_closed' }),
    });

    const state = await authorizeYoutube();

    expect(state.status).toBe('popup_closed');
    expect(getInMemoryYoutubeAccessToken()).toBeNull();
    expect(initTokenClient).toHaveBeenCalledTimes(1);
  });

  it('error_callback com type "unknown" move o estado para unknown_error, resolve a Promise de authorizeYoutube() e não abre outro popup automaticamente', async () => {
    const { initTokenClient } = installMockGis({
      onRequestAccessToken: (_override, config) => config.error_callback!({ type: 'unknown' }),
    });

    const state = await authorizeYoutube();

    expect(state.status).toBe('unknown_error');
    expect(getInMemoryYoutubeAccessToken()).toBeNull();
    expect(initTokenClient).toHaveBeenCalledTimes(1);
  });

  it('error_callback com um type completamente desconhecido (nem documentado) também cai em unknown_error, nunca fica pendente', async () => {
    const { initTokenClient } = installMockGis({
      onRequestAccessToken: (_override, config) => config.error_callback!({ type: 'algo-novo-que-o-google-inventou' }),
    });

    const state = await authorizeYoutube();

    expect(state.status).toBe('unknown_error');
    expect(initTokenClient).toHaveBeenCalledTimes(1);
  });

  it('mapeia error: "access_denied" do callback do GIS (canal REAL para erros OAuth, distinto de error_callback) para authorization_denied (distinto de insufficient_scope)', async () => {
    installMockGis({
      onRequestAccessToken: (_override, config) => config.callback({ error: 'access_denied' }),
    });

    const state = await authorizeYoutube();

    expect(state.status).toBe('authorization_denied');
  });

  it('authorization_denied (access_denied) e insufficient_scope (hasGrantedAllScopes=false) nunca se confundem', async () => {
    installMockGis({
      onRequestAccessToken: (_override, config) => config.callback({ error: 'access_denied' }),
    });
    const denied = await authorizeYoutube();
    expect(denied.status).toBe('authorization_denied');

    __resetYoutubeAuthStateForTests();

    installMockGis({
      hasGrantedAllScopes: false,
      onRequestAccessToken: (_override, config) => config.callback({ access_token: 'abc', expires_in: 3600 }),
    });
    const insufficient = await authorizeYoutube();
    expect(insufficient.status).toBe('insufficient_scope');
  });

  it('authorizeYoutube() NÃO força prompt: "consent" (chamada normal)', async () => {
    let capturedOverride: { prompt?: string } | undefined = { prompt: 'sentinel' };
    installMockGis({
      onRequestAccessToken: (override, config) => {
        capturedOverride = override;
        config.callback({ access_token: 't', expires_in: 3600 });
      },
    });

    await authorizeYoutube();

    expect(capturedOverride).toBeUndefined();
  });

  it('authorizeYoutubeWithConsent() força prompt: "consent" e só deve ser chamada por um novo clique explícito (nunca automaticamente)', async () => {
    let capturedOverride: { prompt?: string } | undefined;
    installMockGis({
      onRequestAccessToken: (override, config) => {
        capturedOverride = override;
        config.callback({ access_token: 't', expires_in: 3600 });
      },
    });

    // Simula: uma tentativa normal falhou com insufficient_scope...
    installMockGis({
      hasGrantedAllScopes: false,
      onRequestAccessToken: (_override, config) => config.callback({ access_token: 'x', expires_in: 3600 }),
    });
    const first = await authorizeYoutube();
    expect(first.status).toBe('insufficient_scope');

    // ...e authorizeYoutubeWithConsent() só é chamada aqui, como um NOVO clique
    // explícito simulado — nunca dentro de authorizeYoutube() automaticamente.
    installMockGis({
      onRequestAccessToken: (override, config) => {
        capturedOverride = override;
        config.callback({ access_token: 't', expires_in: 3600 });
      },
    });
    await authorizeYoutubeWithConsent();

    expect(capturedOverride).toEqual({ prompt: 'consent' });
  });

  it('trata exceção síncrona ao abrir o popup (ex.: bloqueado pelo navegador) como popup_failed_to_open', async () => {
    const initTokenClient = vi.fn(() => ({
      requestAccessToken: vi.fn(() => {
        throw new Error('popup blocked');
      }),
    }));
    (window as unknown as { google: unknown }).google = {
      accounts: { oauth2: { initTokenClient, hasGrantedAllScopes: vi.fn() } },
    };

    const state = await authorizeYoutube();

    expect(state.status).toBe('popup_failed_to_open');
  });

  it('quando o timeout defensivo expira sem nenhuma evidência de fechamento, vai para authorization_timeout — NUNCA popup_closed', async () => {
    vi.useFakeTimers();
    // Nem `callback` nem `error_callback` disparam — simula um popup que nunca
    // recebe resposta (aba trocada, tela de consentimento travada, etc.).
    installMockGis({ onRequestAccessToken: () => undefined });

    const promise = authorizeYoutube();
    await vi.advanceTimersByTimeAsync(120_000);
    const state = await promise;

    expect(state.status).toBe('authorization_timeout');
    expect(state.status).not.toBe('popup_closed');
    expect(state.errorMessage).toBe('A autorização não foi concluída a tempo. Tente novamente.');
  });

  it('getInMemoryYoutubeAccessToken retorna null e move o estado para token_invalid quando o token expira', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T10:00:00Z'));

    installMockGis({
      onRequestAccessToken: (_override, config) => {
        // expires_in pequeno para expirar rápido mesmo com a margem de segurança de 60s.
        config.callback({ access_token: 'short-lived', expires_in: 61 });
      },
    });

    const authorized = await authorizeYoutube();
    expect(authorized.status).toBe('authorized');

    vi.setSystemTime(new Date('2026-07-24T10:05:00Z'));

    expect(getInMemoryYoutubeAccessToken()).toBeNull();
    expect(getYoutubeAuthState().status).toBe('token_invalid');
  });

  it('notifyYoutubeTokenRejected limpa o token em memória e move o estado para token_invalid', async () => {
    installMockGis({
      onRequestAccessToken: (_override, config) => config.callback({ access_token: 'abc', expires_in: 3600 }),
    });
    await authorizeYoutube();
    expect(getYoutubeAuthState().status).toBe('authorized');
    expect(getInMemoryYoutubeAccessToken()).toBe('abc');

    notifyYoutubeTokenRejected();

    expect(getYoutubeAuthState().status).toBe('token_invalid');
    expect(getInMemoryYoutubeAccessToken()).toBeNull();
  });

  it('o token desaparece após "recarregar a página" (reset do módulo)', async () => {
    installMockGis({
      onRequestAccessToken: (_override, config) => config.callback({ access_token: 'abc', expires_in: 3600 }),
    });
    await authorizeYoutube();
    expect(getInMemoryYoutubeAccessToken()).toBe('abc');

    __resetYoutubeAuthStateForTests();

    expect(getYoutubeAuthState().status).toBe('gis_loading');
    expect(getInMemoryYoutubeAccessToken()).toBeNull();
  });

  it('notifica os inscritos a cada transição de estado', async () => {
    const seen: string[] = [];
    const unsubscribe = subscribeToYoutubeAuthState(state => seen.push(state.status));

    installMockGis({
      onRequestAccessToken: (_override, config) => config.callback({ access_token: 'abc', expires_in: 3600 }),
    });
    await authorizeYoutube();

    expect(seen).toContain('ready');
    expect(seen).toContain('authorizing');
    expect(seen).toContain('authorized');

    unsubscribe();
  });

  it('o estado público (getYoutubeAuthState) e todo estado publicado aos listeners NUNCA contêm o access token', async () => {
    const publishedStates: Array<Record<string, unknown>> = [];
    const unsubscribe = subscribeToYoutubeAuthState(state => publishedStates.push(state as unknown as Record<string, unknown>));

    installMockGis({
      onRequestAccessToken: (_override, config) => config.callback({ access_token: 'super-secret-abc', expires_in: 3600 }),
    });
    const finalState = await authorizeYoutube();

    // Estado retornado diretamente por authorizeYoutube()/getYoutubeAuthState().
    expect(finalState).not.toHaveProperty('accessToken');
    expect(Object.keys(getYoutubeAuthState() as unknown as Record<string, unknown>)).not.toContain('accessToken');
    expect(JSON.stringify(finalState)).not.toContain('super-secret-abc');

    // Todo estado publicado aos inscritos, em toda transição (gis_loading -> ready
    // -> authorizing -> authorized), também nunca carrega o token.
    expect(publishedStates.length).toBeGreaterThan(0);
    for (const published of publishedStates) {
      expect(published).not.toHaveProperty('accessToken');
      expect(JSON.stringify(published)).not.toContain('super-secret-abc');
    }

    unsubscribe();
  });
});
