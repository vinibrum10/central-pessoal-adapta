import type { YouTubeEnglishVideo } from '../types/englishStudy';

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
const YOUTUBE_SEARCH_API = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_API = 'https://www.googleapis.com/youtube/v3/videos';

export function isYouTubeEnglishConfigured(): boolean {
  return Boolean(YOUTUBE_API_KEY && YOUTUBE_API_KEY.trim() !== '');
}

export function getYouTubeEnglishConfigMessage(): string {
  return 'YouTube não configurado. Configure VITE_YOUTUBE_API_KEY para buscar vídeos de listening.';
}

// Multiple query variations per level so we can try alternatives when results are scarce.
// Queries are in English to match YouTube's content index.
const LEVEL_QUERIES: Record<string, string[]> = {
  'Iniciante': [
    'beginner English listening practice',
    'basic English conversation slow speech A1 A2',
    'English for beginners daily routine slow English',
    'simple English conversation practice A2',
  ],
  'Intermediário': [
    'intermediate English conversation practice',
    'B1 B2 English listening practice conversation',
    'business English conversation workplace meetings',
    'English speaking practice intermediate level B2',
  ],
  'Avançado': [
    'advanced English listening practice C1',
    'C1 C2 English lecture academic discussion',
    'TED talk English advanced listening comprehension',
    'professional English conversation advanced C2',
  ],
};

// YouTube videoDuration buckets: 'short' < 4 min, 'medium' 4–20 min, 'long' > 20 min.
// Our targets: curto ≤5 min, medio ≤10 min, longo ≤20 min.
// We use 'any' for curto (catches both short and the 4-5 min range from medium).
// We use 'medium' for medio and longo, then post-filter by real duration.
const DURACAO_YT_PARAM: Record<string, string> = {
  'curto': 'any',
  'medio': 'medium',
  'longo': 'medium',
};

export const DURACAO_MAX_SECONDS: Record<string, number> = {
  'curto': 300,
  'medio': 600,
  'longo': 1200,
};

function parseDurationISO8601(duration: string): number {
  // "PT4M3S" → 243, "PT1H2M3S" → 3723, "PT30S" → 30
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] ?? '0', 10)) * 3600
    + (parseInt(match[2] ?? '0', 10)) * 60
    + (parseInt(match[3] ?? '0', 10));
}

export interface BibliotecaVideoResult extends YouTubeEnglishVideo {
  durationSeconds: number;
}

export interface YouTubeSearchResult {
  videos: BibliotecaVideoResult[];
  nextPageToken: string | null;
  queryIndex: number;
}

export async function buscarVideosIngles(params: {
  nivel: string;
  duracao: 'curto' | 'medio' | 'longo';
  pageToken?: string;
  queryIndex?: number;
  seenVideoIds?: Set<string>;
}): Promise<YouTubeSearchResult> {
  if (!isYouTubeEnglishConfigured()) throw new Error(getYouTubeEnglishConfigMessage());

  const queries = LEVEL_QUERIES[params.nivel] ?? LEVEL_QUERIES['Intermediário'];
  const qIndex = (params.queryIndex ?? 0) % queries.length;
  const query = queries[qIndex];
  const ytDuration = DURACAO_YT_PARAM[params.duracao] ?? 'medium';
  const maxSeconds = DURACAO_MAX_SECONDS[params.duracao] ?? 600;

  // Request 25 candidates so we have enough after duration post-filtering
  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '25',
    q: query,
    relevanceLanguage: 'en',
    regionCode: 'US',
    safeSearch: 'strict',
    videoEmbeddable: 'true',
    videoDuration: ytDuration,
    key: YOUTUBE_API_KEY!,
  });
  if (params.pageToken) searchParams.set('pageToken', params.pageToken);

  const searchRes = await fetch(`${YOUTUBE_SEARCH_API}?${searchParams}`);
  const searchBody = await searchRes.json() as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
        publishedAt?: string;
      };
    }>;
    nextPageToken?: string;
    error?: { message?: string };
  };

  if (!searchRes.ok) {
    const message = searchBody.error?.message?.toLowerCase() ?? '';
    if (message.includes('quota')) throw new Error('Quota do YouTube excedida. Tente novamente mais tarde.');
    if (message.includes('key') || message.includes('api key')) throw new Error('Chave do YouTube inválida ou sem permissão para YouTube Data API v3.');
    throw new Error(searchBody.error?.message ?? `YouTube indisponível. Erro ${searchRes.status}.`);
  }

  // Exclude already seen video IDs to prevent repeats
  const candidates = (searchBody.items ?? [])
    .filter(item => {
      const vid = item.id?.videoId;
      return vid && !(params.seenVideoIds?.has(vid));
    })
    .map(item => ({ videoId: item.id!.videoId!, snippet: item.snippet! }));

  if (candidates.length === 0) {
    return { videos: [], nextPageToken: searchBody.nextPageToken ?? null, queryIndex: qIndex };
  }

  // Fetch contentDetails for real ISO 8601 duration — YouTube search doesn't include it
  const ids = candidates.map(c => c.videoId).join(',');
  const detailsParams = new URLSearchParams({
    part: 'contentDetails,snippet',
    id: ids,
    key: YOUTUBE_API_KEY!,
  });
  const detailsRes = await fetch(`${YOUTUBE_VIDEOS_API}?${detailsParams}`);
  const detailsBody = await detailsRes.json() as {
    items?: Array<{
      id?: string;
      contentDetails?: { duration?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
        publishedAt?: string;
      };
    }>;
  };

  const durationMap = new Map<string, number>();
  const detailSnippetMap = new Map<string, NonNullable<NonNullable<typeof detailsBody.items>[number]['snippet']>>();

  for (const item of detailsBody.items ?? []) {
    if (item.id) {
      if (item.contentDetails?.duration) {
        durationMap.set(item.id, parseDurationISO8601(item.contentDetails.duration));
      }
      if (item.snippet) {
        detailSnippetMap.set(item.id, item.snippet);
      }
    }
  }

  // Filter by real duration and deduplicate
  const videos: BibliotecaVideoResult[] = candidates
    .filter(c => {
      const dur = durationMap.get(c.videoId);
      return dur !== undefined && dur > 0 && dur <= maxSeconds;
    })
    .map(c => {
      const detail = detailSnippetMap.get(c.videoId) ?? c.snippet;
      return {
        id: c.videoId,
        title: detail?.title ?? 'Vídeo sem título',
        channelTitle: detail?.channelTitle ?? 'Canal não informado',
        thumbnailUrl: detail?.thumbnails?.medium?.url ?? detail?.thumbnails?.default?.url,
        publishedAt: detail?.publishedAt,
        url: `https://www.youtube.com/watch?v=${c.videoId}`,
        durationSeconds: durationMap.get(c.videoId)!,
      };
    });

  return { videos, nextPageToken: searchBody.nextPageToken ?? null, queryIndex: qIndex };
}
