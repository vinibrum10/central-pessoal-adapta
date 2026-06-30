import type { EnglishCefrLevel, GeneratedEnglishQuiz } from '../types/englishStudy';

export interface GenerateEnglishQuizPayload {
  videoId: string;
  title: string;
  channel: string;
  level: EnglishCefrLevel;
  theme: string;
  durationSeconds: number;
  transcript?: string;
  summary?: string;
  questionCount: number;
}

interface ErrorResponse {
  success?: false;
  error?: string;
}

function isGeneratedQuiz(value: unknown): value is Omit<GeneratedEnglishQuiz, 'generatedAt' | 'source'> & {
  source?: GeneratedEnglishQuiz['source'];
} {
  const quiz = value as Partial<GeneratedEnglishQuiz> | null;
  return Boolean(
    quiz
    && typeof quiz.videoId === 'string'
    && typeof quiz.title === 'string'
    && typeof quiz.level === 'string'
    && typeof quiz.questionCount === 'number'
    && Array.isArray(quiz.questions)
    && quiz.questions.length >= 1
    && quiz.questions.length <= 10
    && quiz.questions.every(question =>
      question
      && typeof question.id === 'string'
      && question.type === 'multiple_choice'
      && typeof question.question === 'string'
      && Array.isArray(question.options)
      && question.options.length === 4
      && question.options.every(option => typeof option === 'string')
      && Number.isInteger(question.correctIndex)
      && question.correctIndex >= 0
      && question.correctIndex <= 3
      && typeof question.explanation === 'string'
      && typeof question.skill === 'string'
      && typeof question.difficulty === 'string',
    ),
  );
}

export async function generateEnglishQuiz(payload: GenerateEnglishQuizPayload): Promise<GeneratedEnglishQuiz> {
  const response = await fetch('/api/english/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({})) as GeneratedEnglishQuiz | ErrorResponse;
  if (!response.ok || !isGeneratedQuiz(data)) {
    const error = 'error' in data && typeof data.error === 'string'
      ? data.error
      : 'Não foi possível gerar o questionário agora. Tente novamente.';
    throw new Error(error);
  }

  return {
    ...data,
    generatedAt: 'generatedAt' in data && typeof data.generatedAt === 'string' ? data.generatedAt : new Date().toISOString(),
    source: data.source ?? (payload.transcript ? 'transcript' : payload.summary ? 'summary' : 'metadata'),
  };
}
