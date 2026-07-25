import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  fromCalls: [] as string[],
  result: { data: null as unknown, error: null as unknown },
  lastBuilder: null as null | Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock('../../lib/supabase', () => {
  function createQueryBuilder() {
    const builder: Record<string, unknown> = {};
    const chain = () => vi.fn((..._args: unknown[]) => builder);
    builder.select = chain();
    builder.eq = chain();
    builder.upsert = chain();
    builder.update = chain();
    builder.delete = chain();
    builder.maybeSingle = vi.fn(() => Promise.resolve(mockState.result));
    builder.single = vi.fn(() => Promise.resolve(mockState.result));
    builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(mockState.result).then(resolve, reject);
    mockState.lastBuilder = builder as Record<string, ReturnType<typeof vi.fn>>;
    return builder;
  }

  return {
    isSupabaseConfigured: true,
    supabase: {
      from: vi.fn((table: string) => {
        mockState.fromCalls.push(table);
        return createQueryBuilder();
      }),
    },
  };
});

import {
  deleteYoutubePlaylistSettings,
  getYoutubePlaylistSettings,
  isYoutubePlaylistSettingsStorageReady,
  saveYoutubePlaylistSettings,
  touchYoutubePlaylistLastSyncedAt,
  touchYoutubePlaylistLastVerifiedAt,
} from './youtubePlaylistSettingsRepository';

const SAMPLE_ROW = {
  id: 'row-1',
  user_id: 'user-1',
  playlist_id: 'PL123',
  playlist_title: 'SGP — Inglês',
  configured_at: '2026-07-24T00:00:00.000Z',
  last_verified_at: null,
  last_synced_at: null,
  created_at: '2026-07-24T00:00:00.000Z',
  updated_at: '2026-07-24T00:00:00.000Z',
};

const TOKEN_LIKE_KEYS = ['access_token', 'accessToken', 'refresh_token', 'refreshToken', 'token'];

describe('youtubePlaylistSettingsRepository', () => {
  beforeEach(() => {
    mockState.fromCalls = [];
    mockState.result = { data: null, error: null };
    mockState.lastBuilder = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('isYoutubePlaylistSettingsStorageReady exige um userId', () => {
    expect(isYoutubePlaylistSettingsStorageReady('user-1')).toBe(true);
    expect(isYoutubePlaylistSettingsStorageReady(null)).toBe(false);
    expect(isYoutubePlaylistSettingsStorageReady(undefined)).toBe(false);
  });

  it('getYoutubePlaylistSettings consulta a tabela correta filtrando por user_id', async () => {
    mockState.result = { data: SAMPLE_ROW, error: null };

    const row = await getYoutubePlaylistSettings('user-1');

    expect(mockState.fromCalls).toEqual(['youtube_playlist_settings']);
    expect(mockState.lastBuilder?.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockState.lastBuilder?.maybeSingle).toHaveBeenCalled();
    expect(row).toEqual(SAMPLE_ROW);
  });

  it('getYoutubePlaylistSettings lança o erro do Supabase em vez de escondê-lo', async () => {
    mockState.result = { data: null, error: new Error('falha de rede') };

    await expect(getYoutubePlaylistSettings('user-1')).rejects.toThrow('falha de rede');
  });

  it('saveYoutubePlaylistSettings faz upsert por user_id com somente metadados — nunca um token', async () => {
    mockState.result = { data: SAMPLE_ROW, error: null };

    await saveYoutubePlaylistSettings('user-1', { playlistId: 'PL123', playlistTitle: 'SGP — Inglês' });

    expect(mockState.fromCalls).toEqual(['youtube_playlist_settings']);
    const upsertMock = mockState.lastBuilder?.upsert;
    expect(upsertMock).toHaveBeenCalledTimes(1);

    const [payload, upsertOptions] = upsertMock!.mock.calls[0] as [Record<string, unknown>, { onConflict: string }];
    expect(upsertOptions).toEqual({ onConflict: 'user_id' });
    expect(payload).toMatchObject({ user_id: 'user-1', playlist_id: 'PL123', playlist_title: 'SGP — Inglês' });
    expect(typeof payload.last_verified_at).toBe('string');

    for (const key of TOKEN_LIKE_KEYS) {
      expect(Object.keys(payload)).not.toContain(key);
    }
  });

  it('touchYoutubePlaylistLastVerifiedAt só atualiza last_verified_at', async () => {
    mockState.result = { data: SAMPLE_ROW, error: null };

    await touchYoutubePlaylistLastVerifiedAt('user-1');

    const updateMock = mockState.lastBuilder?.update;
    const [payload] = updateMock!.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(payload)).toEqual(['last_verified_at']);
    expect(mockState.lastBuilder?.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('touchYoutubePlaylistLastSyncedAt só atualiza last_synced_at', async () => {
    mockState.result = { data: SAMPLE_ROW, error: null };

    await touchYoutubePlaylistLastSyncedAt('user-1');

    const updateMock = mockState.lastBuilder?.update;
    const [payload] = updateMock!.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(payload)).toEqual(['last_synced_at']);
  });

  it('deleteYoutubePlaylistSettings remove só a linha do usuário informado', async () => {
    mockState.result = { data: null, error: null };

    await deleteYoutubePlaylistSettings('user-1');

    expect(mockState.fromCalls).toEqual(['youtube_playlist_settings']);
    expect(mockState.lastBuilder?.delete).toHaveBeenCalled();
    expect(mockState.lastBuilder?.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('deleteYoutubePlaylistSettings lança o erro do Supabase em vez de escondê-lo', async () => {
    mockState.result = { data: null, error: new Error('sem permissão') };

    await expect(deleteYoutubePlaylistSettings('user-1')).rejects.toThrow('sem permissão');
  });
});
