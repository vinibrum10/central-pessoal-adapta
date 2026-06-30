import { GoogleGenAI } from '@google/genai';

type QuizSource = 'transcript' | 'summary' | 'metadata';
type Difficulty = 'easy' | 'medium' | 'hard';

declare const process: {
  env: Record<string, string | undefined>;
};

type GenerateQuizRequest = {
  videoId?: string;
  title?: string;
  channel?: string;
  level?: string;
  theme?: string;
  durationSeconds?: number;
  transcript?: string;
  summary?: string;
  questionCount?: number;
};

type QuizQuestion = {
  id: string;
  type: 'multiple_choice';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  skill: string;
  difficulty: Difficulty;
};

type GeminiQuizQuestion = {
  id: string;
  type: 'multiple_choice';
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  level: string;
  skill: string;
};

type GeminiQuizResponse = {
  questions: GeminiQuizQuestion[];
};

type GeneratedQuiz = {
  videoId: string;
  title: string;
  level: string;
  questionCount: number;
  generatedAt: string;
  source: QuizSource;
  warning?: string;
  questions: QuizQuestion[];
};

type ServerRequest = {
  method?: string;
  body?: unknown;
};

type ServerResponse = {
  status: (code: number) => ServerResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_TRANSCRIPT_LENGTH = 12000;
const MAX_SUMMARY_LENGTH = 3000;

const quizSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'type', 'question', 'options', 'correctAnswer', 'explanation', 'level', 'skill'],
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['multiple_choice'] },
          question: { type: 'string' },
          options: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: { type: 'string' },
          },
          correctAnswer: { type: 'string' },
          explanation: { type: 'string' },
          level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2'] },
          skill: { type: 'string', enum: ['listening', 'vocabulary', 'grammar', 'comprehension'] },
        },
      },
    },
  },
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function parseBody(body: unknown): GenerateQuizRequest {
  if (typeof body === 'string') return JSON.parse(body) as GenerateQuizRequest;
  return (body ?? {}) as GenerateQuizRequest;
}

function clampQuestionCount(value: unknown) {
  const count = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 5;
  return Math.min(10, Math.max(1, count));
}

function trimString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeQuizLevel(level: string) {
  if (level === 'A1' || level === 'A2' || level === 'B1' || level === 'B2') return level;
  return 'B2';
}

function resolveSource(body: GenerateQuizRequest): { source: QuizSource; content: string; warning?: string } {
  const transcript = trimString(body.transcript, MAX_TRANSCRIPT_LENGTH);
  if (transcript) return { source: 'transcript', content: transcript };

  const summary = trimString(body.summary, MAX_SUMMARY_LENGTH);
  if (summary) return { source: 'summary', content: summary };

  return {
    source: 'metadata',
    content: [
      `Title: ${body.title}`,
      `Channel: ${body.channel}`,
      `Theme: ${body.theme}`,
      `Level: ${body.level}`,
      `Duration: ${body.durationSeconds} seconds`,
    ].join('\n'),
    warning: 'Questionário gerado com base em metadados do vídeo, pois não havia transcrição ou resumo disponível.',
  };
}

function buildPrompt(body: Required<Pick<GenerateQuizRequest, 'videoId' | 'title' | 'channel' | 'level' | 'theme' | 'durationSeconds'>>, questionCount: number, source: QuizSource, content: string, warning?: string) {
  return [
    'Você é um tutor de inglês para um aluno brasileiro.',
    'Gere um questionário curto baseado no conteúdo do vídeo informado.',
    'O objetivo é testar compreensão auditiva, vocabulário e frases úteis.',
    'Use inglês simples nas perguntas e alternativas.',
    'Use português apenas nas explicações.',
    source === 'metadata'
      ? 'Como não há transcrição suficiente, crie perguntas gerais de vocabulário e compreensão sobre o tema do vídeo.'
      : 'Não invente detalhes que não estejam no conteúdo.',
    'Não misture este questionário com outro vídeo.',
    'Retorne somente JSON no schema solicitado, sem markdown.',
    'Cada correctAnswer deve ser exatamente igual a uma das 4 opções.',
    'Use skill apenas como listening, vocabulary, grammar ou comprehension.',
    'Use level apenas como A1, A2, B1 ou B2.',
    '',
    `Video ID: ${body.videoId}`,
    `Title: ${body.title}`,
    `Channel: ${body.channel}`,
    `Level: ${body.level}`,
    `Theme: ${body.theme}`,
    `Duration seconds: ${body.durationSeconds}`,
    `Question count: ${questionCount}`,
    `Source: ${source}`,
    warning ? `Warning to include: ${warning}` : 'Warning to include: null',
    '',
    'Reliable content:',
    content,
  ].filter(Boolean).join('\n');
}

