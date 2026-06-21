/**
 * Integração com Microsoft Outlook Calendar (somente leitura)
 *
 * Usa OAuth 2.0 Implicit Flow com popup — sem redirect, sem client secret.
 * Escopos: Calendars.Read, User.Read
 *
 * Como configurar:
 * 1. portal.azure.com → App registrations → New registration
 * 2. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
 * 3. Redirect URI: Single-page application (SPA) → https://central-pessoal-adapta.vercel.app
 *    e também http://localhost:5173 para dev
 * 4. Permissions → Add: Calendars.Read, User.Read (delegated)
 * 5. Copiar Application (client) ID → VITE_MICROSOFT_CLIENT_ID
 */

/// <reference types="vite/client" />
import type { EventoAgenda } from '../types';

const CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined;
const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'Calendars.Read User.Read';
const SESSION_KEY = 'ms_access_token';

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
// AUTENTICAÇÃO — POPUP (não redireciona a página)
// ============================================================

export async function conectarMicrosoftCalendar(): Promise<string> {
  if (!isMicrosoftConfigured()) throw new Error(getMensagemNaoConfigurado());

  const redirectUri = encodeURIComponent(window.location.origin);
  const authUrl =
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=token` +
    `&redirect_uri=${redirectUri}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&response_mode=fragment` +
    `&prompt=select_account`;

  const popup = window.open(authUrl, 'ms-oauth-popup', 'width=520,height=680,left=200,top=100');
  if (!popup) throw new Error('Popup bloqueado. Habilite popups para este site e tente novamente.');

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(poller);
      try { popup.close(); } catch {}
      reject(new Error('Timeout na autenticação Microsoft (2 min).'));
    }, 120_000);

    const poller = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(poller);
          clearTimeout(timeout);
          reject(new Error('Autenticação cancelada.'));
          return;
        }

        // Tenta ler o hash — vai lançar DOMException enquanto ainda no domínio Microsoft
        const hash = popup.location.hash;
        if (hash && hash.includes('access_token')) {
          const params = new URLSearchParams(hash.replace('#', ''));
          const token = params.get('access_token');
          if (token) {
            sessionStorage.setItem(SESSION_KEY, token);
            popup.close();
            clearInterval(poller);
            clearTimeout(timeout);
            resolve(token);
          }
        }
        if (hash && hash.includes('error')) {
          const params = new URLSearchParams(hash.replace('#', ''));
          const err = params.get('error_description') ?? params.get('error') ?? 'Erro OAuth Microsoft';
          popup.close();
          clearInterval(poller);
          clearTimeout(timeout);
          reject(new Error(err));
        }
      } catch {
        // Cross-origin error enquanto a aba navega — ignorar
      }
    }, 400);
  });
}

export function desconectarMicrosoftCalendar(): void {
  sessionStorage.removeItem(SESSION_KEY);
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

  const res = await fetch(`${GRAPH_API}/me/calendars?$select=id,name,isDefaultCalendar&$top=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) { desconectarMicrosoftCalendar(); throw new Error('Sessão Microsoft expirada. Reconecte.'); }
    throw new Error(`Erro ao listar calendários Microsoft: ${res.status}`);
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
  webLink?: string;
}

function extrairLinkReuniaoms(ev: MsEvent): string | undefined {
  return ev.onlineMeeting?.joinUrl ?? ev.onlineMeetingUrl ?? undefined;
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
    if (res.status === 403 || res.status === 404) return [];
    return [];
  }

  const json = await res.json() as { value?: MsEvent[] };
  return (json.value ?? []).map((ev): EventoAgenda => ({
    id: `ms-${calendarId.slice(0, 8)}-${ev.id.slice(-12)}`,
    fonte: 'microsoft',
    titulo: ev.subject ?? '(Sem título)',
    descricao: ev.bodyPreview,
    inicio: ev.start.dateTime.endsWith('Z') ? ev.start.dateTime : `${ev.start.dateTime}Z`,
    fim: ev.end.dateTime.endsWith('Z') ? ev.end.dateTime : `${ev.end.dateTime}Z`,
    diaInteiro: Boolean(ev.isAllDay),
    local: ev.location?.displayName ?? undefined,
    bloqueiaTempo: !ev.isAllDay,
    importadoEm: new Date().toISOString(),
    tarefaGeradaId: null,
    ignorado: false,
    calendarNome,
    linkReuniao: extrairLinkReuniaoms(ev),
  }));
}

export async function sincronizarMicrosoftCalendar(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  const token = getToken();
  if (!token) throw new Error('Não conectado ao Microsoft Calendar');

  let calendarios: MsCalendario[];
  try {
    calendarios = await listarCalendariosMs();
  } catch {
    // Fallback: tenta só o calendário padrão
    const res = await fetch(
      `${GRAPH_API}/me/calendarView?startDateTime=${dataInicio}T00:00:00Z&endDateTime=${dataFim}T23:59:59Z` +
      `&$select=id,subject,bodyPreview,start,end,isAllDay,location,onlineMeeting&$top=250`,
      { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } }
    );
    if (!res.ok) { if (res.status === 401) desconectarMicrosoftCalendar(); return []; }
    const json = await res.json() as { value?: MsEvent[] };
    return (json.value ?? []).map((ev): EventoAgenda => ({
      id: `ms-${ev.id.slice(-12)}`,
      fonte: 'microsoft',
      titulo: ev.subject ?? '(Sem título)',
      descricao: ev.bodyPreview,
      inicio: ev.start.dateTime.endsWith('Z') ? ev.start.dateTime : `${ev.start.dateTime}Z`,
      fim: ev.end.dateTime.endsWith('Z') ? ev.end.dateTime : `${ev.end.dateTime}Z`,
      diaInteiro: Boolean(ev.isAllDay),
      local: ev.location?.displayName ?? undefined,
      bloqueiaTempo: !ev.isAllDay,
      importadoEm: new Date().toISOString(),
      tarefaGeradaId: null,
      ignorado: false,
      calendarNome: 'Outlook',
      linkReuniao: extrairLinkReuniaoms(ev),
    }));
  }

  const resultados = await Promise.all(
    calendarios.map(c => buscarEventosCalendarioMs(c.id, c.name, dataInicio, dataFim))
  );
  return resultados.flat();
}
