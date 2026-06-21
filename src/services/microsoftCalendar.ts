/**
 * Integração com Microsoft Outlook Calendar (somente leitura)
 *
 * Usa OAuth 2.0 Authorization Code Flow + PKCE (SPA, sem client secret, sem MSAL).
 * Escopos delegados: Calendars.Read, User.Read
 *
 * ─── Configurar no portal.azure.com ─────────────────────────────────────────
 * 1. Microsoft Entra ID → Registros de Aplicativo → Novo Registro
 * 2. Nome: "Central Pessoal ADAPTA"
 * 3. Tipos de conta: "Contas em qualquer diretório organizacional e contas pessoais Microsoft"
 * 4. URI de Redirecionamento: SPA (não "Web") →
 *      https://central-pessoal-adapta.vercel.app
 *      http://localhost:5173
 * 5. API Permissions → Adicionar permissão → Microsoft Graph → Delegadas:
 *      Calendars.Read
 *      User.Read
 * 6. Copiar "ID do Aplicativo (cliente)" → variável VITE_MICROSOFT_CLIENT_ID na Vercel
 *
 * ─── Por que PKCE em vez de Implicit Flow? ──────────────────────────────────
 * A Microsoft deprecou o Implicit Flow (response_type=token) para tokens de acesso.
 * Contas organizacionais (Entra ID) frequentemente bloqueiam esse fluxo.
 * O PKCE não exige client secret e é o padrão recomendado para SPAs.
 * ────────────────────────────────────────────────────────────────────────────
 */

/// <reference types="vite/client" />
import type { EventoAgenda } from '../types';

const CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined;
const GRAPH_API = 'https://graph.microsoft.com/v1.0';
// openid profile necessários para token PKCE; offline_access para refresh (não usado, mas evita erros em alguns tenants)
const SCOPES = 'openid profile Calendars.Read User.Read';
const SESSION_KEY = 'ms_access_token';
const PKCE_VERIFIER_KEY = 'ms_pkce_verifier';

// ============================================================
// CONFIGURAÇÃO / STATUS
// ============================================================

export function isMicrosoftConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_ID.trim().length > 10);
}

export function getMensagemNaoConfigurado(): string {
  return 'Configure VITE_MICROSOFT_CLIENT_ID na Vercel para habilitar Microsoft Outlook.';
}

export function isMicrosoftConectado(): boolean {
  return Boolean(sessionStorage.getItem(SESSION_KEY));
}

function getToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

// ============================================================
// PKCE — geração de code_verifier e code_challenge
// ============================================================

function base64urlEncode(buffer: Uint8Array): string {
  // btoa com Uint8Array
  let bin = '';
  buffer.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function gerarPKCE(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64urlEncode(array);
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const challenge = base64urlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

// ============================================================
// TROCA DE CÓDIGO POR TOKEN (PKCE — sem client secret)
// ============================================================

async function trocarCodigoPorToken(code: string, verifier: string): Promise<string> {
  const redirectUri = window.location.origin;
  const res = await fetch(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        scope: SCOPES,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as {
      error?: string;
      error_description?: string;
    };
    const desc = err.error_description ?? err.error ?? `HTTP ${res.status}`;
    if (desc.includes('AADSTS65001') || desc.includes('consent') || err.error === 'invalid_grant') {
      throw new Error('INSTITUTIONAL_CONSENT_REQUIRED');
    }
    throw new Error(`Erro ao obter token Microsoft: ${desc}`);
  }

  const json = await res.json() as { access_token: string };
  if (!json.access_token) throw new Error('Token Microsoft não retornado.');
  return json.access_token;
}

// ============================================================
// AUTENTICAÇÃO — PKCE + POPUP (sem redirect na página principal)
// ============================================================

export async function conectarMicrosoftCalendar(): Promise<void> {
  if (!isMicrosoftConfigured()) throw new Error(getMensagemNaoConfigurado());

  const { verifier, challenge } = await gerarPKCE();
  // Guarda o verifier para usar após o redirect
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);

  const redirectUri = window.location.origin;
  const authUrl =
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
    `?client_id=${encodeURIComponent(CLIENT_ID!)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&code_challenge=${challenge}` +
    `&code_challenge_method=S256` +
    `&prompt=select_account` +
    `&response_mode=query`;

  const popup = window.open(
    authUrl,
    'ms-oauth-popup',
    'width=520,height=680,left=200,top=100,scrollbars=yes'
  );
  if (!popup) {
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    throw new Error('Popup bloqueado. Habilite popups para este site e tente novamente.');
  }

  return new Promise((resolve, reject) => {
    const TIMEOUT_MS = 120_000;

    const timeout = setTimeout(() => {
      clearInterval(poller);
      try { popup.close(); } catch {}
      sessionStorage.removeItem(PKCE_VERIFIER_KEY);
      reject(new Error('Timeout na autenticação Microsoft (2 min). Tente novamente.'));
    }, TIMEOUT_MS);

    const poller = setInterval(async () => {
      try {
        if (popup.closed) {
          clearInterval(poller);
          clearTimeout(timeout);
          sessionStorage.removeItem(PKCE_VERIFIER_KEY);
          reject(new Error('Autenticação cancelada pelo usuário.'));
          return;
        }

        // DOMException enquanto o popup está no domínio Microsoft — ignorar
        const href = popup.location.href;

        // O popup retornou para nossa origem → tem o código
        if (!href.startsWith(redirectUri)) return;

        clearInterval(poller);
        clearTimeout(timeout);

        const params = new URLSearchParams(popup.location.search);
        const code = params.get('code');
        const error = params.get('error');
        const errorDesc = params.get('error_description') ?? '';

        popup.close();

        if (error) {
          sessionStorage.removeItem(PKCE_VERIFIER_KEY);
          if (
            error === 'access_denied' ||
            errorDesc.includes('AADSTS65001') ||
            errorDesc.includes('consent') ||
            errorDesc.includes('admin')
          ) {
            reject(new Error('INSTITUTIONAL_CONSENT_REQUIRED'));
          } else {
            reject(new Error(errorDesc || error));
          }
          return;
        }

        if (!code) {
          sessionStorage.removeItem(PKCE_VERIFIER_KEY);
          reject(new Error('Código de autorização não recebido. Tente novamente.'));
          return;
        }

        const storedVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY) ?? verifier;
        sessionStorage.removeItem(PKCE_VERIFIER_KEY);

        try {
          const token = await trocarCodigoPorToken(code, storedVerifier);
          sessionStorage.setItem(SESSION_KEY, token);
          resolve();
        } catch (e) {
          reject(e);
        }
      } catch {
        // Cross-origin enquanto navega no domínio Microsoft — ignorar
      }
    }, 400);
  });
}

