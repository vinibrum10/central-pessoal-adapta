// AVISO DE SEGURANÇA: Em produção, a busca do YouTube deve ser movida para
// backend/serverless para proteger a quota da API Key e aplicar cache.

import type { ListeningVideo } from './englishStorage';
import { getRecentlyUsedVideoIds, pickLeastRecentlyUsed, type VideoHistoryPurpose } from './videoHistoryService';

// Lida sob demanda (não capturada num const no topo do módulo) para que
// testes possam stubar import.meta.env.VITE_YOUTUBE_API_KEY dinamicamente.
function getYouTubeApiKey(): string | undefined {
  return import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
}

const SEARCH_API = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_API = 'https://www.googleapis.com/youtube/v3/videos';

// Limite da busca automática via API para Listening — vídeos acima disso são
// rejeitados na busca (nunca chegam a ser oferecidos ao usuário).
export const MAX_LISTENING_SEARCH_DURATION_SECONDS = 1800;
// Limite da busca automática via API para Shadowing.
const MAX_SHADOWING_DURATION_SECONDS = 900;
// Vídeos colados manualmente (link do usuário) NUNCA são bloqueados por
// duração — este valor só decide quando mostrar um aviso amigável e não
// bloqueante na tela (ver src/pages/Ingles.tsx).
export const MANUAL_VIDEO_LONG_WARNING_SECONDS = 1800;

const QUOTA_ERROR_MESSAGE = 'Limite diário da YouTube API atingido. Use um link manual de vídeo ou tente novamente amanhã.';

export type ListeningLevel = 'basic' | 'intermediate' | 'advanced' | 'fluent';

const LISTENING_LEVEL_QUERIES: Record<ListeningLevel, string> = {
  basic: 'English in a Minute VOA Learning English American English',
  intermediate: 'VOA Learning English intermediate American English listening',
  advanced: "Rachel's English American English pronunciation listening",
  fluent: "natural American English conversation Rachel's English short",
};

const SHADOWING_LEVEL_QUERIES: Record<ListeningLevel, string> = {
  basic: 'basic American English shadowing pronunciation practice',
  intermediate: 'intermediate American English shadowing speaking practice',
  advanced: "Rachel's English American English shadowing pronunciation",
  fluent: 'natural American English conversation shadowing short',
};

type PrioritizedSource = {
  label: string;
  channelTitleIncludes?: string;
  queryBoost?: string;
};

const LISTENING_SOURCES: PrioritizedSource[] = [
  { label: 'VOA Learning English - English in a Minute', channelTitleIncludes: 'VOA Learning English', queryBoost: 'English in a Minute' },
  { label: 'VOA Learning English', channelTitleIncludes: 'VOA Learning English' },
  { label: "Rachel's English", channelTitleIncludes: "Rachel's English" },
  { label: 'Listening Time', channelTitleIncludes: 'Listening Time' },
  { label: 'English with Jennifer', channelTitleIncludes: 'English with Jennifer' },
  { label: 'Speak English With Vanessa', channelTitleIncludes: 'Speak English With Vanessa' },
];

const SHADOWING_SOURCES: PrioritizedSource[] = [
  { label: 'Fluent American Shadowing', channelTitleIncludes: 'Fluent American', queryBoost: 'shadowing' },
  { label: "Rachel's English", channelTitleIncludes: "Rachel's English" },
  { label: "Accent's Way English with Hadar", channelTitleIncludes: 'Hadar' },
  { label: 'English With Kayla', channelTitleIncludes: 'English With Kayla' },
  { label: 'Speak English With Vanessa', channelTitleIncludes: 'Speak English With Vanessa' },
];

export function isYouTubeConfigured(): boolean {
  return Boolean(getYouTubeApiKey()?.trim());
}

export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export function buildManualListeningVideo(videoId: string, level: ListeningLevel): ListeningVideo {
  return {
    youtubeVideoId: videoId,
    title: 'Vídeo manual de Listening',
    channelTitle: 'Canal não informado',
    durationSeconds: 0,
    level,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    source: 'manual_link',
  };
}

function isQuotaExceededError(body: { error?: { message?: string; errors?: Array<{ reason?: string }> } }): boolean {
  const message = body.error?.message ?? '';
  const reasons = body.error?.errors?.map(error => error.reason ?? '') ?? [];
  return /quota/i.test(message) || reasons.some(reason => /quota/i.test(reason));
}

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? '0', 10)) * 3600
    + (parseInt(m[2] ?? '0', 10)) * 60
    + (parseInt(m[3] ?? '0', 10));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/['’]/g, '').replace(/\s+/g, ' ').trim();
}

function matchesSource(channelTitle: string, source: PrioritizedSource): boolean {
  if (!source.channelTitleIncludes) return true;
  return normalize(channelTitle).includes(normalize(source.channelTitleIncludes));
}

async function fetchCandidateIds(query: string, excludeVideoId?: string): Promise<string[]> {
  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '15',
    q: query,
    relevanceLanguage: 'en',
    regionCode: 'US',
    safeSearch: 'strict',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    key: getYouTubeApiKey()!,
  });

  const searchRes = await fetch(`${SEARCH_API}?${searchParams}`);
  if (!searchRes.ok) {
    const body = await searchRes.json() as { error?: { message?: string; errors?: Array<{ reason?: string }> } };
    if (isQuotaExceededError(body)) {
      console.error('[English Listening] YouTube API quota exceeded:', body);
      throw new Error(QUOTA_ERROR_MESSAGE);
    }
    throw new Error(body.error?.message ?? `YouTube search failed (${searchRes.status})`);
  }

  const searchBody = await searchRes.json() as {
    items?: Array<{ id?: { videoId?: string } }>;
  };

  return (searchBody.items ?? [])
    .map(item => item.id?.videoId)
    .filter((id): id is string => Boolean(id && /^[a-zA-Z0-9_-]{11}$/.test(id)))
    .filter(id => id !== excludeVideoId);
}

