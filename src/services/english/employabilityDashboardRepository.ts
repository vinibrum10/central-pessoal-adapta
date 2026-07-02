import { supabase } from '../../lib/supabase';
import type { MockInterviewSession } from '../../types/englishInterview';

async function throwIfError<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export interface AnswersMetrics {
  totalAnswers: number;
  distinctQuestions: number;
  answersLast7Days: number;
  answersLast30Days: number;
}

export interface SpeakingTimeMetrics {
  totalSec: number;
  last7DaysSec: number;
  last30DaysSec: number;
}

export interface AiScoreMetrics {
  evaluatedCount: number;
  averageOverall: number | null;
  averageLast7Days: number | null;
  averageLast30Days: number | null;
  bestScore: number | null;
  latestScore: number | null;
}

export interface VocabularyMetrics {
  totalJobPostingTerms: number;
  mastered: number;
  review: number;
  notMastered: number;
  masteredPercent: number;
}

export interface StarMetrics {
  totalStarAnswers: number;
  distinctQuestionsWithStar: number;
  lastUpdatedAt: string | null;
}

export interface MockMetrics {
  completedCount: number;
  lastCompleted: { title: string | null; completedAt: string | null; overallScore: number | null } | null;
  bestOverallScore: number | null;
  currentMock: { title: string | null; status: 'draft' | 'in_progress'; createdAt: string } | null;
}

export interface EvolutionDashboardData {
  answers: AnswersMetrics;
  speakingTime: SpeakingTimeMetrics;
  aiScores: AiScoreMetrics;
  vocabulary: VocabularyMetrics;
  star: StarMetrics;
  mock: MockMetrics;
  nextAction: string;
}

type AnswerRow = {
  question_id: string;
  duration_sec: number | null;
  gemini_feedback: { score?: number } | null;
  created_at: string;
};

function daysAgoISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function buildNextAction(data: Omit<EvolutionDashboardData, 'nextAction'>): string {
  if (data.vocabulary.totalJobPostingTerms > 0 && data.vocabulary.masteredPercent < 40) {
    return 'Revise 5 termos técnicos hoje.';
  }
  if (data.answers.answersLast7Days < 2) {
    return 'Grave uma resposta de entrevista hoje.';
  }
  if (data.mock.completedCount === 0) {
    return 'Faça seu primeiro mock mensal.';
  }
  if (data.aiScores.averageOverall !== null && data.aiScores.averageOverall < 7) {
    return 'Treine respostas usando STAR.';
  }
  return 'Mantenha a rotina e faça um novo mock na próxima semana.';
}

async function loadAnswerRows(): Promise<AnswerRow[]> {
  return throwIfError<AnswerRow[]>(
    supabase
      .from('interview_answers')
      .select('question_id, duration_sec, gemini_feedback, created_at')
      .order('created_at', { ascending: true }) as never,
  );
}

async function loadVocabularyMetrics(userId: string): Promise<VocabularyMetrics> {
  const terms = await throwIfError<Array<{ id: string }>>(
    supabase
      .from('glossary_terms')
      .select('id')
      .eq('source', 'job_posting') as never,
  );

  const empty: VocabularyMetrics = { totalJobPostingTerms: terms.length, mastered: 0, review: 0, notMastered: 0, masteredPercent: 0 };
  if (terms.length === 0) return empty;

  const statuses = await throwIfError<Array<{ term_id: string; status: 'mastered' | 'review' | 'not_mastered' }>>(
    supabase
      .from('user_glossary_term_status')
      .select('term_id, status')
      .eq('user_id', userId)
      .in('term_id', terms.map(term => term.id)) as never,
  );

  const mastered = statuses.filter(row => row.status === 'mastered').length;
  const review = statuses.filter(row => row.status === 'review').length;
  // Termos sem status explícito contam como "ainda não domino", igual à aba Vocabulário EUA.
  const notMastered = terms.length - mastered - review;

  return {
    totalJobPostingTerms: terms.length,
    mastered,
    review,
    notMastered,
    masteredPercent: Math.round((mastered / terms.length) * 100),
  };
}

