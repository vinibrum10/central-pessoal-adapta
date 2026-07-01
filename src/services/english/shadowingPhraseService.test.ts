import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchVideoTranscriptBestEffort, generateAiShadowingPhrases, generateShadowingPhrasesForVideo } from './shadowingPhraseService';

const validResponse = {
  source: 'aiGenerated',
  phrases: [
    { text: 'Could you say that again?', translation: 'Você pode repetir isso?' },
    { text: 'I really appreciate your help.', translation: 'Eu realmente agradeço sua ajuda.' },
  ],
};

describe('fetchVideoTranscriptBestEffort', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retorna null (sem lançar exceção) quando o endpoint de legendas falha — ex.: bloqueio de CORS', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('CORS blocked'));
    vi.stubGlobal('fetch', fetchMock);

    const transcript = await fetchVideoTranscriptBestEffort('abc12345678');
    expect(transcript).toBeNull();
  });

  it('retorna null quando a resposta não é 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    const transcript = await fetchVideoTranscriptBestEffort('abc12345678');
    expect(transcript).toBeNull();
  });

  it('extrai o texto quando a legenda existe', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<transcript><text start="0" dur="2">Hello there</text><text start="2" dur="2">How are you?</text></transcript>',
    });
    vi.stubGlobal('fetch', fetchMock);

    const transcript = await fetchVideoTranscriptBestEffort('abc12345678');
    expect(transcript).toBe('Hello there How are you?');
  });
});

describe('generateAiShadowingPhrases (ação explícita do botão "Gerar frases com IA")', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retorna as frases com source "aiGenerated" quando o backend responde com sucesso', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => validResponse });
    vi.stubGlobal('fetch', fetchMock);

    const phrases = await generateAiShadowingPhrases({ theme: 'travel', count: 2 });
    expect(phrases).toHaveLength(2);
    expect(phrases.every(p => p.source === 'aiGenerated')).toBe(true);
    expect(phrases.every(p => p.repetitionsDone === 0 && p.repetitionsTarget === 5 && p.completed === false)).toBe(true);
  });

  it('propaga o erro real em vez de mascará-lo com frases genéricas — o usuário clicou "gerar com IA" e precisa saber que falhou', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: 'Geração de frases com IA não configurada.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiShadowingPhrases({ theme: 'travel' })).rejects.toThrow('Geração de frases com IA não configurada.');
  });

  it('rejeita com erro amigável em caso de falha de rede', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiShadowingPhrases({ theme: 'travel' })).rejects.toThrow(/conexão/i);
  });

  it('rejeita quando a resposta do Gemini não bate com o schema esperado, sem inventar frases', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ phrases: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiShadowingPhrases({ theme: 'travel' })).rejects.toThrow();
  });
});

describe('generateShadowingPhrasesForVideo (preenchimento automático de um vídeo novo)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa o resultado do backend (com a origem que ele decidiu) quando a IA responde', async () => {
    const fetchMock = vi.fn()
      // fetchVideoTranscriptBestEffort falha (sem legenda/CORS)
      .mockRejectedValueOnce(new Error('CORS blocked'))
      // chamada ao backend de geração
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...validResponse, source: 'videoMetadata' }) });
    vi.stubGlobal('fetch', fetchMock);

    const phrases = await generateShadowingPhrasesForVideo({ videoId: 'abc12345678', videoTitle: 'Daily routines', videoDescription: 'desc' });
    expect(phrases.every(p => p.source === 'videoMetadata')).toBe(true);
  });

  it('NUNCA lança exceção — cai para o fallback local (source "fallback") se a IA falhar', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const phrases = await generateShadowingPhrasesForVideo({ videoId: 'abc12345678', videoTitle: 'Daily routines' });
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases.every(p => p.source === 'fallback')).toBe(true);
  });
});