async function fetchVideoDetails(ids: string[]) {
  const detailsParams = new URLSearchParams({
    part: 'contentDetails,snippet,status,statistics',
    id: ids.join(','),
    key: getYouTubeApiKey()!,
  });

  const detailsRes = await fetch(`${VIDEOS_API}?${detailsParams}`);
  if (!detailsRes.ok) {
    const body = await detailsRes.json().catch(() => ({})) as { error?: { message?: string; errors?: Array<{ reason?: string }> } };
    if (isQuotaExceededError(body)) {
      console.error('[English Listening] YouTube API quota exceeded:', body);
      throw new Error(QUOTA_ERROR_MESSAGE);
    }
    return [];
  }

  const detailsBody = await detailsRes.json() as {
    items?: Array<{
      id?: string;
      contentDetails?: { duration?: string };
      status?: { embeddable?: boolean; privacyStatus?: string; uploadStatus?: string };
      statistics?: { viewCount?: string; likeCount?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
      };
    }>;
  };

  return detailsBody.items ?? [];
}

function buildValidVideo(
  item: Awaited<ReturnType<typeof fetchVideoDetails>>[number],
  level: ListeningLevel,
  maxDurationSeconds: number,
  source: PrioritizedSource,
): ListeningVideo | null {
  const durationSeconds = parseDuration(item.contentDetails?.duration ?? '');
  const title = item.snippet?.title?.trim() ?? '';
  const channelTitle = item.snippet?.channelTitle?.trim() ?? '';
  const videoId = item.id ?? '';

  const valid = /^[a-zA-Z0-9_-]{11}$/.test(videoId)
    && durationSeconds > 0
    && durationSeconds <= maxDurationSeconds
    && item.status?.privacyStatus === 'public'
    && item.status?.embeddable === true
    && item.status?.uploadStatus === 'processed'
    && title.length > 0
    && channelTitle.length > 0
    && matchesSource(channelTitle, source);

  if (!valid) return null;

  const viewCount = Number(item.statistics?.viewCount ?? 0);
  const likeCount = Number(item.statistics?.likeCount ?? 0);
  const qualityScore = Math.min(100,
    35
    + (durationSeconds > 0 && durationSeconds <= maxDurationSeconds ? 25 : 0)
    + (viewCount >= 1000 ? 10 : 0)
    + (viewCount >= 10000 ? 5 : 0)
    + (likeCount >= 50 ? 5 : 0)
    + (/english|learn|listening|conversation|practice|speak|pronunciation|shadowing|native/i.test(`${title} ${channelTitle}`) ? 15 : 0)
    + (channelTitle.length > 0 ? 5 : 0),
  );

  return {
    youtubeVideoId: videoId,
    title,
    channelTitle,
    durationSeconds,
    level,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    source: 'youtube_api',
    qualityScore,
  };
}

async function searchPrioritizedVideo(
  level: ListeningLevel,
  excludeVideoId: string | undefined,
  _queryIndex: number,
  sources: PrioritizedSource[],
  levelQueries: Record<ListeningLevel, string>,
  maxDurationSeconds: number,
  purpose: VideoHistoryPurpose,
): Promise<ListeningVideo | null> {
  if (!isYouTubeConfigured()) return null;

  // Evita repetir vídeos usados nos últimos 30 dias. Se todo vídeo válido
  // encontrado já tiver sido usado recentemente, cai no fallback: reutiliza
  // o menos usado recentemente em vez de não entregar nada.
  const recentlyUsed = getRecentlyUsedVideoIds(purpose);
  const recentButValidCandidates: ListeningVideo[] = [];

  for (const source of sources) {
    const query = `${source.queryBoost ?? source.label} ${levelQueries[level]}`;
    const ids = await fetchCandidateIds(query, excludeVideoId);
    if (ids.length === 0) continue;

    const details = await fetchVideoDetails(ids);
    for (const item of details) {
      const video = buildValidVideo(item, level, maxDurationSeconds, source);
      if (!video) continue;
      if (!recentlyUsed.has(video.youtubeVideoId)) return video;
      recentButValidCandidates.push(video);
    }
  }

  return pickLeastRecentlyUsed(recentButValidCandidates, purpose);
}

export async function searchListeningVideo(
  level: ListeningLevel,
  excludeVideoId?: string,
  queryIndex = 0,
): Promise<ListeningVideo | null> {
  return searchPrioritizedVideo(level, excludeVideoId, queryIndex, LISTENING_SOURCES, LISTENING_LEVEL_QUERIES, MAX_LISTENING_SEARCH_DURATION_SECONDS, 'listening');
}

export async function searchShadowingVideo(
  level: ListeningLevel,
  excludeVideoId?: string,
  queryIndex = 0,
): Promise<ListeningVideo | null> {
  return searchPrioritizedVideo(level, excludeVideoId, queryIndex, SHADOWING_SOURCES, SHADOWING_LEVEL_QUERIES, MAX_SHADOWING_DURATION_SECONDS, 'shadowing');
}
