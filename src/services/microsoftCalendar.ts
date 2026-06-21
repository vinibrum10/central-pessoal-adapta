/**
 * Integração com Microsoft Outlook / Teams Calendar (somente leitura)
 *
 * Usa OAuth 2.0 implicit flow para SPA — sem client secret, sem MSAL.
 * Permissões delegadas: User.Read + Calendars.Read
 *
 * Como configurar:
 * 1. portal.azure.com → Microsoft Entra ID → Registros de Aplicativo
 * 2. Novo Registro → Nome: "Agenda Pessoal" → Tipo: Contas pessoais e corporativas
 * 3. URI de Redirecionamento: SPA → https://central-pessoal-adapta.vercel.app
 * 4. Permissões de API → Adicionar: User.Read + Calendars.Read (Delegado)
 * 5. Copiar "ID do Aplicativo (cliente)" → VITE_MICROSOFT_CLIENT_ID no Vercel
 */

/// <reference types="vite/client" />
import type { EventoAgenda } from '../types';

const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined;

// ============================================================
// CONFIGURAÇÃO E ESTADO
// ============================================================

export function isMicrosoftConfigured(): boolean {
  return Boolean(MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_ID.length > 10);
}

export function getMensagemNaoConfigurado(): string {
  return 'Configure VITE_MICROSOFT_CLIENT_ID nas variáveis de ambiente do Vercel para habilitar o Microsoft Outlook.';
}

export function getMicrosoftToken(): string | null {
  return sessionStorage.getItem('microsoft_access_token');
}

export function isMicrosoftConectado(): boolean {
  return Boolean(getMicrosoftToken());
}

// ============================================================
// AUTENTICAÇÃO — IMPLICIT FLOW (SPA)
// ============================================================

const SCOPES = ['Calendars.Read', 'User.Read'].join(' ');

export async function conectarMicrosoftCalendar(): Promise<boolean> {
  if (!isMicrosoftConfigured()) return false;
  const redirectUri = encodeURIComponent(window.location.origin);
  const nonce = Math.random().toString(36).slice(2);
  const url =
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
    `?client_id=${MICROSOFT_CLIENT_ID}` +
    `&response_type=token` +
    `&redirect_uri=${redirectUri}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&response_mode=fragment` +
    `&nonce=${nonce}`;
  window.location.href = url;
  return true;
}

export function capturarTokenMicrosoftDaURL(): string | null {
  const hash = window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash.replace('#', ''));
  const token = params.get('access_token');
  const error = params.get('error');
  const errorDesc = params.get('error_description');

  if (error) {
    // Limpa o hash independentemente
    window.history.replaceState(null, '', window.location.pathname);
    if (
      errorDesc?.includes('AADSTS65001') ||
      errorDesc?.includes('consent') ||
      error === 'interaction_required'
    ) {
      throw new Error('INSTITUTIONAL_CONSENT_REQUIRED');
    }
    throw new Error(errorDesc ?? error);
  }

  if (token) {
    sessionStorage.setItem('microsoft_access_token', token);
    window.history.replaceState(null, '', window.location.pathname);
  }
  return token;
}

export function desconectarMicrosoftCalendar(): void {
  sessionStorage.removeItem('microsoft_access_token');
}

// ============================================================
// LISTAGEM DE CALENDÁRIOS
// ============================================================

interface CalendarioMicrosoft {
  id: string;
  name: string;
  isDefaultCalendar?: boolean;
}

async function listarCalendariosMicrosoft(token: string): Promise<CalendarioMicrosoft[]> {
  const res = await fetch(
    'https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar&$top=50',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return [{ id: 'primary', name: 'Calendário', isDefaultCalendar: true }];
  const json = await res.json() as { value?: CalendarioMicrosoft[] };
  return json.value ?? [{ id: 'primary', name: 'Calendário', isDefaultCalendar: true }];
}

// ============================================================
// EXTRAÇÃO DE LINK DE REUNIÃO
// ============================================================

interface MicrosoftEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string };
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  isAllDay: boolean;
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string };
  onlineMeetingUrl?: string;
}

function extrairLinkReuniao(ev: MicrosoftEvent): string | undefined {
  // 1. Campo direto onlineMeeting.joinUrl (Teams / Skype)
  if (ev.onlineMeeting?.joinUrl) return ev.onlineMeeting.joinUrl;
  // 2. Campo legado onlineMeetingUrl
  if (ev.onlineMeetingUrl) return ev.onlineMeetingUrl;
  // 3. Busca no corpo do evento (HTML ou texto)
  const corpo = ev.body?.content ?? ev.bodyPreview ?? '';
  const match = corpo.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+/);
  if (match) return match[0];
  // 4. Zoom
  const zoom = corpo.match(/https:\/\/[a-z0-9.]+\.zoom\.us\/[j|w]\/[^\s"'<>]+/);
  if (zoom) return zoom[0];
  return undefined;
}

// ============================================================
// BUSCA DE EVENTOS POR CALENDÁRIO
// ============================================================

async function buscarEventosPorCalendario(
  token: string,
  calendarId: string,
  calendarNome: string,
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  const params = new URLSearchParams({
    startDateTime: `${dataInicio}T00:00:00Z`,
    endDateTime: `${dataFim}T23:59:59Z`,
    $select: 'id,subject,start,end,isAllDay,location,bodyPreview,body,onlineMeeting,onlineMeetingUrl',
    $top: '500',
    $orderby: 'start/dateTime',
  });

  const endpoint = calendarId === 'primary'
    ? `https://graph.microsoft.com/v1.0/me/calendarView?${params}`
    : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${params}`;

  const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 401) {
    desconectarMicrosoftCalendar();
    throw new Error('Sessão Microsoft expirada. Reconecte.');
  }
  // Calendários sem acesso: ignora silenciosamente
  if (res.status === 403 || res.status === 404) return [];
  if (!res.ok) return [];

  const json = await res.json() as { value?: MicrosoftEvent[] };
  return (json.value ?? []).map((ev): EventoAgenda => {
    const diaInteiro = ev.isAllDay;
    const inicio = ev.start.dateTime;
    const fim = ev.end.dateTime;
    const linkReuniao = extrairLinkReuniao(ev);

    return {
      id: `ms-${calendarId}-${ev.id}`,
      fonte: 'microsoft' as const,
      titulo: ev.subject ?? '(sem título)',
      descricao: ev.bodyPreview ?? undefined,
      inicio,
      fim,
      diaInteiro,
      local: ev.location?.displayName ?? undefined,
      bloqueiaTempo: !diaInteiro,
      importadoEm: new Date().toISOString(),
      tarefaGeradaId: null,
      ignorado: false,
      calendarNome,
      linkReuniao,
    };
  });
}

// ============================================================
// API PÚBLICA: LISTAR E SINCRONIZAR EVENTOS
// ============================================================

export async function listarEventosMicrosoft(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  const token = getMicrosoftToken();
  if (!token) return [];

  try {
    // Busca todos os calendários do usuário
    const calendarios = await listarCalendariosMicrosoft(token);

    // Busca eventos de todos os calendários em paralelo
    const resultados = await Promise.all(
      calendarios.map(cal =>
        buscarEventosPorCalendario(token, cal.id, cal.name, dataInicio, dataFim)
      )
    );

    return resultados.flat();
  } catch (e) {
    if (e instanceof Error && e.message.includes('expirada')) {
      desconectarMicrosoftCalendar();
    }
    throw e;
  }
}

export async function sincronizarMicrosoftCalendar(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  return listarEventosMicrosoft(dataInicio, dataFim);
}
