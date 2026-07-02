import { GoogleGenAI } from '@google/genai';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

declare const process: {
  env: Record<string, string | undefined>;
};

type MockQuestionInput = {
  question_id?: string;
  question_en?: string;
  transcript?: string;
  score?: number;
  duration_sec?: number;
};

type EvaluateMockRequest = {
  questions?: MockQuestionInput[];
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

type MockOverallFeedback = {
  overall_score: number;
  fluency_score: number;
  technical_clarity_score: number;
  star_structure_score: number;
  grammar_score: number;
  strengths: string[];
  weaknesses: string[];
  recommended_next_steps: string[];
  best_answer: string;
  weakest_answer: string;
  suggested_training_focus: string;
};

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_BODY_CHARS = 400_000;
const MAX_TEXT_LENGTH = 3000;
const MAX_QUESTIONS = 10;
const MIN_QUESTIONS_WITH_TRANSCRIPT = 1;
const LOCAL_ENV_FILES = ['.env.local', '.env'];

const scoreField = { type: 'integer', minimum: 1, maximum: 10 } as const;

const feedbackSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'overall_score',
    'fluency_score',
    'technical_clarity_score',
    'star_structure_score',
    'grammar_score',
    'strengths',
    'weaknesses',
    'recommended_next_steps',
    'best_answer',
    'weakest_answer',
    'suggested_training_focus',
  ],
  properties: {
    overall_score: scoreField,
    fluency_score: scoreField,
    technical_clarity_score: scoreField,
    star_structure_score: scoreField,
    grammar_score: scoreField,
    strengths: { type: 'array', maxItems: 5, items: { type: 'string' } },
    weaknesses: { type: 'array', maxItems: 5, items: { type: 'string' } },
    recommended_next_steps: { type: 'array', maxItems: 5, items: { type: 'string' } },
    best_answer: { type: 'string' },
    weakest_answer: { type: 'string' },
    suggested_training_focus: { type: 'string' },
  },
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function parseBody(body: unknown): EvaluateMockRequest {
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_CHARS) {
      throw new Error('Os dados do mock estão grandes demais para avaliação. Reduza a quantidade de perguntas.');
    }
    return JSON.parse(body) as EvaluateMockRequest;
  }
  return (body ?? {}) as EvaluateMockRequest;
}

function trimString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function sanitizeQuestions(input: unknown): Array<{ question_id: string; question_en: string; transcript: string; score: number | null; duration_sec: number | null }> {
  if (!Array.isArray(input)) return [];

  return input.slice(0, MAX_QUESTIONS).map((raw): { question_id: string; question_en: string; transcript: string; score: number | null; duration_sec: number | null } => {
    const item = raw as MockQuestionInput;
    const score = typeof item.score === 'number' && Number.isFinite(item.score)
      ? Math.min(10, Math.max(1, Math.round(item.score)))
      : null;
    const durationSec = typeof item.duration_sec === 'number' && Number.isFinite(item.duration_sec)
      ? Math.max(0, Math.round(item.duration_sec))
      : null;
    return {
      question_id: trimString(item.question_id, 80),
      question_en: trimString(item.question_en, MAX_TEXT_LENGTH),
      transcript: trimString(item.transcript, MAX_TEXT_LENGTH),
      score,
      duration_sec: durationSec,
    };
  }).filter(item => item.question_id && item.question_en);
}

function validateFeedback(value: unknown): MockOverallFeedback | null {
  const feedback = value as Partial<MockOverallFeedback> | null;
  if (!feedback) return null;

  const scoreFields: Array<keyof MockOverallFeedback> = [
    'overall_score',
    'fluency_score',
    'technical_clarity_score',
    'star_structure_score',
    'grammar_score',
  ];
  for (const field of scoreFields) {
    const value = feedback[field];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) return null;
  }

  const arrayFields: Array<keyof MockOverallFeedback> = ['strengths', 'weaknesses', 'recommended_next_steps'];
  for (const field of arrayFields) {
    const value = feedback[field];
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) return null;
  }

  if (typeof feedback.best_answer !== 'string' || typeof feedback.weakest_answer !== 'string' || typeof feedback.suggested_training_focus !== 'string') {
    return null;
  }

  return {
    overall_score: feedback.overall_score as number,
    fluency_score: feedback.fluency_score as number,
    technical_clarity_score: feedback.technical_clarity_score as number,
    star_structure_score: feedback.star_structure_score as number,
    grammar_score: feedback.grammar_score as number,
    strengths: (feedback.strengths as string[]).slice(0, 5),
    weaknesses: (feedback.weaknesses as string[]).slice(0, 5),
    recommended_next_steps: (feedback.recommended_next_steps as string[]).slice(0, 5),
    best_answer: feedback.best_answer.slice(0, MAX_TEXT_LENGTH),
    weakest_answer: feedback.weakest_answer.slice(0, MAX_TEXT_LENGTH),
    suggested_training_focus: feedback.suggested_training_focus.slice(0, MAX_TEXT_LENGTH),
  };
}

