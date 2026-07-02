import { supabase } from '../../lib/supabase';
import type { InterviewAnswer, InterviewAnswerFeedback } from '../../types/englishInterview';
import { extensionFromMimeType, INTERVIEW_AUDIO_BUCKET } from './interviewAudio';

async function throwIfError<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export async function createInterviewAnswer(params: {
  userId: string;
  questionId: string;
  durationSec: number;
  selfRating: number;
  mockSessionId?: string | null;
}): Promise<InterviewAnswer> {
  return throwIfError<InterviewAnswer>(
    supabase
      .from('interview_answers')
      .insert({
        user_id: params.userId,
        question_id: params.questionId,
        duration_sec: params.durationSec,
        self_rating: params.selfRating,
        mock_session_id: params.mockSessionId ?? null,
      })
      .select('*')
      .single() as never,
  );
}

export async function uploadInterviewAnswerAudio(params: {
  userId: string;
  answerId: string;
  audio: Blob;
  mimeType: string;
}): Promise<string> {
  const ext = extensionFromMimeType(params.mimeType);
  const path = `${params.userId}/${params.answerId}.${ext}`;
  const { error } = await supabase.storage
    .from(INTERVIEW_AUDIO_BUCKET)
    .upload(path, params.audio, {
      contentType: params.mimeType,
      upsert: true,
    });
  if (error) throw error;
  return path;
}

export async function updateInterviewAnswer(answerId: string, updates: Partial<InterviewAnswer>): Promise<InterviewAnswer> {
  return throwIfError<InterviewAnswer>(
    supabase
      .from('interview_answers')
      .update(updates)
      .eq('id', answerId)
      .select('*')
      .single() as never,
  );
}

export async function saveInterviewAnswerWithAudio(params: {
  userId: string;
  questionId: string;
  audio: Blob;
  mimeType: string;
  durationSec: number;
  selfRating: number;
  mockSessionId?: string | null;
}): Promise<InterviewAnswer> {
  const answer = await createInterviewAnswer({
    userId: params.userId,
    questionId: params.questionId,
    durationSec: params.durationSec,
    selfRating: params.selfRating,
    mockSessionId: params.mockSessionId,
  });
  const audioPath = await uploadInterviewAnswerAudio({
    userId: params.userId,
    answerId: answer.id,
    audio: params.audio,
    mimeType: params.mimeType,
  });
  return updateInterviewAnswer(answer.id, { audio_path: audioPath });
}

export async function listInterviewAnswers(questionId: string): Promise<InterviewAnswer[]> {
  const answers = await throwIfError<InterviewAnswer[]>(
    supabase
      .from('interview_answers')
      .select('*')
      .eq('question_id', questionId)
      .order('created_at', { ascending: false }) as never,
  );

  return Promise.all(answers.map(async answer => {
    if (!answer.audio_path) return answer;
    const { data, error } = await supabase.storage
      .from(INTERVIEW_AUDIO_BUCKET)
      .createSignedUrl(answer.audio_path, 60 * 15);
    if (error) return answer;
    return { ...answer, audioUrl: data.signedUrl };
  }));
}

export async function saveAnswerFeedback(answerId: string, feedback: InterviewAnswerFeedback): Promise<InterviewAnswer> {
  return updateInterviewAnswer(answerId, { gemini_feedback: feedback });
}
