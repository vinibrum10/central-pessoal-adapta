import { CURATED_ENGLISH_VIDEOS } from '../data/curatedEnglishVideos';
import type { DailyEnglishVideo } from '../data/englishDailyVideos';
import type { CuratedEnglishVideo, CuratedVideoStats, EnglishCefrLevel, EnglishLevelFilter } from '../types/englishStudy';
import {
  buscarVideosIngles,
  getYouTubeEmbedUrl,
  isYouTubeEnglishConfigured,
  searchWeeklyVideoCandidates,
  validateYouTubeEnglishVideo,
  type BibliotecaVideoResult,
} from './youtubeEnglish';
import { LEVEL_FILTER_TO_LEVEL_GROUP, MAX_VIDEO_DURATION_SECONDS } from './dailyVideoSelector';

/**
 * Camada de acesso ao banco curado de vídeos. Mantém a separação:
 *  - dados ESTÁTICOS (seed) vivem em src/data/curatedEnglishVideos.ts;
 *  - estado de RUNTIME por usuário (useCount/failureCount/lastUsedAt/
 *    statusOverride) vive em EnglishStudyData.curatedVideoStats e é
 *    mesclado aqui, nunca mutando o seed.
 */

/** Banco curado completo (todos os status), sem nenhum estado de runtime aplicado. */
export function getAllCuratedVideos(): CuratedEnglishVideo[] {
  return CURATED_ENGLISH_VIDEOS;
}

/**
 * Mescla o estado de runtime do usuário (curatedVideoStats) sobre o seed
 * estático — `statusOverride` tem prioridade sobre o `status` de seed (ex.:
 * vídeo confirmadamente quebrado para ESTE usuário vira 'unavailable' aqui
 * mesmo que o seed diga 'active' para todo mundo).
 */
export function applyRuntimeStats(videos: CuratedEnglishVideo[], stats: Record<string, CuratedVideoStats>): CuratedEnglishVideo[] {
  return videos.map(video => {
    const stat = stats[video.youtubeVideoId];
    if (!stat) return video;
    return {
      ...video,
      status: stat.statusOverride ?? video.status,
      useCount: stat.useCount,
      failureCount: stat.failureCount,
      lastUsedAt: stat.lastUsedAt ?? video.lastUsedAt,
    };
  });
}

/** Vídeos curados já com o estado de runtime do usuário aplicado — o que o seletor de fato usa. */
export function getCuratedVideoLibrary(stats: Record<string, CuratedVideoStats>): CuratedEnglishVideo[] {
  return applyRuntimeStats(getAllCuratedVideos(), stats);
}

/**
 * Registra um uso (vídeo virou "vídeo do dia") — incrementa useCount e
 * atualiza lastUsedAt. Função pura: devolve o novo mapa de stats, não
 * mexe em storage.
 */
export function recordCuratedVideoUse(stats: Record<string, CuratedVideoStats>, youtubeVideoId: string, whenISO: string): Record<string, CuratedVideoStats> {
  const current = stats[youtubeVideoId] ?? { useCount: 0, failureCount: 0 };
  return {
    ...stats,
    [youtubeVideoId]: { ...current, useCount: current.useCount + 1, lastUsedAt: whenISO },
  };
}

/**
 * Registra uma falha real (erro do player/validação remota) — incrementa
 * failureCount e marca statusOverride: 'unavailable' para ESTE usuário.
 * Função pura: devolve o novo mapa de stats, não mexe em storage.
 */
export function recordCuratedVideoFailure(stats: Record<string, CuratedVideoStats>, youtubeVideoId: string): Record<string, CuratedVideoStats> {
  const current = stats[youtubeVideoId] ?? { useCount: 0, failureCount: 0 };
  return {
    ...stats,
    [youtubeVideoId]: { ...current, failureCount: current.failureCount + 1, statusOverride: 'unavailable' },
  };
}

/** Adapta um CuratedEnglishVideo para o formato DailyEnglishVideo usado pela UI/player do Inglês Diário. */
export function curatedToDailyVideo(video: CuratedEnglishVideo): DailyEnglishVideo {
  return {
    videoId: video.youtubeVideoId,
    title: video.title,
    channel: video.channelTitle,
    level: video.levelGroup === 'beginner' ? 'iniciante' : video.levelGroup === 'intermediate' ? 'intermediário' : 'avançado',
    cefrLevel: video.cefrLevel,
    theme: video.themes[0] ?? 'Listening',
    durationSeconds: video.durationSeconds,
    summary: video.summary ?? '',
    transcript: video.transcript,
  };
}

const CEFR_BY_LEVEL_GROUP: Record<string, EnglishCefrLevel> = {
  beginner: 'A2',
  intermediate: 'B1',
  advanced: 'C1',
};

/**
 * Converte um resultado bruto da API do YouTube (já validado: duração,
 * embeddable, público, processado — ver buscarVideosIngles/
 * validateYouTubeEnglishVideo) num candidato `CuratedEnglishVideo` com
 * status 'needs_validation'. Esses candidatos são DESCOBERTA — não entram
 * na seleção da aula diária até alguém revisar e promover para 'active'
 * (manualmente, copiando para src/data/curatedEnglishVideos.ts).
 */
export function youtubeResultToCuratedCandidate(result: {
  id: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
}, levelGroup: 'beginner' | 'intermediate' | 'advanced'): CuratedEnglishVideo {
  return {
    id: `youtube-${result.id}`,
    youtubeVideoId: result.id,
    title: result.title,
    channelTitle: result.channelTitle,
    durationSeconds: result.durationSeconds,
    cefrLevel: CEFR_BY_LEVEL_GROUP[levelGroup] ?? 'B1',
    levelGroup,
    themes: ['Listening'],
    skills: ['listening'],
    source: 'youtube_api',
    status: 'needs_validation',
    embeddable: true,
    validatedAt: new Date().toISOString(),
    useCount: 0,
    failureCount: 0,
  };
}

