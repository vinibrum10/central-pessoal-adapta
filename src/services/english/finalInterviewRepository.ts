import { supabase } from '../../lib/supabase';
import type {
  FinalInterviewFocusArea,
  FinalInterviewOverallFeedback,
  FinalInterviewQuestionRow,
  FinalInterviewSimulation,
  FinalInterviewStatus,
  GeneratedFinalInterviewQuestion,
  InterviewAnswerFeedback,
} from '../../types/englishInterview';
import { extensionFromMimeType, INTERVIEW_AUDIO_BUCKET } from './interviewAudio';

async function throwIfError<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export async function listFinalInterviewSimulations(): Promise<FinalInterviewSimulation[]> {
  return throwIfError<FinalInterviewSimulation[]>(
    supabase
      .from('final_interview_simulations')
      .select('*')
      .order('created_at', { ascending: false }) as never,
  );
}

export async function getFinalInterviewSimulation(simulationId: string): Promise<FinalInterviewSimulation> {
  return throwIfError<FinalInterviewSimulation>(
    supabase
      .from('final_interview_simulations')
      .select('*')
      .eq('id', simulationId)
      .single() as never,
  );
}

export async function listFinalInterviewQuestions(simulationId: string): Promise<FinalInterviewQuestionRow[]> {
  const rows = await throwIfError<FinalInterviewQuestionRow[]>(
    supabase
      .from('final_interview_questions')
      .select('*')
      .eq('simulation_id', simulationId)
      .order('sort_order', { ascending: true }) as never,
  );

  return Promise.all(rows.map(async row => {
    if (!row.audio_path) return row;
    const { data, error } = await supabase.storage
      .from(INTERVIEW_AUDIO_BUCKET)
      .createSignedUrl(row.audio_path, 60 * 15);
    if (error) return row;
    return { ...row, audioUrl: data.signedUrl };
  }));
}

export async function createFinalInterviewSimulation(params: {
  userId: string;
  title: string;
  focusArea: FinalInterviewFocusArea;
  jobTargetId: string | null;
  questions: GeneratedFinalInterviewQuestion[];
}): Promise<FinalInterviewSimulation> {
  if (params.questions.length === 0) {
    throw new Error('Não foi possível montar as perguntas do simulado. Confira o seed do banco de perguntas.');
  }

  const simulation = await throwIfError<FinalInterviewSimulation>(
    supabase
      .from('final_interview_simulations')
      .insert({
        user_id: params.userId,
        title: params.title.trim() || 'Simulado final de 30 minutos',
        focus_area: params.focusArea,
        job_target_id: params.jobTargetId,
        status: 'draft',
        estimated_duration_min: 30,
        question_count: params.questions.length,
      })
      .select('*')
      .single() as never,
  );

  const rows = params.questions.map(question => ({
    user_id: params.userId,
    simulation_id: simulation.id,
    question_text: question.question_text,
    question_category: question.question_category,
    guidance: question.guidance,
    suggested_duration_sec: question.suggested_duration_sec,
    sort_order: question.sort_order,
    source_type: question.source_type,
    source_ref_id: question.source_ref_id,
  }));

  const { error } = await supabase.from('final_interview_questions').insert(rows);
  if (error) throw error;

  return simulation;
}

export async function updateFinalSimulationStatus(simulationId: string, status: FinalInterviewStatus): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === 'in_progress') updates.started_at = new Date().toISOString();
  if (status === 'completed') updates.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from('final_interview_simulations')
    .update(updates)
    .eq('id', simulationId);
  if (error) throw error;
}

export async function saveFinalAnswerAudio(params: {
  userId: string;
  simulation: FinalInterviewSimulation;
  questionRowId: string;
  audio: Blob;
  mimeType: string;
  durationSec: number;
}): Promise<FinalInterviewQuestionRow> {
  const ext = extensionFromMimeType(params.mimeType);
  // Mesmo bucket e prefixo {user_id}/ das respostas normais — as policies de Storage já cobrem.
  const path = `${params.userId}/final-${params.questionRowId}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(INTERVIEW_AUDIO_BUCKET)
    .upload(path, params.audio, { contentType: params.mimeType, upsert: true });
  if (uploadError) throw uploadError;

  const row = await throwIfError<FinalInterviewQuestionRow>(
    supabase
      .from('final_interview_questions')
      .update({ audio_path: path, duration_sec: params.durationSec, individual_feedback: null })
      .eq('id', params.questionRowId)
      .select('*')
      .single() as never,
  );

  if (params.simulation.status === 'draft') {
    await updateFinalSimulationStatus(params.simulation.id, 'in_progress');
  }

  return row;
}

export async function saveFinalQuestionFeedback(questionRowId: string, feedback: InterviewAnswerFeedback): Promise<FinalInterviewQuestionRow> {
  return throwIfError<FinalInterviewQuestionRow>(
    supabase
      .from('final_interview_questions')
      .update({ individual_feedback: feedback })
      .eq('id', questionRowId)
      .select('*')
      .single() as never,
  );
}

export async function saveFinalOverallFeedback(params: {
  simulationId: string;
  feedback: FinalInterviewOverallFeedback;
}): Promise<FinalInterviewSimulation> {
  return throwIfError<FinalInterviewSimulation>(
    supabase
      .from('final_interview_simulations')
      .update({
        overall_feedback: params.feedback,
        readiness_score: params.feedback.readiness_score,
        status: 'evaluated',
        completed_at: new Date().toISOString(),
      })
      .eq('id', params.simulationId)
      .select('*')
      .single() as never,
  );
}

export async function archiveFinalSimulation(simulationId: string): Promise<void> {
  await updateFinalSimulationStatus(simulationId, 'archived');
}
