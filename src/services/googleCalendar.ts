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
import type { EventoAgenda } from '../types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GSI_URL = 'https://accounts.google.com/gsi/client';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Token em memória — não persiste no LocalStorage
let tokenEmMemoria: string | null = null;

// ============================================================
// VERIFICAÇÃO DE CONFIGURAÇÃO
// ============================================================

export function isGoogleConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_ID.trim() !== '');
}

export function getMensagemNaoConfigurado(): string {
  return 'Google Calendar não configurado. Adicione VITE_GOOGLE_CLIENT_ID nas variáveis de ambiente do Vercel e em .env local para habilitar esta integração.';
}

// ============================================================
// CARREGAMENTO DINÂMICO DO SCRIPT GSI
// ============================================================

function carregarScriptGSI(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Browser não disponível'));
    const win = window as unknown as Record<string, unknown>;
    if (win['google']) return resolve();

    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      const check = setInterval(() => {
        if ((window as unknown as Record<string, unknown>)['google']) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = GSI_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar script do Google Identity Services'));
    document.head.appendChild(script);
  });
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================

export async function conectarGoogleCalendar(): Promise<string> {
  if (!isGoogleConfigured()) {
    throw new Error(getMensagemNaoConfigurado());
  }

  await carregarScriptGSI();

  return new Promise((resolve, reject) => {
    const win = window as unknown as {
      google?: {
        accounts: {
          oauth2: {
            initTokenClient: (config: {
              client_id: string;
              scope: string;
              callback: (resp: { access_token?: string; error?: string }) => void;
            }) => { requestAccessToken: () => void };
          };
        };
      };
    };

    if (!win.google?.accounts?.oauth2) {
      return reject(new Error('Google Identity Services não carregado corretamente'));
    }

    const tokenClient = win.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID!,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          if (resp.error === 'access_denied') {
            reject(new Error('Permissão negada. Você pode conectar novamente a qualquer momento.'));
          } else {
            reject(new Error(resp.error ?? 'Falha na autenticação com o Google'));
          }
          return;
        }
        tokenEmMemoria = resp.access_token;
        resolve(resp.access_token);
      },
    });

    tokenClient.requestAccessToken();
  });
}

export function desconectarGoogleCalendar(): void {
  const win = window as unknown as {
    google?: { accounts: { oauth2: { revoke: (token: string, cb: () => void) => void } } };
  };
  if (tokenEmMemoria && win.google?.accounts?.oauth2) {
    win.google.accounts.oauth2.revoke(tokenEmMemoria, () => {
      tokenEmMemoria = null;
    });
  } else {
    tokenEmMemoria = null;
  }
}

export function isGoogleConectado(): boolean {
  return Boolean(tokenEmMemoria);
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
  if (!tokenEmMemoria) throw new Error('Não conectado ao Google Calendar');

  const resp = await fetch(`${CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${tokenEmMemoria}` },
  });

  if (!resp.ok) {
    if (resp.status === 401) {
      tokenEmMemoria = null;
      throw new Error('Sessão Google expirada. Reconecte.');
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
  const params = new URLSearchParams({
    timeMin: `${dataInicio}T00:00:00Z`,
    timeMax: `${dataFim}T23:59:59Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '500',
  });

  const resp = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${tokenEmMemoria}` } }
  );

  if (!resp.ok) {
    if (resp.status === 401) {
      tokenEmMemoria = null;
      throw new Error('Sessão Google expirada. Reconecte.');
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
  if (!tokenEmMemoria) throw new Error('Não conectado ao Google Calendar');

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
