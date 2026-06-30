import { supabase, isSupabaseConfigured, modoLocalAtivo } from '../lib/supabase';
import { gerarId } from '../utils';
import { calculateNextReview, INITIAL_EASE_FACTOR, type ReviewGrade } from './spacedRepetitionEngine';
import type {
  CuratedVideoStats,
  DailyPlanItem,
  DuolingoStreak,
  EnglishLevelFilter,
  EnglishStudyData,
  PhraseItem,
  PreplyAula,
  SavedEnglishVideo,
  ShadowingSession,
  SpeakingPractice,
  StudySession,
  VocabularyItem,
  WatchedVideoEntry,
  WeeklyVideoHistoryEntry,
  WeeklyWord,
  WeeklyWordSource,
} from '../types/englishStudy';

const TABLE = 'english_study_data';
const LOCAL_KEY = 'english_study_data_local';
const SETUP_ERROR_CODES = new Set(['42P01', 'PGRST205', 'PGRST116']);
const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

function getSaoPauloParts(date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return {
    year: Number(parts.find(part => part.type === 'year')?.value),
    month: Number(parts.find(part => part.type === 'month')?.value),
    day: Number(parts.find(part => part.type === 'day')?.value),
  };
}

function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getCurrentStudyDate(date = new Date()): string {
  const { year, month, day } = getSaoPauloParts(date);
  return isoFromParts(year, month, day);
}

