/**
 * Integração com Microsoft Outlook Calendar via Microsoft Graph API.
 *
 * Autenticação: MSAL para SPA, sem client secret no cliente.
 * Escopos delegados mínimos: User.Read, Calendars.Read, offline_access.
 *
 * Configuração no Microsoft Entra:
 * - Tipo de conta: contas em qualquer diretório organizacional e contas pessoais Microsoft.
 * - Redirect URI SPA:
 *   - https://central-pessoal-adapta.vercel.app
 *   - http://localhost:5173
 *   - http://127.0.0.1:5173
 * - Variável de ambiente: VITE_MICROSOFT_CLIENT_ID.
 */

/// <reference types="vite/client" />
import {
  BrowserAuthErrorCodes,
  BrowserCacheLocation,
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';
import type { EventoAgenda } from '../types';

const CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined;
const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['User.Read', 'Calendars.Read', 'offline_access'];
const CONNECTED_KEY = 'ms_graph_connected';
const USER_EMAIL_KEY = 'ms_graph_user_email';
const CONSENT_ERROR_CODE = 'INSTITUTIONAL_CONSENT_REQUIRED';
const INTERACTION_PROGRESS_CODE = 'MICROSOFT_INTERACTION_IN_PROGRESS';
const RECONNECT_REQUIRED_CODE = 'MICROSOFT_RECONNECT_REQUIRED';
const LOGIN_TIMEOUT_CODE = 'MICROSOFT_LOGIN_TIMEOUT';
const ACCESS_DENIED_CODE = 'MICROSOFT_ACCESS_DENIED';
const UNIASSELVI_TENANT_ID = '28ee1771-192d-4a6a-9d2d-d43859ae1aef';

let msalApp: PublicClientApplication | null = null;
let msalInit: Promise<void> | null = null;

export function isMicrosoftConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_ID.trim().length > 10);
}

export function getMensagemNaoConfigurado(): string {
  return 'Configure VITE_MICROSOFT_CLIENT_ID na Vercel para habilitar Microsoft Graph.';
}

function getMsalApp(): PublicClientApplication {
  if (!isMicrosoftConfigured()) {
    throw new Error(getMensagemNaoConfigurado());
  }

  if (!msalApp) {
    msalApp = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID!,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: BrowserCacheLocation.LocalStorage,
      },
    });
  }

  return msalApp;
}

async function ensureMsalReady(): Promise<PublicClientApplication> {
  const app = getMsalApp();
  if (!msalInit) {
    msalInit = app.initialize().then(async () => {
      try {
        const redirectResult = await app.handleRedirectPromise();
        if (redirectResult?.account) {
          setMicrosoftAccount(app, redirectResult.account);
          return;
        }
      } catch (error) {
        throw normalizeMsError(error);
      }

      const account = app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
      if (account) {
        setMicrosoftAccount(app, account);
      }
    });
  }
  await msalInit;
  return app;
}

function getActiveAccount(app: PublicClientApplication): AccountInfo | null {
  return app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
}

export function isMicrosoftConectado(): boolean {
  return localStorage.getItem(CONNECTED_KEY) === 'true';
}

export function getMicrosoftUserEmail(): string | null {
  return localStorage.getItem(USER_EMAIL_KEY);
}

export function gerarLinkConsentimentoAdmin(): string {
  const redirectUri = window.location.origin;
  return (
    `https://login.microsoftonline.com/${UNIASSELVI_TENANT_ID}/v2.0/adminconsent` +
    `?client_id=${encodeURIComponent(CLIENT_ID ?? '')}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(SCOPES.join(' '))}`
  );
}

function isConsentError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message === CONSENT_ERROR_CODE ||
    message.includes('AADSTS65001') ||
    message.includes('AADSTS65004') ||
    message.includes('AADSTS90094') ||
    message.includes('AADSTS90100') ||
    message.toLowerCase().includes('admin consent') ||
    message.toLowerCase().includes('requires administrator approval')
  );
}