/**
 * DESCOBERTA de candidatos novos via API do YouTube — não é chamada pela
 * rotina diária do usuário. Destinada a uso manual (DevTools/console ou
 * uma futura tela de admin) para alimentar o banco curado. Só funciona se
 * VITE_YOUTUBE_API_KEY estiver configurada; lança erro claro se não.
 *
 * Exemplo de uso no console do navegador (com a chave configurada):
 *   const { discoverYouTubeCandidates } = await import('/src/services/englishVideoLibrary.ts');
 *   const candidatos = await discoverYouTubeCandidates('Avançado', 'curto');
 *   console.table(candidatos);
 */
export async function discoverYouTubeCandidates(
  nivel: 'Iniciante' | 'Intermediário' | 'Avançado',
  duracao: 'curto' | 'medio' | 'longo',
  queryIndex = 0,
): Promise<CuratedEnglishVideo[]> {
  if (!isYouTubeEnglishConfigured()) {
    throw new Error('VITE_YOUTUBE_API_KEY não configurada — descoberta de vídeos indisponível.');
  }
  const levelGroup = nivel === 'Iniciante' ? 'beginner' : nivel === 'Intermediário' ? 'intermediate' : 'advanced';
  console.log('[EnglishVideoLibrary] Descobrindo candidatos via YouTube API.', { nivel, duracao, queryIndex });

  const result = await buscarVideosIngles({ nivel, duracao, queryIndex, allowFallback: true });
  const candidates: CuratedEnglishVideo[] = [];
  for (const video of result.videos) {
    const validation = await validateYouTubeEnglishVideo(video.id);
    if (!validation.ok) {
      console.log('[EnglishVideoLibrary] Candidato rejeitado na validação.', { videoId: video.id, motivo: validation.reason });
      continue;
    }
    candidates.push(youtubeResultToCuratedCandidate(video, levelGroup));
  }
  console.log('[EnglishVideoLibrary] Candidatos descobertos e validados:', candidates.length, '| embed de exemplo:', candidates[0] ? getYouTubeEmbedUrl(candidates[0].youtubeVideoId) : '—');
  return candidates;
}

const CEFR_BY_LEVEL_FILTER: Record<EnglishLevelFilter, EnglishCefrLevel> = {
  basic: 'A2',
  intermediate: 'B1',
  advanced: 'C1',
  fluent: 'C2',
};

/**
 * Qualidade mínima CALCULADA PELO APP (0-100) para um candidato vindo da
 * API do YouTube — NÃO é avaliação do YouTube. Usa os mesmos sinais
 * estruturais de calculateVideoQualityScore (em dailyVideoSelector.ts) mais
 * um bônus fixo por já ter passado pela validação de duração/embeddable da
 * própria busca (searchWeeklyVideoCandidates só retorna candidatos válidos).
 * Estatísticas reais de engajamento (view/like/comment count) não estão
 * disponíveis nesta chamada (search + contentDetails/status, sem `statistics`)
 * — quando adicionadas, este cálculo pode ser enriquecido sem mudar a
 * assinatura pública.
 */
export function calculateApiVideoQualityScore(video: BibliotecaVideoResult): number {
  let score = 30; // embeddable confirmado (já filtrado na busca)
  score += 25; // status ativo/processado/público confirmado
  if (video.durationSeconds > 0 && video.durationSeconds <= MAX_VIDEO_DURATION_SECONDS) score += 20;
  if (video.channelTitle && video.channelTitle !== 'Canal não informado') score += 10;
  if (video.title && video.title !== 'Vídeo sem título') score += 10;
  return Math.min(100, score);
}

/** Converte um candidato validado da API (filtro de 4 níveis) num CuratedEnglishVideo pronto para uso (status 'needs_validation'). */
export function apiCandidateToCuratedVideo(video: BibliotecaVideoResult, levelFilter: EnglishLevelFilter): CuratedEnglishVideo {
  return {
    id: `youtube-${video.id}`,
    youtubeVideoId: video.id,
    title: video.title,
    channelTitle: video.channelTitle,
    durationSeconds: video.durationSeconds,
    cefrLevel: CEFR_BY_LEVEL_FILTER[levelFilter],
    levelGroup: LEVEL_FILTER_TO_LEVEL_GROUP[levelFilter],
    themes: ['Listening'],
    skills: ['listening'],
    source: 'youtube_api',
    status: 'needs_validation',
    embeddable: true,
    validatedAt: new Date().toISOString(),
    useCount: 0,
    failureCount: 0,
  };
}

/**
 * Descoberta de candidatos novos para o filtro de nível de 4 opções
 * (Básico/Intermediário/Avançado/Fluente). Só serve para ENRIQUECER o pool
 * quando o banco curado estiver fraco num nível — nunca é pré-requisito
 * para a seção funcionar. Sem VITE_YOUTUBE_API_KEY, devolve lista vazia
 * silenciosamente (nunca lança, nunca quebra a experiência).
 */
export async function discoverWeeklyVideoCandidates(levelFilter: EnglishLevelFilter): Promise<CuratedEnglishVideo[]> {
  if (!isYouTubeEnglishConfigured()) return [];
  const raw = await searchWeeklyVideoCandidates(levelFilter, 10);
  return raw.map(video => apiCandidateToCuratedVideo(video, levelFilter));
}
