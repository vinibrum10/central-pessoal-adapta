import { describe, expect, it, vi } from 'vitest';
import {
  createDailyVideoConnectionController,
  type DailyVideoConnectionDeps,
} from './dailyVideoConnectionController';
import type { DiscoveredPlaylist, YoutubeConnectionState } from '../../types/dailyVideoEnglish';
import type { DailyVideoSessionRow } from './dailyVideoSessionsRepository';

function makeConnectionState(status: YoutubeConnectionState['status'], overrides: Partial<YoutubeConnectionState> = {}): YoutubeConnectionState {
  return { status, grantedScopes: [], lastRefreshedAt: null, errorMessage: null, ...overrides };
}

function makeSessionRow(overrides: Partial<DailyVideoSessionRow> = {}): DailyVideoSessionRow {
  return {
    id: 'session-1',
    user_id: 'user-1',
    session_date: '2026-07-25',
    timezone: 'America/Sao_Paulo',
    youtube_video_id: null,
    youtube_video_title: null,
    youtube_video_thumbnail_url: null,
    ...overrides,
  };
}

const SAMPLE_PLAYLIST: DiscoveredPlaylist = { playlistId: 'PL123', playlistTitle: 'SGP — Inglês' };

function createTestDeps(initialStatus: YoutubeConnectionState['status'] = 'not_connected') {
  const deps: DailyVideoConnectionDeps = {
    getYoutubeConnectionStatus: vi.fn().mockResolvedValue(makeConnectionState(initialStatus)),
    startYoutubeAuthorization: vi.fn().mockResolvedValue(undefined),
    disconnectYoutube: vi.fn().mockResolvedValue(undefined),
    discoverYoutubePlaylist: vi.fn().mockResolvedValue({ kind: 'not_found' }),
    getRecentVideos: vi.fn().mockResolvedValue({ kind: 'empty' }),
    saveYoutubePlaylistSettings: vi.fn().mockResolvedValue({
      id: 'row-1', user_id: 'user-1', playlist_id: 'PL123', playlist_title: 'SGP — Inglês',
      configured_at: '2026-01-01T00:00:00.000Z', last_verified_at: null, last_synced_at: null,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    }),
    getTodaysVideoSession: vi.fn().mockResolvedValue(null),
    saveSelectedVideoForToday: vi.fn().mockResolvedValue(makeSessionRow()),
  };
  return deps;
}

describe('dailyVideoConnectionController — primeira autorização', () => {
  it('nunca chama startYoutubeAuthorization durante initialize() — nenhum redirect/popup automático ao montar a página', async () => {
    const deps = createTestDeps('not_connected');
    const controller = createDailyVideoConnectionController(deps);

    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    expect(deps.startYoutubeAuthorization).not.toHaveBeenCalled();
  });

  it('connect() só é chamada a partir de uma ação explícita — dispara o redirect OAuth exatamente uma vez', async () => {
    const deps = createTestDeps('not_connected');
    const controller = createDailyVideoConnectionController(deps);
    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    expect(deps.startYoutubeAuthorization).not.toHaveBeenCalled();
    await controller.connect();
    expect(deps.startYoutubeAuthorization).toHaveBeenCalledTimes(1);
  });
});

describe('dailyVideoConnectionController — restauração automática após F5', () => {
  it('quando o backend já reporta "connected", descobre a playlist e carrega vídeos automaticamente, sem nenhuma ação do usuário', async () => {
    const deps = createTestDeps('connected');
    deps.discoverYoutubePlaylist = vi.fn().mockResolvedValue({ kind: 'found', playlist: SAMPLE_PLAYLIST });
    deps.getRecentVideos = vi.fn().mockResolvedValue({ kind: 'empty' });
    const controller = createDailyVideoConnectionController(deps);

    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    expect(deps.startYoutubeAuthorization).not.toHaveBeenCalled();
    expect(controller.getState().connection.status).toBe('connected');
    expect(deps.discoverYoutubePlaylist).toHaveBeenCalledTimes(1);
    expect(deps.getRecentVideos).toHaveBeenCalledWith(SAMPLE_PLAYLIST);
  });

  it('quando "not_connected", NÃO tenta descobrir playlist nem carregar vídeos', async () => {
    const deps = createTestDeps('not_connected');
    const controller = createDailyVideoConnectionController(deps);

    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    expect(deps.discoverYoutubePlaylist).not.toHaveBeenCalled();
    expect(deps.getRecentVideos).not.toHaveBeenCalled();
  });
});

