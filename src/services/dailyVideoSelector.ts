import type { DailyEnglishVideo } from '../data/englishDailyVideos';
import { getYouTubeEnglishConfigMessage, isYouTubeEnglishConfigured } from './youtubeEnglish';

export type NivelFiltro = 'Iniciante' | 'Intermediário' | 'Avançado';
export type DuracaoFiltro = 'curto' | 'medio' | 'longo';

export const NIVEL_CEFR: Record<NivelFiltro, string[]> = {
  'Iniciante': ['A1', 'A2'],
  'Intermediário': ['B1', 'B2'],
  'Avançado': ['C1', 'C2'],
};

// Ordem de "níveis próximos" usada quando o nível exato pedido não tem
// nenhum vídeo disponível no dataset local — ex.: pediu Avançado (C1/C2)
// mas só existem vídeos B1/B2 cadastrados.
const NEARBY_LEVELS: Record<NivelFiltro, NivelFiltro[]> = {
  'Avançado': ['Intermediário', 'Iniciante'],
  'Intermediário': ['Avançado', 'Iniciante'],
  'Iniciante': ['Intermediário', 'Avançado'],
};

// Janela "estrita" (shadowing 2-5min) tentada primeiro.
export const MIN_SHADOWING_SECONDS = 120;
export const MAX_SHADOWING_SECONDS = 300;
// Janela relaxada usada só quando nada cabe na janela estrita — ainda um
// vídeo curto de listening, com teto mais alto em vez de travar a tela.
const RELAXED_MIN_SECONDS = 60;
const RELAXED_MAX_SECONDS = 600;

export function isWithinShadowingDuration(durationSeconds: number): boolean {
  return durationSeconds >= MIN_SHADOWING_SECONDS && durationSeconds <= MAX_SHADOWING_SECONDS;
}

function withinWindow(seconds: number, min: number, max: number): boolean {
  return seconds >= min && seconds <= max;
}

function pickDeterministic<T>(pool: T[], seed: string): T {
  const hash = Array.from(seed).reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0);
  return pool[Math.abs(hash) % pool.length];
}

export type VideoSelectionSource =
  | 'api'
  | 'local-exact'
  | 'local-relaxed-level'
  | 'local-relaxed-duration'
  | 'local-review';

export interface VideoSelectionResult {
  video: DailyEnglishVideo;
  source: VideoSelectionSource;
  /** true quando reaproveitou um vídeo já assistido por não haver nenhum vídeo novo disponível. */
  isReview: boolean;
}

export interface LocalSelectionContext {
  nivel: NivelFiltro;
  duracao: DuracaoFiltro;
  localVideos: DailyEnglishVideo[];
  /** IDs que nunca podem ser escolhidos (formato inválido ou confirmadamente quebrados). */
  blockedIds: Set<string>;
  /** IDs já assistidos/concluídos — preferência de não repetir, NÃO é regra absoluta. */
  watchedIds: Set<string>;
}

export interface VideoSelectionContext extends LocalSelectionContext {
  /** Busca um candidato via API do YouTube; deve devolver null se falhar/sem candidato. Só é chamada se a API estiver configurada. */
  fetchFromApi?: () => Promise<DailyEnglishVideo | null>;
}

/**
 * Seleção local (síncrona, sem rede) com fallback progressivo:
 *  1. nível exato + janela de duração estrita, nunca assistido
 *  2. níveis próximos + duração estrita, nunca assistido
 *  3. qualquer nível + duração relaxada, nunca assistido
 *  4. modo revisão: reaproveita um vídeo já assistido (a regra de "nunca
 *     repetir" é preferência, não bloqueio absoluto)
 * Garante retorno sempre que `localVideos` tiver pelo menos 1 vídeo fora de
 * `blockedIds` — e, em último caso extremo (todos bloqueados), ignora até o
 * bloqueio para nunca deixar a tela sem nenhum vídeo.
 */
