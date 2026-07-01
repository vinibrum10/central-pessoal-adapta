import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRecentlyUsedVideoIds,
  loadVideoHistory,
  pickLeastRecentlyUsed,
  recordVideoUsage,
  updateVideoHistoryDuration,
} from './videoHistoryService';

function baseInput(overrides: Partial<Parameters<typeof recordVideoUsage>[0]> = {}) {
  return {
    videoId: 'abc12345678',
    url: 'https://www.youtube.com/watch?v=abc12345678',
    title: 'Daily routines in American English',
    channelTitle: 'VOA Learning English',
    durationSeconds: 300,
    source: 'manualLink' as const,
    purpose: 'listening' as const,
    ...overrides,
  };
}

describe('videoHistoryService (histórico local de vídeos do Inglês Diário)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('salva um vídeo novo no histórico', () => {
    const result = recordVideoUsage(baseInput());
    expect(result.alreadyUsedBefore).toBe(false);
    expect(result.entry.useCount).toBe(1);

    const history = loadVideoHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      videoId: 'abc12345678',
      title: 'Daily routines in American English',
      channelTitle: 'VOA Learning English',
      source: 'manualLink',
      purpose: 'listening',
      status: 'active',
      useCount: 1,
    });
    expect(history[0].id).toBeTruthy();
    expect(history[0].addedAt).toBeTruthy();
    expect(history[0].lastUsedAt).toBeTruthy();
    expect(history[0].thumbnailUrl).toContain('abc12345678');
  });

  it('não duplica o mesmo videoId+purpose — atualiza lastUsedAt e incrementa useCount', () => {
    recordVideoUsage(baseInput());

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z'));
    const second = recordVideoUsage(baseInput());

    expect(second.alreadyUsedBefore).toBe(true);
    expect(second.entry.useCount).toBe(2);
    expect(second.entry.lastUsedAt).toBe('2026-07-05T10:00:00.000Z');

    const history = loadVideoHistory();
    expect(history).toHaveLength(1);
    expect(history[0].useCount).toBe(2);
  });

  it('permite o mesmo videoId em purposes diferentes (listening e shadowing) sem conflito', () => {
    recordVideoUsage(baseInput({ purpose: 'listening' }));
    const shadowingResult = recordVideoUsage(baseInput({ purpose: 'shadowing' }));

    expect(shadowingResult.alreadyUsedBefore).toBe(false);
    expect(loadVideoHistory()).toHaveLength(2);
  });

  it('persiste o histórico após "reload" (nova leitura do zero via loadVideoHistory)', () => {
    recordVideoUsage(baseInput());
    const reloaded = loadVideoHistory();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].videoId).toBe('abc12345678');
  });

  it('updateVideoHistoryDuration atualiza a duração sem contar como novo uso', () => {
    recordVideoUsage(baseInput({ durationSeconds: 0 }));
    updateVideoHistoryDuration('abc12345678', 'listening', 872);

    const history = loadVideoHistory();
    expect(history[0].durationSeconds).toBe(872);
    expect(history[0].useCount).toBe(1);
  });

  it('getRecentlyUsedVideoIds só retorna vídeos usados dentro da janela de dias', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
    recordVideoUsage(baseInput({ videoId: 'old12345678' }));

    vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'));
    recordVideoUsage(baseInput({ videoId: 'new12345678' }));

    const recent = getRecentlyUsedVideoIds('listening', 30);
    expect(recent.has('new12345678')).toBe(true);
    expect(recent.has('old12345678')).toBe(false);
  });

  it('pickLeastRecentlyUsed escolhe o vídeo usado há mais tempo entre os candidatos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));
    recordVideoUsage(baseInput({ videoId: 'oldest1234a' }));

    vi.setSystemTime(new Date('2026-06-20T00:00:00.000Z'));
    recordVideoUsage(baseInput({ videoId: 'newest1234b' }));

    const picked = pickLeastRecentlyUsed(
      [{ youtubeVideoId: 'newest1234b' }, { youtubeVideoId: 'oldest1234a' }],
      'listening',
    );
    expect(picked?.youtubeVideoId).toBe('oldest1234a');
  });
});
