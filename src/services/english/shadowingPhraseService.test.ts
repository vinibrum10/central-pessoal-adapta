import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShadowingPhrase } from './englishStorage';
import {
  NO_THEME_ERROR,
  NO_VIDEO_ERROR,
  fetchVideoTranscriptBestEffort,
  generateAiShadowingPhrasesFromTheme,
  generateAiShadowingPhrasesFromVideo,
  generateShadowingPhrasesForVideo,
} from './shadowingPhraseService';

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

describe('generateAiShadowingPhrasesFromVideo (botão "Gerar com vídeo atual")', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('vídeo carregado (link manual, sem título/descrição) -> gera frases, source "aiGeneratedFromVideo"', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('CORS blocked')) // fetchVideoTranscriptBestEffort falha
      .mockResolvedValueOnce({ ok: true, json: async () => validResponse }); // chamada ao backend
    vi.stubGlobal('fetch', fetchMock);

    const phrases = await generateAiShadowingPhrasesFromVideo(
      { videoId: 'abc12345678', videoUrl: 'https://www.youtube.com/watch?v=abc12345678' },
      2,
    );

    expect(phrases).toHaveLength(2);
    expect(phrases.every((p: ShadowingPhrase) => p.source === 'aiGeneratedFromVideo')).toBe(true);
    expect(phrases.every((p: ShadowingPhrase) => p.videoId === 'abc12345678')).toBe(true);
    expect(phrases.every((p: ShadowingPhrase) => p.videoUrl === 'https://www.youtube.com/watch?v=abc12345678')).toBe(true);
    expect(phrases.every((p: ShadowingPhrase) => p.repetitionsDone === 0 && p.repetitionsTarget === 5 && p.completed === false)).toBe(true);

    // A chamada ao backend deve realmente enviar o videoId (bug corrigido — antes não era enviado).
    const [, requestInit] = fetchMock.mock.calls[1];
    const sentBody = JSON.parse((requestInit as RequestInit).body as string);
    expect(sentBody.videoId).toBe('abc12345678');
  });

  it('sem vídeo carregado -> erro amigável, sem chamar a rede', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiShadowingPhrasesFromVideo({})).rejects.toThrow(NO_VIDEO_ERROR);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propaga o erro real em vez de mascará-lo com frases genéricas — o usuário clicou explicitamente e precisa saber que falhou', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('CORS blocked'))
      .mockResolvedValueOnce({ ok: false, json: async () => ({ success: false, error: 'Geração de frases com IA não configurada.' }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiShadowingPhrasesFromVideo({ videoId: 'abc12345678' })).rejects.toThrow('Geração de frases com IA não configurada.');
  });

  it('rejeita com erro amigável em caso de falha de rede', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiShadowingPhrasesFromVideo({ videoId: 'abc12345678' })).rejects.toThrow(/conexão|CORS/i);
  });
});

describe('generateAiShadowingPhrasesFromTheme (botão "Usar tema manual")', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tema manual digitado -> gera frases, source "aiGeneratedFromTheme"', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => validResponse });
    vi.stubGlobal('fetch', fetchMock);

    const phrases = await generateAiShadowingPhrasesFromTheme('job interview', 2);
    expect(phrases).toHaveLength(2);
    expect(phrases.every((p: ShadowingPhrase) => p.source === 'aiGeneratedFromTheme')).toBe(true);
    expect(phrases.every((p: ShadowingPhrase) => p.theme === 'job interview')).toBe(true);
    expect(phrases.every((p: ShadowingPhrase) => p.videoId === undefined)).toBe(true);

    const [, requestInit] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse((requestInit as RequestInit).body as string);
    expect(sentBody.theme).toBe('job interview');
    // Nunca deve chamar fetchVideoTranscriptBestEffort — só uma chamada de rede (o backend).
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('usa o tema mesmo quando há um vídeo carregado — o usuário escolheu essa origem explicitamente', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => validResponse });
    vi.stubGlobal('fetch', fetchMock);

    // A própria assinatura da função não recebe contexto de vídeo — ela sempre usa tema.
    const phrases = await generateAiShadowingPhrasesFromTheme('job interview');
    expect(phrases.every((p: ShadowingPhrase) => p.source === 'aiGeneratedFromTheme')).toBe(true);
  });

  it('sem tema -> erro amigável, sem chamar a rede', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiShadowingPhrasesFromTheme('   ')).rejects.toThrow(NO_THEME_ERROR);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejeita quando a resposta do Gemini não bate com o schema esperado, sem inventar frases', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ phrases: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiShadowingPhrasesFromTheme('travel')).rejects.toThrow();
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
    expect(phrases.every((p: ShadowingPhrase) => p.source === 'videoMetadata')).toBe(true);
  });

  it('NUNCA lança exceção — cai para o fallback local (source "fallback") se a IA falhar', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const phrases = await generateShadowingPhrasesForVideo({ videoId: 'abc12345678', videoTitle: 'Daily routines' });
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases.every((p: ShadowingPhrase) => p.source === 'fallback')).toBe(true);
  });
});
