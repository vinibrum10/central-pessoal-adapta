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
import type { Session } from '@supabase/supabase-js';
import type { LeituraDiaria, TipoLeitura } from '../types';
import { gerarId, hojeISO } from '../utils';
import { SGP_DRIVE_FOLDERS, SGP_LEITURA_SYNC_FOLDERS, type SgpDriveFolder } from './sgpDriveConfig';
import {
  bootstrapGoogleIntegrationFromSession,
  clearGoogleIntegration,
  getGoogleIntegrationStatus,
  getGoogleIntegrationScope,
  getStoredGoogleToken,
  inspectGoogleIntegrationToken,
  isGoogleIntegrationConfigured,
  requestGoogleIntegrationToken,
  revokeGoogleIntegration,
} from './googleIntegrationService';

const DRIVE_FOLDER_ID = SGP_DRIVE_FOLDERS.leituraDiaria.id;
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_FOLDER_MIME = 'application/vnd.google-apps.folder';

class DriveFolderError extends Error {
  folderId: string;
  status: number;
  apiMessage: string;

  constructor(folderId: string, status: number, apiMessage: string) {
    super(apiMessage);
    this.name = 'DriveFolderError';
    this.folderId = folderId;
    this.status = status;
    this.apiMessage = apiMessage;
  }
}

function driveLog(message: string, details: Record<string, unknown>): void {
  console.info(`[SGP Drive][leitura] ${message}`, details);
}

function driveWarn(message: string, details: Record<string, unknown>): void {
  console.warn(`[SGP Drive][leitura] ${message}`, details);
}

export function isDriveConfigurado(): boolean {
  return Boolean(DRIVE_FOLDER_ID && DRIVE_FOLDER_ID.trim() !== '' && isGoogleIntegrationConfigured('drive'));
}

export function isDriveConectado(): boolean {
  return getStoredGoogleToken('drive') !== null;
}

export function getMensagemDriveNaoConfigurado(): string {
  if (!isGoogleIntegrationConfigured('drive')) {
    return 'Google Drive não configurado. Configure VITE_GOOGLE_CLIENT_ID ou VITE_GOOGLE_DRIVE_CLIENT_ID com um Client ID OAuth válido do Google nas variáveis de ambiente.';
  }
  return 'Google Drive não configurado. Configure VITE_GOOGLE_DRIVE_FOLDER_ID e conecte sua conta Google para sincronizar leituras.';
}

export async function conectarGoogleDrive(): Promise<string> {
  return requestGoogleIntegrationToken('drive', { prompt: '' });
}

export async function reconectarGoogleDrive(): Promise<string> {
  driveLog('Iniciando reconexão Drive', {
    acao: 'limpar_token_antigo_e_abrir_oauth',
    escopoSolicitado: getGoogleIntegrationScope('drive'),
  });
  clearGoogleIntegration('drive');
  const token = await requestGoogleIntegrationToken('drive', { prompt: 'consent select_account' });
  const tokenInfo = await inspectGoogleIntegrationToken('drive').catch(() => ({
    present: Boolean(token),
    valid: false,
    expectedScope: getGoogleIntegrationScope('drive'),
    scopes: [],
  }));
  driveLog('Reconexão Drive concluída', {
    tokenRecebido: Boolean(token),
    escopoEsperado: tokenInfo.expectedScope,
    possuiDriveReadonly: tokenInfo.valid,
    escoposToken: tokenInfo.scopes,
  });
  return token;
}

export function desconectarGoogleDrive(): void {
  void revokeGoogleIntegration('drive');
}

export function getDriveConnectionStatus(): 'desconectado' | 'permissao_necessaria' | 'conectado' | 'expirado' {
  return getGoogleIntegrationStatus('drive');
}

export async function prepararGoogleDriveComSessao(session: Session | null | undefined): Promise<boolean> {
  return bootstrapGoogleIntegrationFromSession('drive', session);
}

async function getToken(): Promise<string> {
  const token = getStoredGoogleToken('drive');
  if (token) return token;
  throw new Error('Permissão do Google Drive necessária.');
}

function classificarArquivo(nome: string, mimeType?: string, temUrl = false): TipoLeitura {
  const n = nome.toLowerCase();
  // mimeType tem prioridade: Google Workspace e PDF → documento
  if (mimeType?.startsWith('application/vnd.google-apps.')) {
    if (/document|presentation|form|drawing/.test(mimeType)) return 'documento';
    if (/spreadsheet/.test(mimeType)) return 'documento';
  }
  if (mimeType === 'application/pdf') return 'documento';
  // Classificação pelo nome do arquivo
  if (/vaga|emprego|job|linkedin|curr[ií]culo|resume|career|candidatura|recrutamento|oportunidade/.test(n)) return 'vaga';
  if (/tecnologia|tech|ia\b|ai\b|programação|framework|javascript|python|react|llm|gpt|claude/.test(n)) return 'tecnologia';
  if (/artigo|article|post|blog|paper|pesquisa/.test(n)) return 'artigo';
  if (/doc|documento|relatorio|relatório|draft/.test(n)) return 'documento';
  if (/link|url|http/.test(n)) return 'link';
  // Arquivo com URL mas sem palavra-chave reconhecida → link (melhor que geral)
  if (temUrl) return 'link';
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
  parentFolderId?: string;
  parentFolderName?: string;
  sgpCategoria?: string;
}

