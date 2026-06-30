export interface TranslateWordResult {
  word: string;
  translation: string;
  example: string;
}

interface ErrorResponse {
  success?: false;
  error?: string;
}

function isTranslateWordResult(value: unknown): value is TranslateWordResult {
  const result = value as Partial<TranslateWordResult> | null;
  return Boolean(
    result
    && typeof result.word === 'string'
    && typeof result.translation === 'string'
    && typeof result.example === 'string',
  );
}

export async function translateWeeklyWord(word: string): Promise<TranslateWordResult> {
  const response = await fetch('/api/english/translate-word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word }),
  });

  const data = await response.json().catch(() => ({})) as TranslateWordResult | ErrorResponse;
  if (!response.ok || !isTranslateWordResult(data)) {
    const error = 'error' in data && typeof data.error === 'string'
      ? data.error
      : 'Não foi possível traduzir agora. Tente novamente.';
    throw new Error(error);
  }

  return data;
}
