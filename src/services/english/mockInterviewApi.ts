import type { MockInterviewOverallFeedback } from '../../types/englishInterview';

export interface EvaluateMockQuestionPayload {
  question_id: string;
  question_en: string;
  transcript?: string;
  score?: number;
  duration_sec?: number;
}

export interface EvaluateMockPayload {
  questions: EvaluateMockQuestionPayload[];
}

interface ErrorResponse {
  success?: false;
  error?: string;
}

function isOverallFeedback(value: unknown): value is MockInterviewOverallFeedback {
  const feedback = value as Partial<MockInterviewOverallFeedback> | null;
  if (!feedback) return false;

  const scoreFields: Array<keyof MockInterviewOverallFeedback> = [
    'overall_score',
    'fluency_score',
    'technical_clarity_score',
    'star_structure_score',
    'grammar_score',
  ];
  const scoresValid = scoreFields.every(field => {
    const value = feedback[field];
    return typeof value === 'number' && value >= 1 && value <= 10;
  });

  const arrayFields: Array<keyof MockInterviewOverallFeedback> = ['strengths', 'weaknesses', 'recommended_next_steps'];
  const arraysValid = arrayFields.every(field => Array.isArray(feedback[field]));

  return scoresValid
    && arraysValid
    && typeof feedback.best_answer === 'string'
    && typeof feedback.weakest_answer === 'string'
    && typeof feedback.suggested_training_focus === 'string';
}

export async function evaluateMockInterview(payload: EvaluateMockPayload): Promise<MockInterviewOverallFeedback> {
  const response = await fetch('/api/english/evaluate-mock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({})) as MockInterviewOverallFeedback | ErrorResponse;
  if (!response.ok || !isOverallFeedback(data)) {
    const message = 'error' in data && typeof data.error === 'string'
      ? data.error
      : 'Não foi possível gerar a avaliação geral do mock agora.';
    throw new Error(message);
  }

  return data;
}
