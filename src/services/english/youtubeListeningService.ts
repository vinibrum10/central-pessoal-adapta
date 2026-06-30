// AVISO DE SEGURANÇA: Em produção, a busca do YouTube deve ser movida para
// backend/serverless para proteger a quota da API Key e aplicar cache.

import type { ListeningVideo } from './englishStorage';

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
const SEARCH_API = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_API = 'https://www.googleapis.com/youtube/v3/videos';
const MAX_DURATION_SECONDS = 600;

export type ListeningLevel = 'basic' | 'intermediate' | 'advanced' | 'fluent';

const LEVEL_QUERIES: Record<ListeningLevel, string[]> = {
  basic: [
    'American English listening practice A1 A2 short conversation',
    'basic American English conversation under 10 minutes',
    'English for beginners American listening practice',
  ],
  intermediate: [
    'American English listening practice B1 B2 conversation under 10 minutes',
    'intermediate American English conversation practice',
    'American English speaking practice intermediate business',
  ],
  advanced: [
    'advanced American English listening practice C1 under 10 minutes',
    'advanced business English conversation American English',
    'C1 American English speaking practice',
  ],
  fluent: [
    'C2 American English listening practice native speakers under 10 minutes',
    'native speaker American English conversation under 10 minutes',
    'advanced native American English business conversation',
  ],
};

export function isYouTubeConfigured(): boolean {
  return Boolean(YOUTUBE_API_KEY?.trim());
}

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? '0', 10)) * 3600
    + (parseInt(m[2] ?? '0', 10)) * 60
    + (parseInt(m[3] ?? '0', 10));
}

export async function searchListeningVideo(
  level: ListeningLevel,
  excludeVideoId?: string,
  queryIndex = 0,
): Promise<ListeningVideo | null> {
  if (!isYouTubeConfigured()) return null;

  const queries = LEVEL_QUERIES[level];
  const query = queries[queryIndex % queries.length];

  // 1. Search for candidate IDs
  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '25',
    q: query,
    relevanceLanguage: 'en',
    regionCode: 'US',
    safeSearch: 'strict',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    key: YOUTUBE_API_KEY!,
  });

  const searchRes = await fetch(`${SEARCH_API}?${searchParams}`);
  if (!searchRes.ok) {
    const body = await searchRes.json() as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `YouTube search failed (${searchRes.status})`);
  }

  const searchBody = await searchRes.json() as {
    items?: Array<{ id?: { videoId?: string } }>;
    error?: { message?: string };
  };

  const ids = (searchBody.items ?? [])
    .map(item => item.id?.videoId)
    .filter((id): id is string => Boolean(id && /^[a-zA-Z0-9_-]{11}$/.test(id)))
    .filter(id => id !== excludeVideoId);

  if (ids.length === 0) return null;

  // 2. Validate each candidate via videos.list
  const detailsParams = new URLSearchParams({
    part: 'contentDetails,snippet,status,statistics',
    id: ids.join(','),
    key: YOUTUBE_API_KEY!,
  });

  const detailsRes = await fetch(`${VIDEOS_API}?${detailsParams}`);
  if (!detailsRes.ok) return null;

  const detailsBody = await detailsRes.json() as {
    items?: Array<{
      id?: string;
      contentDetails?: { duration?: string };
      status?: { embeddable?: boolean; privacyStatus?: string; uploadStatus?: string };
      statistics?: { viewCount?: string; likeCount?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { medium?: { url?: string } };
      };
    }>;
  };

  for (const item of detailsBody.items ?? []) {
    const durationSeconds = parseDuration(item.contentDetails?.duration ?? '');
    const title = item.snippet?.title?.trim() ?? '';
    const channelTitle = item.snippet?.channelTitle?.trim() ?? '';
    const videoId = item.id ?? '';

    const valid = /^[a-zA-Z0-9_-]{11}$/.test(videoId)
      && durationSeconds > 0
      && durationSeconds <= MAX_DURATION_SECONDS
      && item.status?.privacyStatus === 'public'
      && item.status?.embeddable === true
      && item.status?.uploadStatus === 'processed'
      && title.length > 0
      && channelTitle.length > 0;

    if (!valid) continue;

    const viewCount = Number(item.statistics?.viewCount ?? 0);
    const likeCount = Number(item.statistics?.likeCount ?? 0);
    const qualityScore = Math.min(100,
      35 // public + embeddable confirmed
      + (durationSeconds > 0 && durationSeconds <= MAX_DURATION_SECONDS ? 25 : 0)
      + (viewCount >= 1000 ? 10 : 0)
      + (viewCount >= 10000 ? 5 : 0)
      + (likeCount >= 50 ? 5 : 0)
      + (/english|learn|listening|conversation|practice|speak|business|native/i.test(`${title} ${channelTitle}`) ? 15 : 0)
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

  return null;
}
