import { GoogleGenAI } from '@google/genai';

declare const process: {
  env: Record<string, string | undefined>;
};

type TranslateWordRequest = {
  word?: string;
};

type TranslateWordResult = {
  word: string;
  translation: string;
  example: string;
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
const MAX_WORD_LENGTH = 120;

const translationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['translation', 'example'],
  properties: {
    translation: { type: 'string' },
    example: { type: 'string' },
  },
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function parseBody(body: unknown): TranslateWordRequest {
  if (typeof body === 'string') return JSON.parse(body) as TranslateWordRequest;
  return (body ?? {}) as TranslateWordRequest;
}

function trimString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function buildPrompt(word: string) {
  return [
    'Você é um tutor de inglês para um aluno brasileiro estudando vocabulário.',
    `Palavra ou expressão em inglês: "${word}"`,
    'Traduza essa palavra/expressão para português do Brasil, considerando o sentido mais comum e natural.',
    'Crie também uma frase de exemplo curta em inglês usando essa palavra/expressão em contexto natural.',
    'A tradução deve ser curta (poucas palavras, sem explicações longas).',
    'A frase de exemplo deve ter no máximo 20 palavras.',
    'Retorne somente JSON no schema solicitado, sem markdown.',
  ].join('\n');
}

function isValidResult(value: unknown): value is { translation: string; example: string } {
  const result = value as Partial<{ translation: string; example: string }> | null;
  return Boolean(
    result
    && typeof result.translation === 'string'
    && result.translation.trim().length > 0
    && typeof result.example === 'string'
    && result.example.trim().length > 0,
  );
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
      error: 'Não foi possível traduzir agora. Tente novamente.',
    });
    return;
  }

  let body: TranslateWordRequest;
  try {
    body = parseBody(req.body);
  } catch {
    json(res, 400, { success: false, error: 'JSON inválido.' });
    return;
  }

  const word = trimString(body.word, MAX_WORD_LENGTH);
  if (!word) {
    json(res, 400, { success: false, error: 'Informe uma palavra ou expressão.' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents: buildPrompt(word),
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: translationSchema,
        temperature: 0.3,
        maxOutputTokens: 300,
      },
    });

    const outputText = response.text ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      json(res, 502, { success: false, error: 'Não foi possível traduzir agora. Tente novamente.' });
      return;
    }

    if (!isValidResult(parsed)) {
      json(res, 502, { success: false, error: 'Não foi possível traduzir agora. Tente novamente.' });
      return;
    }

    const result: TranslateWordResult = {
      word,
      translation: parsed.translation.trim(),
      example: parsed.example.trim(),
    };
    json(res, 200, result);
  } catch (error) {
    console.error('English translate-word endpoint error', { message: error instanceof Error ? error.message : 'unknown' });
    json(res, 502, {
      success: false,
      error: 'Não foi possível traduzir agora. Tente novamente.',
    });
  }
}
