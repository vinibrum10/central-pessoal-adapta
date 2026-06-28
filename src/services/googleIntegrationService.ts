/// <reference types="vite/client" />
import type { Session } from '@supabase/supabase-js';

const GSI_URL = 'https://accounts.google.com/gsi/client';
const TOKENINFO_URL = 'https://www.googleapis.com/oauth2/v3/tokeninfo';

export type GoogleIntegrationKind = 'calendar' | 'drive';
export type GoogleIntegrationStatus = 'desconectado' | 'permissao_necessaria' | 'conectado' | 'expirado';

type StoredConnection = {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
  source: 'supabase' | 'gsi';
};

type TokenInfo = {
  scope?: string;
  expires_in?: string;
  error_description?: string;
};

const CONFIG: Record<GoogleIntegrationKind, {
  scope: string;
  storageKey: string;
  clientId: string | undefined;
}> = {
  calendar: {
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    storageKey: 'google_calendar_connection',
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined,
  },
  drive: {
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    storageKey: 'google_drive_connection',
    clientId: (import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID) as string | undefined,
  },
};

function getConfig(kind: GoogleIntegrationKind) {
  return CONFIG[kind];
}

export function isGoogleIntegrationConfigured(kind: GoogleIntegrationKind): boolean {
  const clientId = getConfig(kind).clientId;
  return Boolean(clientId && clientId.trim() !== '');
}

export function getGoogleIntegrationScope(kind: GoogleIntegrationKind): string {
  return getConfig(kind).scope;
}

function hasScope(scopes: string[], requiredScope: string): boolean {
  return scopes.includes(requiredScope);
}

export async function inspectGoogleIntegrationToken(kind: GoogleIntegrationKind): Promise<{ present: boolean; valid: boolean; expectedScope: string; scopes: string[] }> {
  const expectedScope = getConfig(kind).scope;
  const token = getStoredGoogleToken(kind);
  if (!token) return { present: false, valid: false, expectedScope, scopes: [] };
  const info = await inspectGoogleToken(token).catch(() => null);
  const scopes = info?.scopes ?? [];
  return { present: true, valid: hasScope(scopes, expectedScope), expectedScope, scopes };
}

function readConnection(kind: GoogleIntegrationKind): StoredConnection | null {
  try {
    const raw = localStorage.getItem(getConfig(kind).storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConnection>;
    if (!parsed.accessToken || !parsed.expiresAt) return null;
    return {
      accessToken: parsed.accessToken,
      expiresAt: parsed.expiresAt,
      scopes: Array.isArray(parsed.scopes) ? parsed.scopes : [getConfig(kind).scope],
      source: parsed.source === 'supabase' ? 'supabase' : 'gsi',
    };
  } catch {
    return null;
  }
}

function saveConnection(
  kind: GoogleIntegrationKind,
  accessToken: string,
  expiresInSeconds = 3600,
  scopes: string[] = [getConfig(kind).scope],
  source: StoredConnection['source'] = 'gsi',
): void {
  const margemSegurancaMs = 60_000;
  const expiresAt = Date.now() + expiresInSeconds * 1000 - margemSegurancaMs;
  localStorage.setItem(getConfig(kind).storageKey, JSON.stringify({ accessToken, expiresAt, scopes, source }));
}

export function clearGoogleIntegration(kind: GoogleIntegrationKind): void {
  localStorage.removeItem(getConfig(kind).storageKey);
}

export function getStoredGoogleToken(kind: GoogleIntegrationKind): string | null {
  const connection = readConnection(kind);
  if (!connection) return null;
  if (connection.expiresAt <= Date.now() || !hasScope(connection.scopes, getConfig(kind).scope)) {
    clearGoogleIntegration(kind);
    return null;
  }
  return connection.accessToken;
}

export function getGoogleIntegrationStatus(kind: GoogleIntegrationKind): GoogleIntegrationStatus {
  if (!isGoogleIntegrationConfigured(kind)) return 'desconectado';
  const connection = readConnection(kind);
  if (!connection) return 'permissao_necessaria';
  if (connection.expiresAt <= Date.now()) {
    clearGoogleIntegration(kind);
    return 'expirado';
  }
  if (!hasScope(connection.scopes, getConfig(kind).scope)) return 'permissao_necessaria';
  return 'conectado';
}

async function loadGsi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Browser não disponível'));
    const win = window as unknown as Record<string, unknown>;
    if (win.google) return resolve();

    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      const check = window.setInterval(() => {
        if ((window as unknown as Record<string, unknown>).google) {
          window.clearInterval(check);
          resolve();
        }
      }, 100);
      window.setTimeout(() => {
        window.clearInterval(check);
        if (!(window as unknown as Record<string, unknown>).google) {
          reject(new Error('Falha ao carregar script do Google Identity Services'));
        }
      }, 10_000);
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

export async function requestGoogleIntegrationToken(
  kind: GoogleIntegrationKind,
  options: { prompt?: string } = {},
): Promise<string> {
  const config = getConfig(kind);
  if (!isGoogleIntegrationConfigured(kind)) {
    throw new Error(kind === 'calendar'
      ? 'Google Calendar não configurado. Adicione VITE_GOOGLE_CLIENT_ID nas variáveis de ambiente.'
      : 'Google Drive não configurado. Configure VITE_GOOGLE_CLIENT_ID ou VITE_GOOGLE_DRIVE_CLIENT_ID.');
  }

  await loadGsi();

  return new Promise((resolve, reject) => {
    const win = window as unknown as {
      google?: {
        accounts: {
          oauth2: {
            initTokenClient: (config: {
              client_id: string;
              scope: string;
              callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
            }) => { requestAccessToken: (override?: { prompt?: string }) => void };
            revoke?: (token: string, cb: () => void) => void;
          };
        };
      };
    };

    if (!win.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services não carregado corretamente'));
      return;
    }

    const tokenClient = win.google.accounts.oauth2.initTokenClient({
      client_id: config.clientId!,
      scope: config.scope,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error === 'access_denied'
            ? 'Permissão negada. Você pode conectar novamente a qualquer momento.'
            : resp.error ?? 'Falha na autenticação com o Google'));
          return;
        }
        inspectGoogleToken(resp.access_token)
          .then(info => {
            const scopes = info?.scopes ?? [config.scope];
            saveConnection(kind, resp.access_token!, resp.expires_in, scopes, 'gsi');
            if (!hasScope(scopes, config.scope)) {
              reject(new Error(`Permissão Google insuficiente. Escopo esperado: ${config.scope}.`));
              return;
            }
            resolve(resp.access_token!);
          })
          .catch(() => {
            saveConnection(kind, resp.access_token!, resp.expires_in, [config.scope], 'gsi');
            resolve(resp.access_token!);
          });
      },
    });

    try {
      tokenClient.requestAccessToken(options.prompt !== undefined ? { prompt: options.prompt } : undefined);
    } catch {
      reject(new Error('Popup bloqueado pelo navegador. Permita popups para este site e tente novamente.'));
    }
  });
}

