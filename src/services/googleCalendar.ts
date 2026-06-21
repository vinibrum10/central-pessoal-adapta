/**
 * Integração com Google Calendar (somente leitura)
 *
 * Implementação usando Google Identity Services (GSI) carregado dinamicamente.
 * Não requer client secret — usa OAuth 2.0 com implicit flow para SPAs.
 *
 * Como configurar:
 * 1. Acesse console.cloud.google.com
 * 2. Crie um projeto e habilite a "Google Calendar API"
 * 3. Em "Credenciais", crie um "ID do cliente OAuth 2.0" do tipo "Aplicativo Web"
 * 4. Adicione http://localhost:5173 em "Origens JavaScript autorizadas"
 * 5. Copie o Client ID para a variável VITE_GOOGLE_CLIENT_ID no .env
 *
 * Escopos utilizados: https://www.googleapis.com/auth/calendar.readonly
 */

/// <reference types="vite/client" />
import type { EventoAgenda } from '../types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GSI_URL = 'https://accounts.google.com/gsi/client';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Token em memória apenas — não persiste no LocalStorage
let tokenEmMemoria: string | null = null;

// ============================================================
// VERIFICAÇÃO DE CONFIGURAÇÃO
// ============================================================

export function isGoogleConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_ID.trim() !== '');
}

export function getMensagemNaoConfigurado(): string {
  return 'Google Calendar ainda não configurado. Defina VITE_GOOGLE_CLIENT_ID no arquivo .env para habilitar esta integração.';
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
      // Aguardar carregamento já em andamento
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
    script.onerror = () => reject(new Error('Falha ao carregar script do Google'));
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
      return reject(new Error('Google Identity Services não carregado'));
    }

    const tokenClient = win.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID!,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'Falha na autenticação Google'));
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
// LISTAGEM DE EVENTOS
// ============================================================

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
}

export async function listarEventosGoogle(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  if (!tokenEmMemoria) throw new Error('Não conectado ao Google Calendar');

  const params = new URLSearchParams({
    calendarId: 'primary',
    timeMin: `${dataInicio}T00:00:00Z`,
    timeMax: `${dataFim}T23:59:59Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const resp = await fetch(
    `${CALENDAR_API}/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${tokenEmMemoria}` } }
  );

  if (!resp.ok) {
    if (resp.status === 401) {
      tokenEmMemoria = null;
      throw new Error('Sessão Google expirada. Reconecte.');
    }
    throw new Error(`Erro ao buscar eventos Google: ${resp.status}`);
  }

  const body = await resp.json() as { items?: GoogleEvent[] };
  const items = body.items ?? [];

  return items.map((ev): EventoAgenda => {
    const diaInteiro = Boolean(ev.start.date && !ev.start.dateTime);
    const inicio = ev.start.dateTime ?? `${ev.start.date}T00:00:00`;
    const fim    = ev.end.dateTime   ?? `${ev.end.date}T23:59:59`;

    return {
      id: `google-${ev.id}`,
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
    };
  });
}

export async function sincronizarGoogleCalendar(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  const eventos = await listarEventosGoogle(dataInicio, dataFim);
  return eventos;
}

// ============================================================
// ID ÚNICO — evita duplicatas
// ============================================================

export function deduplicarEventos(
  existentes: EventoAgenda[],
  novos: EventoAgenda[]
): EventoAgenda[] {
  const idsExistentes = new Set(existentes.map(e => e.id));
  return novos.filter(e => !idsExistentes.has(e.id));
}
