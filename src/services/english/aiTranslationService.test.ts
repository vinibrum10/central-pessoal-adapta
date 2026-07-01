import { afterEach, describe, expect, it, vi } from 'vitest';
import { translateWithAi } from './aiTranslationService';

const validResult = {
  original: 'hello',
  translation: 'olá',
  simpleExplanationPtBr: 'Saudação simples.',
  examples: [
    { english: 'Hello!', portuguese: 'Olá!' },
    { english: 'Hello there.', portuguese: 'Olá aí.' },
  ],
  pronunciationTipPtBr: 'O "h" é mudo.',
  vocabulary: [],
};

describe('translateWithAi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retorna o resultado estruturado quando o backend responde com sucesso', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => validResult });
    vi.stubGlobal('fetch', fetchMock);

    const result = await translateWithAi({ text: 'hello', context: 'vocabulary' });

    expect(fetchMock).toHaveBeenCalledWith('/api/english/translate', expect.objectContaining({ method: 'POST' }));
    expect(result.translation).toBe('olá');
  });

  it('propaga a mensagem de erro do backend (ex.: sem GEMINI_API_KEY) em vez de travar', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: 'Tradução com IA não configurada. Peça para o administrador configurar GEMINI_API_KEY.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(translateWithAi({ text: 'hello', context: 'vocabulary' }))
      .rejects.toThrow('Tradução com IA não configurada. Peça para o administrador configurar GEMINI_API_KEY.');
  });

  it('retorna um erro amigável de conexão quando o fetch falha (rede indisponível)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(translateWithAi({ text: 'hello', context: 'vocabulary' })).rejects.toThrow(/conexão/i);
  });

  it('rejeita quando a resposta não bate com o schema esperado, sem inventar uma tradução', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ translation: 'olá' }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(translateWithAi({ text: 'hello', context: 'vocabulary' })).rejects.toThrow();
  });
});