function parseISODateOnly(dateISO: string): Date {
  const [year, month, day] = dateISO.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export const defaultDailyPlanTitles = [
  'Fazer 10 minutos de listening',
  'Revisar vocabulário pendente',
  'Praticar uma resposta em voz alta',
];

export function createEmptyDuolingoStreak(): DuolingoStreak {
  return { currentStreak: 0, longestStreak: 0, lastUpdatedDate: '', history: [] };
}

export function createEmptyEnglishStudyData(date = getCurrentStudyDate()): EnglishStudyData {
  return {
    unavailableVideoIds: [],
    curatedVideoStats: {},
    dailyPlan: defaultDailyPlanTitles.map(title => ({ id: gerarId(), title, done: false, date })),
    sessions: [],
    vocabulary: [],
    phrases: [],
    speakingPractices: [],
    savedVideos: [],
    dailyStudies: [],
    generatedQuizzes: [],
    quizAttempts: [],
    shadowingSessions: [],
    preplyAulas: [],
    duolingoStreak: createEmptyDuolingoStreak(),
    weeklyWords: [],
    watchedVideos: [],
    weeklyVideoHistory: [],
    lastLevelFilter: undefined,
  };
}

function normalizeData(raw: Partial<EnglishStudyData> | null | undefined): EnglishStudyData {
  const base = createEmptyEnglishStudyData();
  return {
    dailyPlan: raw?.dailyPlan?.length ? raw.dailyPlan : base.dailyPlan,
    sessions: raw?.sessions ?? [],
    vocabulary: raw?.vocabulary ?? [],
    phrases: raw?.phrases ?? [],
    speakingPractices: raw?.speakingPractices ?? [],
    savedVideos: raw?.savedVideos ?? [],
    dailyStudies: raw?.dailyStudies ?? [],
    generatedQuizzes: raw?.generatedQuizzes ?? [],
    quizAttempts: raw?.quizAttempts ?? [],
    shadowingSessions: raw?.shadowingSessions ?? [],
    preplyAulas: raw?.preplyAulas ?? [],
    duolingoStreak: raw?.duolingoStreak ?? base.duolingoStreak,
    weeklyWords: (raw?.weeklyWords ?? []).map(migrateWeeklyWord),
    watchedVideos: raw?.watchedVideos ?? [],
    weeklyVideoHistory: Array.isArray(raw?.weeklyVideoHistory) ? raw.weeklyVideoHistory as WeeklyVideoHistoryEntry[] : [],
    lastLevelFilter: raw?.lastLevelFilter,
    // Migração de segurança: versões antigas dos dados não tinham esse campo.
    // Também filtra qualquer lixo não-string que tenha vazado para a lista.
    unavailableVideoIds: Array.isArray(raw?.unavailableVideoIds)
      ? raw.unavailableVideoIds.filter((id): id is string => typeof id === 'string')
      : [],
    // Migração: vídeos já bloqueados no formato antigo (unavailableVideoIds)
    // viram statusOverride 'unavailable' no formato novo, sem perder o bloqueio.
    curatedVideoStats: migrateCuratedVideoStats(raw),
  };
}

function migrateCuratedVideoStats(raw: Partial<EnglishStudyData> | null | undefined): Record<string, CuratedVideoStats> {
  const stats: Record<string, CuratedVideoStats> = { ...(raw?.curatedVideoStats ?? {}) };
  const legacyUnavailable = Array.isArray(raw?.unavailableVideoIds) ? raw.unavailableVideoIds : [];
  for (const id of legacyUnavailable) {
    if (typeof id !== 'string' || stats[id]) continue;
    stats[id] = { useCount: 0, failureCount: 1, statusOverride: 'unavailable' };
  }
  return stats;
}

/**
 * Converte uma WeeklyWord no formato antigo (reviewStage/mastered) para o
 * modelo de repetição espaçada atual. Idempotente: palavras já no formato
 * novo passam direto. Garante que nenhuma palavra seja perdida na migração.
 */
function migrateWeeklyWord(raw: Partial<WeeklyWord> & { word: string; translation: string; id: string; weekStart: string }): WeeklyWord {
  if (raw.status && typeof raw.intervalDays === 'number') {
    return {
      ...raw,
      // Cards antigos só tinham `example` (frase em inglês) — usa como
      // `sentence` se o card ainda não tiver o campo novo preenchido.
      sentence: raw.sentence ?? raw.example,
      createdAt: raw.createdAt ?? raw.addedAt ?? new Date().toISOString(),
      updatedAt: raw.updatedAt ?? raw.addedAt ?? new Date().toISOString(),
      easeFactor: raw.easeFactor ?? INITIAL_EASE_FACTOR,
      lapses: raw.lapses ?? 0,
      totalReviews: raw.totalReviews ?? 0,
      correctReviews: raw.correctReviews ?? 0,
      source: raw.source ?? 'manual',
    } as WeeklyWord;
  }

  const legacyStage = raw.reviewStage ?? 0;
  const legacyIntervals = [1, 3, 7, 14, 30, 60, 90];
  const addedAt = raw.addedAt ?? new Date().toISOString();
  console.log('[EnglishWords] Migrando palavra do formato antigo:', raw.word);
  return {
    id: raw.id,
    word: raw.word,
    translation: raw.translation,
    example: raw.example,
    sentence: raw.example,
    weekStart: raw.weekStart,
    addedAt,
    createdAt: addedAt,
    updatedAt: new Date().toISOString(),
    status: raw.mastered ? 'learned' : 'learning',
    lastReviewedAt: raw.lastReviewedAt,
    nextReviewAt: raw.nextReviewAt ?? getCurrentStudyDate(),
    intervalDays: legacyIntervals[legacyStage] ?? 1,
    repetitions: legacyStage,
    easeFactor: INITIAL_EASE_FACTOR,
    lapses: 0,
    totalReviews: legacyStage,
    correctReviews: legacyStage,
    source: 'manual',
  };
}

function localKeyForUser(userId?: string | null): string {
  return userId ? `${LOCAL_KEY}:${userId}` : LOCAL_KEY;
}

function readLocal(userId?: string | null): EnglishStudyData {
  try {
    const raw = localStorage.getItem(localKeyForUser(userId)) ?? localStorage.getItem(LOCAL_KEY);
    return normalizeData(raw ? JSON.parse(raw) as Partial<EnglishStudyData> : null);
  } catch {
    return createEmptyEnglishStudyData();
  }
}

function saveLocal(data: EnglishStudyData, userId?: string | null): void {
  localStorage.setItem(localKeyForUser(userId), JSON.stringify(data));
}

function hasEnglishContent(data: EnglishStudyData): boolean {
  return [
    data.sessions,
    data.vocabulary,
    data.phrases,
    data.speakingPractices,
    data.savedVideos,
    data.dailyStudies,
    data.generatedQuizzes,
    data.quizAttempts,
    data.shadowingSessions,
    data.preplyAulas,
    data.weeklyWords,
  ].some(list => list.length > 0)
    || data.duolingoStreak.history.length > 0
    || data.dailyPlan.some(item => item.done);
}

function shouldUseLocal(userId?: string | null): boolean {
  return modoLocalAtivo || !isSupabaseConfigured || !userId;
}

function isSetupMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  return SETUP_ERROR_CODES.has(error.code ?? '')
    || message.includes(TABLE)
    || message.includes('could not find the table')
    || message.includes('relation') && message.includes('does not exist');
}

