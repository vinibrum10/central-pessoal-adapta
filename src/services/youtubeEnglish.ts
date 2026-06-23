import type { EnglishLevel, YouTubeEnglishVideo } from '../types/englishStudy';

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
const YOUTUBE_SEARCH_API = 'https://www.googleapis.com/youtube/v3/search';

export interface BuscarVideosInglesParams {
  query: string;
  nivel: EnglishLevel | 'todos';
  duracao: 'curta' | 'media' | 'longa' | 'qualquer';
  tema: string;
}

export function isYouTubeEnglishConfigured(): boolean {
  return Boolean(YOUTUBE_API_KEY && YOUTUBE_API_KEY.trim() !== '');
}

export function getYouTubeEnglishConfigMessage(): string {
  return 'YouTube não configurado. Configure VITE_YOUTUBE_API_KEY para buscar vídeos de listening.';
}

function mapDuracao(duracao: BuscarVideosInglesParams['duracao']) {
  if (duracao === 'curta') return 'short';
  if (duracao === 'media') return 'medium';
  if (duracao === 'longa') return 'long';
  return undefined;
}

export async function buscarVideosIngles(params: BuscarVideosInglesParams): Promise<YouTubeEnglishVideo[]> {
  if (!isYouTubeEnglishConfigured()) throw new Error(getYouTubeEnglishConfigMessage());

  const termo = [
    params.query || 'English listening practice',
    params.tema,
    params.nivel !== 'todos' ? params.nivel : '',
    'English learning',
  ].filter(Boolean).join(' ');

  const search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '8',
    q: termo,
    relevanceLanguage: 'en',
    safeSearch: 'moderate',
    key: YOUTUBE_API_KEY!,
  });

  const videoDuration = mapDuracao(params.duracao);
  if (videoDuration) search.set('videoDuration', videoDuration);

  const response = await fetch(`${YOUTUBE_SEARCH_API}?${search.toString()}`);
  const body = await response.json() as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
      };
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(body.error?.message ?? `Erro ${response.status} ao buscar vídeos no YouTube.`);
  }

  return (body.items ?? [])
    .filter(item => item.id?.videoId)
    .map(item => {
      const videoId = item.id!.videoId!;
      return {
        id: videoId,
        title: item.snippet?.title ?? 'Vídeo sem título',
        channelTitle: item.snippet?.channelTitle ?? 'Canal não informado',
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url,
        publishedAt: item.snippet?.publishedAt,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    });
}
