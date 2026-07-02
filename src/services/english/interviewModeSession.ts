import type {
  DailySession,
  EnglishInterviewLevel,
  InterviewModeState,
  InterviewQuestion,
  ListeningEpisode,
} from '../../types/englishInterview';
import {
  getAnsweredQuestionIds,
  getInterviewQuestion,
  getListeningEpisode,
  getMissionMetrics,
  getOrCreateDailySession,
  getReviewCards,
  importLegacyVocabularyIfNeeded,
  listInterviewQuestions,
  listListeningEpisodes,
  updateDailySession,
} from './interviewModeRepository';
import { toDateOnly } from './interviewModeSrs';

export interface LoadInterviewModeOptions {
  userId: string;
  theme?: string;
  level?: EnglishInterviewLevel | 'all';
}

function pickByDate<T>(items: T[], seed: string): T | null {
  if (items.length === 0) return null;
  const hash = Array.from(seed).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
  return items[Math.abs(hash) % items.length];
}

function prioritizeQuestion(questions: InterviewQuestion[], answeredIds: Set<string>, seed: string): InterviewQuestion | null {
  const neverUsed = questions.filter(question => !answeredIds.has(question.id));
  return pickByDate(neverUsed.length > 0 ? neverUsed : questions, seed);
}

function prioritizeEpisode(episodes: ListeningEpisode[], seed: string): ListeningEpisode | null {
  return pickByDate(episodes, seed);
}

async function assignDailyContent(session: DailySession, options: LoadInterviewModeOptions): Promise<DailySession> {
  const updates: Partial<DailySession> = {};

  if (!session.episode_id) {
    const episodes = await listListeningEpisodes(options.theme, options.level);
    const episode = prioritizeEpisode(episodes, `${session.session_date}:episode:${options.theme ?? 'all'}:${options.level ?? 'all'}`);
    if (episode) updates.episode_id = episode.id;
  }

  if (!session.question_id) {
    const [questions, answeredIds] = await Promise.all([
      listInterviewQuestions(),
      getAnsweredQuestionIds(options.userId),
    ]);
    const question = prioritizeQuestion(questions, answeredIds, `${session.session_date}:question`);
    if (question) updates.question_id = question.id;
  }

  if (Object.keys(updates).length === 0) return session;
  return updateDailySession(session.id, updates);
}

export async function reselectDailyEpisode(session: DailySession, options: LoadInterviewModeOptions): Promise<DailySession> {
  const episodes = await listListeningEpisodes(options.theme, options.level);
  const episode = prioritizeEpisode(episodes, `${session.session_date}:episode:${options.theme ?? 'all'}:${options.level ?? 'all'}:manual-change`);
  return updateDailySession(session.id, { episode_id: episode?.id ?? null });
}

export async function loadInterviewModeState(options: LoadInterviewModeOptions): Promise<InterviewModeState> {
  await importLegacyVocabularyIfNeeded(options.userId);

  const today = toDateOnly();
  const baseSession = await getOrCreateDailySession(options.userId, today);
  const session = await assignDailyContent(baseSession, options);

  const [episode, question, reviewCards, metrics] = await Promise.all([
    getListeningEpisode(session.episode_id),
    getInterviewQuestion(session.question_id),
    getReviewCards(5, today),
    getMissionMetrics(),
  ]);

  return {
    session,
    episode,
    question,
    reviewCards,
    metrics,
  };
}