function isInteractionInProgressError(error: unknown): boolean {
  const authError = error as { errorCode?: string; message?: string };
  const message = authError.message ?? String(error);
  return (
    authError.errorCode === BrowserAuthErrorCodes.interactionInProgress ||
    message.includes('interaction_in_progress')
  );
}

function isTimedOutError(error: unknown): boolean {
  const authError = error as { errorCode?: string; message?: string };
  const message = authError.message ?? String(error);
  return (
    authError.errorCode === BrowserAuthErrorCodes.timedOut ||
    message.includes('timed_out')
  );
}

function isAccessDeniedError(error: unknown): boolean {
  const authError = error as { errorCode?: string; message?: string };
  const message = authError.message ?? String(error);
  return (
    authError.errorCode === 'access_denied' ||
    message.includes('access_denied')
  );
}

function clearMsalInteractionStatus(): void {
  for (const storage of [localStorage, sessionStorage]) {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (key?.includes('interaction.status')) {
        storage.removeItem(key);
      }
    }
  }
}

function clearMicrosoftLocalState(): void {
  localStorage.removeItem(CONNECTED_KEY);
  localStorage.removeItem(USER_EMAIL_KEY);
  clearMsalInteractionStatus();
}

function normalizeMsError(error: unknown): Error {
  if (isConsentError(error)) {
    clearMicrosoftLocalState();
    return new Error(CONSENT_ERROR_CODE);
  }
  if (isAccessDeniedError(error)) {
    clearMicrosoftLocalState();
    return new Error(ACCESS_DENIED_CODE);
  }
  if (isInteractionInProgressError(error)) {
    clearMicrosoftLocalState();
    return new Error(INTERACTION_PROGRESS_CODE);
  }
  if (isTimedOutError(error)) {
    clearMicrosoftLocalState();
    return new Error(LOGIN_TIMEOUT_CODE);
  }
  return error instanceof Error ? error : new Error(String(error));
}

function setMicrosoftAccount(app: PublicClientApplication, account: AccountInfo): void {
  app.setActiveAccount(account);
  localStorage.setItem(CONNECTED_KEY, 'true');
  localStorage.setItem(USER_EMAIL_KEY, account.username);
}

async function getAccessToken(): Promise<string> {
  const app = await ensureMsalReady();
  const account = getActiveAccount(app);
  if (!account) {
    clearMicrosoftLocalState();
    throw new Error('Não conectado ao Microsoft Calendar');
  }

  try {
    const result = await app.acquireTokenSilent({ account, scopes: SCOPES });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) throw new Error(RECONNECT_REQUIRED_CODE);
    throw normalizeMsError(error);
  }
}

export async function prepararMicrosoftCalendar(): Promise<boolean> {
  const app = await ensureMsalReady();
  const account = getActiveAccount(app);
  if (account) {
    setMicrosoftAccount(app, account);
    return true;
  }
  return false;
}

export async function conectarMicrosoftCalendar(): Promise<boolean> {
  const app = await ensureMsalReady();
  clearMicrosoftLocalState();
  try {
    await app.loginRedirect({
      scopes: SCOPES,
      prompt: 'select_account',
      redirectStartPage: window.location.href,
    });
    return false;
  } catch (error) {
    throw normalizeMsError(error);
  }
}

export function desconectarMicrosoftCalendar(): void {
  clearMicrosoftLocalState();

  if (!isMicrosoftConfigured()) return;
  void ensureMsalReady()
    .then(app => {
      const account = getActiveAccount(app);
      if (account) return app.clearCache({ account });
      return app.clearCache();
    })
    .catch(() => {
      // A limpeza local acima já remove o estado visual de conexão.
    });
}

interface MsCalendario {
  id: string;
  name: string;
  isDefaultCalendar?: boolean;
}

interface MsEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  isAllDay?: boolean;
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string } | null;
  onlineMeetingUrl?: string;
}

