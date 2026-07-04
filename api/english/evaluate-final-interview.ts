import { GoogleGenAI } from '@google/genai';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

declare const process: {
  env: Record<string, string | undefined>;
};

type FinalQuestionInput = {
  question_text?: string;
  question_category?: string;
  transcript?: string;
  score?: number;
  duration_sec?: number;
};

type EvaluateFinalInterviewRequest = {
  title?: string;
  focus_area?: string;
  job_target_title?: string;
  questions?: FinalQuestionInput[];
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

type FinalInterviewOverallFeedback = {
  readiness_score: number;
  overall_level: string;
  fluency_score: number;
  technical_clarity_score: number;
  star_structure_score: number;
  confidence_score: number;
  grammar_score: number;
  vocabulary_score: number;
  strengths: string[];
  weaknesses: string[];
  repeated_mistakes: string[];
  missing_vocabulary: string[];
  best_answer_summary: string;
  weakest_answer_summary: string;
  recommended_next_week_focus: string[];
  suggested_interview_strategy: string;
  final_feedback_pt: string;
};

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_BODY_CHARS = 400_000;
const MAX_TEXT_LENGTH = 3000;
const MAX_QUESTIONS = 12;
const MIN_QUESTIONS_WITH_TRANSCRIPT = 1;
const LOCAL_ENV_FILES = ['.env.local', '.env'];

const scoreField = { type: 'integer', minimum: 0, maximum: 10 } as const;
const stringList = { type: 'array', maxItems: 6, items: { type: 'string' } } as const;

const feedbackSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'readiness_score',
    'overall_level',
    'fluency_score',
    'technical_clarity_score',
    'star_structure_score',
    'confidence_score',
    'grammar_score',
    'vocabulary_score',
    'strengths',
    'weaknesses',
    'repeated_mistakes',
    'missing_vocabulary',
    'best_answer_summary',
    'weakest_answer_summary',
    'recommended_next_week_focus',
    'suggested_interview_strategy',
    'final_feedback_pt',
  ],
  properties: {
    readiness_score: { type: 'integer', minimum: 0, maximum: 100 },
    overall_level: { type: 'string' },
    fluency_score: scoreField,
    technical_clarity_score: scoreField,
    star_structure_score: scoreField,
    confidence_score: scoreField,
    grammar_score: scoreField,
    vocabulary_score: scoreField,
    strengths: stringList,
    weaknesses: stringList,
    repeated_mistakes: stringList,
    missing_vocabulary: { type: 'array', maxItems: 12, items: { type: 'string' } },
    best_answer_summary: { type: 'string' },
    weakest_answer_summary: { type: 'string' },
    recommended_next_week_focus: stringList,
    suggested_interview_strategy: { type: 'string' },
    final_feedback_pt: { type: 'string' },
  },
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function parseBody(body: unknown): EvaluateFinalInterviewRequest {
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_CHARS) {
      throw new Error('Os dados do simulado estão grandes demais para avaliação. Reduza a quantidade de perguntas.');
    }
    return JSON.parse(body) as EvaluateFinalInterviewRequest;
  }
  return (body ?? {}) as EvaluateFinalInterviewRequest;
}

function trimString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

type SanitizedQuestion = {
  question_text: string;
  question_category: string;
  transcript: string;
  score: number | null;
  duration_sec: number | null;
};