export async function getEnglishStudyData(userId?: string | null): Promise<EnglishStudyData> {
  if (shouldUseLocal(userId)) return readLocal(userId);

  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('user_id', userId!)
    .maybeSingle();

  if (error) {
    if (isSetupMissingError(error)) return readLocal(userId);
    throw error;
  }
  if (!data?.data) {
    const localData = readLocal(userId);
    return hasEnglishContent(localData) ? localData : normalizeData(null);
  }
  const normalized = normalizeData(data.data as Partial<EnglishStudyData>);
  saveLocal(normalized, userId);
  return normalized;
}

export async function saveEnglishStudyData(userId: string | null | undefined, data: EnglishStudyData): Promise<void> {
  console.log('[EnglishStudy] Salvando dados | weeklyWords:', data.weeklyWords.length, '| modo:', shouldUseLocal(userId) ? 'local' : 'supabase');
  if (shouldUseLocal(userId)) {
    saveLocal(data, userId);
    return;
  }

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: userId!, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) {
    if (isSetupMissingError(error)) {
      saveLocal(data, userId);
      return;
    }
    throw error;
  }
  saveLocal(data, userId);
}

async function mutate(userId: string | null | undefined, updater: (data: EnglishStudyData) => EnglishStudyData): Promise<EnglishStudyData> {
  const current = await getEnglishStudyData(userId);
  const next = updater(current);
  await saveEnglishStudyData(userId, next);
  return next;
}

export const addStudySession = (userId: string | null | undefined, session: StudySession) =>
  mutate(userId, data => ({ ...data, sessions: [session, ...data.sessions] }));

export const saveVocabularyItem = (userId: string | null | undefined, item: VocabularyItem) =>
  mutate(userId, data => ({
    ...data,
    vocabulary: data.vocabulary.some(v => v.id === item.id)
      ? data.vocabulary.map(v => v.id === item.id ? item : v)
      : [item, ...data.vocabulary],
  }));

export const deleteVocabularyItem = (userId: string | null | undefined, id: string) =>
  mutate(userId, data => ({ ...data, vocabulary: data.vocabulary.filter(v => v.id !== id) }));

export const savePhraseItem = (userId: string | null | undefined, item: PhraseItem) =>
  mutate(userId, data => ({
    ...data,
    phrases: data.phrases.some(p => p.id === item.id)
      ? data.phrases.map(p => p.id === item.id ? item : p)
      : [item, ...data.phrases],
  }));

export const deletePhraseItem = (userId: string | null | undefined, id: string) =>
  mutate(userId, data => ({ ...data, phrases: data.phrases.filter(p => p.id !== id) }));

export const addSpeakingPractice = (userId: string | null | undefined, practice: SpeakingPractice) =>
  mutate(userId, data => ({ ...data, speakingPractices: [practice, ...data.speakingPractices] }));

export const saveVideo = (userId: string | null | undefined, video: SavedEnglishVideo) =>
  mutate(userId, data => ({
    ...data,
    savedVideos: data.savedVideos.some(v => v.youtubeId === video.youtubeId)
      ? data.savedVideos
      : [video, ...data.savedVideos],
  }));

export const toggleDailyPlanItem = (userId: string | null | undefined, item: DailyPlanItem) =>
  mutate(userId, data => ({
    ...data,
    dailyPlan: data.dailyPlan.map(p => p.id === item.id ? { ...p, done: !p.done } : p),
  }));

