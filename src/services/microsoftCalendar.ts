/**
 * Integração com Microsoft Outlook Calendar via Microsoft Graph
 *
 * Implementação usando MSAL.js carregado dinamicamente (sem npm).
 * Não requer client secret — usa OAuth 2.0 PKCE para SPAs.
 *
 * Como configurar:
 * 1. Acesse portal.azure.com → Azure Active Directory → Registros de aplicativo
 * 2. Clique em "Novo registro" e registre o app como "SPA"
 * 3. Adicione http://localhost:5173 como URI de redirecionamento
 * 4. Em "Permissões de API", adicione Calendars.Read (Microsoft Graph)
 * 5. Copie o "ID do aplicativo (cliente)" para VITE_MICROSOFT_CLIENT_ID no .env
 *
 * Escopos utilizados: Calendars.Read (somente leitura)
 */

/// <reference types="vite/client" />
import type { EventoAgenda } from '../types';

const CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined;
const MSAL_URL = 'https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js';
const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['Calendars.Read', 'User.Read'];

// Token em memória — não persiste no LocalStorage
let tokenEmMemoria: string | null = null;

// ============================================================
// VERIFICAÇÃO DE CONFIGURAÇÃO
// ============================================================

export function isMicrosoftConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_ID.trim() !== '');
}

export function getMensagemNaoConfigurado(): string {
  return 'Microsoft Calendar ainda não configurado. Defina VITE_MICROSOFT_CLIENT_ID no arquivo .env para habilitar esta integração.';
}

// ============================================================
// CARREGAMENTO DINÂMICO DO MSAL
// ============================================================

function carregarMSAL(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Browser não disponível'));
    const win = window as unknown as Record<string, unknown>;
    if (win['msal']) return resolve();

    const existing = document.getElementById('msal-script');
    if (existing) {
      const check = setInterval(() => {
        if ((window as unknown as Record<string, unknown>)['msal']) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.id = 'msal-script';
    script.src = MSAL_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar MSAL.js'));
    document.head.appendChild(script);
  });
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================

export async function conectarMicrosoftCalendar(): Promise<string> {
  if (!isMicrosoftConfigured()) {
    throw new Error(getMensagemNaoConfigurado());
  }

  await carregarMSAL();

  const win = window as unknown as {
    msal?: {
      PublicClientApplication: new (config: {
        auth: { clientId: string; redirectUri: string };
        cache: { cacheLocation: string };
      }) => {
        loginPopup: (req: { scopes: string[] }) => Promise<void>;
        acquireTokenSilent: (req: { scopes: string[]; account: unknown }) => Promise<{ accessToken: string }>;
        acquireTokenPopup: (req: { scopes: string[] }) => Promise<{ accessToken: string }>;
        getAllAccounts: () => unknown[];
      };
    };
  };

  if (!win.msal?.PublicClientApplication) {
    throw new Error('MSAL.js não carregado corretamente');
  }

  const pca = new win.msal.PublicClientApplication({
    auth: {
      clientId: CLIENT_ID!,
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: 'sessionStorage' },
  });

  await pca.loginPopup({ scopes: SCOPES });

  const accounts = pca.getAllAccounts();
  if (!accounts.length) throw new Error('Login Microsoft falhou');

  const result = await pca.acquireTokenSilent({ scopes: SCOPES, account: accounts[0] });
  tokenEmMemoria = result.accessToken;
  return result.accessToken;
}

export function desconectarMicrosoftCalendar(): void {
  tokenEmMemoria = null;
}

export function isMicrosoftConectado(): boolean {
  return Boolean(tokenEmMemoria);
}

// ============================================================
// LISTAGEM DE EVENTOS
// ============================================================

interface MsEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  location?: { displayName?: string };
  start: { dateTime?: string; timeZone?: string };
  end:   { dateTime?: string; timeZone?: string };
  isAllDay?: boolean;
}

export async function listarEventosMicrosoft(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  if (!tokenEmMemoria) throw new Error('Não conectado ao Microsoft Calendar');

  const params = new URLSearchParams({
    startDateTime: `${dataInicio}T00:00:00`,
    endDateTime: `${dataFim}T23:59:59`,
    $top: '250',
    $select: 'id,subject,bodyPreview,location,start,end,isAllDay',
    $orderby: 'start/dateTime',
  });

  const resp = await fetch(
    `${GRAPH_API}/me/calendarView?${params}`,
    { headers: { Authorization: `Bearer ${tokenEmMemoria}`, Prefer: 'outlook.timezone="America/Sao_Paulo"' } }
  );

  if (!resp.ok) {
    if (resp.status === 401) {
      tokenEmMemoria = null;
      throw new Error('Sessão Microsoft expirada. Reconecte.');
    }
    throw new Error(`Erro ao buscar eventos Microsoft: ${resp.status}`);
  }

  const body = await resp.json() as { value?: MsEvent[] };
  const items = body.value ?? [];

  return items.map((ev): EventoAgenda => {
    const diaInteiro = ev.isAllDay ?? false;
    const inicio = ev.start.dateTime ?? `${dataInicio}T00:00:00`;
    const fim    = ev.end.dateTime   ?? `${dataFim}T23:59:59`;

    return {
      id: `ms-${ev.id}`,
      fonte: 'microsoft',
      titulo: ev.subject ?? '(Sem título)',
      descricao: ev.bodyPreview,
      inicio,
      fim,
      diaInteiro,
      local: ev.location?.displayName,
      bloqueiaTempo: true,
      importadoEm: new Date().toISOString(),
      tarefaGeradaId: null,
      ignorado: false,
    };
  });
}

export async function sincronizarMicrosoftCalendar(
  dataInicio: string,
  dataFim: string
): Promise<EventoAgenda[]> {
  return listarEventosMicrosoft(dataInicio, dataFim);
}