async function inspectGoogleToken(accessToken: string): Promise<{ scopes: string[]; expiresInSeconds: number } | null> {
  const params = new URLSearchParams({ access_token: accessToken });
  const response = await fetch(`${TOKENINFO_URL}?${params}`);
  if (!response.ok) return null;
  const body = await response.json() as TokenInfo;
  if (body.error_description) return null;
  const scopes = body.scope?.split(/\s+/).filter(Boolean) ?? [];
  const expiresInSeconds = Number(body.expires_in ?? 0);
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) return null;
  return { scopes, expiresInSeconds };
}

export async function bootstrapGoogleIntegrationFromSession(
  kind: GoogleIntegrationKind,
  session: Session | null | undefined,
): Promise<boolean> {
  const provider = session?.user?.app_metadata?.provider;
  const providerToken = session?.provider_token;
  if (provider !== 'google' || !providerToken) return getStoredGoogleToken(kind) !== null;

  try {
    const info = await inspectGoogleToken(providerToken);
    if (!info || !hasScope(info.scopes, getConfig(kind).scope)) return getStoredGoogleToken(kind) !== null;
    saveConnection(kind, providerToken, info.expiresInSeconds, info.scopes, 'supabase');
    return true;
  } catch {
    return getStoredGoogleToken(kind) !== null;
  }
}

export async function ensureGoogleIntegrationToken(
  kind: GoogleIntegrationKind,
  options: { interactive?: boolean; forceConsent?: boolean } = {},
): Promise<string> {
  const stored = getStoredGoogleToken(kind);
  if (stored) return stored;
  if (!options.interactive) {
    throw new Error(kind === 'calendar'
      ? 'Permissão do Google Calendar necessária.'
      : 'Permissão do Google Drive necessária.');
  }
  return requestGoogleIntegrationToken(kind, { prompt: options.forceConsent ? 'consent' : '' });
}

export async function revokeGoogleIntegration(kind: GoogleIntegrationKind): Promise<void> {
  const token = getStoredGoogleToken(kind);
  clearGoogleIntegration(kind);
  if (!token) return;
  await loadGsi().catch(() => undefined);
  const win = window as unknown as {
    google?: { accounts: { oauth2: { revoke?: (token: string, cb: () => void) => void } } };
  };
  if (!win.google?.accounts?.oauth2.revoke) return;
  await new Promise<void>(resolve => win.google!.accounts.oauth2.revoke!(token, resolve));
}
