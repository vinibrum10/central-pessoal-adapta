import { GoogleGenAI } from '@google/genai';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

declare const process: {
  env: Record<string, string | undefined>;
};

type EvaluateAnswerRequest = {
  audioBase64?: string;
  mimeType?: string;
  question_en?: string;
  como_responder?: string;
  duration_sec?: number;
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

type StarStructure = {
  situation?: boolean;
  task?: boolean;
  action?: boolean;
  result?: boolean;
};

type Feedback = {
  transcript: string;
  star_structure?: StarStructure;
  strengths: string[];
  improvements: string[];
  grammar_notes?: string[];
  score: number;
};

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_BODY_CHARS = 4_200_000;
const MAX_AUDIO_BASE64_CHARS = 4_000_000;
const MAX_TEXT_LENGTH = 3000;
const LOCAL_ENV_FILES = ['.env.local', '.env'];

const feedbackSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['transcript', 'strengths', 'improvements', 'score'],
  properties: {
    transcript: { type: 'string' },
    star_structure: {
      type: 'object',
      additionalProperties: false,
      properties: {
        situation: { type: 'boolean' },
        task: { type: 'boolean' },
        action: { type: 'boolean' },
        result: { type: 'boolean' },
      },
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    improvements: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string' },
    },
    grammar_notes: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string' },
    },
    score: {
      type: 'integer',
      minimum: 1,
      maximum: 10,
    },
  },
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function parseBody(body: unknown): EvaluateAnswerRequest {
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_CHARS) {
      throw new Error('A gravação está grande demais para avaliação com IA. Grave uma resposta mais curta.');
    }
    return JSON.parse(body) as EvaluateAnswerRequest;
  }
  return (body ?? {}) as EvaluateAnswerRequest;
}

function trimString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isAllowedAudioMimeType(value: string) {
  return /^audio\/[a-z0-9.+-]+(?:;.*)?$/i.test(value);
}

function validateFeedback(value: unknown): Feedback | null {
  const feedback = value as Partial<Feedback> | null;
  if (
    !feedback
    || typeof feedback.transcript !== 'string'
    || !Array.isArray(feedback.strengths)
    || !feedback.strengths.every(item => typeof item === 'string')
    || !Array.isArray(feedback.improvements)
    || !feedback.improvements.every(item => typeof item === 'string')
    || typeof feedback.score !== 'number'
    || !Number.isInteger(feedback.score)
    || feedback.score < 1
    || feedback.score > 10
  ) {
    return null;
  }

  return {
    transcript: feedback.transcript,
    star_structure: feedback.star_structure,
    strengths: feedback.strengths,
    improvements: feedback.improvements.slice(0, 3),
    grammar_notes: Array.isArray(feedback.grammar_notes) ? feedback.grammar_notes.filter(item => typeof item === 'string').slice(0, 3) : [],
    score: feedback.score,
  };
}

function buildPrompt(question: string, guide: string, durationSec: number) {
  return [
    'You are evaluating an English interview answer as a hiring interviewer at a US electric utility.',
    'The candidate is a Brazilian electrical engineer preparing for a Power Systems Engineer interview.',
    'Be specific and practical. Do not invent facts that are not present in the audio.',
    'The transcript field must be in English and should reflect the spoken answer.',
    'All feedback fields must be written in Brazilian Portuguese.',
    'Evaluate STAR structure when applicable. For technical questions, map structure to context, task/problem, action/approach, and result/outcome as closely as possible.',
    'Return only JSON matching the schema.',
    '',
    `Question: ${question}`,
    `Answer guide in Portuguese: ${guide}`,
    `Recorded duration seconds: ${durationSec}`,
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

function logGeminiEnvAvailability(apiKey: string | undefined, modelEnv: string | undefined) {
  if (process.env.NODE_ENV === 'production') return;
  const hasLocalEnvFile = LOCAL_ENV_FILES.some(file => existsSync(path.join(process.cwd(), file)));
  console.log('English evaluate-answer env', {
    hasGeminiApiKey: Boolean(apiKey),
    hasGeminiModel: Boolean(modelEnv),
    hasProcessGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
    hasProcessGeminiModel: Boolean(process.env.GEMINI_MODEL),
    hasLocalEnvFile,
  });
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
  logGeminiEnvAvailability(apiKey, modelEnv);
  if (!apiKey) {
    json(res, 503, { success: false, error: 'IA não configurada. Defina GEMINI_API_KEY no servidor.' });
    return;
  }

  let body: EvaluateAnswerRequest;
  try {
    body = parseBody(req.body);
  } catch (error) {
    json(res, 400, {
      success: false,
      error: error instanceof Error ? error.message : 'JSON inválido.',
    });
    return;
  }

  const audioBase64 = trimString(body.audioBase64, MAX_AUDIO_BASE64_CHARS + 1);
  const mimeType = trimString(body.mimeType, 80);
  const question = trimString(body.question_en, MAX_TEXT_LENGTH);
  const guide = trimString(body.como_responder, MAX_TEXT_LENGTH);
  const durationSec = typeof body.duration_sec === 'number' && Number.isFinite(body.duration_sec)
    ? Math.max(1, Math.round(body.duration_sec))
    : 0;

  if (!audioBase64 || !mimeType || !question || !guide || !durationSec) {
    json(res, 400, { success: false, error: 'Envie áudio, tipo do arquivo, pergunta, guia de resposta e duração.' });
    return;
  }

  if (audioBase64.length > MAX_AUDIO_BASE64_CHARS) {
    json(res, 413, { success: false, error: 'A gravação está grande demais para avaliação com IA. Grave uma resposta mais curta.' });
    return;
  }

  if (!isAllowedAudioMimeType(mimeType)) {
    json(res, 400, { success: false, error: 'Formato de áudio inválido. Grave novamente em um formato de áudio suportado.' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildPrompt(question, guide, durationSec) },
            {
              inlineData: {
                mimeType: mimeType.split(';')[0],
                data: audioBase64,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: feedbackSchema,
        temperature: 0.25,
        maxOutputTokens: 3000,
      },
    });

    const text = response.text ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      json(res, 502, { success: false, error: 'A IA não retornou um feedback válido. Tente novamente.' });
      return;
    }

    const feedback = validateFeedback(parsed);
    if (!feedback) {
      json(res, 502, { success: false, error: 'A IA não retornou um feedback no formato esperado. Tente novamente.' });
      return;
    }

    json(res, 200, feedback);
  } catch (error) {
    console.error('English evaluate-answer endpoint error', { message: error instanceof Error ? error.message : 'unknown' });
    json(res, 502, { success: false, error: 'Não foi possível avaliar a resposta agora. Tente novamente.' });
  }
}
