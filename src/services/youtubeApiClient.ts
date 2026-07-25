// Cliente tipado e reutilizável para a YouTube Data API v3, autenticado por
// Bearer token (OAuth, escopo youtube.readonly) — diferente de
// src/services/youtubeEnglish.ts e src/services/english/youtubeListeningService.ts,
// que autenticam com uma API key pública (`key=...`) e não conseguem ler
// playlists privadas. Centraliza montagem de URL, parsing seguro de resposta,
// paginação e mapeamento de erros.
//
// O token é obtido e usado SOMENTE aqui dentro — nenhuma assinatura pública
// deste arquivo (nem de youtubePlaylistDiscovery.ts, que consome este cliente)
// recebe ou repassa um access token. `youtubeApiGet` chama
// getInMemoryYoutubeAccessToken() internamente a cada requisição; se não
// houver token válido em memória, nem tenta fazer fetch. O token NUNCA é
// incluído em mensagens de erro, logs, URLs ou é ecoado de volta pelo cliente.

import type { YoutubeApiError } from '../types/dailyVideoEnglish';
import { getInMemoryYoutubeAccessToken, notifyYoutubeTokenRejected } from './youtubeAuth';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YoutubeApiRequestOptions {
  signal?: AbortSignal;
}

function buildUrl(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

interface GoogleApiErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
}

function isGoogleApiErrorBody(value: unknown): value is GoogleApiErrorBody {
  return Boolean(value && typeof value === 'object');
}

function extractReason(body: GoogleApiErrorBody | null): string | undefined {
  return body?.error?.errors?.[0]?.reason ?? body?.error?.status;
}

function classifyHttpError(status: number, body: GoogleApiErrorBody | null): YoutubeApiError {
  const reason = extractReason(body);
  const message = body?.error?.message;

  if (status === 401) {
    return { kind: 'unauthorized', message: 'A sessão de acesso ao YouTube é inválida ou expirou.', reason, status };
  }

  if (status === 403) {
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || reason === 'rateLimitExceeded') {
      return { kind: 'quota_exceeded', message: 'O limite de uso da API do YouTube foi atingido. Tente novamente mais tarde.', reason, status };
    }
    if (reason === 'insufficientPermissions') {
      return { kind: 'insufficient_permissions', message: 'A autorização necessária para acessar o YouTube não foi concedida.', reason, status };
    }
    if (reason === 'accessNotConfigured') {
      return { kind: 'api_not_enabled', message: 'A API do YouTube não está habilitada para este projeto.', reason, status };
    }
    // 'forbidden', 'accessDenied', 'playlistForbidden', 'playlistItemsNotAccessible' e
    // qualquer outro reason 403 não reconhecido caem aqui, de propósito — nenhum
    // deles é tratado como falta de escopo (insufficient_permissions); são bloqueios
    // de acesso/configuração genéricos, distintos de "a autorização OAuth não cobre
    // o escopo pedido".
    return { kind: 'forbidden_other', message: 'Problema de acesso ou configuração ao consultar o YouTube.', reason, status };
  }

  if (status === 404) {
    return { kind: 'not_found', message: 'Recurso do YouTube não encontrado.', reason, status };
  }

  return {
    kind: 'unknown_error',
    message: message ?? `O YouTube respondeu com um erro inesperado (status ${status}).`,
    reason,
    status,
  };
}

export function isYoutubeApiError(value: unknown): value is YoutubeApiError {
  return Boolean(value && typeof value === 'object' && 'kind' in value && 'message' in value);
}

export async function youtubeApiGet<T>(
  path: string,
  params: Record<string, string | undefined>,
  options: YoutubeApiRequestOptions = {},
): Promise<T> {
  // Token resolvido internamente — nunca recebido como parâmetro. Sem token
  // válido em memória, nem chegamos a chamar fetch: o erro é o mesmo tipo
  // usado para 401 do servidor ('unauthorized'), já que da perspectiva de
  // quem chama o efeito é idêntico ("não há acesso autorizado ao YouTube
  // agora"). Não aciona notifyYoutubeTokenRejected aqui — isso é reservado
  // para quando o SERVIDOR de fato rejeita um token que enviamos (mais
  // abaixo); aqui simplesmente não havia nada para enviar.
  const accessToken = getInMemoryYoutubeAccessToken();
  if (!accessToken) {
    const error: YoutubeApiError = {
      kind: 'unauthorized',
      message: 'Não há uma sessão de acesso ao YouTube válida em memória. Conecte ou reconecte o YouTube antes de continuar.',
    };
    throw error;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    const error: YoutubeApiError = { kind: 'network_error', message: 'Falha de conexão ao acessar a API do YouTube.' };
    throw error;
  }

  let body: unknown = null;
  let parseFailed = false;
  try {
    body = await response.json();
  } catch {
    parseFailed = true;
  }

  // Quando o status HTTP já indica erro, classificamos SEMPRE pelo status —
  // mesmo que o corpo seja ilegível/vazio. Isso garante que um 401 é sempre
  // 'unauthorized' (nunca vira 'invalid_response' só porque o corpo não pôde
  // ser lido) e que um 403 sem corpo legível cai no branch padrão de
  // classifyHttpError (reason indefinido -> 'forbidden_other'), nunca é
  // promovido a 'invalid_response'. "Resposta inválida" só existe quando a
  // API respondeu 2xx mas o corpo em si não é JSON válido — aí sim não há
  // status de erro nenhum para nos orientar.
  if (!response.ok) {
    const error = classifyHttpError(response.status, parseFailed || !isGoogleApiErrorBody(body) ? null : body);
    if (error.kind === 'unauthorized') {
      notifyYoutubeTokenRejected();
    }
    throw error;
  }

  if (parseFailed) {
    const error: YoutubeApiError = { kind: 'invalid_response', message: 'Resposta inválida da API do YouTube.', status: response.status };
    throw error;
  }

  return body as T;
}

// ------------------------------------------------------------------
// Paginação genérica — percorre páginas até o fim real (sem nextPageToken) ou
// até um teto defensivo de páginas. Ao atingir o teto, sinaliza `incomplete`
// em vez de tratar silenciosamente como "fim da lista" — quem chamar decide
// como comunicar isso (nunca deve virar um falso "não encontrada"/"vazia").
// ------------------------------------------------------------------
export interface PaginateResult<T> {
  items: T[];
  incomplete: boolean;
  /** Token da última página consultada quando incomplete=true, para permitir retomar sem reiniciar. */
  resumePageToken: string | null;
}

const DEFAULT_MAX_PAGES = 40;

export async function paginateYoutubeList<TItem>(
  fetchPage: (pageToken: string | undefined) => Promise<{ items: TItem[]; nextPageToken?: string }>,
  options: { maxPages?: number; startPageToken?: string } = {},
): Promise<PaginateResult<TItem>> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const items: TItem[] = [];
  // Permite retomar de uma página específica (ex.: "Continuar busca" depois de
  // um resultado `incomplete`) em vez de reiniciar sempre da primeira página.
  let pageToken: string | undefined = options.startPageToken;
  let pagesFetched = 0;

  for (;;) {
    const page = await fetchPage(pageToken);
    items.push(...page.items);
    pagesFetched += 1;

    if (!page.nextPageToken) {
      return { items, incomplete: false, resumePageToken: null };
    }

    if (pagesFetched >= maxPages) {
      return { items, incomplete: true, resumePageToken: page.nextPageToken };
    }

    pageToken = page.nextPageToken;
  }
}
