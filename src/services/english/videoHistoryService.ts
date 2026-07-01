// Histórico local de vídeos do YouTube usados no Inglês Diário (Listening e
// Shadowing). Fica numa chave própria — não é tocado pelo reset de dados de
// demonstração nem pela troca de dia, e sobrevive a refresh da página.

const STORAGE_KEY = 'sgp_english_video_history_v1';
const DEFAULT_RECENT_WINDOW_DAYS = 30;

export type VideoHistorySource = 'manualLink' | 'youtubeApiSearch' | 'playlist' | 'fallback';
export type VideoHistoryPurpose = 'listening' | 'shadowing';
export type VideoHistoryStatus = 'active' | 'archived';

export interface VideoHistoryEntry {
  id: string;
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
  thumbnailUrl: string;
  source: VideoHistorySource;
  purpose: VideoHistoryPurpose;
  addedAt: string;
  lastUsedAt: string;
  useCount: number;
  status: VideoHistoryStatus;
}

export interface RecordVideoUsageInput {
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
  thumbnailUrl?: string;
  source: VideoHistorySource;
  purpose: VideoHistoryPurpose;
}

export interface RecordVideoUsageResult {
  entry: VideoHistoryEntry;
  /** Já existia um registro deste vídeo (mesmo videoId + purpose) antes desta chamada. */
  alreadyUsedBefore: boolean;
  /** lastUsedAt do registro anterior, útil para exibir "usado em DD/MM/AAAA". */
  previousLastUsedAt?: string;
}

function genId(): string {
  return `vh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function loadVideoHistory(): VideoHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<VideoHistoryEntry>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is Partial<VideoHistoryEntry> & { videoId: string; purpose: VideoHistoryPurpose } =>
        Boolean(entry?.videoId && entry?.purpose))
      .map(entry => ({
        id: entry.id ?? genId(),
        videoId: entry.videoId!,
        url: entry.url ?? `https://www.youtube.com/watch?v=${entry.videoId}`,
        title: entry.title ?? '',
        channelTitle: entry.channelTitle ?? '',
        durationSeconds: entry.durationSeconds ?? 0,
        thumbnailUrl: entry.thumbnailUrl ?? getYouTubeThumbnailUrl(entry.videoId!),
        source: entry.source ?? 'fallback',
        purpose: entry.purpose!,
        addedAt: entry.addedAt ?? new Date().toISOString(),
        lastUsedAt: entry.lastUsedAt ?? entry.addedAt ?? new Date().toISOString(),
        useCount: entry.useCount ?? 1,
        status: entry.status ?? 'active',
      }));
  } catch {
    return [];
  }
}

export function saveVideoHistory(entries: VideoHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    console.warn('[EnglishV2] Failed to save video history to localStorage.');
  }
}

function findEntry(entries: VideoHistoryEntry[], videoId: string, purpose: VideoHistoryPurpose): VideoHistoryEntry | undefined {
  return entries.find(entry => entry.videoId === videoId && entry.purpose === purpose);
}

/**
 * Registra o uso de um vídeo no histórico. Se já existir um registro para o
 * mesmo videoId+purpose, atualiza lastUsedAt/useCount em vez de duplicar.
 */
export function recordVideoUsage(input: RecordVideoUsageInput): RecordVideoUsageResult {
  const now = new Date().toISOString();
  const entries = loadVideoHistory();
  const existing = findEntry(entries, input.videoId, input.purpose);

  if (existing) {
    const previousLastUsedAt = existing.lastUsedAt;
    const updated: VideoHistoryEntry = {
      ...existing,
      // Preserva título/canal/duração já conhecidos se a nova chamada não trouxer valor melhor.
      title: input.title || existing.title,
      channelTitle: input.channelTitle || existing.channelTitle,
      durationSeconds: input.durationSeconds > 0 ? input.durationSeconds : existing.durationSeconds,
      thumbnailUrl: input.thumbnailUrl ?? existing.thumbnailUrl,
      url: input.url || existing.url,
      status: 'active',
      lastUsedAt: now,
      useCount: existing.useCount + 1,
    };
    const next = entries.map(entry => (entry.id === existing.id ? updated : entry));
    saveVideoHistory(next);
    return { entry: updated, alreadyUsedBefore: true, previousLastUsedAt };
  }

  const created: VideoHistoryEntry = {
    id: genId(),
    videoId: input.videoId,
    url: input.url,
    title: input.title,
    channelTitle: input.channelTitle,
    durationSeconds: input.durationSeconds,
    thumbnailUrl: input.thumbnailUrl ?? getYouTubeThumbnailUrl(input.videoId),
    source: input.source,
    purpose: input.purpose,
    addedAt: now,
    lastUsedAt: now,
    useCount: 1,
    status: 'active',
  };
  saveVideoHistory([created, ...entries]);
  return { entry: created, alreadyUsedBefore: false };
}

/** Atualiza só a duração de um vídeo já no histórico (ex.: detectada depois, via player), sem contar como novo uso. */
export function updateVideoHistoryDuration(videoId: string, purpose: VideoHistoryPurpose, durationSeconds: number): void {
  if (durationSeconds <= 0) return;
  const entries = loadVideoHistory();
  const existing = findEntry(entries, videoId, purpose);
  if (!existing || existing.durationSeconds === durationSeconds) return;
  saveVideoHistory(entries.map(entry => (entry.id === existing.id ? { ...entry, durationSeconds } : entry)));
}

export function getVideoHistoryEntry(videoId: string, purpose: VideoHistoryPurpose): VideoHistoryEntry | undefined {
  return findEntry(loadVideoHistory(), videoId, purpose);
}

/** IDs de vídeos usados recentemente (padrão: últimos 30 dias) para uma finalidade específica. */
export function getRecentlyUsedVideoIds(purpose: VideoHistoryPurpose, withinDays = DEFAULT_RECENT_WINDOW_DAYS): Set<string> {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  return new Set(
    loadVideoHistory()
      .filter(entry => entry.purpose === purpose && entry.status === 'active' && new Date(entry.lastUsedAt).getTime() >= cutoff)
      .map(entry => entry.videoId),
  );
}

/**
 * Dado um conjunto de candidatos já validados (mas todos recentemente usados),
 * escolhe o menos usado recentemente (menor lastUsedAt). Útil como fallback
 * quando a busca automática não encontra nenhum vídeo "novo".
 */
export function pickLeastRecentlyUsed<T extends { youtubeVideoId: string }>(
  candidates: T[],
  purpose: VideoHistoryPurpose,
): T | null {
  if (candidates.length === 0) return null;
  const entries = loadVideoHistory();
  const lastUsedByVideoId = new Map(
    entries.filter(entry => entry.purpose === purpose).map(entry => [entry.videoId, entry.lastUsedAt]),
  );
  return candidates.slice().sort((a, b) => {
    const ta = lastUsedByVideoId.has(a.youtubeVideoId) ? new Date(lastUsedByVideoId.get(a.youtubeVideoId)!).getTime() : 0;
    const tb = lastUsedByVideoId.has(b.youtubeVideoId) ? new Date(lastUsedByVideoId.get(b.youtubeVideoId)!).getTime() : 0;
    return ta - tb;
  })[0];
}
