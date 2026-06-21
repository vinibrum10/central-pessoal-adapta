/**
 * Integração com Google Drive (somente leitura de metadados).
 * Reutiliza o token do Google Calendar quando disponível.
 *
 * Configuração:
 * 1. Habilite "Google Drive API" no mesmo projeto do Google Calendar.
 * 2. Adicione o escopo drive.readonly (ou drive.metadata.readonly) no OAuth.
 * 3. Configure VITE_GOOGLE_DRIVE_FOLDER_ID com o ID da pasta no Drive.
 *
 * NUNCA coloque client_secret no frontend.
 */

/// <reference types="vite/client" />
import type { LeituraDiaria, TipoLeitura } from '../types';
import { gerarId, hojeISO } from '../utils';

const DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID as string | undefined;
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

// Token reutilizado do módulo googleCalendar via sessionStorage
const TOKEN_KEY = 'google_access_token';

export function isDriveConfigurado(): boolean {
  return Boolean(DRIVE_FOLDER_ID && DRIVE_FOLDER_ID.trim() !== '');
}

export function getMensagemDriveNaoConfigurado(): string {
  return 'Configure VITE_GOOGLE_DRIVE_FOLDER_ID no arquivo .env para sincronizar leituras do Google Drive.';
}

function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

function classificarArquivo(nome: string): TipoLeitura {
  const n = nome.toLowerCase();
  if (/vaga|emprego|job|linkedin|recrutamento|oportunidade/.test(n)) return 'vaga';
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
  const token = getToken();
  if (!token) throw new Error('Não autenticado com o Google. Conecte o Google Calendar primeiro.');

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

  return {
    id: gerarId(),
    origem: 'drive',
    titulo: file.name,
    tipo,
    url,
    driveFileId: file.id,
    categoria: categoriaMap[tipo],
    prioridade: 'normal',
    status: 'pendente',
    dataLeitura: null,
    dataCriacao: hojeISO(),
  };
}