export function selectLocalVideo(ctx: LocalSelectionContext, seed: string): VideoSelectionResult | null {
  if (ctx.localVideos.length === 0) {
    console.warn('[VideoSelector] Dataset local vazio — impossível selecionar vídeo.');
    return null;
  }

  let usable = ctx.localVideos.filter(v => !ctx.blockedIds.has(v.videoId));
  if (usable.length === 0) {
    console.warn('[VideoSelector] Todos os vídeos locais estão bloqueados; ignorando bloqueio como último recurso para não travar a tela.');
    usable = ctx.localVideos;
  }

  // 1) nível exato + duração estrita, nunca assistido
  let pool = usable.filter(v =>
    !ctx.watchedIds.has(v.videoId)
    && NIVEL_CEFR[ctx.nivel].includes(v.cefrLevel)
    && withinWindow(v.durationSeconds, MIN_SHADOWING_SECONDS, MAX_SHADOWING_SECONDS),
  );
  if (pool.length > 0) {
    const video = pickDeterministic(pool, seed);
    console.log('[VideoSelector] Vídeo escolhido (nível exato, duração estrita).', { videoId: video.videoId, candidatos: pool.length });
    return { video, source: 'local-exact', isReview: false };
  }
  console.log('[VideoSelector] Nenhum candidato no nível exato + duração estrita. Relaxando nível...');

  // 2) níveis próximos + duração estrita, nunca assistido
  const nearby = NEARBY_LEVELS[ctx.nivel];
  pool = usable.filter(v =>
    !ctx.watchedIds.has(v.videoId)
    && nearby.some(n => NIVEL_CEFR[n].includes(v.cefrLevel))
    && withinWindow(v.durationSeconds, MIN_SHADOWING_SECONDS, MAX_SHADOWING_SECONDS),
  );
  if (pool.length > 0) {
    const video = pickDeterministic(pool, seed);
    console.log('[VideoSelector] Vídeo escolhido (nível próximo, duração estrita).', { videoId: video.videoId, candidatos: pool.length, nivelPedido: ctx.nivel, nivelEncontrado: video.cefrLevel });
    return { video, source: 'local-relaxed-level', isReview: false };
  }
  console.log('[VideoSelector] Nenhum candidato em níveis próximos. Relaxando duração...');

  // 3) qualquer nível + duração relaxada, nunca assistido
  pool = usable.filter(v =>
    !ctx.watchedIds.has(v.videoId)
    && withinWindow(v.durationSeconds, RELAXED_MIN_SECONDS, RELAXED_MAX_SECONDS),
  );
  if (pool.length > 0) {
    const video = pickDeterministic(pool, seed);
    console.log('[VideoSelector] Vídeo escolhido (duração relaxada, qualquer nível).', { videoId: video.videoId, candidatos: pool.length, duracaoSegundos: video.durationSeconds });
    return { video, source: 'local-relaxed-duration', isReview: false };
  }
  console.log('[VideoSelector] Nenhum vídeo novo em lugar nenhum (API + local esgotados). Reutilizando vídeo já assistido em modo revisão.');

  // 4) modo revisão — reaproveita o vídeo assistido há mais tempo (heurística: ordem determinística pelo seed)
  const video = pickDeterministic(usable, seed);
  console.log('[VideoSelector] Vídeo de revisão escolhido.', { videoId: video.videoId });
  return { video, source: 'local-review', isReview: true };
}

/**
 * Seleção completa com fallback progressivo: tenta a API do YouTube primeiro
 * (só se `VITE_YOUTUBE_API_KEY` estiver configurada) e cai para o dataset
 * local em qualquer outro caso — chave ausente, API fora do ar, quota
 * excedida ou sem candidato válido. Nunca lança: erros da API são
 * capturados e tratados como "sem candidato".
 */
export async function selectNextVideo(ctx: VideoSelectionContext, seed: string): Promise<VideoSelectionResult | null> {
  console.log('[VideoSelector] Iniciando seleção de vídeo.', {
    nivel: ctx.nivel,
    duracao: ctx.duracao,
    totalLocal: ctx.localVideos.length,
    bloqueados: ctx.blockedIds.size,
    assistidos: ctx.watchedIds.size,
    apiConfigurada: isYouTubeEnglishConfigured(),
  });

  if (ctx.fetchFromApi) {
    if (isYouTubeEnglishConfigured()) {
      try {
        console.log('[VideoSelector] Tentando YouTube API como fonte principal...');
        const apiVideo = await ctx.fetchFromApi();
        if (apiVideo) {
          console.log('[VideoSelector] Vídeo escolhido via API do YouTube.', { videoId: apiVideo.videoId, titulo: apiVideo.title });
          return { video: apiVideo, source: 'api', isReview: false };
        }
        console.log('[VideoSelector] API do YouTube não retornou nenhum candidato; caindo para o dataset local.');
      } catch (err) {
        console.warn('[VideoSelector] Busca via YouTube API falhou; usando fallback local.', err instanceof Error ? err.message : err);
      }
    } else {
      console.log('[VideoSelector]', getYouTubeEnglishConfigMessage(), '— usando dataset local diretamente.');
    }
  }

  return selectLocalVideo(ctx, seed);
}
