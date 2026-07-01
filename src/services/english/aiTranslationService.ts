// Serviço central de IA (Gemini) para o módulo Inglês Diário.
// A chave GEMINI_API_KEY nunca é lida aqui — só existe no backend (api/english/translate.ts).
// Este arquivo só faz fetch para o endpoint serverless.

export type TranslateContext = 'daily_english' | 'listening' | 'shadowing' | 'vocabulary';
export type TranslateFocus = 'translate' | 'explain' | 'examples';

export interface TranslateExample {
  english: string;
  portuguese: string;
}

export interface TranslateVocabularyItem {
  word: string;
  translation: string;
  example: string;
}

export interface AiTranslateResult {
  original: string;
  translation: string;
  simpleExplanationPtBr: string;
  examples: TranslateExample[];
  pronunciationTipPtBr: string;
  vocabulary: TranslateVocabularyItem[];
}

export interface TranslateWithAiPayload {
  text: string;
  sourceLang?: string;
  targetLang?: string;
  context: TranslateContext;
  focus?: TranslateFocus;
}

interface ErrorResponse {
  success?: false;
  error?: string;
}

const GENERIC_ERROR = 'Não foi possível traduzir com a IA agora. Tente novamente em instantes.';

function isExample(value: unknown): value is TranslateExample {
  const example = value as Partial<TranslateExample> | null;
  return Boolean(example && typeof example.english === 'string' && typeof example.portuguese === 'string');
}

function isVocabularyItem(value: unknown): value is TranslateVocabularyItem {
  const item = value as Partial<TranslateVocabularyItem> | null;
  return Boolean(item && typeof item.word === 'string' && typeof item.translation === 'string' && typeof item.example === 'string');
}

function isAiTranslateResult(value: unknown): value is AiTranslateResult {
  const result = value as Partial<AiTranslateResult> | null;
  return Boolean(
    result
    && typeof result.translation === 'string'
    && typeof result.simpleExplanationPtBr === 'string'
    && typeof result.pronunciationTipPtBr === 'string'
    && Array.isArray(result.examples) && result.examples.every(isExample)
    && Array.isArray(result.vocabulary) && result.vocabulary.every(isVocabularyItem),
  );
}

export async function translateWithAi(payload: TranslateWithAiPayload): Promise<AiTranslateResult> {
  let response: Response;
  try {
    response = await fetch('/api/english/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: payload.text,
        sourceLang: payload.sourceLang,
        targetLang: payload.targetLang ?? 'pt-BR',
        context: payload.context,
        focus: payload.focus ?? 'translate',
      }),
    });
  } catch (networkError) {
    console.error('[AI Translation] Network error calling /api/english/translate', networkError);
    throw new Error('Sem conexão com o servidor de tradução. Verifique sua internet e tente novamente.');
  }

  const data = await response.json().catch(() => ({})) as AiTranslateResult | ErrorResponse;

  if (!response.ok || !isAiTranslateResult(data)) {
    const error = 'error' in data && typeof data.error === 'string' ? data.error : GENERIC_ERROR;
    console.error('[AI Translation] Gemini translate request failed', { status: response.status, error });
    throw new Error(error);
  }

  return data;
}
