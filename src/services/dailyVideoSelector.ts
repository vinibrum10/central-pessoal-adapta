import type { DailyEnglishVideo } from '../data/englishDailyVideos';
import type { CuratedEnglishVideo, CuratedVideoLevelGroup } from '../types/englishStudy';
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
 * Seleção completa do vídeo do dia. DECISÃO DE ARQUITETURA: o banco curado
 * local (`ctx.localVideos`, projeção dos vídeos curados ativos — ver
 * src/data/curatedEnglishVideos.ts) é a fonte PRINCIPAL e é tentado
 * PRIMEIRO. A API do YouTube (`ctx.fetchFromApi`) só é chamada como ÚLTIMO
 * RECURSO, e só no caso extremo do banco curado estar literalmente vazio
 * (sem nenhum vídeo ativo) — na prática isso não deveria acontecer com o
 * seed atual. Isso é proposital: a aula diária nunca deve depender de uma
 * busca ao vivo no YouTube para funcionar; a API serve para DESCOBRIR
 * candidatos novos (ver discoverYouTubeCandidates em englishVideoLibrary.ts),
 * não para escolher o vídeo de hoje em tempo real.
 */
export async function selectNextVideo(ctx: VideoSelectionContext, seed: string): Promise<VideoSelectionResult | null> {
  console.log('[VideoSelector] Iniciando seleção de vídeo (banco curado é a fonte principal).', {
    nivel: ctx.nivel,
    duracao: ctx.duracao,
    totalLocal: ctx.localVideos.length,
    bloqueados: ctx.blockedIds.size,
    assistidos: ctx.watchedIds.size,
    apiConfigurada: isYouTubeEnglishConfigured(),
  });

  const localResult = selectLocalVideo(ctx, seed);
  if (localResult) return localResult;

  console.warn('[VideoSelector] Banco curado local vazio — recorrendo à API do YouTube como último recurso (descoberta ao vivo).');
  if (ctx.fetchFromApi && isYouTubeEnglishConfigured()) {
    try {
      const apiVideo = await ctx.fetchFromApi();
      if (apiVideo) {
        console.log('[VideoSelector] Vídeo escolhido via API do YouTube (último recurso).', { videoId: apiVideo.videoId, titulo: apiVideo.title });
        return { video: apiVideo, source: 'api', isReview: false };
      }
    } catch (err) {
      console.warn('[VideoSelector] Busca via YouTube API falhou.', err instanceof Error ? err.message : err);
    }
  } else if (!isYouTubeEnglishConfigured()) {
    console.log('[VideoSelector]', getYouTubeEnglishConfigMessage());
  }

  return null;
}

// ============================================================
// SELETOR NATIVO DO BANCO CURADO (CuratedEnglishVideo) — Parte 4 do pedido
// ============================================================
const LEVEL_GROUP_NEARBY: Record<CuratedVideoLevelGroup, CuratedVideoLevelGroup[]> = {
  advanced: ['intermediate', 'beginner'],
  intermediate: ['advanced', 'beginner'],
  beginner: ['intermediate', 'advanced'],
};

export type VideoSelectionMode = 'daily' | 'change' | 'recovery';

export interface SelectDailyEnglishVideoParams {
  curatedVideos: CuratedEnglishVideo[];
  userLevel: CuratedVideoLevelGroup;
  preferredThemes?: string[];
  watchedVideoIds: Set<string>;
  completedVideoIds: Set<string>;
  unavailableVideoIds: Set<string>;
  currentVideoId?: string | null;
  mode: VideoSelectionMode;
}

export interface CuratedVideoSelectionResult {
  video: CuratedEnglishVideo;
  isReview: boolean;
  reason: string;
}

/**
 * Seletor nativo do banco curado — opera direto sobre `CuratedEnglishVideo`
 * (sem o adapter para `DailyEnglishVideo`), pensado para uso futuro
 * server-side/admin ou quando o restante da página migrar para consumir o
 * tipo curado diretamente. Implementa as mesmas 10 regras do pedido:
 * banco curado ativo -> nunca indisponível -> prefere não concluído ->
 * nível exato -> níveis próximos -> modo revisão -> nunca retorna null se
 * houver >=1 vídeo ativo -> nunca repete o vídeo atual ao trocar, se houver
 * alternativa. A API do YouTube NÃO é chamada aqui — descoberta é
 * responsabilidade de discoverYouTubeCandidates (englishVideoLibrary.ts).
 */
export function selectDailyEnglishVideo(params: SelectDailyEnglishVideoParams): CuratedVideoSelectionResult | null {
  const { curatedVideos, userLevel, preferredThemes, watchedVideoIds, completedVideoIds, unavailableVideoIds, currentVideoId, mode } = params;

  const blockedForChange = mode !== 'daily' && currentVideoId ? new Set([...unavailableVideoIds, currentVideoId]) : unavailableVideoIds;

  let active = curatedVideos.filter(v => v.status === 'active' && !blockedForChange.has(v.youtubeVideoId));
  if (active.length === 0) {
    // Nem trocando dá pra evitar o vídeo atual — usa qualquer ativo não-bloqueado-de-verdade.
    active = curatedVideos.filter(v => v.status === 'active' && !unavailableVideoIds.has(v.youtubeVideoId));
  }
  if (active.length === 0) {
    console.warn('[CuratedVideoSelector] Nenhum vídeo ativo e disponível no banco curado.', { total: curatedVideos.length });
    return null;
  }

  const byTheme = (pool: CuratedEnglishVideo[]) => {
    if (!preferredThemes || preferredThemes.length === 0) return pool;
    const matched = pool.filter(v => v.themes.some(t => preferredThemes.includes(t)));
    return matched.length > 0 ? matched : pool;
  };

  const tiers: Array<{ reason: string; pool: CuratedEnglishVideo[] }> = [
    {
      reason: 'nível exato, nunca assistido',
      pool: byTheme(active.filter(v => v.levelGroup === userLevel && !watchedVideoIds.has(v.youtubeVideoId))),
    },
    {
      reason: 'nível próximo, nunca assistido',
      pool: byTheme(active.filter(v => LEVEL_GROUP_NEARBY[userLevel].includes(v.levelGroup) && !watchedVideoIds.has(v.youtubeVideoId))),
    },
    {
      reason: 'qualquer nível, nunca assistido',
      pool: byTheme(active.filter(v => !watchedVideoIds.has(v.youtubeVideoId))),
    },
    {
      reason: 'assistido mas não concluído (terminar antes de revisar)',
      pool: active.filter(v => watchedVideoIds.has(v.youtubeVideoId) && !completedVideoIds.has(v.youtubeVideoId)),
    },
  ];

  for (const tier of tiers) {
    if (tier.pool.length === 0) continue;
    const video = pickLeastUsed(tier.pool);
    console.log('[CuratedVideoSelector] Vídeo escolhido.', { reason: tier.reason, videoId: video.youtubeVideoId, candidatos: tier.pool.length });
    return { video, isReview: false, reason: tier.reason };
  }

  // Modo revisão: todos já assistidos/concluídos — reaproveita o menos usado recentemente.
  const video = pickLeastUsed(active);
  console.log('[CuratedVideoSelector] Modo revisão — reaproveitando vídeo já visto.', { videoId: video.youtubeVideoId });
  return { video, isReview: true, reason: 'modo revisão — nenhum vídeo novo disponível' };
}

function pickLeastUsed(pool: CuratedEnglishVideo[]): CuratedEnglishVideo {
  return [...pool].sort((a, b) => a.useCount - b.useCount || (a.lastUsedAt ?? '').localeCompare(b.lastUsedAt ?? ''))[0];
}
