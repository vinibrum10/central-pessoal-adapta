import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type {
  DailySession,
  GlossaryReview,
  GlossaryReviewCard,
  GlossaryTerm,
  InterviewMissionMetrics,
  InterviewQuestion,
  ListeningEpisode,
  MockSession,
} from '../../types/englishInterview';
import { loadEnglishData } from './englishStorage';
import { calculateLeitnerReview, toDateOnly, type LeitnerResult } from './interviewModeSrs';

const LEGACY_IMPORT_KEY = 'sgp_english_v2_legacy_imported';

function startOfWeekISO(date = new Date()): string {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - copy.getDay());
  return toDateOnly(copy);
}

function shouldUseSupabase(userId?: string | null) {
  return Boolean(isSupabaseConfigured && userId);
}

async function throwIfError<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export async function importLegacyVocabularyIfNeeded(userId?: string | null): Promise<number> {
  if (!shouldUseSupabase(userId)) return 0;
  if (localStorage.getItem(LEGACY_IMPORT_KEY) === 'true') return 0;

  const legacy = loadEnglishData();
  const cards = legacy.vocabularyCards ?? [];
  if (cards.length === 0) {
    localStorage.setItem(LEGACY_IMPORT_KEY, 'true');
    return 0;
  }

  const payload = cards.map(card => ({
    word: 'word' in card ? card.word : card.wordOrPhrase,
    meaning: 'meaning' in card ? card.meaning : card.translation,
    example: card.example,
    reviewStatus: 'reviewStatus' in card
      ? card.reviewStatus
      : card.status === 'mastered'
        ? 'known'
        : card.status === 'reviewing'
          ? 'review'
          : 'learning',
    nextReviewAt: card.nextReviewAt,
  }));

  const imported = await throwIfError<number>(
    supabase.rpc('import_legacy_english_vocabulary', { cards: payload }) as never,
  );
  localStorage.setItem(LEGACY_IMPORT_KEY, 'true');
  return imported ?? 0;
}

