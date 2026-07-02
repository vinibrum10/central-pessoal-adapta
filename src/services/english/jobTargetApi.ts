import type { JobTargetAnalysis } from '../../types/englishInterview';

export interface AnalyzeJobTargetPayload {
  title: string;
  company: string;
  location: string;
  jobDescription: string;
}

interface ErrorResponse {
  success?: false;
  error?: string;
}

const STRING_ARRAY_FIELDS: Array<keyof JobTargetAnalysis> = [
  'required_skills',
  'preferred_skills',
  'technical_keywords',
  'missing_vocabulary',
  'likely_interview_questions',
  'star_story_suggestions',
  'strengths_pt',
  'gaps_pt',
  'study_plan_7_days_pt',
];

function isAnalysis(value: unknown): value is JobTargetAnalysis {
  const analysis = value as Partial<JobTargetAnalysis> | null;
  if (!analysis) return false;

  const stringsValid = typeof analysis.summary_pt === 'string'
    && typeof analysis.role_type === 'string'
    && typeof analysis.recommended_mock_focus === 'string';
  const scoreValid = typeof analysis.match_score === 'number'
    && analysis.match_score >= 0
    && analysis.match_score <= 10;
  const arraysValid = STRING_ARRAY_FIELDS.every(field => {
    const items = analysis[field];
    return Array.isArray(items) && items.every(item => typeof item === 'string');
  });

  return stringsValid && scoreValid && arraysValid;
}

export async function analyzeJobTarget(payload: AnalyzeJobTargetPayload): Promise<JobTargetAnalysis> {
  const response = await fetch('/api/english/analyze-job-target', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({})) as JobTargetAnalysis | ErrorResponse;
  if (!response.ok || !isAnalysis(data)) {
    const message = 'error' in data && typeof data.error === 'string'
      ? data.error
      : 'Não foi possível analisar a vaga agora.';
    throw new Error(message);
  }

  return data;
}
