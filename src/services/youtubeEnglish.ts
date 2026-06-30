import type { YouTubeEnglishVideo } from '../types/englishStudy';

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
const YOUTUBE_SEARCH_API = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_API = 'https://www.googleapis.com/youtube/v3/videos';
const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export function isYouTubeEnglishConfigured(): boolean {
  return Boolean(YOUTUBE_API_KEY && YOUTUBE_API_KEY.trim() !== '');
}

// Diagnóstico de configuração — nunca loga o valor da chave, só se ela existe.
console.log(
  '[Inglês Diário] VITE_YOUTUBE_API_KEY',
  isYouTubeEnglishConfigured() ? 'configurada — disponível para descoberta/validação de novos candidatos (a aula diária usa o Banco Curado como fonte principal).' : 'NÃO configurada — usando só o Banco Curado de vídeos (src/data/curatedEnglishVideos.ts).',
);

export function getYouTubeEnglishConfigMessage(): string {
  return 'YouTube não configurado. Configure VITE_YOUTUBE_API_KEY para buscar vídeos de listening.';
}

function logYouTubeEnglish(message: string, details?: unknown): void {
  if (details === undefined) {
    console.info(`[Inglês Diário] ${message}`);
    return;
  }
  console.info(`[Inglês Diário] ${message}`, details);
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function isValidYouTubeVideoId(videoId: string | null | undefined): videoId is string {
  return Boolean(videoId && VIDEO_ID_PATTERN.test(videoId));
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

const FALLBACK_QUERY_BY_LEVEL: Record<string, string> = {
  'Iniciante': 'short beginner English listening conversation',
  'Intermediário': 'short English listening practice conversation',
  'Avançado': 'short advanced English listening practice',
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
  usedFallback: boolean;
}

export interface YouTubeVideoValidationResult {
  ok: boolean;
  reason?: string;
  video?: BibliotecaVideoResult;
}

export async function buscarVideosIngles(params: {
  nivel: string;
  duracao: 'curto' | 'medio' | 'longo';
  pageToken?: string;
  queryIndex?: number;
  seenVideoIds?: Set<string>;
  allowFallback?: boolean;
}): Promise<YouTubeSearchResult> {
  if (!isYouTubeEnglishConfigured()) throw new Error(getYouTubeEnglishConfigMessage());

  const queries = LEVEL_QUERIES[params.nivel] ?? LEVEL_QUERIES['Intermediário'];
  const qIndex = (params.queryIndex ?? 0) % queries.length;
  const attempts = [
    { query: queries[qIndex], queryIndex: qIndex, usedFallback: false, ytDuration: DURACAO_YT_PARAM[params.duracao] ?? 'medium' },
  ];

  if (params.allowFallback !== false && !params.pageToken) {
    attempts.push({
      query: FALLBACK_QUERY_BY_LEVEL[params.nivel] ?? FALLBACK_QUERY_BY_LEVEL['Intermediário'],
      queryIndex: qIndex,
      usedFallback: true,
      ytDuration: 'any',
    });
  }

  let lastResult: YouTubeSearchResult = { videos: [], nextPageToken: null, queryIndex: qIndex, usedFallback: false };

  for (const attempt of attempts) {
    const result = await searchYouTubeEnglish({
      ...params,
      query: attempt.query,
      queryIndex: attempt.queryIndex,
      ytDuration: attempt.ytDuration,
      usedFallback: attempt.usedFallback,
    });

    lastResult = result;
    if (result.videos.length > 0 || params.pageToken) return result;
    if (attempt.usedFallback) break;
    logYouTubeEnglish('Busca sem resultados válidos; tentando fallback mais amplo.', {
      nivel: params.nivel,
      duracao: params.duracao,
      query: attempt.query,
    });
  }

  return lastResult;
}

async function searchYouTubeEnglish(params: {
  nivel: string;
  duracao: 'curto' | 'medio' | 'longo';
  query: string;
  queryIndex: number;
  ytDuration: string;
  usedFallback: boolean;
  pageToken?: string;
  seenVideoIds?: Set<string>;
}): Promise<YouTubeSearchResult> {
  const maxSeconds = DURACAO_MAX_SECONDS[params.duracao] ?? 600;

  logYouTubeEnglish('Pesquisando vídeos.', {
    termo: params.query,
    nivel: params.nivel,
    duracao: params.duracao,
    youtubeDuration: params.ytDuration,
    fallback: params.usedFallback,
  });

  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '25',
    q: params.query,
    relevanceLanguage: 'en',
    regionCode: 'US',
    safeSearch: 'strict',
    videoEmbeddable: 'true',
    videoDuration: params.ytDuration,
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

  logYouTubeEnglish('Resposta da busca do YouTube.', {
    status: searchRes.status,
    totalItems: searchBody.items?.length ?? 0,
    nextPageToken: searchBody.nextPageToken ?? null,
    error: searchBody.error?.message,
  });

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
    logYouTubeEnglish('Nenhum candidato com videoId novo retornado.', { termo: params.query });
    return { videos: [], nextPageToken: searchBody.nextPageToken ?? null, queryIndex: params.queryIndex, usedFallback: params.usedFallback };
  }

  // Fetch contentDetails for real ISO 8601 duration — YouTube search doesn't include it
  const ids = candidates.map(c => c.videoId).join(',');
  const detailsParams = new URLSearchParams({
    part: 'contentDetails,snippet,status',
    id: ids,
    key: YOUTUBE_API_KEY!,
  });
  const detailsRes = await fetch(`${YOUTUBE_VIDEOS_API}?${detailsParams}`);
  const detailsBody = await detailsRes.json() as {
    items?: Array<{
      id?: string;
      contentDetails?: { duration?: string };
      status?: { embeddable?: boolean; privacyStatus?: string; uploadStatus?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
        publishedAt?: string;
      };
    }>;
    error?: { message?: string };
  };

  logYouTubeEnglish('Resposta de detalhes dos vídeos.', {
    status: detailsRes.status,
    requestedIds: candidates.map(c => c.videoId),
    totalItems: detailsBody.items?.length ?? 0,
    error: detailsBody.error?.message,
  });

  if (!detailsRes.ok) {
    throw new Error(detailsBody.error?.message ?? `YouTube indisponível ao validar vídeos. Erro ${detailsRes.status}.`);
  }

  const durationMap = new Map<string, number>();
  const detailSnippetMap = new Map<string, NonNullable<NonNullable<typeof detailsBody.items>[number]['snippet']>>();
  const statusMap = new Map<string, NonNullable<NonNullable<typeof detailsBody.items>[number]['status']>>();

  for (const item of detailsBody.items ?? []) {
    if (item.id) {
      if (item.contentDetails?.duration) {
        durationMap.set(item.id, parseDurationISO8601(item.contentDetails.duration));
      }
      if (item.snippet) {
        detailSnippetMap.set(item.id, item.snippet);
      }
      if (item.status) {
        statusMap.set(item.id, item.status);
      }
    }
  }

  const videos: BibliotecaVideoResult[] = candidates
    .filter(c => {
      const dur = durationMap.get(c.videoId);
      const status = statusMap.get(c.videoId);
      const valid = dur !== undefined
        && dur > 0
        && dur <= maxSeconds
        && status?.embeddable === true
        && status.privacyStatus === 'public'
        && status.uploadStatus === 'processed';
      if (!valid) {
        logYouTubeEnglish('Candidato descartado.', {
          videoId: c.videoId,
          durationSeconds: dur,
          maxSeconds,
          status,
        });
      }
      return valid;
    })
    .map(c => {
      const detail = detailSnippetMap.get(c.videoId) ?? c.snippet;
      return {
        id: c.videoId,
        title: detail?.title ?? 'Vídeo sem título',
        channelTitle: detail?.channelTitle ?? 'Canal não informado',
        thumbnailUrl: detail?.thumbnails?.medium?.url ?? detail?.thumbnails?.default?.url,
        publishedAt: detail?.publishedAt,
        url: getYouTubeEmbedUrl(c.videoId),
        durationSeconds: durationMap.get(c.videoId)!,
      };
    });

  logYouTubeEnglish('Vídeos válidos selecionados.', {
    count: videos.length,
    videoIds: videos.map(video => video.id),
    fallback: params.usedFallback,
  });

  return { videos, nextPageToken: searchBody.nextPageToken ?? null, queryIndex: params.queryIndex, usedFallback: params.usedFallback };
}

export async function validateYouTubeEnglishVideo(videoId: string): Promise<YouTubeVideoValidationResult> {
  if (!isValidYouTubeVideoId(videoId)) {
    return { ok: false, reason: 'videoId ausente ou inválido.' };
  }

  if (!isYouTubeEnglishConfigured()) {
    logYouTubeEnglish(getYouTubeEnglishConfigMessage());
    return { ok: true, reason: 'Validação completa ignorada porque VITE_YOUTUBE_API_KEY não está configurada.' };
  }

  const detailsParams = new URLSearchParams({
    part: 'contentDetails,snippet,status',
    id: videoId,
    key: YOUTUBE_API_KEY!,
  });
  const detailsRes = await fetch(`${YOUTUBE_VIDEOS_API}?${detailsParams}`);
  const detailsBody = await detailsRes.json() as {
    items?: Array<{
      id?: string;
      contentDetails?: { duration?: string };
      status?: { embeddable?: boolean; privacyStatus?: string; uploadStatus?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
        publishedAt?: string;
      };
    }>;
    error?: { message?: string };
  };

  logYouTubeEnglish('Validando vídeo atual.', {
    videoId,
    status: detailsRes.status,
    itemCount: detailsBody.items?.length ?? 0,
    error: detailsBody.error?.message,
  });

  if (!detailsRes.ok) {
    return { ok: false, reason: detailsBody.error?.message ?? `Erro ${detailsRes.status} ao validar vídeo.` };
  }

  const item = detailsBody.items?.find(video => video.id === videoId);
  if (!item) return { ok: false, reason: 'Vídeo não encontrado, removido ou privado.' };

  const durationSeconds = parseDurationISO8601(item.contentDetails?.duration ?? '');
  if (!durationSeconds) return { ok: false, reason: 'Duração do vídeo indisponível.' };
  if (item.status?.embeddable !== true) return { ok: false, reason: 'Vídeo sem permissão de incorporação.' };
  if (item.status.privacyStatus !== 'public') return { ok: false, reason: `Vídeo com privacidade ${item.status.privacyStatus}.` };
  if (item.status.uploadStatus !== 'processed') return { ok: false, reason: `Vídeo com processamento ${item.status.uploadStatus}.` };

  return {
    ok: true,
    video: {
      id: videoId,
      title: item.snippet?.title ?? 'Vídeo sem título',
      channelTitle: item.snippet?.channelTitle ?? 'Canal não informado',
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url,
      publishedAt: item.snippet?.publishedAt,
      url: getYouTubeEmbedUrl(videoId),
      durationSeconds,
    },
  };
}
