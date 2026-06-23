import { supabase, isSupabaseConfigured, modoLocalAtivo } from '../lib/supabase';
import { gerarId, hojeISO } from '../utils';
import type {
  DailyPlanItem,
  EnglishStudyData,
  PhraseItem,
  SavedEnglishVideo,
  SpeakingPractice,
  StudySession,
  VocabularyItem,
} from '../types/englishStudy';

const TABLE = 'english_study_data';
const LOCAL_KEY = 'english_study_data_local';
const SETUP_ERROR_CODES = new Set(['42P01', 'PGRST205', 'PGRST116']);

export const defaultDailyPlanTitles = [
  'Fazer 10 minutos de listening',
  'Revisar vocabulário pendente',
  'Praticar uma resposta em voz alta',
];

export function createEmptyEnglishStudyData(date = hojeISO()): EnglishStudyData {
  return {
    dailyPlan: defaultDailyPlanTitles.map(title => ({ id: gerarId(), title, done: false, date })),
    sessions: [],
    vocabulary: [],
    phrases: [],
    speakingPractices: [],
    savedVideos: [],
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