export async function listarArquivosDaPasta(folderId?: string): Promise<DriveFile[]> {
  const token = await getToken();

  const pasta = folderId ?? DRIVE_FOLDER_ID;
  if (!pasta) throw new Error(getMensagemDriveNaoConfigurado());
  const tokenInfo = await inspectGoogleIntegrationToken('drive').catch(() => ({
    present: Boolean(token),
    valid: false,
    expectedScope: getGoogleIntegrationScope('drive'),
    scopes: [],
  }));

  driveLog('listando pasta', {
    folderId: pasta,
    modulo: 'leitura',
    subpastaTecnologiaChamada: pasta === SGP_DRIVE_FOLDERS.leituraTecnologia.id,
    tokenStatus: getDriveConnectionStatus(),
    tokenPresente: tokenInfo.present,
    escopoEsperado: tokenInfo.expectedScope,
    escopoValido: tokenInfo.valid,
    escoposToken: tokenInfo.scopes,
  });

  const params = new URLSearchParams({
    q: `'${pasta}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,webContentLink,size)',
    orderBy: 'modifiedTime desc',
    pageSize: '100',
  });

  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  driveLog('resposta da API', {
    folderId: pasta,
    modulo: 'leitura',
    subpastaTecnologiaChamada: pasta === SGP_DRIVE_FOLDERS.leituraTecnologia.id,
    status: res.status,
  });

  if (!res.ok) {
    let apiMessage = `Erro ${res.status} ao listar Drive.`;
    try {
      const err = await res.json() as { error?: { message?: string; status?: string; reason?: string } };
      apiMessage = err.error?.message ?? err.error?.status ?? apiMessage;
    } catch {
      // Mantém a mensagem padrão quando o corpo não é JSON.
    }
    driveWarn('erro da API ao listar pasta', {
      folderId: pasta,
      modulo: 'leitura',
      status: res.status,
      mensagem: apiMessage,
    });
    if (res.status === 401) {
      clearGoogleIntegration('drive');
      throw new DriveFolderError(pasta, res.status, 'Sessão do Google Drive expirada. Clique em "Reconectar" para conceder permissão novamente.');
    }
    if (res.status === 403) {
      throw new DriveFolderError(pasta, res.status, `Acesso negado ao Google Drive: ${apiMessage}`);
    }
    throw new DriveFolderError(pasta, res.status, apiMessage);
  }

  const data = await res.json() as { files: DriveFile[] };
  const files = data.files ?? [];
  driveLog('arquivos retornados', {
    folderId: pasta,
    subpastaTecnologiaChamada: pasta === SGP_DRIVE_FOLDERS.leituraTecnologia.id,
    quantidade: files.length,
    mimeTypes: Array.from(new Set(files.map(file => file.mimeType))).sort(),
  });
  return (data.files ?? [])
    .filter(file => file.mimeType !== GOOGLE_FOLDER_MIME)
    .map(file => ({
      ...file,
      parentFolderId: pasta,
    }));
}

export async function sincronizarLeiturasDrive(folderId?: string): Promise<LeituraDiaria[]> {
  const arquivos = folderId
    ? await listarArquivosDaPasta(folderId)
    : await listarArquivosLeituraDiaria();
  return arquivos.map(f => importarArquivoComoLeitura(f));
}

async function listarArquivosLeituraDiaria(): Promise<DriveFile[]> {
  const results: DriveFile[][] = [];
  const failures: Array<{ folder: SgpDriveFolder; message: string; status?: number }> = [];
  let contentFolderSuccesses = 0;

  for (const folder of SGP_LEITURA_SYNC_FOLDERS) {
    try {
      const files = await listarArquivosDaPasta(folder.id);
      if (folder.key !== SGP_DRIVE_FOLDERS.leituraDiaria.key) {
        contentFolderSuccesses += 1;
      }
      results.push(files.map(file => ({
        ...file,
        parentFolderId: folder.id,
        parentFolderName: folder.nome,
        sgpCategoria: folder.categoria,
      })));
      driveLog('pasta importada', {
        folderId: folder.id,
        pasta: folder.nome,
        categoria: folder.categoria,
        itens: files.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = error instanceof DriveFolderError ? error.status : undefined;
      failures.push({ folder, message, status });
      driveWarn('falha ao importar pasta', {
        folderId: folder.id,
        pasta: folder.nome,
        categoria: folder.categoria,
        status,
        erro: message,
      });
    }
  }

  if (contentFolderSuccesses === 0 && failures.length > 0) {
    const resumo = failures
      .filter(({ folder }) => folder.key !== SGP_DRIVE_FOLDERS.leituraDiaria.key)
      .map(({ folder, status, message }) => `${folder.categoria} (${folder.id}): ${status ?? 'sem status'} - ${message}`)
      .join(' | ');
    throw new Error(`Não foi possível acessar as subpastas oficiais da Leitura Diária. Detalhes: ${resumo || 'sem detalhes de subpasta'}.`);
  }

  if (failures.length > 0) {
    driveWarn('sincronizacao parcial com falhas', {
      sucessosSubpastas: contentFolderSuccesses,
      falhas: failures.map(({ folder, status, message }) => ({
        folderId: folder.id,
        pasta: folder.nome,
        categoria: folder.categoria,
        status,
        erro: message,
      })),
    });
  }

  const seen = new Set<string>();
  return results.flat().filter(file => {
    if (seen.has(file.id)) return false;
    seen.add(file.id);
    return true;
  });
}

export function importarArquivoComoLeitura(file: DriveFile): LeituraDiaria {
  const url = file.webViewLink ?? file.webContentLink;
  const tipo = classificarArquivo(file.name, file.mimeType, Boolean(url));
  const categoriaMap: Record<TipoLeitura, string> = {
    vaga: 'Vagas de emprego',
    tecnologia: file.sgpCategoria ?? 'Atualização de tecnologia',
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
    categoria: file.sgpCategoria ?? categoriaMap[tipo],
    prioridade: importante ? 'importante' : 'normal',
    status: 'pendente',
    dataLeitura: null,
    dataCriacao: file.modifiedTime?.slice(0, 10) || hojeISO(),
  };
}
