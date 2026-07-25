// Descoberta e leitura da playlist "SGP — Inglês" via YouTube Data API v3,
// autenticada com o Bearer token OAuth (youtube.readonly). Nenhuma função
// pública deste arquivo recebe ou repassa um access token — youtubeApiGet
// (youtubeApiClient.ts) resolve o token internamente a cada chamada, via
// getInMemoryYoutubeAccessToken(). Não usa src/services/youtubeEnglish.ts nem
// src/services/english/youtubeListeningService.ts (API key pública, não
// conseguem ler playlist privada) — reaproveita apenas o formato do parser de
// duração ISO 8601 daqueles arquivos como referência, reimplementado aqui.

import {
  DAILY_VIDEO_RECENT_VIDEOS_LIMIT,
  DAILY_VIDEO_TARGET_PLAYLIST_TITLE,
  type DailyVideoItem,
  type DiscoveredPlaylist,
  type PlaylistDiscoveryResult,
  type PlaylistValidationResult,
  type RecentVideosResult,
  type YoutubeApiError,
} from '../types/dailyVideoEnglish';
import { isYoutubeApiError, paginateYoutubeList, youtubeApiGet } from './youtubeApiClient';

export interface YoutubeReadOptions {
  signal?: AbortSignal;
  maxPages?: number;
}

function toYoutubeApiError(err: unknown): YoutubeApiError {
  if (isYoutubeApiError(err)) return err;
  const message = err instanceof Error ? err.message : 'Erro inesperado ao acessar o YouTube.';
  return { kind: 'unknown_error', message };
}

/**
 * Converte o erro para o tipo tipado do domínio. A limpeza do token em
 * memória em caso de 401 já acontece dentro de youtubeApiGet
 * (youtubeApiClient.ts) — garantida ali para TODO 401, independente de qual
 * função desta camada tiver disparado a chamada.
 */
function handleApiError(err: unknown): YoutubeApiError {
  if (err instanceof DOMException && err.name === 'AbortError') throw err;
  return toYoutubeApiError(err);
}

function normalizeTitle(value: string): string {
  return value.trim();
}

// ------------------------------------------------------------------
// Descoberta por título (playlists.list, mine=true)
// ------------------------------------------------------------------
interface RawPlaylistItem {
  id?: string;
  snippet?: { title?: string };
}
interface RawPlaylistsResponse {
  items?: RawPlaylistItem[];
  nextPageToken?: string;
}

function toDiscoveredPlaylist(item: RawPlaylistItem): DiscoveredPlaylist | null {
  const playlistId = item.id;
  const playlistTitle = item.snippet?.title;
  if (!playlistId || typeof playlistTitle !== 'string') return null;
  return { playlistId, playlistTitle };
}

/**
 * Percorre TODAS as páginas de `playlists.list` (até o fim real ou até o teto
 * defensivo) antes de classificar. Nunca conclui "não encontrada" examinando
 * só a primeira página, e nunca deixa um teto de páginas virar falso negativo
 * — nesse caso retorna `incomplete`.
 *
 * `startPageToken`/`previousMatches` permitem retomar uma busca marcada como
 * `incomplete` anteriormente (ex.: botão "Continuar busca" na interface) sem
 * reiniciar a paginação do zero — o `resumePageToken` de um resultado
 * `incomplete` nunca é descartado, só reaproveitado nesta continuação.
 */
export async function discoverPlaylistByTitle(
  options: YoutubeReadOptions & {
    startPageToken?: string;
    previousMatches?: DiscoveredPlaylist[];
  } = {},
): Promise<PlaylistDiscoveryResult> {
  try {
    const result = await paginateYoutubeList<RawPlaylistItem>(
      async pageToken => {
        const page = await youtubeApiGet<RawPlaylistsResponse>(
          'playlists',
          { part: 'snippet', mine: 'true', maxResults: '50', pageToken },
          { signal: options.signal },
        );
        return { items: page.items ?? [], nextPageToken: page.nextPageToken };
      },
      { maxPages: options.maxPages, startPageToken: options.startPageToken },
    );

    const newMatches = result.items
      .map(toDiscoveredPlaylist)
      .filter((p): p is DiscoveredPlaylist => p !== null)
      .filter(p => normalizeTitle(p.playlistTitle) === DAILY_VIDEO_TARGET_PLAYLIST_TITLE);
    const matches = [...(options.previousMatches ?? []), ...newMatches];

    if (result.incomplete) {
      return { kind: 'incomplete', playlistsSeenSoFar: matches, resumePageToken: result.resumePageToken };
    }
    if (matches.length === 0) return { kind: 'not_found' };
    if (matches.length > 1) return { kind: 'duplicate', playlists: matches };
    return { kind: 'found', playlist: matches[0] };
  } catch (err) {
    return { kind: 'error', error: handleApiError(err) };
  }
}

