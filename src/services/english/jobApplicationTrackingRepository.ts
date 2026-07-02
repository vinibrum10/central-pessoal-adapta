import { supabase } from '../../lib/supabase';
import type { JobApplicationTrackingInput, JobTarget } from '../../types/englishInterview';

async function throwIfError<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

export async function updateJobApplicationTracking(
  jobTargetId: string,
  input: JobApplicationTrackingInput,
): Promise<JobTarget> {
  return throwIfError<JobTarget>(
    supabase
      .from('job_targets')
      .update({
        status: input.status,
        applied_at: input.applied_at,
        interview_at: input.interview_at,
        follow_up_at: input.follow_up_at,
        next_action: optionalText(input.next_action),
        application_notes: optionalText(input.application_notes),
        recruiter_name: optionalText(input.recruiter_name),
        recruiter_contact: optionalText(input.recruiter_contact),
        salary_range: optionalText(input.salary_range),
        work_model: input.work_model || null,
        visa_sponsorship: optionalText(input.visa_sponsorship),
        priority: input.priority || null,
        archived_at: input.status === 'archived' ? new Date().toISOString() : null,
      })
      .eq('id', jobTargetId)
      .select('*')
      .single() as never,
  );
}