function buildPrompt(questions: Array<{ question_id: string; question_en: string; transcript: string; score: number | null; duration_sec: number | null }>) {
  const lines = questions.map((item, index) => [
    `Question ${index + 1} (id: ${item.question_id}): ${item.question_en}`,
    `Transcript: ${item.transcript || '(no transcript available)'}`,
    `Individual score: ${item.score ?? 'not evaluated'}/10`,
    `Answer duration: ${item.duration_sec ?? 0}s`,
  ].join('\n'));

  return [
    'You are a senior hiring manager giving an overall mock interview review for a Brazilian electrical engineer',
    'preparing for Power Systems Engineer interviews at US electric utilities.',
    'You are given the transcripts and individual scores of several answers from one mock interview session.',
    'Do not invent facts that are not present in the transcripts.',
    'All feedback fields (strengths, weaknesses, recommended_next_steps, best_answer, weakest_answer, suggested_training_focus) must be written in Brazilian Portuguese.',
    'best_answer and weakest_answer must identify which question they refer to and briefly explain why.',
    'Return only JSON matching the schema.',
    '',
    ...lines,
  ].join('\n');
}

function readLocalEnvValue(name: string): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;

  for (const file of LOCAL_ENV_FILES) {
    const envPath = path.join(process.cwd(), file);
    if (!existsSync(envPath)) continue;

    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index < 0) continue;
      const key = trimmed.slice(0, index).trim();
      if (key !== name) continue;
      return trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }

  return undefined;
}

function getServerEnv(name: string): string | undefined {
  return process.env[name] || readLocalEnvValue(name);
}

export default async function handler(req: ServerRequest, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    json(res, 405, { success: false, error: 'Método não permitido.' });
    return;
  }

  const apiKey = getServerEnv('GEMINI_API_KEY');
  const modelEnv = getServerEnv('GEMINI_MODEL');
  const model = modelEnv || DEFAULT_MODEL;
  if (!apiKey) {
    json(res, 503, { success: false, error: 'IA não configurada. Defina GEMINI_API_KEY no servidor.' });
    return;
  }

  let body: EvaluateMockRequest;
  try {
    body = parseBody(req.body);
  } catch (error) {
    json(res, 400, {
      success: false,
      error: error instanceof Error ? error.message : 'JSON inválido.',
    });
    return;
  }

  const questions = sanitizeQuestions(body.questions);
  const questionsWithTranscript = questions.filter(item => item.transcript);

  if (questions.length === 0) {
    json(res, 400, { success: false, error: 'Envie as perguntas do mock para avaliação.' });
    return;
  }

  if (questionsWithTranscript.length < MIN_QUESTIONS_WITH_TRANSCRIPT) {
    json(res, 400, { success: false, error: 'Avalie ao menos uma resposta individualmente com IA antes de gerar a avaliação geral do mock.' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ text: buildPrompt(questions) }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: feedbackSchema,
        temperature: 0.3,
        maxOutputTokens: 3000,
      },
    });

    const text = response.text ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      json(res, 502, { success: false, error: 'A IA não retornou uma avaliação válida. Tente novamente.' });
      return;
    }

    const feedback = validateFeedback(parsed);
    if (!feedback) {
      json(res, 502, { success: false, error: 'A IA não retornou uma avaliação no formato esperado. Tente novamente.' });
      return;
    }

    json(res, 200, feedback);
  } catch (error) {
    console.error('English evaluate-mock endpoint error', { message: error instanceof Error ? error.message : 'unknown' });
    json(res, 502, { success: false, error: 'Não foi possível gerar a avaliação geral do mock agora. Tente novamente.' });
  }
}
