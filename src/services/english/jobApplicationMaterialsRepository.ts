import { supabase } from '../../lib/supabase';
import type { JobApplicationMaterials, JobApplicationMaterialsContent } from '../../types/englishInterview';

export async function getJobApplicationMaterials(jobTargetId: string): Promise<JobApplicationMaterials | null> {
  const { data, error } = await supabase
    .from('job_application_materials')
    .select('*')
    .eq('job_target_id', jobTargetId)
    .maybeSingle();
  if (error) throw error;
  return data as JobApplicationMaterials | null;
}

export async function saveJobApplicationMaterials(params: {
  userId: string;
  jobTargetId: string;
  content: JobApplicationMaterialsContent;
}): Promise<JobApplicationMaterials> {
  if (!params.userId) throw new Error('Usuário autenticado não encontrado para salvar os materiais.');

  const { data, error } = await supabase
    .from('job_application_materials')
    .upsert({
      user_id: params.userId,
      job_target_id: params.jobTargetId,
      ...params.content,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,job_target_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as JobApplicationMaterials;
}
