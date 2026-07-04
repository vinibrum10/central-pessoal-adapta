import type { FinalInterviewOverallFeedback } from '../../types/englishInterview';

export interface EvaluateFinalInterviewQuestionPayload {
  question_text: string;
  question_category?: string;
  transcript?: string;
  score?: number;
  duration_sec?: number;
}

export interface EvaluateFinalInterviewPayload {
  title: string;
  focus_area: string;
  job_target_title?: string;
  questions: EvaluateFinalInterviewQuestionPayload[];
}

interface ErrorResponse {
  success?: false;
  error?: string;
}

function isOverallFeedback(value: unknown): value is FinalInterviewOverallFeedback {
  const feedback = value as Partial<FinalInterviewOverallFeedback> | null;
  if (!feedback) return false;

  if (typeof feedback.readiness_score !== 'number' || feedback.readiness_score < 0 || feedback.readiness_score > 100) {
    return false;
  }

  const scoreFields: Array<keyof FinalInterviewOverallFeedback> = [
    'fluency_score',
    'technical_clarity_score',
    'star_structure_score',
    'confidence_score',
    'grammar_score',
    'vocabulary_score',
  ];
  const scoresValid = scoreFields.every(field => {
    const fieldValue = feedback[field];
    return typeof fieldValue === 'number' && fieldValue >= 0 && fieldValue <= 10;
  });

  const arrayFields: Array<keyof FinalInterviewOverallFeedback> = [
    'strengths', 'weaknesses', 'repeated_mistakes', 'missing_vocabulary', 'recommended_next_week_focus',
  ];
  const arraysValid = arrayFields.every(field => Array.isArray(feedback[field]));

  return scoresValid
    && arraysValid
    && typeof feedback.overall_level === 'string'
    && typeof feedback.best_answer_summary === 'string'
    && typeof feedback.weakest_answer_summary === 'string'
    && typeof feedback.suggested_interview_strategy === 'string'
    && typeof feedback.final_feedback_pt === 'string';
}

export async function evaluateFinalInterview(payload: EvaluateFinalInterviewPayload): Promise<FinalInterviewOverallFeedback> {
  const response = await fetch('/api/english/evaluate-final-interview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({})) as FinalInterviewOverallFeedback | ErrorResponse;
  if (!response.ok || !isOverallFeedback(data)) {
    const message = 'error' in data && typeof data.error === 'string'
      ? data.error
      : 'Não foi possível gerar a avaliação geral do simulado agora.';
    throw new Error(message);
  }

  return data;
}