// ------------------------------------------------------------------
// Validação de um playlist_id previamente persistido
// ------------------------------------------------------------------
interface RawPlaylistByIdResponse {
  items?: RawPlaylistItem[];
}

/**
 * Um resultado vazio da API (playlist deletada, ou ID inválido/de outro
 * usuário) é classificado como `inaccessible` — diferente de
 * `invalid_or_missing`, que só ocorre quando o próprio ID recebido está
 * ausente/vazio, sem sequer chamar a API.
 */
export async function validatePersistedPlaylist(
  playlistId: string | null | undefined,
  options: YoutubeReadOptions = {},
): Promise<PlaylistValidationResult> {
  if (!playlistId || !playlistId.trim()) {
    return { kind: 'invalid_or_missing' };
  }

  try {
    const response = await youtubeApiGet<RawPlaylistByIdResponse>(
      'playlists',
      { part: 'snippet', id: playlistId, maxResults: '1' },
      { signal: options.signal },
    );

    const item = response.items?.[0];
    const playlist = item ? toDiscoveredPlaylist(item) : null;
    if (!playlist) return { kind: 'inaccessible' };
    return { kind: 'valid', playlist };
  } catch (err) {
    const error = handleApiError(err);
    if (error.kind === 'unauthorized') return { kind: 'auth_error', error };
    if (error.kind === 'insufficient_permissions' || error.kind === 'not_found' || error.kind === 'forbidden_other') {
      return { kind: 'inaccessible' };
    }
    return { kind: 'temporary_failure', error };
  }
}

// ------------------------------------------------------------------
// Vídeos recentes (playlistItems.list + videos.list para duração)
// ------------------------------------------------------------------
interface RawPlaylistItemFull {
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
    resourceId?: { videoId?: string };
  };
  contentDetails?: { videoId?: string };
}
interface RawPlaylistItemsResponse {
  items?: RawPlaylistItemFull[];
  nextPageToken?: string;
}

interface RawVideoItem {
  id?: string;
  contentDetails?: { duration?: string };
}
interface RawVideosResponse {
  items?: RawVideoItem[];
}

// Título-sentinela que a própria YouTube Data API usa quando o item de playlist
// aponta para um vídeo que ficou privado/foi removido, mesmo que ainda "exista"
// como item de playlist.
const SENTINEL_TITLES = new Set(['Private video', 'Deleted video']);

interface CandidateVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  addedAt: string;
}

function extractVideoId(item: RawPlaylistItemFull): string | null {
  return item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId ?? null;
}

function toCandidateVideo(item: RawPlaylistItemFull): CandidateVideo | null {
  const videoId = extractVideoId(item);
  const title = item.snippet?.title;
  const addedAt = item.snippet?.publishedAt;
  if (!videoId || typeof title !== 'string' || typeof addedAt !== 'string') return null;
  if (SENTINEL_TITLES.has(title)) return null;

  const thumbs = item.snippet?.thumbnails;
  const thumbnailUrl = thumbs?.medium?.url ?? thumbs?.high?.url ?? thumbs?.default?.url ?? null;
  return { videoId, title, thumbnailUrl, addedAt };
}