function sanitizeQuestions(input: unknown): SanitizedQuestion[] {
  if (!Array.isArray(input)) return [];

  return input.slice(0, MAX_QUESTIONS).map((raw): SanitizedQuestion => {
    const item = raw as FinalQuestionInput;
    const score = typeof item.score === 'number' && Number.isFinite(item.score)
      ? Math.min(10, Math.max(1, Math.round(item.score)))
      : null;
    const durationSec = typeof item.duration_sec === 'number' && Number.isFinite(item.duration_sec)
      ? Math.max(0, Math.round(item.duration_sec))
      : null;
    return {
      question_text: trimString(item.question_text, MAX_TEXT_LENGTH),
      question_category: trimString(item.question_category, 40),
      transcript: trimString(item.transcript, MAX_TEXT_LENGTH),
      score,
      duration_sec: durationSec,
    };
  }).filter(item => item.question_text);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function validateFeedback(value: unknown): FinalInterviewOverallFeedback | null {
  const feedback = value as Partial<FinalInterviewOverallFeedback> | null;
  if (!feedback) return null;

  if (typeof feedback.readiness_score !== 'number' || !Number.isInteger(feedback.readiness_score)
    || feedback.readiness_score < 0 || feedback.readiness_score > 100) return null;

  const scoreFields: Array<keyof FinalInterviewOverallFeedback> = [
    'fluency_score',
    'technical_clarity_score',
    'star_structure_score',
    'confidence_score',
    'grammar_score',
    'vocabulary_score',
  ];
  for (const field of scoreFields) {
    const fieldValue = feedback[field];
    if (typeof fieldValue !== 'number' || !Number.isInteger(fieldValue) || fieldValue < 0 || fieldValue > 10) return null;
  }

  const arrayFields: Array<keyof FinalInterviewOverallFeedback> = [
    'strengths', 'weaknesses', 'repeated_mistakes', 'missing_vocabulary', 'recommended_next_week_focus',
  ];
  for (const field of arrayFields) {
    if (!isStringArray(feedback[field])) return null;
  }

  const textFields: Array<keyof FinalInterviewOverallFeedback> = [
    'overall_level', 'best_answer_summary', 'weakest_answer_summary', 'suggested_interview_strategy', 'final_feedback_pt',
  ];
  for (const field of textFields) {
    if (typeof feedback[field] !== 'string') return null;
  }

  return {
    readiness_score: feedback.readiness_score,
    overall_level: (feedback.overall_level as string).slice(0, 120),
    fluency_score: feedback.fluency_score as number,
    technical_clarity_score: feedback.technical_clarity_score as number,
    star_structure_score: feedback.star_structure_score as number,
    confidence_score: feedback.confidence_score as number,
    grammar_score: feedback.grammar_score as number,
    vocabulary_score: feedback.vocabulary_score as number,
    strengths: (feedback.strengths as string[]).slice(0, 6),
    weaknesses: (feedback.weaknesses as string[]).slice(0, 6),
    repeated_mistakes: (feedback.repeated_mistakes as string[]).slice(0, 6),
    missing_vocabulary: (feedback.missing_vocabulary as string[]).slice(0, 12),
    best_answer_summary: (feedback.best_answer_summary as string).slice(0, MAX_TEXT_LENGTH),
    weakest_answer_summary: (feedback.weakest_answer_summary as string).slice(0, MAX_TEXT_LENGTH),
    recommended_next_week_focus: (feedback.recommended_next_week_focus as string[]).slice(0, 6),
    suggested_interview_strategy: (feedback.suggested_interview_strategy as string).slice(0, MAX_TEXT_LENGTH),
    final_feedback_pt: (feedback.final_feedback_pt as string).slice(0, MAX_TEXT_LENGTH),
  };
}

function buildPrompt(params: {
  title: string;
  focusArea: string;
  jobTargetTitle: string;
  questions: SanitizedQuestion[];
}) {
  const lines = params.questions.map((item, index) => [
    `Question ${index + 1} [${item.question_category || 'general'}]: ${item.question_text}`,
    `Transcript: ${item.transcript || '(no transcript available — question not answered or not individually evaluated)'}`,
    `Individual score: ${item.score ?? 'not evaluated'}/10`,
    `Answer duration: ${item.duration_sec ?? 0}s`,
  ].join('\n'));

  return [
    'You are a senior hiring manager at a US electric utility running a final 30-minute technical interview readiness review',
    'for a Brazilian electrical engineer preparing for Power Systems Engineer interviews in the United States.',
    'You receive the questions of one full interview simulation, with transcripts and individual scores where available.',
    'Evaluate overall interview readiness. Do not invent facts that are not present in the transcripts.',
    'readiness_score is 0-100 and answers: "Is this candidate ready to sustain a 30-minute technical interview in English?"',
    'overall_level must be a short label in Brazilian Portuguese such as "Ainda em preparação", "Quase pronto" or "Pronto para entrevistas iniciais".',
    'All list and text feedback fields must be written in Brazilian Portuguese, except missing_vocabulary which lists English terms.',
    'best_answer_summary and weakest_answer_summary must identify which question they refer to and briefly explain why.',
    'final_feedback_pt is a direct, encouraging but honest paragraph in Brazilian Portuguese guiding the candidate.',
    'Return only JSON matching the schema.',
    '',
    `Simulation title: ${params.title || '(untitled)'}`,
    `Simulation focus: ${params.focusArea || 'general'}`,
    `Target job: ${params.jobTargetTitle || '(none)'}`,
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

  let body: EvaluateFinalInterviewRequest;
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
    json(res, 400, { success: false, error: 'Envie as perguntas do simulado para avaliação.' });
    return;
  }

  if (questionsWithTranscript.length < MIN_QUESTIONS_WITH_TRANSCRIPT) {
    json(res, 400, { success: false, error: 'Avalie ao menos uma resposta individualmente com IA antes de gerar a avaliação geral do simulado.' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{
            text: buildPrompt({
              title: trimString(body.title, 200),
              focusArea: trimString(body.focus_area, 60),
              jobTargetTitle: trimString(body.job_target_title, 200),
              questions,
            }),
          }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: feedbackSchema,
        temperature: 0.3,
        maxOutputTokens: 4000,
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
    console.error('English evaluate-final-interview endpoint error', { message: error instanceof Error ? error.message : 'unknown' });
    json(res, 502, { success: false, error: 'Não foi possível gerar a avaliação geral do simulado agora. Tente novamente.' });
  }
}