// ============================================================
// SHADOWING
// ============================================================
export const addShadowingSession = (userId: string | null | undefined, session: ShadowingSession) =>
  mutate(userId, data => ({ ...data, shadowingSessions: [session, ...data.shadowingSessions] }));

// Inserts on first call for a given id, updates in place on subsequent calls — used by the
// guided shadowing wizard to persist progress incrementally (status 'parcial' until step 5).
export const upsertShadowingSession = (userId: string | null | undefined, session: ShadowingSession) =>
  mutate(userId, data => ({
    ...data,
    shadowingSessions: data.shadowingSessions.some(s => s.id === session.id)
      ? data.shadowingSessions.map(s => s.id === session.id ? session : s)
      : [session, ...data.shadowingSessions],
  }));

// ============================================================
// PREPLY
// ============================================================
export const addPreplyAula = (userId: string | null | undefined, aula: PreplyAula) =>
  mutate(userId, data => ({ ...data, preplyAulas: [aula, ...data.preplyAulas] }));

export const deletePreplyAula = (userId: string | null | undefined, id: string) =>
  mutate(userId, data => ({ ...data, preplyAulas: data.preplyAulas.filter(a => a.id !== id) }));

// ============================================================
// DUOLINGO
// ============================================================
export const saveDuolingoStreak = (userId: string | null | undefined, streak: DuolingoStreak) =>
  mutate(userId, data => ({ ...data, duolingoStreak: streak }));

// ============================================================
// PALAVRAS DA SEMANA (spaced repetition)
// ============================================================
// IMPORTANTE: estas funções são PURAS e SÍNCRONAS — elas recebem o
// `EnglishStudyData` que a página já tem em memória (latestDataRef.current) e
// devolvem o próximo estado, sem ler/escrever storage por conta própria.
//
// Causa raiz do bug de "palavra some sozinha": antes, addWeeklyWord/
// deleteWeeklyWord/reviewWeeklyWord buscavam os dados direto do storage
// (via mutate -> getEnglishStudyData) em vez de usar o estado em memória da
// página. Como a página também salva o progresso do vídeo a cada segundo
// usando o estado em memória (latestDataRef.current), havia uma janela de
// corrida: se esse "save" do vídeo disparasse durante o await da leitura do
// storage feita por addWeeklyWord (especialmente com Supabase, onde a leitura
// é uma chamada de rede), ele sobrescrevia o storage com uma cópia antiga dos
// dados — sem a palavra recém-adicionada — apagando-a. Eliminar a leitura
// paralela do storage remove essa janela de corrida.
const WEEKLY_WORD_CAP = 10;

