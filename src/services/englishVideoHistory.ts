import { getYouTubeEmbedUrl } from './youtubeEnglish';
import { getCurrentWeekKey } from '../utils/weekKey';
import { gerarId } from '../utils';
import type {
  CuratedEnglishVideo,
  EnglishLevelFilter,
  EnglishStudyData,
  WeeklyVideoHistoryEntry,
  WeeklyVideoStatus,
} from '../types/englishStudy';

/**
 * Funções PURAS sobre `EnglishStudyData.weeklyVideoHistory` — o histórico
 * semanal completo (não rotaciona, nunca é apagado entre semanas) usado pela
 * seção "1. Assistir vídeo do dia". Nenhuma função aqui lê/escreve storage
 * diretamente; quem chama decide quando persistir (mesmo padrão das funções
 * de weeklyWords em englishStudyStorage.ts).
 */

/** Todas as entradas da semana atual (ISO week), mais recentes primeiro. */
export function getCurrentWeekHistory(data: EnglishStudyData, weekKey: string = getCurrentWeekKey()): WeeklyVideoHistoryEntry[] {
  return (data.weeklyVideoHistory ?? []).filter(entry => entry.weekKey === weekKey);
}

/** youtubeVideoId já disponibilizados na semana atual — usado para a regra de não-repetição. */
export function getUsedVideoIdsThisWeek(data: EnglishStudyData, weekKey: string = getCurrentWeekKey()): Set<string> {
  return new Set(getCurrentWeekHistory(data, weekKey).map(entry => entry.youtubeVideoId));
}

export function buildWeeklyHistoryEntry(params: {
  video: CuratedEnglishVideo;
  levelFilter: EnglishLevelFilter;
  qualityScore: number;
  status?: WeeklyVideoStatus;
  weekKey?: string;
}): WeeklyVideoHistoryEntry {
  const { video, levelFilter, qualityScore, status = 'available', weekKey = getCurrentWeekKey() } = params;
  return {
    id: gerarId(),
    youtubeVideoId: video.youtubeVideoId,
    title: video.title,
    channelTitle: video.channelTitle,
    levelFilter,
    cefrLevel: video.cefrLevel,
    durationSeconds: video.durationSeconds,
    qualityScore,
    source: video.source === 'youtube_api' ? 'youtube_api' : 'curated',
    status,
    selectedAt: new Date().toISOString(),
    weekKey,
    watchUrl: `https://www.youtube.com/watch?v=${video.youtubeVideoId}`,
    embedUrl: getYouTubeEmbedUrl(video.youtubeVideoId),
  };
}

/** Adiciona uma nova entrada ao histórico semanal (sempre no topo). Nunca remove entradas existentes. */
export function appendWeeklyHistoryEntry(data: EnglishStudyData, entry: WeeklyVideoHistoryEntry): EnglishStudyData {
  return { ...data, weeklyVideoHistory: [entry, ...(data.weeklyVideoHistory ?? [])] };
}

/** Atualiza o status (e opcionalmente o progresso) da entrada mais recente de um vídeo nesta semana. Não cria entrada nova. */
export function updateWeeklyHistoryStatus(
  data: EnglishStudyData,
  youtubeVideoId: string,
  status: WeeklyVideoStatus,
  progressPercent?: number,
  weekKey: string = getCurrentWeekKey(),
): EnglishStudyData {
  const history = data.weeklyVideoHistory ?? [];
  let updated = false;
  const next = history.map(entry => {
    if (updated || entry.youtubeVideoId !== youtubeVideoId || entry.weekKey !== weekKey) return entry;
    updated = true;
    return {
      ...entry,
      status: entry.status === 'completed' ? entry.status : status,
      progressPercent: progressPercent !== undefined ? progressPercent : entry.progressPercent,
    };
  });
  if (!updated) return data;
  return { ...data, weeklyVideoHistory: next };
}

/** Marca a entrada atual da semana como "swapped" (vídeo trocado pelo usuário antes de concluir). */
export function markCurrentWeekEntrySwapped(data: EnglishStudyData, youtubeVideoId: string, weekKey: string = getCurrentWeekKey()): EnglishStudyData {
  return updateWeeklyHistoryStatus(data, youtubeVideoId, 'swapped', undefined, weekKey);
}

/**
 * Reinicia a rotação da semana atual: remove (só) as entradas da semana
 * atual do histórico, permitindo que vídeos já exibidos voltem a ser
 * elegíveis. NÃO afeta semanas anteriores, palavras, shadowing, revisão ou
 * qualquer outro estado de EnglishStudyData.
 */
export function resetCurrentWeekRotation(data: EnglishStudyData, weekKey: string = getCurrentWeekKey()): EnglishStudyData {
  const history = (data.weeklyVideoHistory ?? []).filter(entry => entry.weekKey !== weekKey);
  console.warn('[Inglês Diário] Rotação da semana reiniciada.', { weekKey, entradasRemovidas: (data.weeklyVideoHistory ?? []).length - history.length });
  return { ...data, weeklyVideoHistory: history };
}
