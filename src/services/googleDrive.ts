/**
 * Integração com Google Drive (somente leitura de metadados).
 *
 * Configuração:
 * 1. Habilite "Google Drive API" no mesmo projeto do Google Calendar.
 * 2. Configure VITE_GOOGLE_CLIENT_ID ou VITE_GOOGLE_DRIVE_CLIENT_ID.
 * 3. Configure VITE_GOOGLE_DRIVE_FOLDER_ID com o ID da pasta no Drive.
 *
 * NUNCA coloque client_secret no frontend.
 */

/// <reference types="vite/client" />
import type { LeituraDiaria, TipoLeitura } from '../types';
import { gerarId, hojeISO } from '../utils';

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID) as string | undefined;
const DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID as string | undefined;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GSI_URL = 'https://accounts.google.com/gsi/client';
const STORAGE_KEY = 'google_drive_connection';

type DriveConnectionState = {
  accessToken: string;
  expiresAt: number;
};

export function isDriveConfigurado(): boolean {
  return Boolean(DRIVE_FOLDER_ID && DRIVE_FOLDER_ID.trim() !== '');
}

export function getMensagemDriveNaoConfigurado(): string {
  return 'Google Drive não configurado. Configure VITE_GOOGLE_DRIVE_FOLDER_ID e conecte sua conta Google para sincronizar leituras.';
}

function carregarScriptGSI(): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = window as unknown as Record<string, unknown>;
    if (win.google) return resolve();

    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      const check = setInterval(() => {
        if ((window as unknown as Record<string, unknown>).google) {
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

function lerEstado(): DriveConnectionState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DriveConnectionState>;
    if (!parsed.accessToken || !parsed.expiresAt) return null;
    return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function salvarEstado(accessToken: string, expiresInSeconds = 3600): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000 - 60_000,
  }));
}

function limparEstado(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function tokenValido(): string | null {
  const estado = lerEstado();
  if (!estado) return null;
  if (estado.expiresAt <= Date.now()) {
    limparEstado();
    return null;
  }
  return estado.accessToken;
}

export async function conectarGoogleDrive(): Promise<string> {
  if (!CLIENT_ID) throw new Error('Google Drive não configurado. Configure VITE_GOOGLE_CLIENT_ID ou VITE_GOOGLE_DRIVE_CLIENT_ID.');
  await carregarScriptGSI();

  return new Promise((resolve, reject) => {
    const win = window as unknown as {
      google?: {
        accounts: {
          oauth2: {
            initTokenClient: (config: {
              client_id: string;
              scope: string;
              callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
            }) => { requestAccessToken: () => void };
          };
        };
      };
    };

    if (!win.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services não carregado corretamente'));
      return;
    }

    const tokenClient = win.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'Falha na autenticação com Google Drive'));
          return;
        }
        salvarEstado(resp.access_token, resp.expires_in);
        resolve(resp.access_token);
      },
    });
    tokenClient.requestAccessToken();
  });
}

async function getToken(): Promise<string> {
  const token = tokenValido();
  if (token) return token;
  return conectarGoogleDrive();
}

function classificarArquivo(nome: string): TipoLeitura {
  const n = nome.toLowerCase();
  if (/vaga|emprego|job|linkedin|curr[ií]culo|resume|career|candidatura|recrutamento|oportunidade/.test(n)) return 'vaga';
  if (/tecnologia|tech|ia\b|ai\b|programação|framework|javascript|python|react|llm|gpt|claude/.test(n)) return 'tecnologia';
  if (/artigo|article|post|blog|paper|pesquisa/.test(n)) return 'artigo';
  if (/doc|documento|relatorio|relatório|draft/.test(n)) return 'documento';
  if (/link|url|http/.test(n)) return 'link';
  return 'geral';
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
}

export async function listarArquivosDaPasta(folderId?: string): Promise<DriveFile[]> {
  const token = await getToken();

  const pasta = folderId ?? DRIVE_FOLDER_ID;
  if (!pasta) throw new Error(getMensagemDriveNaoConfigurado());

  const params = new URLSearchParams({
    q: `'${pasta}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,webContentLink,size)',
    orderBy: 'modifiedTime desc',
    pageSize: '100',
  });

  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) limparEstado();
    if (res.status === 401 || res.status === 403) {
      throw new Error('Não foi possível acessar o Google Drive. Verifique permissões da conta Google.');
    }
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Erro ${res.status} ao listar Drive.`);
  }

  const data = await res.json() as { files: DriveFile[] };
  return data.files ?? [];
}

export async function sincronizarLeiturasDrive(folderId?: string): Promise<LeituraDiaria[]> {
  const arquivos = await listarArquivosDaPasta(folderId);
  return arquivos.map(f => importarArquivoComoLeitura(f));
}

export function importarArquivoComoLeitura(file: DriveFile): LeituraDiaria {
  const tipo = classificarArquivo(file.name);
  const url = file.webViewLink ?? file.webContentLink;
  const categoriaMap: Record<TipoLeitura, string> = {
    vaga: 'Vagas de emprego',
    tecnologia: 'Atualização de tecnologia',
    artigo: 'Artigos',
    documento: 'Documentos',
    link: 'Links',
    geral: 'Geral',
  };
  const importante = /vaga|emprego|linkedin|curr[ií]culo|resume|career|job|candidatura|urgente|importante/i.test(file.name);

  return {
    id: gerarId(),
    origem: 'drive',
    titulo: file.name,
    tipo,
    url,
    driveFileId: file.id,
    categoria: categoriaMap[tipo],
    prioridade: importante ? 'importante' : 'normal',
    status: 'pendente',
    dataLeitura: null,
    dataCriacao: file.modifiedTime?.slice(0, 10) || hojeISO(),
  };
}
