/// <reference types="vite/client" />

// Autorização OAuth do YouTube (escopo youtube.readonly), via Google Identity
// Services Token Model — separada do login principal do SGP (Supabase Auth,
// implicit flow) e também separada de src/services/googleIntegrationService.ts
// (Calendar/Drive), por decisão explícita da especificação aprovada: o token do
// YouTube nunca é persistido, nem em localStorage (diferente do padrão usado por
// Calendar/Drive), nem em nenhum outro lugar.
//
// O carregamento do script do GIS abaixo é a única pequena duplicação técnica
// necessária: `loadGsi` em googleIntegrationService.ts não é exportada (é privada
// daquele módulo), então este arquivo implementa sua própria função equivalente,
// reaproveitando o MESMO id de <script> ('google-gsi-script') e a mesma URL, para
// não carregar o script do Google duas vezes na mesma página caso a integração de
// Calendar/Drive já o tenha carregado.

import {
  YOUTUBE_READONLY_SCOPE,
  type YoutubeAuthState,
  type YoutubeAuthStatus,
} from '../types/dailyVideoEnglish';

const GIS_URL = 'https://accounts.google.com/gsi/client';
const GIS_SCRIPT_ID = 'google-gsi-script';
const GIS_SCRIPT_LOAD_TIMEOUT_MS = 10_000;
const AUTHORIZATION_TIMEOUT_MS = 120_000;
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

type GisTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

// Erro do `error_callback` do GIS — documentado pelo Google como o canal para
// falhas NÃO-OAuth do próprio popup (o token nunca chega a ser emitido):
// 'popup_failed_to_open', 'popup_closed', 'unknown'. Diferente de `callback`,
// que recebe TokenResponse (sucesso e erros OAuth como 'access_denied').
type GisTokenClientError = {
  type?: string;
};

type GisWindow = Window & {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (resp: GisTokenResponse) => void;
          error_callback?: (error: GisTokenClientError) => void;
        }) => { requestAccessToken: (override?: { prompt?: string }) => void };
        hasGrantedAllScopes: (tokenResponse: GisTokenResponse, ...scopes: string[]) => boolean;
      };
    };
  };
};

function getGisWindow(): GisWindow {
  return window as unknown as GisWindow;
}

function getClientId(): string | null {
  const raw = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  return raw ? raw : null;
}

// ------------------------------------------------------------------
// Estado em memória. Duas variáveis SEPARADAS de propósito:
//
// - `state` (YoutubeAuthState): publicado para listeners/componentes via
//   subscribeToYoutubeAuthState()/getYoutubeAuthState(). Só contém informação
//   não sensível (status, expiração, escopos concedidos, mensagem de erro).
// - `privateAccessToken`: o token de verdade. Módulo-privado, nunca exportado
//   diretamente, nunca colocado dentro de `state`, nunca gravado em
//   localStorage/sessionStorage/cookies próprios/IndexedDB/localForage/
//   Supabase/arquivos/logs/URLs. A ÚNICA forma de obter o valor é
//   getInMemoryYoutubeAccessToken() — usada só pelo cliente da API
//   (youtubeApiClient.ts) para montar o header Authorization.
//
// Ambas desaparecem ao recarregar a página (o módulo é reinicializado do zero).
// ------------------------------------------------------------------
function baseState(status: YoutubeAuthStatus, overrides: Partial<Omit<YoutubeAuthState, 'status'>> = {}): YoutubeAuthState {
  return {
    status,
    expiresAt: null,
    grantedScopes: [],
    errorMessage: null,
    ...overrides,
  };
}

let state: YoutubeAuthState = baseState('gis_loading');
let privateAccessToken: string | null = null;
const listeners = new Set<(state: YoutubeAuthState) => void>();

