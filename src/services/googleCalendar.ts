/**
 * Integração com Google Calendar (somente leitura)
 *
 * Usa Google Identity Services (GSI) — carregado dinamicamente, sem client secret.
 * Escopo: https://www.googleapis.com/auth/calendar.readonly
 *
 * Como configurar:
 * 1. console.cloud.google.com → habilitar "Google Calendar API"
 * 2. Credenciais → OAuth 2.0 → Aplicativo Web
 * 3. Origens JS autorizadas: http://localhost:5173 e https://central-pessoal-adapta.vercel.app
 * 4. Copiar Client ID → VITE_GOOGLE_CLIENT_ID no .env / Vercel
 */

/// <reference types="vite/client" />
import type { Session } from '@supabase/supabase-js';
import type { EventoAgenda } from '../types';
import {
  bootstrapGoogleIntegrationFromSession,
  clearGoogleIntegration,
  getGoogleIntegrationStatus,
  getStoredGoogleToken,
  isGoogleIntegrationConfigured,
  requestGoogleIntegrationToken,
  revokeGoogleIntegration,
} from './googleIntegrationService';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// ============================================================
// VERIFICAÇÃO DE CONFIGURAÇÃO
// ============================================================

export function isGoogleConfigured(): boolean {
  return isGoogleIntegrationConfigured('calendar');
}

export function getMensagemNaoConfigurado(): string {
  return 'Google Calendar não configurado. Adicione VITE_GOOGLE_CLIENT_ID nas variáveis de ambiente do Vercel e em .env local para habilitar esta integração.';
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================

export async function conectarGoogleCalendar(): Promise<string> {
  if (!isGoogleConfigured()) throw new Error(getMensagemNaoConfigurado());
  return requestGoogleIntegrationToken('calendar', { prompt: '' });
}

export async function reconectarGoogleCalendar(): Promise<string> {
  clearGoogleIntegration('calendar');
  return requestGoogleIntegrationToken('calendar', { prompt: 'consent' });
}

export function desconectarGoogleCalendar(): void {
  void revokeGoogleIntegration('calendar');
}

export function isGoogleConectado(): boolean {
  return getStoredGoogleToken('calendar') !== null;
}

export function getGoogleConnectionStatus(): 'desconectado' | 'permissao_necessaria' | 'conectado' | 'expirado' {
  return getGoogleIntegrationStatus('calendar');
}

export async function prepararGoogleCalendarComSessao(session: Session | null | undefined): Promise<boolean> {
  return bootstrapGoogleIntegrationFromSession('calendar', session);
}

function obterTokenOuErro(): string {
  const token = getStoredGoogleToken('calendar');
  if (!token) {
    throw new Error('Permissão do Google Calendar necessária.');
  }
  return token;
}

// ============================================================
// LISTAGEM DE CALENDÁRIOS
// ============================================================

export interface CalendarioGoogle {
  id: string;
  summary: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
}

export async function listarCalendarios(): Promise<CalendarioGoogle[]> {
  const token = obterTokenOuErro();

  const resp = await fetch(`${CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    if (resp.status === 401) {
      clearGoogleIntegration('calendar');
      throw new Error('Sessão expirada — reconectar Google Calendar');
    }
    throw new Error(`Erro ao listar calendários: ${resp.status}`);
  }

  const body = await resp.json() as { items?: CalendarioGoogle[] };
  return (body.items ?? []).filter(c => c.accessRole !== 'none');
}

// ============================================================
// LISTAGEM DE EVENTOS
// ============================================================

interface ConferenceEntryPoint {
  entryPointType: string;
  uri: string;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: ConferenceEntryPoint[];
  };
}

function extrairLinkReuniao(ev: GoogleEvent): string | undefined {
  if (ev.hangoutLink) return ev.hangoutLink;
  const entry = ev.conferenceData?.entryPoints?.find(
    ep => ep.entryPointType === 'video' || ep.entryPointType === 'phone'
  );
  return entry?.uri;
}

async function buscarEventosCalendario(
  calendarId: string,
  calendarNome: string,
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  const token = obterTokenOuErro();
  const params = new URLSearchParams({
    timeMin: `${dataInicio}T00:00:00Z`,
    timeMax: `${dataFim}T23:59:59Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '500',
  });

  const resp = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) {
    if (resp.status === 401) {
      clearGoogleIntegration('calendar');
      throw new Error('Sessão expirada — reconectar Google Calendar');
    }
    // Calendários sem acesso de leitura retornam 403/404 — ignorar silenciosamente
    if (resp.status === 403 || resp.status === 404) return [];
    throw new Error(`Erro ao buscar eventos (${calendarId}): ${resp.status}`);
  }

  const body = await resp.json() as { items?: GoogleEvent[] };
  const items = body.items ?? [];

  return items.map((ev): EventoAgenda => {
    const diaInteiro = Boolean(ev.start.date && !ev.start.dateTime);
    const inicio = ev.start.dateTime ?? `${ev.start.date}T00:00:00`;
    const fim = ev.end.dateTime ?? `${ev.end.date}T23:59:59`;
    const linkReuniao = extrairLinkReuniao(ev);

    return {
      id: `google-${calendarId}-${ev.id}`,
      fonte: 'google',
      titulo: ev.summary ?? '(Sem título)',
      descricao: ev.description,
      inicio,
      fim,
      diaInteiro,
      local: ev.location,
      bloqueiaTempo: true,
      importadoEm: new Date().toISOString(),
      tarefaGeradaId: null,
      ignorado: false,
      calendarNome,
      linkReuniao,
    };
  });
}

export async function listarEventosTodosCalendarios(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  obterTokenOuErro();

  const calendarios = await listarCalendarios();
  const resultados = await Promise.all(
    calendarios.map(c => buscarEventosCalendario(c.id, c.summary, dataInicio, dataFim))
  );

  return resultados.flat();
}

export async function sincronizarGoogleCalendar(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  return listarEventosTodosCalendarios(dataInicio, dataFim);
}

// ============================================================
// DEDUPLICAÇÃO
// ============================================================

export function deduplicarEventos(
  existentes: EventoAgenda[],
  novos: EventoAgenda[]
): EventoAgenda[] {
  const idsExistentes = new Set(existentes.map(e => e.id));
  return novos.filter(e => !idsExistentes.has(e.id));
}