export function desconectarMicrosoftCalendar(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
}

// ============================================================
// LISTAGEM DE CALENDÁRIOS
// ============================================================

interface MsCalendario {
  id: string;
  name: string;
  isDefaultCalendar?: boolean;
}

async function listarCalendariosMs(): Promise<MsCalendario[]> {
  const token = getToken();
  if (!token) throw new Error('Não conectado ao Microsoft Calendar');

  const res = await fetch(
    `${GRAPH_API}/me/calendars?$select=id,name,isDefaultCalendar&$top=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    if (res.status === 401) {
      desconectarMicrosoftCalendar();
      throw new Error('Sessão Microsoft expirada. Clique em Reconectar.');
    }
    if (res.status === 403) throw new Error('Sem permissão para acessar calendários. Verifique as permissões no Azure.');
    throw new Error(`Erro ao listar calendários: ${res.status}`);
  }

  const json = await res.json() as { value?: MsCalendario[] };
  return json.value ?? [];
}

// ============================================================
// LISTAGEM DE EVENTOS
// ============================================================

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
  // Microsoft às vezes omite o 'Z'; garante UTC
  return dt.endsWith('Z') || dt.includes('+') ? dt : `${dt}Z`;
}

async function buscarEventosCalendarioMs(
  calendarId: string,
  calendarNome: string,
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  const token = getToken();
  if (!token) return [];

  const params = new URLSearchParams({
    startDateTime: `${dataInicio}T00:00:00Z`,
    endDateTime: `${dataFim}T23:59:59Z`,
    '$select': 'id,subject,bodyPreview,start,end,isAllDay,location,onlineMeeting,onlineMeetingUrl',
    '$top': '250',
    '$orderby': 'start/dateTime',
  });

  const res = await fetch(
    `${GRAPH_API}/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${params}`,
    { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } }
  );

  if (!res.ok) {
    if (res.status === 401) { desconectarMicrosoftCalendar(); throw new Error('Sessão Microsoft expirada. Reconecte.'); }
    if (res.status === 403 || res.status === 404) return []; // calendário sem acesso, ignora
    return [];
  }

  const json = await res.json() as { value?: MsEvent[] };
  return (json.value ?? []).map((ev): EventoAgenda => ({
    id: `ms-${calendarId.slice(0, 8)}-${ev.id.slice(-12)}`,
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
  }));
}

// ============================================================
// SINCRONIZAÇÃO PRINCIPAL (todos os calendários)
// ============================================================

export async function sincronizarMicrosoftCalendar(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  const token = getToken();
  if (!token) throw new Error('Não conectado ao Microsoft Calendar');

  let calendarios: MsCalendario[];
  try {
    calendarios = await listarCalendariosMs();
  } catch (e) {
    // Fallback: calendário padrão via /me/calendarView
    if (e instanceof Error && e.message.includes('expirada')) throw e;
    const res = await fetch(
      `${GRAPH_API}/me/calendarView` +
      `?startDateTime=${dataInicio}T00:00:00Z&endDateTime=${dataFim}T23:59:59Z` +
      `&$select=id,subject,bodyPreview,start,end,isAllDay,location,onlineMeeting,onlineMeetingUrl` +
      `&$top=250`,
      { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } }
    );
    if (!res.ok) {
      if (res.status === 401) desconectarMicrosoftCalendar();
      return [];
    }
    const json = await res.json() as { value?: MsEvent[] };
    return (json.value ?? []).map((ev): EventoAgenda => ({
      id: `ms-default-${ev.id.slice(-12)}`,
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
      calendarNome: 'Outlook',
      linkReuniao: extrairLinkMs(ev),
    }));
  }

  const resultados = await Promise.all(
    calendarios.map(c => buscarEventosCalendarioMs(c.id, c.name, dataInicio, dataFim))
  );
  return resultados.flat();
}