export function parseYoutubeDurationIso8601(duration: string): number {
  // "PT4M3S" -> 243, "PT1H2M3S" -> 3723, "PT30S" -> 30
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatDurationFromSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

const VIDEOS_BATCH_SIZE = 50;

async function fetchDurationsByVideoId(
  videoIds: string[],
  options: { signal?: AbortSignal } = {},
): Promise<Map<string, string>> {
  const durationById = new Map<string, string>();
  for (let i = 0; i < videoIds.length; i += VIDEOS_BATCH_SIZE) {
    const batch = videoIds.slice(i, i + VIDEOS_BATCH_SIZE);
    const response = await youtubeApiGet<RawVideosResponse>(
      'videos',
      { part: 'contentDetails', id: batch.join(','), maxResults: String(batch.length) },
      { signal: options.signal },
    );
    for (const item of response.items ?? []) {
      if (item.id && item.contentDetails?.duration) {
        durationById.set(item.id, item.contentDetails.duration);
      }
    }
  }
  return durationById;
}

/**
 * Lê os itens da playlist (paginando até o fim ou o teto defensivo), ordena
 * TODOS os candidatos válidos por `snippet.publishedAt` (data de adição à
 * playlist) em ordem decrescente — nunca presume que a ordem de retorno da API
 * já é essa — e só então seleciona até `limit` vídeos. Um vídeo inválido em
 * `videos.list` (removido/privado após ser adicionado) é substituído
 * automaticamente pelo próximo candidato mais recente da lista já ordenada,
 * em vez de reduzir o resultado ou interromper os demais.
 */
export async function getRecentPlaylistVideos(
  playlistId: string,
  options: YoutubeReadOptions & { limit?: number } = {},
): Promise<RecentVideosResult> {
  const limit = options.limit ?? DAILY_VIDEO_RECENT_VIDEOS_LIMIT;

  try {
    const paginated = await paginateYoutubeList<RawPlaylistItemFull>(
      async pageToken => {
        const page = await youtubeApiGet<RawPlaylistItemsResponse>(
          'playlistItems',
          { part: 'snippet,contentDetails', playlistId, maxResults: '50', pageToken },
          { signal: options.signal },
        );
        return { items: page.items ?? [], nextPageToken: page.nextPageToken };
      },
      { maxPages: options.maxPages },
    );

    // Paginação incompleta nunca vira lista definitiva de "vídeos recentes":
    // como a ordenação por data de adição só é confiável depois de coletar
    // TODOS os itens, um vídeo mais recente ainda pode estar numa página que
    // não foi buscada. Retornar um resultado parcial aqui fingiria uma
    // resposta completa que não é.
    if (paginated.incomplete) {
      return { kind: 'incomplete', resumePageToken: paginated.resumePageToken };
    }

    const candidates = paginated.items
      .map(toCandidateVideo)
      .filter((c): c is CandidateVideo => c !== null)
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

    if (candidates.length === 0) {
      return { kind: 'empty' };
    }

    const selected: CandidateVideo[] = [];
    const durationById = new Map<string, string>();
    let skippedInvalidCount = 0;
    let cursor = 0;

    while (selected.length < limit && cursor < candidates.length) {
      const windowEnd = Math.min(cursor + (limit - selected.length), candidates.length);
      const windowCandidates = candidates.slice(cursor, windowEnd);
      cursor = windowEnd;

      const durations = await fetchDurationsByVideoId(
        windowCandidates.map(c => c.videoId),
        { signal: options.signal },
      );

      for (const candidate of windowCandidates) {
        const duration = durations.get(candidate.videoId);
        if (!duration) {
          skippedInvalidCount += 1;
          continue;
        }
        durationById.set(candidate.videoId, duration);
        selected.push(candidate);
        if (selected.length >= limit) break;
      }
    }

    if (selected.length === 0) {
      return { kind: 'empty' };
    }

    const videos: DailyVideoItem[] = selected.map(candidate => {
      const durationIso = durationById.get(candidate.videoId)!;
      const durationSeconds = parseYoutubeDurationIso8601(durationIso);
      return {
        videoId: candidate.videoId,
        title: candidate.title,
        thumbnailUrl: candidate.thumbnailUrl,
        addedAt: candidate.addedAt,
        durationIso,
        durationSeconds,
        durationFormatted: formatDurationFromSeconds(durationSeconds),
      };
    });

    return { kind: 'videos', videos, skippedInvalidCount };
  } catch (err) {
    return { kind: 'error', error: handleApiError(err) };
  }
}