function isQuestion(value: unknown): value is QuizQuestion {
  const question = value as Partial<QuizQuestion> | null;
  const correctIndex = question?.correctIndex;
  return Boolean(
    question
    && typeof question.id === 'string'
    && question.type === 'multiple_choice'
    && typeof question.question === 'string'
    && Array.isArray(question.options)
    && question.options.length === 4
    && question.options.every(option => typeof option === 'string' && option.trim().length > 0)
    && typeof correctIndex === 'number'
    && Number.isInteger(correctIndex)
    && correctIndex >= 0
    && correctIndex <= 3
    && typeof question.explanation === 'string'
    && typeof question.skill === 'string'
    && ['easy', 'medium', 'hard'].includes(question.difficulty ?? ''),
  );
}

function skillToDifficulty(skill: string): Difficulty {
  if (skill === 'grammar') return 'hard';
  if (skill === 'comprehension') return 'medium';
  return 'easy';
}

function normalizeGeminiQuestion(value: unknown, index: number): QuizQuestion | null {
  const question = value as Partial<GeminiQuizQuestion> | null;
  if (
    !question
    || question.type !== 'multiple_choice'
    || typeof question.question !== 'string'
    || !Array.isArray(question.options)
    || question.options.length !== 4
    || !question.options.every(option => typeof option === 'string' && option.trim().length > 0)
    || typeof question.correctAnswer !== 'string'
    || typeof question.explanation !== 'string'
    || typeof question.skill !== 'string'
  ) {
    return null;
  }

  const options = question.options.map(option => option.trim());
  const correctIndex = options.findIndex(option => option.toLowerCase() === question.correctAnswer?.trim().toLowerCase());
  if (correctIndex < 0) return null;

  return {
    id: typeof question.id === 'string' && question.id.trim() ? question.id.trim() : `q${index + 1}`,
    type: 'multiple_choice',
    question: question.question.trim(),
    options,
    correctIndex,
    explanation: question.explanation.trim(),
    skill: question.skill.trim(),
    difficulty: skillToDifficulty(question.skill.trim()),
  };
}

function validateQuiz(value: unknown, fallback: {
  videoId: string;
  title: string;
  level: string;
  source: QuizSource;
  warning?: string;
}): GeneratedQuiz | null {
  const quiz = value as Partial<GeneratedQuiz | GeminiQuizResponse> | null;
  if (!quiz || !Array.isArray(quiz.questions)) return null;
  const questions = quiz.questions
    .map((question, index) => isQuestion(question) ? question : normalizeGeminiQuestion(question, index))
    .filter((question): question is QuizQuestion => Boolean(question));
  if (questions.length < 1 || questions.length > 10) return null;

  return {
    videoId: fallback.videoId,
    title: fallback.title,
    level: fallback.level,
    questionCount: questions.length,
    generatedAt: new Date().toISOString(),
    source: fallback.source,
    warning: fallback.warning,
    questions,
  };
}

export default async function handler(req: ServerRequest, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    json(res, 405, { success: false, error: 'Método não permitido.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    json(res, 503, {
      success: false,
      error: 'Não foi possível gerar o questionário agora. Tente novamente.',
    });
    return;
  }

  let body: GenerateQuizRequest;
  try {
    body = parseBody(req.body);
  } catch {
    json(res, 400, { success: false, error: 'JSON inválido.' });
    return;
  }

  const videoId = trimString(body.videoId, 120);
  const title = trimString(body.title, 240);
  const channel = trimString(body.channel, 160);
  const requestedLevel = trimString(body.level, 20);
  const level = normalizeQuizLevel(requestedLevel);
  const theme = trimString(body.theme, 160);
  const durationSeconds = typeof body.durationSeconds === 'number' && Number.isFinite(body.durationSeconds)
    ? Math.max(1, Math.round(body.durationSeconds))
    : 1;
  const questionCount = clampQuestionCount(body.questionCount);

  if (!videoId || !title || !requestedLevel || !channel || !theme) {
    json(res, 400, { success: false, error: 'Dados do vídeo incompletos para gerar o questionário.' });
    return;
  }

  const { source, content, warning } = resolveSource(body);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents: buildPrompt({ videoId, title, channel, level, theme, durationSeconds }, questionCount, source, content, warning),
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: quizSchema,
        temperature: 0.4,
        maxOutputTokens: 2400,
      },
    });
    const outputText = response.text ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      json(res, 502, { success: false, error: 'Não foi possível gerar o questionário agora. Tente novamente.' });
      return;
    }

    const quiz = validateQuiz(parsed, { videoId, title, level, source, warning });
    if (!quiz) {
      json(res, 502, { success: false, error: 'Não foi possível gerar o questionário agora. Tente novamente.' });
      return;
    }

    json(res, 200, quiz);
  } catch (error) {
    console.error('English quiz endpoint error', { message: error instanceof Error ? error.message : 'unknown' });
    json(res, 502, {
      success: false,
      error: 'Não foi possível gerar o questionário agora. Tente novamente.',
    });
  }
}
