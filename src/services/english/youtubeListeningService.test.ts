import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildManualListeningVideo,
  extractYouTubeVideoId,
  searchListeningVideo,
  searchShadowingVideo,
  MANUAL_VIDEO_LONG_WARNING_SECONDS,
  MAX_LISTENING_SEARCH_DURATION_SECONDS,
} from './youtubeListeningService';
import { recordVideoUsage } from './videoHistoryService';

function searchApiResponse(videoId: string) {
  return { ok: true, json: async () => ({ items: [{ id: { videoId } }] }) };
}

function videosApiResponse(video: {
  id: string;
  durationIso: string;
  title?: string;
  channelTitle?: string;
  viewCount?: string;
}) {
  return {
    ok: true,
    json: async () => ({
      items: [{
        id: video.id,
        contentDetails: { duration: video.durationIso },
        status: { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed' },
        statistics: { viewCount: video.viewCount ?? '5000', likeCount: '100' },
        snippet: { title: video.title ?? 'Listening practice video', channelTitle: video.channelTitle ?? 'VOA Learning English' },
      }],
    }),
  };
}

describe('buildManualListeningVideo / extractYouTubeVideoId (link manual — nunca bloqueia por duração)', () => {
  it('extrai o ID de diferentes formatos de link do YouTube', () => {
    expect(extractYouTubeVideoId('https://youtu.be/abc12345678')).toBe('abc12345678');
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=abc12345678')).toBe('abc12345678');
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=abc12345678&t=30s')).toBe('abc12345678');
    expect(extractYouTubeVideoId('abc12345678')).toBe('abc12345678');
    expect(extractYouTubeVideoId('não é um link')).toBeNull();
  });

  it('constrói o vídeo manual sempre com sucesso, sem nenhuma validação de duração', () => {
    // buildManualListeningVideo não recebe nem valida duração — o vídeo é
    // sempre aceito. A duração só é preenchida depois, de forma assíncrona,
    // pelo player (ver Ingles.tsx) — aqui começa em 0 (desconhecida).
    const video = buildManualListeningVideo('abc12345678', 'advanced');
    expect(video.source).toBe('manual_link');
    expect(video.durationSeconds).toBe(0);
    expect(video.youtubeVideoId).toBe('abc12345678');
  });

  it('o limite de aviso amigável para link manual é 30 minutos (1800s) — não é um bloqueio, é só um valor de referência para a UI', () => {
    expect(MANUAL_VIDEO_LONG_WARNING_SECONDS).toBe(1800);
  });
});

describe('searchListeningVideo (busca automática via API — máximo 30 minutos)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_YOUTUBE_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('o limite de busca automática é 30 minutos (1800s)', () => {
    expect(MAX_LISTENING_SEARCH_DURATION_SECONDS).toBe(1800);
  });

  it('rejeita vídeos acima de 30 minutos e aceita o próximo vídeo válido (até 30 minutos)', async () => {
    const fetchMock = vi.fn()
      // 1ª fonte: vídeo longo demais (33min20s) — inválido, descartado
      .mockResolvedValueOnce(searchApiResponse('toolongvid1'))
      .mockResolvedValueOnce(videosApiResponse({ id: 'toolongvid1', durationIso: 'PT33M20S' }))
      // 2ª fonte: vídeo de 20 minutos — válido
      .mockResolvedValueOnce(searchApiResponse('validvideo1'))
      .mockResolvedValueOnce(videosApiResponse({ id: 'validvideo1', durationIso: 'PT20M0S' }));
    vi.stubGlobal('fetch', fetchMock);

    const video = await searchListeningVideo('advanced');
    expect(video?.youtubeVideoId).toBe('validvideo1');
    expect(video?.durationSeconds).toBe(1200);
  });

  it('aceita um vídeo de exatamente 30 minutos (limite inclusivo)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(searchApiResponse('exactly30m1'))
      .mockResolvedValueOnce(videosApiResponse({ id: 'exactly30m1', durationIso: 'PT30M0S' }));
    vi.stubGlobal('fetch', fetchMock);

    const video = await searchListeningVideo('advanced');
    expect(video?.youtubeVideoId).toBe('exactly30m1');
    expect(video?.durationSeconds).toBe(1800);
  });

  it('não repetição: evita devolver um vídeo já usado recentemente quando existe alternativa nova', async () => {
    recordVideoUsage({
      videoId: 'usedrecent1',
      url: 'https://www.youtube.com/watch?v=usedrecent1',
      title: 'Already used video',
      channelTitle: 'VOA Learning English',
      durationSeconds: 600,
      source: 'youtubeApiSearch',
      purpose: 'listening',
    });

    const fetchMock = vi.fn()
      // 1ª fonte: devolve o vídeo já usado recentemente
      .mockResolvedValueOnce(searchApiResponse('usedrecent1'))
      .mockResolvedValueOnce(videosApiResponse({ id: 'usedrecent1', durationIso: 'PT10M0S', title: 'Already used video' }))
      // 2ª fonte: devolve um vídeo novo (nunca usado)
      .mockResolvedValueOnce(searchApiResponse('freshvideo1'))
      .mockResolvedValueOnce(videosApiResponse({ id: 'freshvideo1', durationIso: 'PT12M0S', title: 'Fresh video' }));
    vi.stubGlobal('fetch', fetchMock);

    const video = await searchListeningVideo('advanced');
    expect(video?.youtubeVideoId).toBe('freshvideo1');
  });

  it('se só houver vídeos usados recentemente, reutiliza o menos usado recentemente em vez de retornar nada', async () => {
    recordVideoUsage({
      videoId: 'onlyoption1',
      url: 'https://www.youtube.com/watch?v=onlyoption1',
      title: 'Only option',
      channelTitle: 'VOA Learning English',
      durationSeconds: 600,
      source: 'youtubeApiSearch',
      purpose: 'listening',
    });

    // Toda fonte pesquisada devolve o mesmo (único) vídeo disponível, que já
    // está no histórico recente.
    const fetchMock = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/search')) return searchApiResponse('onlyoption1');
      return videosApiResponse({ id: 'onlyoption1', durationIso: 'PT10M0S', title: 'Only option' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const video = await searchListeningVideo('advanced');
    expect(video?.youtubeVideoId).toBe('onlyoption1');
  });
});

