import { GoogleGenAI } from '@google/genai';

declare const process: {
  env: Record<string, string | undefined>;
};

type PhraseSource = 'videoTranscript' | 'videoMetadata' | 'aiGenerated';

type GenerateShadowingPhrasesRequest = {
  videoId?: string;
  videoTitle?: string;
  videoDescription?: string;
  transcriptExcerpt?: string;
  theme?: string;
  count?: number;
};

type GeneratedPhrase = {
  text: string;
  translation: string;
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
const MAX_TEXT_LENGTH = 8000;
const MAX_THEME_LENGTH = 200;
const FRIENDLY_ERROR = 'Não foi possível gerar frases de shadowing com a IA agora. Tente novamente em instantes.';

const phrasesSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['phrases'],
  properties: {
    phrases: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'translation'],
        properties: {
          text: { type: 'string' },
          translation: { type: 'string' },
        },
      },
    },
  },
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function parseBody(body: unknown): GenerateShadowingPhrasesRequest {
  if (typeof body === 'string') return JSON.parse(body) as GenerateShadowingPhrasesRequest;
  return (body ?? {}) as GenerateShadowingPhrasesRequest;
}

function trimString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function clampCount(value: unknown) {
  const count = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 5;
  return Math.min(10, Math.max(1, count));
}

/** Decide a fonte com base no que realmente foi fornecido — nunca finge ter transcrição/descrição que não existe. */
function resolveSource(transcriptExcerpt: string, videoDescription: string): PhraseSource {
  if (transcriptExcerpt) return 'videoTranscript';
  if (videoDescription) return 'videoMetadata';
  return 'aiGenerated';
}

function buildPrompt(
  source: PhraseSource,
  count: number,
  videoTitle: string,
  transcriptExcerpt: string,
  videoDescription: string,
  theme: string,
) {
  const base = [
    'Você é um tutor de inglês americano criando frases curtas para um aluno brasileiro praticar SHADOWING',
    '(ouvir, ler e repetir em voz alta para treinar pronúncia, ritmo e entonação).',
    `Gere exatamente ${count} frases curtas (até 15 palavras cada), naturais, em inglês americano falado.`,
    'Cada frase deve ser útil para repetir em voz alta — evite frases muito técnicas ou muito longas.',
    'Para cada frase, forneça também a tradução natural em português do Brasil.',
    'Retorne somente JSON no schema solicitado, sem markdown.',
  ];

  if (source === 'videoTranscript') {
    base.push(
      '',
      'Use como base a TRANSCRIÇÃO real do vídeo abaixo. Extraia ou adapte frases que realmente aparecem nela.',
      'Não invente frases que não tenham relação com este conteúdo.',
      `Título do vídeo: ${videoTitle}`,
      'Transcrição (trecho):',
      transcriptExcerpt,
    );
  } else if (source === 'videoMetadata') {
    base.push(
      '',
      'Não há transcrição disponível. Use como base o TÍTULO e a DESCRIÇÃO reais do vídeo abaixo.',
      'Adapte frases relacionadas ao conteúdo descrito — não invente detalhes que não estejam aqui.',
      `Título do vídeo: ${videoTitle}`,
      'Descrição do vídeo:',
      videoDescription,
    );
  } else {
    base.push(
      '',
      'Não há transcrição nem descrição de vídeo disponíveis desta vez.',
      `Gere frases gerais de conversação sobre o tema: "${theme || videoTitle || 'inglês do dia a dia'}".`,
      'Deixe claro (implicitamente, pelo conteúdo) que são frases gerais sobre o tema, não extraídas de um vídeo específico.',
    );
  }

  return base.join('\n');
}

function isValidPhrase(value: unknown): value is GeneratedPhrase {
  const phrase = value as Partial<GeneratedPhrase> | null;
  return Boolean(
    phrase
    && typeof phrase.text === 'string' && phrase.text.trim().length > 0
    && typeof phrase.translation === 'string' && phrase.translation.trim().length > 0,
  );
}

function isValidResult(value: unknown): value is { phrases: GeneratedPhrase[] } {
  const result = value as Partial<{ phrases: unknown[] }> | null;
  return Boolean(result && Array.isArray(result.phrases) && result.phrases.length > 0 && result.phrases.every(isValidPhrase));
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
      error: 'Geração de frases com IA não configurada. Peça para o administrador configurar GEMINI_API_KEY.',
    });
    return;
  }

  let body: GenerateShadowingPhrasesRequest;
  try {
    body = parseBody(req.body);
  } catch {
    json(res, 400, { success: false, error: 'JSON inválido.' });
    return;
  }

  const videoId = trimString(body.videoId, 20);
  const videoTitle = trimString(body.videoTitle, 240);
  const transcriptExcerpt = trimString(body.transcriptExcerpt, MAX_TEXT_LENGTH);
  const videoDescription = trimString(body.videoDescription, MAX_TEXT_LENGTH);
  const theme = trimString(body.theme, MAX_THEME_LENGTH);
  const count = clampCount(body.count);

  // Um vídeo carregado conta como contexto válido mesmo sem título/descrição
  // (ex.: link colado manualmente, sem metadados da YouTube API) — só recusamos
  // quando não há vídeo E não há tema nenhum.
  if (!videoTitle && !theme && !transcriptExcerpt && !videoDescription && !videoId) {
    json(res, 400, { success: false, error: 'Informe ao menos um vídeo ou um tema para gerar as frases.' });
    return;
  }

  const source = resolveSource(transcriptExcerpt, videoDescription);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents: buildPrompt(source, count, videoTitle, transcriptExcerpt, videoDescription, theme),
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: phrasesSchema,
        temperature: 0.6,
        maxOutputTokens: 1600,
      },
    });

    const outputText = response.text ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      json(res, 502, { success: false, error: FRIENDLY_ERROR });
      return;
    }

    if (!isValidResult(parsed)) {
      json(res, 502, { success: false, error: FRIENDLY_ERROR });
      return;
    }

    json(res, 200, {
      source,
      phrases: parsed.phrases.slice(0, count).map(phrase => ({
        text: phrase.text.trim(),
        translation: phrase.translation.trim(),
      })),
    });
  } catch (error) {
    console.error('[api/english/generate-shadowing-phrases] Gemini call failed', { message: error instanceof Error ? error.message : 'unknown' });
    json(res, 502, { success: false, error: FRIENDLY_ERROR });
  }
}