export function addDaysISO(dateISO: string, days: number): string {
  const date = parseISODateOnly(dateISO);
  date.setDate(date.getDate() + days);
  return isoFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function getWeekStartISO(dateISO: string): string {
  const date = parseISODateOnly(dateISO);
  date.setDate(date.getDate() - date.getDay());
  return isoFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function countWordsInWeek(words: WeeklyWord[], weekStart: string): number {
  return words.filter(w => w.weekStart === weekStart).length;
}

export interface NewWeeklyWordInput {
  word: string;
  translation: string;
  /** @deprecated use `sentence` — mantido para chamadores antigos. */
  example?: string;
  sentence?: string;
  sentenceTranslation?: string;
  weekStart: string;
  source?: WeeklyWordSource;
}

export function createWeeklyWord(word: NewWeeklyWordInput): WeeklyWord {
  const now = new Date().toISOString();
  return {
    id: gerarId(),
    word: word.word,
    translation: word.translation,
    example: word.sentence ?? word.example,
    sentence: word.sentence ?? word.example,
    sentenceTranslation: word.sentenceTranslation,
    weekStart: word.weekStart,
    addedAt: now,
    createdAt: now,
    updatedAt: now,
    status: 'learning',
    nextReviewAt: addDaysISO(getCurrentStudyDate(), 1),
    intervalDays: 0,
    repetitions: 0,
    easeFactor: INITIAL_EASE_FACTOR,
    lapses: 0,
    totalReviews: 0,
    correctReviews: 0,
    source: word.source ?? 'manual',
  };
}

/**
 * Adiciona um card novo. O limite semanal (WEEKLY_WORD_CAP) só controla
 * cards NOVOS — revisões de cards antigos nunca são bloqueadas por ele
 * (ver getDueReviewCards, que ignora `weekStart`).
 */
export function addWeeklyWordToData(data: EnglishStudyData, word: NewWeeklyWordInput): EnglishStudyData {
  const weekCount = countWordsInWeek(data.weeklyWords, word.weekStart);
  if (weekCount >= WEEKLY_WORD_CAP) {
    console.warn('[EnglishWords] Limite semanal (10) atingido — card não adicionado:', word.word);
    return data;
  }
  const newWord = createWeeklyWord(word);
  console.log('[EnglishWords] Card adicionado:', newWord.word, '| id:', newWord.id, '| nextReviewAt:', newWord.nextReviewAt);
  const next = { ...data, weeklyWords: [newWord, ...data.weeklyWords] };
  console.log('[EnglishWords] Total de cards salvos (todas as semanas):', next.weeklyWords.length);
  return next;
}

export function deleteWeeklyWordFromData(data: EnglishStudyData, id: string): EnglishStudyData {
  console.log('[EnglishWords] Removendo card id:', id);
  return { ...data, weeklyWords: data.weeklyWords.filter(w => w.id !== id) };
}

// ----------------------------------------------------------------
// Separação de conceitos: cada uma destas funções olha só para UM
// recorte da lista de cards. Nunca misturar "novos da semana" com
// "vencidos para revisão" — são filtros independentes.
// ----------------------------------------------------------------

/** Cards adicionados NESTA semana (controla só o contador/limite de 10 novos). */
export function getNewWeeklyCards(words: WeeklyWord[], weekStart: string): WeeklyWord[] {
  return words.filter(w => w.weekStart === weekStart);
}

/** Cards vencidos para revisão hoje, de QUALQUER semana — nunca limitado pelo cap semanal. */
export function getDueReviewCards(words: WeeklyWord[], todayISO: string): WeeklyWord[] {
  return words.filter(w => w.status !== 'learned' && w.status !== 'archived' && w.nextReviewAt <= todayISO);
}

/** Cards que completaram a escada de repetição (intervalo ≥ 365 dias com sucesso). */
export function getLearnedCards(words: WeeklyWord[]): WeeklyWord[] {
  return words.filter(w => w.status === 'learned');
}

/** Cards arquivados manualmente (fora da rotação de revisão). */
export function getArchivedCards(words: WeeklyWord[]): WeeklyWord[] {
  return words.filter(w => w.status === 'archived');
}

export function reviewWeeklyWordInData(data: EnglishStudyData, id: string, grade: ReviewGrade): EnglishStudyData {
  const today = getCurrentStudyDate();
  return {
    ...data,
    weeklyWords: data.weeklyWords.map(w => {
      if (w.id !== id) return w;
      const result = calculateNextReview(w, grade, today, addDaysISO);
      console.log('[EnglishWords] Revisão registrada:', w.word, '| nota:', grade, '| próxima revisão:', result.nextReviewAt, '| status:', result.status, '| intervalo(dias):', result.intervalDays);
      return { ...w, ...result, updatedAt: new Date().toISOString() };
    }),
  };
}

// ============================================================
// HISTÓRICO DE VÍDEOS ASSISTIDOS (Inglês Diário)
// ============================================================
// Histórico permanente (nunca rotaciona) — usado para garantir que o vídeo
// do dia e o "Trocar vídeo" nunca repitam um vídeo já assistido/concluído.

/** Todos os videoId já assistidos (status 'watched' ou 'completed'), histórico completo. */
export function getWatchedVideoIds(data: EnglishStudyData): Set<string> {
  return new Set(data.watchedVideos.map(entry => entry.videoId));
}

/**
 * Marca um vídeo como assistido (upsert por videoId). Nunca rebaixa
 * 'completed' de volta para 'watched' — só evolui o status.
 */
export function markVideoWatched(data: EnglishStudyData, entry: Omit<WatchedVideoEntry, 'watchedAt'> & { watchedAt?: string }): EnglishStudyData {
  const watchedAt = entry.watchedAt ?? getCurrentStudyDate();
  const existing = data.watchedVideos.find(item => item.videoId === entry.videoId);
  if (existing) {
    if (existing.status === 'completed' || existing.status === entry.status) return data;
    return {
      ...data,
      watchedVideos: data.watchedVideos.map(item =>
        item.videoId === entry.videoId ? { ...item, status: entry.status } : item,
      ),
    };
  }
  const newEntry: WatchedVideoEntry = { ...entry, watchedAt };
  return { ...data, watchedVideos: [newEntry, ...data.watchedVideos] };
}

const MAX_UNAVAILABLE_VIDEO_IDS = 100;

/**
 * Marca um videoId como confirmadamente quebrado (erro real do player ou
 * falha de validação remota) para que a seleção de vídeo nunca mais o
 * restaure/sugira — nem mesmo após recarregar a página. Lista é persistida
 * e limitada (FIFO) para não crescer indefinidamente.
 */
export function markVideoUnavailableInData(data: EnglishStudyData, videoId: string): EnglishStudyData {
  const alreadyBlocked = data.unavailableVideoIds.includes(videoId) && data.curatedVideoStats[videoId]?.statusOverride === 'unavailable';
  if (alreadyBlocked) return data;
  console.warn('[Inglês Diário] Vídeo marcado como indisponível permanentemente (não será mais sugerido):', videoId);
  const unavailableVideoIds = data.unavailableVideoIds.includes(videoId)
    ? data.unavailableVideoIds
    : [videoId, ...data.unavailableVideoIds].slice(0, MAX_UNAVAILABLE_VIDEO_IDS);
  const current = data.curatedVideoStats[videoId] ?? { useCount: 0, failureCount: 0 };
  const curatedVideoStats = {
    ...data.curatedVideoStats,
    [videoId]: { ...current, failureCount: current.failureCount + 1, statusOverride: 'unavailable' as const },
  };
  return { ...data, unavailableVideoIds, curatedVideoStats };
}

/**
 * Limpa SÓ o estado quebrado de vídeo (vídeos bloqueados, estatísticas de
 * uso/falha) — nunca mexe em palavras/cards, shadowing, quiz ou progresso.
 * Útil quando `unavailableVideoIds` acumulou bloqueios demais (ex.: por
 * instabilidade de rede) e o usuário quer "resetar" só a parte de vídeo.
 */
export function resetVideoStateInData(data: EnglishStudyData): EnglishStudyData {
  console.warn('[Inglês Diário] Resetando estado de vídeo (unavailableVideoIds + curatedVideoStats). Palavras/cards e progresso preservados.');
  return { ...data, unavailableVideoIds: [], curatedVideoStats: {} };
}

// ============================================================
// FILTRO DE NÍVEL (preferência do usuário) — Inglês Diário
// ============================================================
const LEVEL_FILTER_LOCAL_KEY = 'english_daily_video_level_filter';

/** Lê a última escolha do filtro de nível salva localmente (fallback de leitura rápida antes de `data` carregar). */
export function readLastLevelFilterLocal(): EnglishLevelFilter | null {
  try {
    const raw = localStorage.getItem(LEVEL_FILTER_LOCAL_KEY);
    if (raw === 'basic' || raw === 'intermediate' || raw === 'advanced' || raw === 'fluent') return raw;
    return null;
  } catch {
    return null;
  }
}

export function setLevelFilterInData(data: EnglishStudyData, levelFilter: EnglishLevelFilter): EnglishStudyData {
  try {
    localStorage.setItem(LEVEL_FILTER_LOCAL_KEY, levelFilter);
  } catch {
    // localStorage indisponível (modo privado etc.) — segue só com o campo em `data`.
  }
  return { ...data, lastLevelFilter: levelFilter };
}
