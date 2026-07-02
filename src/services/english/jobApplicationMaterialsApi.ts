import type { JobApplicationMaterialsContent, JobTarget } from '../../types/englishInterview';

interface ErrorResponse {
  success?: false;
  error?: string;
}

const STRING_FIELDS: Array<keyof JobApplicationMaterialsContent> = [
  'professional_summary_en',
  'linkedin_about_en',
  'recruiter_message_en',
  'cover_letter_en',
];

const ARRAY_FIELDS: Array<keyof JobApplicationMaterialsContent> = [
  'resume_bullets_en',
  'key_terms_to_include',
  'warnings_pt',
  'tailoring_notes_pt',
];

function isMaterials(value: unknown): value is JobApplicationMaterialsContent {
  const materials = value as Partial<JobApplicationMaterialsContent> | null;
  if (!materials) return false;

  const stringsValid = STRING_FIELDS.every(field => typeof materials[field] === 'string' && (materials[field] as string).trim().length > 0);
  const arraysValid = ARRAY_FIELDS.every(field => {
    const items = materials[field];
    return Array.isArray(items) && items.every(item => typeof item === 'string');
  });

  return stringsValid && arraysValid && (materials.resume_bullets_en as string[]).length > 0;
}

export async function generateJobApplicationMaterials(jobTarget: JobTarget): Promise<JobApplicationMaterialsContent> {
  const analysis = jobTarget.ai_analysis;
  const response = await fetch('/api/english/generate-job-application-materials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: jobTarget.title,
      company: jobTarget.company ?? '',
      location: jobTarget.location ?? '',
      jobDescription: jobTarget.description,
      analysisSummary: analysis?.summary_pt ?? '',
      requiredSkills: analysis?.required_skills ?? [],
      technicalKeywords: analysis?.technical_keywords ?? [],
      strengths: analysis?.strengths_pt ?? [],
      gaps: analysis?.gaps_pt ?? [],
    }),
  });

  const data = await response.json().catch(() => ({})) as JobApplicationMaterialsContent | ErrorResponse;
  if (!response.ok || !isMaterials(data)) {
    const message = 'error' in data && typeof data.error === 'string'
      ? data.error
      : 'Não foi possível gerar os materiais agora.';
    throw new Error(message);
  }

  return data;
}