export async function getOrCreateDailySession(userId: string, todayISO = toDateOnly()): Promise<DailySession> {
  const existing = await throwIfError<DailySession | null>(
    supabase
      .from('daily_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('session_date', todayISO)
      .maybeSingle() as never,
  );
  if (existing) return existing;

  const created = await throwIfError<DailySession>(
    supabase
      .from('daily_sessions')
      .insert({ user_id: userId, session_date: todayISO })
      .select('*')
      .single() as never,
  );
  return created;
}

export async function updateDailySession(sessionId: string, updates: Partial<DailySession>): Promise<DailySession> {
  return throwIfError<DailySession>(
    supabase
      .from('daily_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select('*')
      .single() as never,
  );
}

export async function listListeningEpisodes(theme?: string, level?: string): Promise<ListeningEpisode[]> {
  let query = supabase
    .from('listening_episodes')
    .select('*, listening_sources(*)')
    .order('created_at', { ascending: true });

  if (theme && theme !== 'all') query = query.contains('themes', [theme]);
  if (level && level !== 'all') query = query.eq('level', level);

  return throwIfError<ListeningEpisode[]>(query as never);
}

export async function getListeningEpisode(id: string | null): Promise<ListeningEpisode | null> {
  if (!id) return null;
  return throwIfError<ListeningEpisode | null>(
    supabase
      .from('listening_episodes')
      .select('*, listening_sources(*)')
      .eq('id', id)
      .maybeSingle() as never,
  );
}

export async function listInterviewQuestions(): Promise<InterviewQuestion[]> {
  return throwIfError<InterviewQuestion[]>(
    supabase
      .from('interview_questions')
      .select('*')
      .order('id', { ascending: true }) as never,
  );
}

export async function getInterviewQuestion(id: string | null): Promise<InterviewQuestion | null> {
  if (!id) return null;
  return throwIfError<InterviewQuestion | null>(
    supabase
      .from('interview_questions')
      .select('*')
      .eq('id', id)
      .maybeSingle() as never,
  );
}

export async function getAnsweredQuestionIds(userId: string): Promise<Set<string>> {
  const [answers, sessions] = await Promise.all([
    throwIfError<Array<{ question_id: string }>>(
      supabase.from('interview_answers').select('question_id').eq('user_id', userId) as never,
    ),
    throwIfError<Array<{ question_id: string | null }>>(
      supabase.from('daily_sessions').select('question_id').eq('user_id', userId).not('question_id', 'is', null) as never,
    ),
  ]);
  return new Set([
    ...answers.map(row => row.question_id),
    ...sessions.map(row => row.question_id).filter((id): id is string => Boolean(id)),
  ]);
}

export async function getReviewCards(limit = 5, todayISO = toDateOnly()): Promise<GlossaryReviewCard[]> {
  const dueReviews = await throwIfError<GlossaryReview[]>(
    supabase
      .from('glossary_reviews')
      .select('*, glossary_terms(*)')
      .lte('next_review', todayISO)
      .order('next_review', { ascending: true })
      .limit(limit) as never,
  );

  const cards: GlossaryReviewCard[] = dueReviews
    .filter(review => review.glossary_terms)
    .map(review => ({
      review,
      term: review.glossary_terms as GlossaryTerm,
      box: review.box,
      next_review: review.next_review,
    }));

  if (cards.length >= limit) return cards;

  const allReviews = await throwIfError<Array<{ term_id: string }>>(
    supabase
      .from('glossary_reviews')
      .select('term_id') as never,
  );
  const excludedIds = Array.from(new Set([
    ...cards.map(card => card.term.id),
    ...allReviews.map(review => review.term_id),
  ]));
  let query = supabase
    .from('glossary_terms')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit * 3);
  if (excludedIds.length > 0) query = query.not('id', 'in', `(${excludedIds.join(',')})`);

  const terms = await throwIfError<GlossaryTerm[]>(query as never);
  const extra = terms
    .filter(term => !cards.some(card => card.term.id === term.id))
    .slice(0, limit - cards.length)
    .map(term => ({
      review: null,
      term,
      box: 1,
      next_review: todayISO,
    }));

  return [...cards, ...extra];
}

export async function reviewGlossaryTerm(userId: string, card: GlossaryReviewCard, result: LeitnerResult): Promise<void> {
  const next = calculateLeitnerReview(card.box, result);
  const row = {
    user_id: userId,
    term_id: card.term.id,
    ...next,
  };

  await throwIfError<GlossaryReview>(
    supabase
      .from('glossary_reviews')
      .upsert(row, { onConflict: 'user_id,term_id' })
      .select('*')
      .single() as never,
  );
}

export async function getMissionMetrics(): Promise<InterviewMissionMetrics> {
  const weekStart = startOfWeekISO();
  const today = toDateOnly();

  const [mastered, seedTerms, shadowing, lastMock] = await Promise.all([
    supabase.from('glossary_reviews').select('id', { count: 'exact', head: true }).eq('box', 5),
    supabase.from('glossary_terms').select('id', { count: 'exact', head: true }).eq('source', 'seed'),
    supabase
      .from('daily_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('step_shadowing_done', true)
      .gte('session_date', weekStart)
      .lte('session_date', today),
    supabase
      .from('mock_sessions')
      .select('*')
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (mastered.error) throw mastered.error;
  if (seedTerms.error) throw seedTerms.error;
  if (shadowing.error) throw shadowing.error;
  if (lastMock.error) throw lastMock.error;

  const mock = lastMock.data as MockSession | null;
  return {
    masteredTerms: mastered.count ?? 0,
    totalSeedTerms: seedTerms.count ?? 200,
    shadowingThisWeek: shadowing.count ?? 0,
    lastMockRating: mock?.rating ?? null,
  };
}

export function isInterviewModeStorageReady(userId?: string | null) {
  return shouldUseSupabase(userId);
}
