import { GoogleGenAI } from '@google/genai';

declare const process: {
  env: Record<string, string | undefined>;
};

type TranslateContext = 'daily_english' | 'listening' | 'shadowing' | 'vocabulary';
type TranslateFocus = 'translate' | 'explain' | 'examples';

type TranslateRequest = {
  text?: string;
  sourceLang?: string;
  targetLang?: string;
  context?: TranslateContext;
  focus?: TranslateFocus;
};

type TranslateExample = { english: string; portuguese: string };
type TranslateVocabularyItem = { word: string; translation: string; example: string };

type TranslateResult = {
  original: string;
  translation: string;
  simpleExplanationPtBr: string;
  examples: TranslateExample[];
  pronunciationTipPtBr: string;
  vocabulary: TranslateVocabularyItem[];
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
const MAX_TEXT_LENGTH = 600;
const FRIENDLY_ERROR = 'Não foi possível traduzir com a IA agora. Tente novamente em instantes.';

const CONTEXT_LABEL: Record<TranslateContext, string> = {
  daily_english: 'rotina de Inglês Diário (listening + vocabulário)',
  listening: 'exercício de listening em inglês americano',
  shadowing: 'prática de shadowing (ouvir, ler, repetir)',
  vocabulary: 'revisão de vocabulário / cards de palavras',
};

const FOCUS_INSTRUCTION: Record<TranslateFocus, string> = {
  translate: 'O aluno quer a tradução principal, mas preencha todos os campos do schema com qualidade.',
  explain: 'O aluno já sabe a tradução aproximada e quer principalmente uma explicação simples e clara em português. Capriche em "simpleExplanationPtBr" e "pronunciationTipPtBr", mas preencha todos os campos.',
  examples: 'O aluno quer principalmente frases de exemplo novas e variadas em inglês americano. Capriche no campo "examples" com frases naturais e diferentes entre si, mas preencha todos os campos.',
};

const translateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['original', 'translation', 'simpleExplanationPtBr', 'examples', 'pronunciationTipPtBr', 'vocabulary'],
  properties: {
    original: { type: 'string' },
    translation: { type: 'string' },
    simpleExplanationPtBr: { type: 'string' },
    examples: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['english', 'portuguese'],
        properties: {
          english: { type: 'string' },
          portuguese: { type: 'string' },
        },
      },
    },
    pronunciationTipPtBr: { type: 'string' },
    vocabulary: {
      type: 'array',
      minItems: 0,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['word', 'translation', 'example'],
        properties: {
          word: { type: 'string' },
          translation: { type: 'string' },
          example: { type: 'string' },
        },
      },
    },
  },
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function parseBody(body: unknown): TranslateRequest {
  if (typeof body === 'string') return JSON.parse(body) as TranslateRequest;
  return (body ?? {}) as TranslateRequest;
}

function trimString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeContext(value: unknown): TranslateContext {
  if (value === 'daily_english' || value === 'listening' || value === 'shadowing' || value === 'vocabulary') return value;
  return 'vocabulary';
}

function normalizeFocus(value: unknown): TranslateFocus {
  if (value === 'translate' || value === 'explain' || value === 'examples') return value;
  return 'translate';
}

function buildPrompt(text: string, sourceLang: string, targetLang: string, context: TranslateContext, focus: TranslateFocus) {
  return [
    'Você é um tutor de inglês americano para um aluno brasileiro estudando pelo módulo "Inglês Diário".',
    `Contexto do pedido: ${CONTEXT_LABEL[context]}.`,
    `Idioma de origem: ${sourceLang}. Idioma de destino: ${targetLang}.`,
    FOCUS_INSTRUCTION[focus],
    '',
    `Texto do aluno (palavra ou frase em inglês): "${text}"`,
    '',
    'Preencha o JSON solicitado com:',
    '- original: o texto exatamente como foi enviado.',
    '- translation: tradução natural para português do Brasil.',
    '- simpleExplanationPtBr: explicação simples, curta e didática em português (quando fizer sentido, explique quando/como se usa).',
    '- examples: 2 a 3 frases de exemplo em inglês americano natural, cada uma com sua tradução em português.',
    '- pronunciationTipPtBr: uma dica curta de pronúncia em português (ex.: sílaba tônica, som que costuma confundir brasileiros).',
    '- vocabulary: 0 a 5 palavras-chave relevantes do texto (vazio se o texto já for uma única palavra simples), cada uma com tradução curta e um exemplo em inglês.',
    'Use sempre inglês americano nos exemplos.',
    'Retorne somente JSON no schema solicitado, sem markdown e sem texto fora do JSON.',
  ].join('\n');
}

function isValidExample(value: unknown): value is TranslateExample {
  const example = value as Partial<TranslateExample> | null;
  return Boolean(
    example
    && typeof example.english === 'string' && example.english.trim().length > 0
    && typeof example.portuguese === 'string' && example.portuguese.trim().length > 0,
  );
}

function isValidVocabularyItem(value: unknown): value is TranslateVocabularyItem {
  const item = value as Partial<TranslateVocabularyItem> | null;
  return Boolean(
    item
    && typeof item.word === 'string' && item.word.trim().length > 0
    && typeof item.translation === 'string' && item.translation.trim().length > 0
    && typeof item.example === 'string' && item.example.trim().length > 0,
  );
}

function isValidResult(value: unknown): value is TranslateResult {
  const result = value as Partial<TranslateResult> | null;
  return Boolean(
    result
    && typeof result.translation === 'string' && result.translation.trim().length > 0
    && typeof result.simpleExplanationPtBr === 'string' && result.simpleExplanationPtBr.trim().length > 0
    && typeof result.pronunciationTipPtBr === 'string'
    && Array.isArray(result.examples) && result.examples.length >= 2 && result.examples.every(isValidExample)
    && Array.isArray(result.vocabulary) && result.vocabulary.every(isValidVocabularyItem),
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
      error: 'Tradução com IA não configurada. Peça para o administrador configurar GEMINI_API_KEY.',
    });
    return;
  }

  let body: TranslateRequest;
  try {
    body = parseBody(req.body);
  } catch {
    json(res, 400, { success: false, error: 'JSON inválido.' });
    return;
  }

  const text = trimString(body.text, MAX_TEXT_LENGTH);
  if (!text) {
    json(res, 400, { success: false, error: 'Informe uma palavra ou frase para traduzir.' });
    return;
  }

  const sourceLang = trimString(body.sourceLang, 20) || 'en';
  const targetLang = trimString(body.targetLang, 20) || 'pt-BR';
  const context = normalizeContext(body.context);
  const focus = normalizeFocus(body.focus);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents: buildPrompt(text, sourceLang, targetLang, context, focus),
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: translateSchema,
        temperature: 0.4,
        maxOutputTokens: 1200,
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

    const result: TranslateResult = {
      original: text,
      translation: parsed.translation.trim(),
      simpleExplanationPtBr: parsed.simpleExplanationPtBr.trim(),
      examples: parsed.examples.map(example => ({ english: example.english.trim(), portuguese: example.portuguese.trim() })),
      pronunciationTipPtBr: parsed.pronunciationTipPtBr.trim(),
      vocabulary: parsed.vocabulary.map(item => ({
        word: item.word.trim(),
        translation: item.translation.trim(),
        example: item.example.trim(),
      })),
    };
    json(res, 200, result);
  } catch (error) {
    console.error('[api/english/translate] Gemini call failed', { message: error instanceof Error ? error.message : 'unknown' });
    json(res, 502, { success: false, error: FRIENDLY_ERROR });
  }
}