function extrairLinkMs(ev: MsEvent): string | undefined {
  return ev.onlineMeeting?.joinUrl ?? ev.onlineMeetingUrl ?? undefined;
}

function normalizarDateTimeMs(dt: string): string {
  return dt.endsWith('Z') || dt.includes('+') ? dt : `${dt}Z`;
}

function mapMsEvent(ev: MsEvent, calendarNome: string, calendarKey: string): EventoAgenda {
  return {
    id: `ms-${calendarKey.slice(0, 12)}-${ev.id.slice(-12)}`,
    fonte: 'microsoft',
    titulo: ev.subject ?? '(Sem título)',
    descricao: ev.bodyPreview,
    inicio: normalizarDateTimeMs(ev.start.dateTime),
    fim: normalizarDateTimeMs(ev.end.dateTime),
    diaInteiro: Boolean(ev.isAllDay),
    local: ev.location?.displayName || undefined,
    bloqueiaTempo: !ev.isAllDay,
    importadoEm: new Date().toISOString(),
    tarefaGeradaId: null,
    ignorado: false,
    calendarNome,
    linkReuniao: extrairLinkMs(ev),
  };
}

async function graphGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GRAPH_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      desconectarMicrosoftCalendar();
      throw new Error('Sessão Microsoft expirada. Clique em Reconectar.');
    }
    if (res.status === 403) {
      throw new Error(CONSENT_ERROR_CODE);
    }
    const details = await res.text().catch(() => '');
    throw new Error(`Erro Microsoft Graph ${res.status}: ${details || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

async function listarCalendariosMs(token: string): Promise<MsCalendario[]> {
  const json = await graphGet<{ value?: MsCalendario[] }>(
    '/me/calendars?$select=id,name,isDefaultCalendar&$top=50',
    token
  );
  return json.value ?? [];
}

async function buscarEventosPathMs(
  path: string,
  token: string,
  calendarNome: string,
  calendarKey: string,
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  const params = new URLSearchParams({
    startDateTime: `${dataInicio}T00:00:00Z`,
    endDateTime: `${dataFim}T23:59:59Z`,
    '$select': 'id,subject,bodyPreview,start,end,isAllDay,location,onlineMeeting,onlineMeetingUrl',
    '$top': '250',
    '$orderby': 'start/dateTime',
  });

  const json = await graphGet<{ value?: MsEvent[] }>(`${path}?${params}`, token);
  return (json.value ?? []).map(ev => mapMsEvent(ev, calendarNome, calendarKey));
}

async function buscarEventosCalendarioMs(
  token: string,
  calendario: MsCalendario,
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  try {
    return await buscarEventosPathMs(
      `/me/calendars/${encodeURIComponent(calendario.id)}/calendarView`,
      token,
      calendario.name,
      calendario.id,
      dataInicio,
      dataFim
    );
  } catch (error) {
    if (error instanceof Error && error.message === CONSENT_ERROR_CODE) throw error;
    return [];
  }
}

export async function sincronizarMicrosoftCalendar(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  try {
    const token = await getAccessToken();

    const eventosPrincipal = await buscarEventosPathMs(
      '/me/calendar/calendarView',
      token,
      'Calendário principal',
      'default',
      dataInicio,
      dataFim
    );

    let calendarios: MsCalendario[] = [];
    try {
      calendarios = await listarCalendariosMs(token);
    } catch (error) {
      if (error instanceof Error && error.message === CONSENT_ERROR_CODE) throw error;
    }

    const extras = await Promise.all(
      calendarios
        .filter(calendario => !calendario.isDefaultCalendar)
        .map(calendario => buscarEventosCalendarioMs(token, calendario, dataInicio, dataFim))
    );

    const porId = new Map<string, EventoAgenda>();
    for (const evento of [...eventosPrincipal, ...extras.flat()]) {
      porId.set(evento.id, evento);
    }

    return [...porId.values()];
  } catch (error) {
    throw normalizeMsError(error);
  }
}
