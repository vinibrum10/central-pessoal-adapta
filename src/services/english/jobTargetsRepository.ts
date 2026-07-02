import { supabase } from '../../lib/supabase';
import type { JobTarget, JobTargetAnalysis, JobTargetInput, JobTargetStatus } from '../../types/englishInterview';

async function throwIfError<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

function normalizeInput(input: JobTargetInput) {
  return {
    title: input.title.trim(),
    company: input.company.trim() || null,
    location: input.location.trim() || null,
    job_url: input.job_url.trim() || null,
    description: input.description.trim(),
    status: input.status,
  };
}

export async function listJobTargets(): Promise<JobTarget[]> {
  return throwIfError<JobTarget[]>(
    supabase
      .from('job_targets')
      .select('*')
      .order('created_at', { ascending: false }) as never,
  );
}

export async function createJobTarget(userId: string, input: JobTargetInput): Promise<JobTarget> {
  if (!userId) throw new Error('Usuário autenticado não encontrado para salvar a vaga.');
  return throwIfError<JobTarget>(
    supabase
      .from('job_targets')
      .insert({ user_id: userId, ...normalizeInput(input) })
      .select('*')
      .single() as never,
  );
}

export async function updateJobTarget(jobTargetId: string, input: JobTargetInput): Promise<JobTarget> {
  return throwIfError<JobTarget>(
    supabase
      .from('job_targets')
      .update(normalizeInput(input))
      .eq('id', jobTargetId)
      .select('*')
      .single() as never,
  );
}

export async function updateJobTargetStatus(jobTargetId: string, status: JobTargetStatus): Promise<JobTarget> {
  return throwIfError<JobTarget>(
    supabase
      .from('job_targets')
      .update({
        status,
        archived_at: status === 'archived' ? new Date().toISOString() : null,
      })
      .eq('id', jobTargetId)
      .select('*')
      .single() as never,
  );
}

export async function archiveJobTarget(jobTargetId: string): Promise<JobTarget> {
  return updateJobTargetStatus(jobTargetId, 'archived');
}

export async function saveJobTargetAnalysis(jobTargetId: string, analysis: JobTargetAnalysis): Promise<JobTarget> {
  return throwIfError<JobTarget>(
    supabase
      .from('job_targets')
      .update({
        ai_analysis: analysis,
        match_score: analysis.match_score,
      })
      .eq('id', jobTargetId)
      .select('*')
      .single() as never,
  );
}
