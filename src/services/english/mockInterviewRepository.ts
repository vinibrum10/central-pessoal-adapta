import { supabase } from '../../lib/supabase';
import type {
  MockInterviewOverallFeedback,
  MockInterviewSession,
  MockSessionQuestion,
} from '../../types/englishInterview';

async function throwIfError<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

const MOCK_SESSION_QUESTIONS_SELECT = '*, interview_questions(*), interview_answers(*)';

export async function listMockSessions(): Promise<MockInterviewSession[]> {
  return throwIfError<MockInterviewSession[]>(
    supabase
      .from('mock_sessions')
      .select('*')
      .order('created_at', { ascending: false }) as never,
  );
}

export async function getMockSession(mockSessionId: string): Promise<MockInterviewSession> {
  return throwIfError<MockInterviewSession>(
    supabase
      .from('mock_sessions')
      .select('*')
      .eq('id', mockSessionId)
      .single() as never,
  );
}

export async function listMockSessionQuestions(mockSessionId: string): Promise<MockSessionQuestion[]> {
  return throwIfError<MockSessionQuestion[]>(
    supabase
      .from('mock_session_questions')
      .select(MOCK_SESSION_QUESTIONS_SELECT)
      .eq('mock_session_id', mockSessionId)
      .order('position', { ascending: true }) as never,
  );
}

export async function createMockSession(params: {
  userId: string;
  questionIds: string[];
  title?: string;
}): Promise<MockInterviewSession> {
  if (params.questionIds.length === 0) {
    throw new Error('Selecione ao menos uma pergunta para criar o mock.');
  }

  const session = await throwIfError<MockInterviewSession>(
    supabase
      .from('mock_sessions')
      .insert({
        user_id: params.userId,
        title: params.title?.trim() || null,
        status: 'draft',
        question_ids: params.questionIds,
      })
      .select('*')
      .single() as never,
  );

  const rows = params.questionIds.map((questionId, index) => ({
    mock_session_id: session.id,
    question_id: questionId,
    position: index,
  }));

  const { error } = await supabase.from('mock_session_questions').insert(rows);
  if (error) throw error;

  return session;
}

export async function linkAnswerToMockQuestion(params: {
  mockSessionId: string;
  questionId: string;
  answerId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('mock_session_questions')
    .update({ answer_id: params.answerId, score: null })
    .eq('mock_session_id', params.mockSessionId)
    .eq('question_id', params.questionId);
  if (error) throw error;

  await updateMockSessionStatus(params.mockSessionId, 'in_progress');
}

export async function updateMockSessionQuestionScore(params: {
  mockSessionId: string;
  questionId: string;
  score: number;
}): Promise<void> {
  const { error } = await supabase
    .from('mock_session_questions')
    .update({ score: params.score })
    .eq('mock_session_id', params.mockSessionId)
    .eq('question_id', params.questionId);
  if (error) throw error;
}

export async function updateMockSessionStatus(mockSessionId: string, status: 'draft' | 'in_progress' | 'completed'): Promise<void> {
  const current = await getMockSession(mockSessionId);
  if (current.status === status || (current.status !== 'draft' && status === 'in_progress')) return;

  const { error } = await supabase
    .from('mock_sessions')
    .update({ status })
    .eq('id', mockSessionId);
  if (error) throw error;
}

export async function saveMockOverallFeedback(params: {
  mockSessionId: string;
  feedback: MockInterviewOverallFeedback;
  totalDurationSec: number;
}): Promise<MockInterviewSession> {
  return throwIfError<MockInterviewSession>(
    supabase
      .from('mock_sessions')
      .update({
        overall_feedback: params.feedback,
        total_duration_sec: params.totalDurationSec,
        status: 'completed',
        completed_at: new Date().toISOString(),
        rating: params.feedback.overall_score,
      })
      .eq('id', params.mockSessionId)
      .select('*')
      .single() as never,
  );
}
