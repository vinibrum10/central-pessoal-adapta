import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateAiQuiz, generateFallbackQuiz } from './videoQuizService';
import type { ListeningVideo } from './englishStorage';

const video: ListeningVideo = {
  youtubeVideoId: 'abc12345678',
  title: 'Daily routines in American English',
  channelTitle: 'VOA Learning English',
  durationSeconds: 180,
  level: 'intermediate',
  watchUrl: 'https://www.youtube.com/watch?v=abc12345678',
  embedUrl: 'https://www.youtube.com/embed/abc12345678',
  source: 'youtube_api',
};

describe('generateFallbackQuiz (offline, sem IA)', () => {
  it('é marcado explicitamente como fallback offline, nunca como se fosse gerado por IA', () => {
    const quiz = generateFallbackQuiz(video.youtubeVideoId);
    expect(quiz.source).toBe('fallback');
    expect(quiz.warning).toBeTruthy();
    expect(quiz.warning?.toLowerCase()).toContain('offline');
    expect(quiz.questions.length).toBeGreaterThan(0);
    expect(quiz.questions.length).toBeLessThanOrEqual(10);
    expect(quiz.answers).toEqual({});
  });
});

describe('generateAiQuiz (Gemini via /api/english/generate-quiz)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mapeia uma resposta válida do Gemini para o formato VideoQuiz da tela, preservando source/warning', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        videoId: video.youtubeVideoId,
        title: video.title,
        level: 'A2',
        questionCount: 1,
        generatedAt: new Date().toISOString(),
        source: 'metadata',
        warning: 'Questionário gerado com base em metadados do vídeo, pois não havia transcrição ou resumo disponível.',
        questions: [
          {
            id: 'q1',
            type: 'multiple_choice',
            question: 'What is this video about?',
            options: ['Daily routines', 'Cooking', 'Sports', 'Weather'],
            correctIndex: 0,
            explanation: 'O vídeo fala sobre rotinas diárias.',
            skill: 'comprehension',
            difficulty: 'medium',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const quiz = await generateAiQuiz(video, 1);

    expect(fetchMock).toHaveBeenCalledWith('/api/english/generate-quiz', expect.objectContaining({ method: 'POST' }));
    expect(quiz.youtubeVideoId).toBe(video.youtubeVideoId);
    expect(quiz.source).toBe('metadata');
    expect(quiz.warning).toMatch(/metadados/i);
    expect(quiz.questions).toHaveLength(1);
    expect(quiz.questions[0].correctAnswerIndex).toBe(0);
    expect(quiz.answers).toEqual({});
  });

  it('propaga o erro do backend em vez de mascará-lo com um quiz genérico como se fosse IA', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: 'Não foi possível gerar o questionário agora. Tente novamente.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiQuiz(video, 5)).rejects.toThrow('Não foi possível gerar o questionário agora. Tente novamente.');
  });

  it('rejeita com erro amigável em caso de falha de rede, sem inventar um quiz', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiQuiz(video, 5)).rejects.toThrow(/conexão/i);
  });

  it('rejeita quando o Gemini responde 200 mas com um formato inválido/incompleto', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ questions: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateAiQuiz(video, 5)).rejects.toThrow();
  });
});