function setState(status: YoutubeAuthStatus, overrides: Partial<Omit<YoutubeAuthState, 'status'>> = {}): void {
  // Construção sempre a partir de um objeto novo e completo (nunca merge parcial
  // com o estado anterior) — evita que campos de uma transição anterior
  // sobrevivam silenciosamente a uma transição que deveria limpá-los.
  state = baseState(status, overrides);
  for (const listener of listeners) listener(state);
}

function setPrivateAccessToken(token: string | null): void {
  privateAccessToken = token;
}

export function getYoutubeAuthState(): YoutubeAuthState {
  return state;
}

export function subscribeToYoutubeAuthState(listener: (state: YoutubeAuthState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Só para testes — reinicializa o estado, o token privado e a promise de carregamento do script. */
export function __resetYoutubeAuthStateForTests(): void {
  gisLoadPromise = null;
  privateAccessToken = null;
  state = baseState('gis_loading');
}

// ------------------------------------------------------------------
// Carregamento do script do GIS — passivo: não abre popup nem solicita
// consentimento. Pode ser chamado proativamente por uma futura tela (ex.: ao
// montar o passo de conexão) para deixar o botão de autorizar pronto mais rápido.
// ------------------------------------------------------------------
let gisLoadPromise: Promise<void> | null = null;

export function preloadGoogleIdentityServices(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;

  const win = getGisWindow();
  if (win.google?.accounts?.oauth2) {
    setState('ready');
    gisLoadPromise = Promise.resolve();
    return gisLoadPromise;
  }

  setState('gis_loading');

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const finish = (err?: Error) => {
      if (err) {
        setState('config_error', { errorMessage: err.message });
        reject(err);
        return;
      }
      setState('ready');
      resolve();
    };

    const existing = document.getElementById(GIS_SCRIPT_ID);
    if (existing) {
      const check = window.setInterval(() => {
        if (getGisWindow().google?.accounts?.oauth2) {
          window.clearInterval(check);
          finish();
        }
      }, 100);
      window.setTimeout(() => {
        window.clearInterval(check);
        if (!getGisWindow().google?.accounts?.oauth2) {
          finish(new Error('Falha ao carregar o Google Identity Services.'));
        }
      }, GIS_SCRIPT_LOAD_TIMEOUT_MS);
      return;
    }

    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => finish();
    script.onerror = () => finish(new Error('Falha ao carregar o script do Google Identity Services.'));
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

// ------------------------------------------------------------------
// Autorização — só deve ser iniciada a partir de uma ação explícita do usuário
// (clique em "Conectar YouTube" / "Reconectar YouTube" / "Autorizar acesso ao
// YouTube"). Este módulo nunca se auto-invoca.
// ------------------------------------------------------------------
/**
 * Canal REAL (documentado pelo Google) para falhas do próprio popup que nunca
 * chegam a emitir um token — 'popup_failed_to_open', 'popup_closed', ou
 * qualquer outro valor ('unknown' incluso) tratado genericamente. É este
 * callback, e não `callback`/handleTokenResponse, quem o GIS efetivamente
 * invoca nesses casos. Sempre finaliza a Promise pendente de requestToken
 * (via finishOnce, no chamador) e nunca abre um novo popup sozinho.
 */
function handleTokenClientError(error: GisTokenClientError): void {
  setPrivateAccessToken(null);
  const type = error?.type;

  if (type === 'popup_failed_to_open') {
    setState('popup_failed_to_open', { errorMessage: 'Não foi possível abrir a janela de autorização do Google. Verifique se pop-ups estão bloqueados.' });
    return;
  }
  if (type === 'popup_closed') {
    setState('popup_closed', { errorMessage: 'A janela de autorização do Google foi fechada antes de concluir.' });
    return;
  }
  // 'unknown' ou qualquer tipo não reconhecido.
  setState('unknown_error', { errorMessage: type ? `Erro do Google (${type}) ao abrir a janela de autorização.` : 'Erro desconhecido do Google ao abrir a janela de autorização.' });
}

function handleTokenResponse(resp: GisTokenResponse): void {
  if (resp.error) {
    const reason = resp.error;
    setPrivateAccessToken(null);

    // Tratamento DEFENSIVO — mantido como rede de segurança, mas não é mais o
    // canal real para estes três casos (isso agora é handleTokenClientError,
    // via error_callback, configurado em requestToken). Se algum dia o GIS
    // entregar um destes valores por aqui em vez de error_callback, ainda
    // assim classificamos corretamente em vez de cair no branch genérico.
    if (reason === 'popup_failed_to_open') {
      setState('popup_failed_to_open', { errorMessage: 'Não foi possível abrir a janela de autorização do Google. Verifique se pop-ups estão bloqueados.' });
      return;
    }
    if (reason === 'popup_closed' || reason === 'popup_closed_by_user') {
      setState('popup_closed', { errorMessage: 'A janela de autorização do Google foi fechada antes de concluir.' });
      return;
    }
    // 'access_denied' É um erro OAuth de verdade (o usuário viu a tela de
    // consentimento do Google e negou) — este SIM chega por `callback`, não
    // por `error_callback`, por isso continua tratado aqui como canal real.
    if (reason === 'access_denied') {
      setState('authorization_denied', { errorMessage: 'Você negou a permissão de leitura do YouTube na tela de consentimento do Google.' });
      return;
    }
    setState('unknown_error', { errorMessage: resp.error_description ?? `Erro do Google ao autorizar: ${reason}` });
    return;
  }

  if (!resp.access_token) {
    setPrivateAccessToken(null);
    setState('unknown_error', { errorMessage: 'O Google não retornou um token de acesso.' });
    return;
  }

  const win = getGisWindow();
  const grantedAll = Boolean(win.google?.accounts?.oauth2.hasGrantedAllScopes(resp, YOUTUBE_READONLY_SCOPE));
  const grantedScopes = resp.scope ? resp.scope.split(/\s+/).filter(Boolean) : [];

  if (!grantedAll) {
    setPrivateAccessToken(null);
    setState('insufficient_scope', {
      grantedScopes,
      errorMessage: 'A permissão de leitura do YouTube (youtube.readonly) não foi concedida.',
    });
    return;
  }

  const expiresInSeconds = resp.expires_in ?? 3600;
  setPrivateAccessToken(resp.access_token);
  setState('authorized', {
    expiresAt: Date.now() + expiresInSeconds * 1000 - EXPIRY_SAFETY_MARGIN_MS,
    grantedScopes: grantedScopes.length > 0 ? grantedScopes : [YOUTUBE_READONLY_SCOPE],
  });
}

async function requestToken(forceConsent: boolean): Promise<YoutubeAuthState> {
  const clientId = getClientId();
  if (!clientId) {
    setState('config_error', { errorMessage: 'VITE_GOOGLE_CLIENT_ID não está configurado.' });
    return state;
  }

  try {
    await preloadGoogleIdentityServices();
  } catch {
    return state; // preloadGoogleIdentityServices já deixou o estado em 'config_error'.
  }

  setState('authorizing');

  return new Promise<YoutubeAuthState>(resolve => {
    const win = getGisWindow();
    if (!win.google?.accounts?.oauth2) {
      setState('config_error', { errorMessage: 'Google Identity Services indisponível após o carregamento do script.' });
      resolve(state);
      return;
    }

    // Controle único de finalização da Promise: tanto `callback` (TokenResponse
    // — sucesso ou erro OAuth) quanto `error_callback` (falha do popup em si)
    // quanto o timeout defensivo quanto uma exceção síncrona de
    // requestAccessToken passam por aqui — garante que a Promise resolve
    // exatamente uma vez e que o timeout é sempre limpo, não importa qual das
    // quatro vias dispare primeiro.
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      // Sem nenhuma evidência real de que o popup foi fechado (nem `callback`
      // nem `error_callback` dispararam) — por isso um estado PRÓPRIO
      // ('authorization_timeout'), nunca 'popup_closed': não sabemos o que
      // aconteceu de fato (aba trocada, popup ainda aberto e esquecido, rede
      // lenta na tela de consentimento, etc.).
      finishOnce(() => {
        setPrivateAccessToken(null);
        setState('authorization_timeout', { errorMessage: 'A autorização não foi concluída a tempo. Tente novamente.' });
      });
    }, AUTHORIZATION_TIMEOUT_MS);

    function finishOnce(run: () => void): void {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      run();
      resolve(state);
    }

    const tokenClient = win.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: YOUTUBE_READONLY_SCOPE,
      callback: resp => finishOnce(() => handleTokenResponse(resp)),
      error_callback: error => finishOnce(() => handleTokenClientError(error)),
    });

    try {
      // Sem `prompt` na chamada normal: se o escopo já foi concedido antes, o
      // GIS pode devolver o token silenciosamente, sem novo popup.
      tokenClient.requestAccessToken(forceConsent ? { prompt: 'consent' } : undefined);
    } catch {
      // Falha síncrona ao chamar requestAccessToken (raro; a maioria dos
      // bloqueios de popup chega de forma assíncrona via error_callback acima).
      finishOnce(() => {
        setPrivateAccessToken(null);
        setState('popup_failed_to_open', { errorMessage: 'Não foi possível abrir a janela de autorização do Google. Verifique se pop-ups estão bloqueados.' });
      });
    }
  });
}

