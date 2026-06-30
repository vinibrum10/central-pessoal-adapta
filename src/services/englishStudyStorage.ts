import { supabase, isSupabaseConfigured, modoLocalAtivo } from '../lib/supabase';
import { gerarId, hojeISO } from '../utils';
import type {
  DailyPlanItem,
  DuolingoStreak,
  EnglishStudyData,
  PhraseItem,
  PreplyAula,
  SavedEnglishVideo,
  ShadowingSession,
  SpeakingPractice,
  StudySession,
  VocabularyItem,
  WeeklyWord,
} from '../types/englishStudy';

const TABLE = 'english_study_data';
const LOCAL_KEY = 'english_study_data_local';
const SETUP_ERROR_CODES = new Set(['42P01', 'PGRST205', 'PGRST116']);

export const defaultDailyPlanTitles = [
  'Fazer 10 minutos de listening',
  'Revisar vocabulário pendente',
  'Praticar uma resposta em voz alta',
];

export function createEmptyDuolingoStreak(): DuolingoStreak {
  return { currentStreak: 0, longestStreak: 0, lastUpdatedDate: '', history: [] };
}

export function createEmptyEnglishStudyData(date = hojeISO()): EnglishStudyData {
  return {
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
    weeklyWords: raw?.weeklyWords ?? [],
  };
}

function readLocal(): EnglishStudyData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return normalizeData(raw ? JSON.parse(raw) as Partial<EnglishStudyData> : null);
  } catch {
    return createEmptyEnglishStudyData();
  }
}

function saveLocal(data: EnglishStudyData): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
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
  if (shouldUseLocal(userId)) return readLocal();

  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('user_id', userId!)
    .maybeSingle();

  if (error) {
    if (isSetupMissingError(error)) return readLocal();
    throw error;
  }
  return normalizeData(data?.data as Partial<EnglishStudyData> | null);
}

export async function saveEnglishStudyData(userId: string | null | undefined, data: EnglishStudyData): Promise<void> {
  if (shouldUseLocal(userId)) {
    saveLocal(data);
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
      saveLocal(data);
      return;
    }
    throw error;
  }
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
const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 90];
const WEEKLY_WORD_CAP = 10;

export function addDaysISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getWeekStartISO(dateISO: string): string {
  const date = new Date(`${dateISO}T00:00:00`);
  date.setDate(date.getDate() - date.getDay());
  return date.toISOString().slice(0, 10);
}

export function countWordsInWeek(words: WeeklyWord[], weekStart: string): number {
  return words.filter(w => w.weekStart === weekStart).length;
}

export const addWeeklyWord = (userId: string | null | undefined, word: Omit<WeeklyWord, 'id' | 'addedAt' | 'nextReviewAt' | 'reviewStage' | 'mastered'>) =>
  mutate(userId, data => {
    const weekCount = countWordsInWeek(data.weeklyWords, word.weekStart);
    if (weekCount >= WEEKLY_WORD_CAP) return data;
    const newWord: WeeklyWord = {
      ...word,
      id: gerarId(),
      addedAt: new Date().toISOString(),
      nextReviewAt: addDaysISO(hojeISO(), REVIEW_INTERVALS_DAYS[0]),
      reviewStage: 0,
      mastered: false,
    };
    return { ...data, weeklyWords: [newWord, ...data.weeklyWords] };
  });

export const deleteWeeklyWord = (userId: string | null | undefined, id: string) =>
  mutate(userId, data => ({ ...data, weeklyWords: data.weeklyWords.filter(w => w.id !== id) }));

export const reviewWeeklyWord = (userId: string | null | undefined, id: string, remembered: boolean) =>
  mutate(userId, data => ({
    ...data,
    weeklyWords: data.weeklyWords.map(w => {
      if (w.id !== id) return w;
      const nextStage = remembered ? Math.min(w.reviewStage + 1, REVIEW_INTERVALS_DAYS.length - 1) : 0;
      const mastered = remembered && w.reviewStage >= REVIEW_INTERVALS_DAYS.length - 1;
      return {
        ...w,
        reviewStage: nextStage,
        lastReviewedAt: new Date().toISOString(),
        nextReviewAt: addDaysISO(hojeISO(), REVIEW_INTERVALS_DAYS[nextStage]),
        mastered,
      };
    }),
  }));