async function loadStarMetrics(): Promise<StarMetrics> {
  const rows = await throwIfError<Array<{ question_id: string; updated_at: string }>>(
    supabase
      .from('star_answers')
      .select('question_id, updated_at')
      .order('updated_at', { ascending: false }) as never,
  );

  return {
    totalStarAnswers: rows.length,
    distinctQuestionsWithStar: new Set(rows.map(row => row.question_id)).size,
    lastUpdatedAt: rows[0]?.updated_at ?? null,
  };
}

async function loadMockMetrics(): Promise<MockMetrics> {
  const sessions = await throwIfError<MockInterviewSession[]>(
    supabase
      .from('mock_sessions')
      .select('*')
      .order('created_at', { ascending: false }) as never,
  );

  const completed = sessions.filter(session => session.status === 'completed');
  const withScore = completed.filter(session => typeof session.overall_feedback?.overall_score === 'number');
  const lastCompleted = completed[0] ?? null;
  const best = withScore.reduce<number | null>((max, session) => {
    const score = session.overall_feedback!.overall_score;
    return max === null || score > max ? score : max;
  }, null);
  const current = sessions.find(session => session.status === 'draft' || session.status === 'in_progress') ?? null;

  return {
    completedCount: completed.length,
    lastCompleted: lastCompleted
      ? {
          title: lastCompleted.title,
          completedAt: lastCompleted.completed_at,
          overallScore: lastCompleted.overall_feedback?.overall_score ?? null,
        }
      : null,
    bestOverallScore: best,
    currentMock: current
      ? { title: current.title, status: current.status as 'draft' | 'in_progress', createdAt: current.created_at }
      : null,
  };
}

export async function loadEvolutionDashboard(userId: string): Promise<EvolutionDashboardData> {
  if (!userId) throw new Error('Usuário autenticado não encontrado para carregar o dashboard.');

  const [answerRows, vocabulary, star, mock] = await Promise.all([
    loadAnswerRows(),
    loadVocabularyMetrics(userId),
    loadStarMetrics(),
    loadMockMetrics(),
  ]);

  const cutoff7 = daysAgoISO(7);
  const cutoff30 = daysAgoISO(30);
  const last7 = answerRows.filter(row => row.created_at >= cutoff7);
  const last30 = answerRows.filter(row => row.created_at >= cutoff30);

  const answers: AnswersMetrics = {
    totalAnswers: answerRows.length,
    distinctQuestions: new Set(answerRows.map(row => row.question_id)).size,
    answersLast7Days: last7.length,
    answersLast30Days: last30.length,
  };

  const sumDuration = (rows: AnswerRow[]) => rows.reduce((sum, row) => sum + (row.duration_sec ?? 0), 0);
  const speakingTime: SpeakingTimeMetrics = {
    totalSec: sumDuration(answerRows),
    last7DaysSec: sumDuration(last7),
    last30DaysSec: sumDuration(last30),
  };

  const scoreOf = (row: AnswerRow) => typeof row.gemini_feedback?.score === 'number' ? row.gemini_feedback.score : null;
  const scored = answerRows.filter(row => scoreOf(row) !== null);
  const scoresOf = (rows: AnswerRow[]) => rows.map(scoreOf).filter((value): value is number => value !== null);
  const allScores = scoresOf(answerRows);

  const aiScores: AiScoreMetrics = {
    evaluatedCount: scored.length,
    averageOverall: average(allScores),
    averageLast7Days: average(scoresOf(last7)),
    averageLast30Days: average(scoresOf(last30)),
    bestScore: allScores.length ? Math.max(...allScores) : null,
    latestScore: scored.length ? scoreOf(scored[scored.length - 1]) : null,
  };

  const partial = { answers, speakingTime, aiScores, vocabulary, star, mock };
  return { ...partial, nextAction: buildNextAction(partial) };
}