describe('dailyVideoConnectionController — renovação/expiração detectada pelo backend', () => {
  it('se discoverYoutubePlaylist retornar reconnect_required (refresh_token inválido/expirado/revogado), o status passa a reconnect_required', async () => {
    const deps = createTestDeps('connected');
    deps.discoverYoutubePlaylist = vi.fn().mockResolvedValue({ kind: 'reconnect_required' });
    const controller = createDailyVideoConnectionController(deps);

    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    expect(controller.getState().connection.status).toBe('reconnect_required');
    expect(deps.getRecentVideos).not.toHaveBeenCalled();
  });

  it('se getRecentVideos retornar reconnect_required durante o carregamento, o status também transiciona (renovação falhou no meio do fluxo)', async () => {
    const deps = createTestDeps('connected');
    deps.discoverYoutubePlaylist = vi.fn().mockResolvedValue({ kind: 'found', playlist: SAMPLE_PLAYLIST });
    deps.getRecentVideos = vi.fn().mockResolvedValue({ kind: 'reconnect_required' });
    const controller = createDailyVideoConnectionController(deps);

    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    expect(controller.getState().connection.status).toBe('reconnect_required');
    expect(controller.getState().videos).toBeNull();
  });
});

describe('dailyVideoConnectionController — timeout sem loading infinito', () => {
  it('nunca fica preso em "checking" para sempre se getYoutubeConnectionStatus travar sem resolver nem rejeitar', async () => {
    vi.useFakeTimers();
    try {
      const deps = createTestDeps('not_connected');
      deps.getYoutubeConnectionStatus = vi.fn(() => new Promise<never>(() => {}));
      const controller = createDailyVideoConnectionController(deps);

      const initializePromise = controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');
      expect(controller.getState().connection.status).toBe('checking');

      await vi.advanceTimersByTimeAsync(10_000);
      await initializePromise;

      expect(controller.getState().connection.status).toBe('error');
      expect(controller.getState().connection.errorMessage).toMatch(/excedeu/i);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('dailyVideoConnectionController — desconexão/revogação', () => {
  it('disconnect() chama deps.disconnectYoutube() e reseta conexão, descoberta e vídeos', async () => {
    const deps = createTestDeps('connected');
    deps.discoverYoutubePlaylist = vi.fn().mockResolvedValue({ kind: 'found', playlist: SAMPLE_PLAYLIST });
    deps.getRecentVideos = vi.fn().mockResolvedValue({ kind: 'empty' });
    const controller = createDailyVideoConnectionController(deps);
    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    await controller.disconnect();

    expect(deps.disconnectYoutube).toHaveBeenCalledTimes(1);
    expect(controller.getState().connection.status).toBe('not_connected');
    expect(controller.getState().discovery).toBeNull();
    expect(controller.getState().videos).toBeNull();
  });
});

describe('dailyVideoConnectionController — persistência e restauração do vídeo selecionado', () => {
  it('initialize() restaura selectedVideoId a partir de daily_video_sessions, mesmo antes de saber o estado da conexão', async () => {
    const deps = createTestDeps('not_connected');
    deps.getTodaysVideoSession = vi.fn().mockResolvedValue(makeSessionRow({ youtube_video_id: 'v-ontem' }));
    const controller = createDailyVideoConnectionController(deps);

    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    expect(controller.getState().selectedVideoId).toBe('v-ontem');
    expect(deps.getTodaysVideoSession).toHaveBeenCalledWith('user-1', '2026-07-25');
  });

  it('selectVideo() persiste metadados do vídeo (id, título, thumbnail) para o usuário e a data corretos', async () => {
    const deps = createTestDeps('connected');
    deps.discoverYoutubePlaylist = vi.fn().mockResolvedValue({ kind: 'found', playlist: SAMPLE_PLAYLIST });
    deps.getRecentVideos = vi.fn().mockResolvedValue({
      kind: 'videos',
      videos: [{ videoId: 'v1', title: 'Título do vídeo', thumbnailUrl: 'https://img/thumb.jpg', addedAt: '2026-07-20', durationIso: 'PT1M', durationSeconds: 60, durationFormatted: '1:00' }],
      skippedInvalidCount: 0,
    });
    const controller = createDailyVideoConnectionController(deps);
    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    controller.selectVideo('v1');

    expect(controller.getState().selectedVideoId).toBe('v1');
    await vi.waitFor(() => expect(deps.saveSelectedVideoForToday).toHaveBeenCalledWith(
      'user-1',
      '2026-07-25',
      'America/Sao_Paulo',
      { videoId: 'v1', title: 'Título do vídeo', thumbnailUrl: 'https://img/thumb.jpg' },
    ));
  });

  it('selectVideo() nunca sobrescreve outros campos da sessão — só chama saveSelectedVideoForToday com os campos do vídeo', async () => {
    const deps = createTestDeps('connected');
    deps.discoverYoutubePlaylist = vi.fn().mockResolvedValue({ kind: 'found', playlist: SAMPLE_PLAYLIST });
    deps.getRecentVideos = vi.fn().mockResolvedValue({
      kind: 'videos',
      videos: [{ videoId: 'v1', title: 'T', thumbnailUrl: null, addedAt: '2026-07-20', durationIso: 'PT1M', durationSeconds: 60, durationFormatted: '1:00' }],
      skippedInvalidCount: 0,
    });
    const controller = createDailyVideoConnectionController(deps);
    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    controller.selectVideo('v1');

    await vi.waitFor(() => expect(deps.saveSelectedVideoForToday).toHaveBeenCalledTimes(1));
    const callArgs = (deps.saveSelectedVideoForToday as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(Object.keys(callArgs[3])).toEqual(['videoId', 'title', 'thumbnailUrl']);
  });
});

describe('dailyVideoConnectionController — descoberta', () => {
  it('duplicate: NÃO escolhe nenhuma playlist automaticamente (saveYoutubePlaylistSettings nunca é chamado)', async () => {
    const deps = createTestDeps('connected');
    deps.discoverYoutubePlaylist = vi.fn().mockResolvedValue({
      kind: 'duplicate',
      playlists: [SAMPLE_PLAYLIST, { playlistId: 'PL999', playlistTitle: 'SGP — Inglês' }],
    });
    const controller = createDailyVideoConnectionController(deps);

    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    expect(controller.getState().discovery?.kind).toBe('duplicate');
    expect(deps.saveYoutubePlaylistSettings).not.toHaveBeenCalled();
    expect(deps.getRecentVideos).not.toHaveBeenCalled();
  });

  it('found: registra a configuração da playlist (melhor-esforço) e carrega os vídeos em seguida', async () => {
    const deps = createTestDeps('connected');
    deps.discoverYoutubePlaylist = vi.fn().mockResolvedValue({ kind: 'found', playlist: SAMPLE_PLAYLIST });
    deps.getRecentVideos = vi.fn().mockResolvedValue({ kind: 'empty' });
    const controller = createDailyVideoConnectionController(deps);

    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    expect(deps.saveYoutubePlaylistSettings).toHaveBeenCalledWith('user-1', SAMPLE_PLAYLIST);
    expect(deps.getRecentVideos).toHaveBeenCalledWith(SAMPLE_PLAYLIST);
  });
});

describe('dailyVideoConnectionController — segurança', () => {
  it('nenhum campo do estado público é ou contém um token — nem access_token, nem refresh_token, nem chaves parecidas', async () => {
    const deps = createTestDeps('connected');
    deps.discoverYoutubePlaylist = vi.fn().mockResolvedValue({ kind: 'found', playlist: SAMPLE_PLAYLIST });
    deps.getRecentVideos = vi.fn().mockResolvedValue({ kind: 'empty' });
    const controller = createDailyVideoConnectionController(deps);

    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');

    const state = controller.getState();
    expect(state).not.toHaveProperty('accessToken');
    expect(state).not.toHaveProperty('refreshToken');
    expect(JSON.stringify(state)).not.toMatch(/access[_-]?token|refresh[_-]?token/i);
  });

  it('dispose() limpa os listeners', async () => {
    const deps = createTestDeps('not_connected');
    const controller = createDailyVideoConnectionController(deps);
    await controller.initialize('user-1', '2026-07-25', 'America/Sao_Paulo');
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.dispose();
    controller.selectVideo('x');

    expect(listener).not.toHaveBeenCalled();
  });
});
