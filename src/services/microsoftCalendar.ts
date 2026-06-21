import type { EventoAgenda } from '../types';

const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined;

export function isMicrosoftConfigured(): boolean {
  return Boolean(MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_ID.length > 10);
}

export function getMensagemNaoConfigurado(): string {
  return 'Configure VITE_MICROSOFT_CLIENT_ID no .env para habilitar o Microsoft Calendar.';
}

export function getMicrosoftToken(): string | null {
  return sessionStorage.getItem('microsoft_access_token');
}

export function isMicrosoftConectado(): boolean {
  return Boolean(getMicrosoftToken());
}

const SCOPES = ['Calendars.Read', 'User.Read'].join(' ');

export async function conectarMicrosoftCalendar(): Promise<boolean> {
  if (!isMicrosoftConfigured()) return false;
  const redirectUri = encodeURIComponent(window.location.origin);
  const url =
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
    `?client_id=${MICROSOFT_CLIENT_ID}` +
    `&response_type=token` +
    `&redirect_uri=${redirectUri}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&response_mode=fragment`;
  window.location.href = url;
  return true;
}

export function capturarTokenMicrosoftDaURL(): string | null {
  const hash = window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash.replace('#', ''));
  const token = params.get('access_token');
  if (token) {
    sessionStorage.setItem('microsoft_access_token', token);
    window.history.replaceState(null, '', window.location.pathname);
  }
  return token;
}

export function desconectarMicrosoftCalendar(): void {
  sessionStorage.removeItem('microsoft_access_token');
}

export async function listarEventosMicrosoft(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  const token = getMicrosoftToken();
  if (!token) return [];

  const url =
    `https://graph.microsoft.com/v1.0/me/calendarView` +
    `?startDateTime=${dataInicio}T00:00:00Z&endDateTime=${dataFim}T23:59:59Z` +
    `&$select=id,subject,start,end,isAllDay,location,bodyPreview` +
    `&$top=100&$orderby=start/dateTime`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) desconectarMicrosoftCalendar();
    return [];
  }

  const json = await res.json() as {
    value: Array<{
      id: string;
      subject: string;
      start: { dateTime: string };
      end: { dateTime: string };
      isAllDay: boolean;
      location?: { displayName?: string };
      bodyPreview?: string;
    }>;
  };

  return (json.value ?? []).map(ev => ({
    id: `ms-${ev.id}`,
    fonte: 'microsoft' as const,
    titulo: ev.subject ?? '(sem título)',
    descricao: ev.bodyPreview,
    inicio: ev.start.dateTime,
    fim: ev.end.dateTime,
    diaInteiro: ev.isAllDay,
    local: ev.location?.displayName,
    bloqueiaTempo: !ev.isAllDay,
    importadoEm: new Date().toISOString(),
    tarefaGeradaId: null,
    ignorado: false,
  }));
}

export async function sincronizarMicrosoftCalendar(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  return listarEventosMicrosoft(dataInicio, dataFim);
}