/**
 * Autorização normal — nunca força novo consentimento. Se o escopo já foi
 * concedido antes (mesmo client_id, sessão Google ativa), o GIS pode devolver
 * o token sem exibir a tela de consentimento. Deve ser chamada só a partir de
 * um clique explícito do usuário (ex.: "Conectar YouTube"/"Reconectar YouTube").
 */
export function authorizeYoutube(): Promise<YoutubeAuthState> {
  return requestToken(false);
}

/**
 * Força `prompt: 'consent'`. Só deve ser chamada a partir de um NOVO clique
 * explícito do usuário (ex.: botão "Autorizar acesso ao YouTube" mostrado quando
 * o estado é 'insufficient_scope') — nunca automaticamente após uma tentativa
 * normal falhar.
 */
export function authorizeYoutubeWithConsent(): Promise<YoutubeAuthState> {
  return requestToken(true);
}

/**
 * API INTERNA da camada de serviços — única forma de ler o access token real.
 * Chamada exclusivamente por youtubeApiClient.ts (internamente, dentro de
 * youtubeApiGet) para montar o header Authorization. NUNCA deve ser chamada
 * pela interface (telas/componentes da Etapa 3) nem por qualquer código que
 * transporte, exiba ou persista o valor retornado — a interface não tem
 * motivo para conhecer o token; ela consome só os resultados tipados das
 * funções de descoberta/leitura, que já resolvem o token por conta própria.
 * O valor nunca é exposto através de `state`/dos listeners.
 *
 * Retorna null se ausente/expirado; ao detectar expiração local, já
 * transiciona o estado para 'token_invalid' e limpa o token privado, em vez
 * de devolver um valor que a API rejeitaria de qualquer forma.
 */
export function getInMemoryYoutubeAccessToken(): string | null {
  if (state.status !== 'authorized' || !privateAccessToken || !state.expiresAt) return null;
  if (state.expiresAt <= Date.now()) {
    setPrivateAccessToken(null);
    setState('token_invalid', { errorMessage: 'O token de acesso ao YouTube expirou.' });
    return null;
  }
  return privateAccessToken;
}

/**
 * Deve ser chamada pelo cliente da API (youtubeApiClient.ts) ao receber um 401
 * da YouTube Data API — limpa o token privado e move o estado público para
 * 'token_invalid'. Nunca reabre o popup sozinha.
 */
export function notifyYoutubeTokenRejected(): void {
  setPrivateAccessToken(null);
  setState('token_invalid', { errorMessage: 'O token de acesso ao YouTube foi rejeitado pela API (401).' });
}
