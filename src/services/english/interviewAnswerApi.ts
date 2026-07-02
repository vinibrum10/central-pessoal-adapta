import type { InterviewAnswerFeedback } from '../../types/englishInterview';

export interface EvaluateAnswerPayload {
  audioBase64: string;
  mimeType: string;
  question_en: string;
  como_responder: string;
  duration_sec: number;
}

interface ErrorResponse {
  success?: false;
  error?: string;
}

function isFeedback(value: unknown): value is InterviewAnswerFeedback {
  const feedback = value as Partial<InterviewAnswerFeedback> | null;
  return Boolean(
    feedback
    && typeof feedback.transcript === 'string'
    && Array.isArray(feedback.strengths)
    && feedback.strengths.every(item => typeof item === 'string')
    && Array.isArray(feedback.improvements)
    && feedback.improvements.every(item => typeof item === 'string')
    && typeof feedback.score === 'number'
    && feedback.score >= 1
    && feedback.score <= 10,
  );
}

export async function evaluateInterviewAnswer(payload: EvaluateAnswerPayload): Promise<InterviewAnswerFeedback> {
  const response = await fetch('/api/english/evaluate-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({})) as InterviewAnswerFeedback | ErrorResponse;
  if (!response.ok || !isFeedback(data)) {
    const message = 'error' in data && typeof data.error === 'string'
      ? data.error
      : 'Não foi possível avaliar a resposta agora.';
    throw new Error(message);
  }

  return data;
}