describe('searchShadowingVideo (histórico de shadowing é independente do de listening)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_YOUTUBE_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('evita repetir um vídeo de shadowing usado recentemente, preferindo um vídeo novo', async () => {
    // A 1ª fonte prioritária de shadowing é 'Fluent American Shadowing'; a 2ª é "Rachel's English".
    recordVideoUsage({
      videoId: 'usedshadow0',
      url: 'https://www.youtube.com/watch?v=usedshadow0',
      title: 'Used shadowing video',
      channelTitle: 'Fluent American Shadowing',
      durationSeconds: 400,
      source: 'youtubeApiSearch',
      purpose: 'shadowing',
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(searchApiResponse('usedshadow0'))
      .mockResolvedValueOnce(videosApiResponse({ id: 'usedshadow0', durationIso: 'PT6M40S', title: 'Used shadowing video', channelTitle: 'Fluent American Shadowing' }))
      .mockResolvedValueOnce(searchApiResponse('freshshado1'))
      .mockResolvedValueOnce(videosApiResponse({ id: 'freshshado1', durationIso: 'PT7M0S', title: 'Fresh shadowing video', channelTitle: "Rachel's English" }));
    vi.stubGlobal('fetch', fetchMock);

    const video = await searchShadowingVideo('advanced');
    expect(video?.youtubeVideoId).toBe('freshshado1');
  });

  it('um vídeo marcado como usado recentemente só em Listening continua disponível para Shadowing', async () => {
    recordVideoUsage({
      videoId: 'sharedvideo',
      url: 'https://www.youtube.com/watch?v=sharedvideo',
      title: 'Shared video',
      channelTitle: 'Fluent American Shadowing',
      durationSeconds: 400,
      source: 'youtubeApiSearch',
      purpose: 'listening',
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(searchApiResponse('sharedvideo'))
      .mockResolvedValueOnce(videosApiResponse({ id: 'sharedvideo', durationIso: 'PT6M40S', title: 'Shared video', channelTitle: 'Fluent American Shadowing' }));
    vi.stubGlobal('fetch', fetchMock);

    const video = await searchShadowingVideo('advanced');
    expect(video?.youtubeVideoId).toBe('sharedvideo');
  });
});
