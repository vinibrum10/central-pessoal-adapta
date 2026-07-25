import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./youtubeAuth', () => ({
  notifyYoutubeTokenRejected: vi.fn(),
  getInMemoryYoutubeAccessToken: vi.fn(),
}));

import { getInMemoryYoutubeAccessToken, notifyYoutubeTokenRejected } from './youtubeAuth';
import {
  discoverPlaylistByTitle,
  formatDurationFromSeconds,
  getRecentPlaylistVideos,
  parseYoutubeDurationIso8601,
  validatePersistedPlaylist,
} from './youtubePlaylistDiscovery';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function playlistItem(id: string, title: string) {
  return { id, snippet: { title } };
}

const TARGET_TITLE = 'SGP — Inglês';

beforeEach(() => {
  // Token resolvido internamente pelo cliente (youtubeApiGet) via mock —
  // nenhuma função pública deste arquivo recebe/repassa um accessToken.
  vi.mocked(getInMemoryYoutubeAccessToken).mockReturnValue('token-em-memoria');
});

describe('parseYoutubeDurationIso8601 / formatDurationFromSeconds', () => {
  it('converte PT4M3S corretamente', () => {
    expect(parseYoutubeDurationIso8601('PT4M3S')).toBe(243);
    expect(formatDurationFromSeconds(243)).toBe('04:03');
  });

  it('converte apenas segundos (PT30S)', () => {
    expect(parseYoutubeDurationIso8601('PT30S')).toBe(30);
    expect(formatDurationFromSeconds(30)).toBe('00:30');
  });

  it('converte horas, minutos e segundos (PT1H2M3S)', () => {
    expect(parseYoutubeDurationIso8601('PT1H2M3S')).toBe(3723);
    expect(formatDurationFromSeconds(3723)).toBe('1:02:03');
  });

  it('duração desconhecida/malformada vira 0', () => {
    expect(parseYoutubeDurationIso8601('')).toBe(0);
    expect(parseYoutubeDurationIso8601('garbage')).toBe(0);
  });
});

describe('discoverPlaylistByTitle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('não exige accessToken — chama sem nenhum parâmetro de token e ainda assim autentica (via mock interno)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [playlistItem('p1', TARGET_TITLE)] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverPlaylistByTitle();

    expect(result).toEqual({ kind: 'found', playlist: { playlistId: 'p1', playlistTitle: TARGET_TITLE } });
    expect(getInMemoryYoutubeAccessToken).toHaveBeenCalled();
  });

  it('sem token válido em memória, NÃO chama fetch e retorna erro unauthorized', async () => {
    vi.mocked(getInMemoryYoutubeAccessToken).mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverPlaylistByTitle();

    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.error.kind).toBe('unauthorized');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retorna not_found só depois de esgotar toda a paginação (nunca decide pela primeira página)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [playlistItem('p1', 'Outra playlist')], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [playlistItem('p2', 'Mais outra')] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverPlaylistByTitle();

    expect(result).toEqual({ kind: 'not_found' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('encontra a playlist mesmo quando ela só aparece na segunda página', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [playlistItem('p1', 'Outra')], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [playlistItem('p2', TARGET_TITLE)] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverPlaylistByTitle();

    expect(result).toEqual({ kind: 'found', playlist: { playlistId: 'p2', playlistTitle: TARGET_TITLE } });
  });

  it('detecta duplicidade mesmo quando as ocorrências estão em páginas diferentes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [playlistItem('p1', TARGET_TITLE)], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [playlistItem('p2', TARGET_TITLE)] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverPlaylistByTitle();

    expect(result.kind).toBe('duplicate');
    if (result.kind === 'duplicate') {
      expect(result.playlists.map(p => p.playlistId).sort()).toEqual(['p1', 'p2']);
    }
  });

  it('retorna incomplete (nunca not_found) quando o teto defensivo de páginas é atingido antes do fim real', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [playlistItem('p1', 'x')], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [playlistItem('p2', 'y')], nextPageToken: 'p3' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverPlaylistByTitle({ maxPages: 2 });

    expect(result.kind).toBe('incomplete');
    if (result.kind === 'incomplete') {
      expect(result.resumePageToken).toBe('p3');
    }
  });

  it('retoma a busca a partir de startPageToken e acumula com previousMatches (continuação de uma busca incompleta)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { items: [playlistItem('p2', TARGET_TITLE)] }));
    vi.stubGlobal('fetch', fetchMock);

    const previousMatches = [{ playlistId: 'p1', playlistTitle: TARGET_TITLE }];
    const result = await discoverPlaylistByTitle({ startPageToken: 'p3', previousMatches });

    // Só uma chamada (retomou de 'p3', não refez as páginas já vistas antes).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('pageToken=p3');
    // Como o novo p2 também bate com o título, agora há 2 -> duplicate,
    // combinando o que já tinha sido visto (p1) com o que apareceu agora (p2).
    expect(result.kind).toBe('duplicate');
    if (result.kind === 'duplicate') {
      expect(result.playlists.map(p => p.playlistId).sort()).toEqual(['p1', 'p2']);
    }
  });

  it('mapeia 401 para o resultado de erro e avisa a camada de auth para limpar o token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: 'invalid' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverPlaylistByTitle();

    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.error.kind).toBe('unauthorized');
    expect(notifyYoutubeTokenRejected).toHaveBeenCalledTimes(1);
  });

  it('mapeia 403 quotaExceeded sem chamar notifyYoutubeTokenRejected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(403, { error: { message: 'quota', errors: [{ reason: 'quotaExceeded' }] } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverPlaylistByTitle();

    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.error.kind).toBe('quota_exceeded');
    expect(notifyYoutubeTokenRejected).not.toHaveBeenCalled();
  });

  it('mapeia 403 insufficientPermissions distintamente de quota', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(403, { error: { message: 'forbidden', errors: [{ reason: 'insufficientPermissions' }] } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverPlaylistByTitle();

    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.error.kind).toBe('insufficient_permissions');
  });

  it('mapeia erro de rede para network_error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverPlaylistByTitle();

    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.error.kind).toBe('network_error');
  });

  it('mapeia resposta inválida (JSON quebrado) para invalid_response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } });
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverPlaylistByTitle();

    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.error.kind).toBe('invalid_response');
  });

  it('nenhum resultado (found/duplicate/incomplete/error) contém o token em qualquer campo', async () => {
    vi.mocked(getInMemoryYoutubeAccessToken).mockReturnValue('super-secret-xyz');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [playlistItem('p1', TARGET_TITLE)] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverPlaylistByTitle();

    expect(JSON.stringify(result)).not.toContain('super-secret-xyz');
  });
});

describe('validatePersistedPlaylist', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('retorna invalid_or_missing sem chamar a API quando o id está ausente (e sem exigir accessToken)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await validatePersistedPlaylist('');

    expect(result).toEqual({ kind: 'invalid_or_missing' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sem token válido em memória, NÃO chama fetch e retorna auth_error', async () => {
    vi.mocked(getInMemoryYoutubeAccessToken).mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await validatePersistedPlaylist('p1');

    expect(result.kind).toBe('auth_error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retorna valid quando a API devolve a playlist', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [playlistItem('p1', TARGET_TITLE)] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await validatePersistedPlaylist('p1');

    expect(result).toEqual({ kind: 'valid', playlist: { playlistId: 'p1', playlistTitle: TARGET_TITLE } });
  });

  it('retorna inaccessible (não invalid_or_missing) quando a API responde 200 com items vazio para um ID antigo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await validatePersistedPlaylist('id-antigo-invalido');

    expect(result).toEqual({ kind: 'inaccessible' });
  });

  it('retorna auth_error em 401, distinto de inaccessible', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: 'invalid' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await validatePersistedPlaylist('p1');

    expect(result.kind).toBe('auth_error');
  });

  it('retorna temporary_failure em erro de rede, distinto de inaccessible', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await validatePersistedPlaylist('p1');

    expect(result.kind).toBe('temporary_failure');
  });
});

describe('getRecentPlaylistVideos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function playlistItemFull(videoId: string, title: string, publishedAt: string) {
    return {
      contentDetails: { videoId },
      snippet: { title, publishedAt, thumbnails: { medium: { url: `https://thumb/${videoId}` } } },
    };
  }

  function videoDetails(id: string, duration: string) {
    return { id, contentDetails: { duration } };
  }

  it('sem token válido em memória, NÃO chama fetch e retorna erro unauthorized', async () => {
    vi.mocked(getInMemoryYoutubeAccessToken).mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await getRecentPlaylistVideos('pl1');

    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.error.kind).toBe('unauthorized');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retorna empty quando a playlist não tem itens utilizáveis', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getRecentPlaylistVideos('pl1');

    expect(result).toEqual({ kind: 'empty' });
  });

  it('ordena por snippet.publishedAt decrescente, mesmo que a ordem bruta da API seja diferente', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, {
        items: [
          playlistItemFull('old', 'Vídeo antigo', '2026-01-01T00:00:00Z'),
          playlistItemFull('new', 'Vídeo novo', '2026-06-01T00:00:00Z'),
          playlistItemFull('mid', 'Vídeo do meio', '2026-03-01T00:00:00Z'),
        ],
      }))
      .mockResolvedValueOnce(jsonResponse(200, {
        items: [videoDetails('old', 'PT1M'), videoDetails('new', 'PT2M'), videoDetails('mid', 'PT3M')],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getRecentPlaylistVideos('pl1');

    expect(result.kind).toBe('videos');
    if (result.kind === 'videos') {
      expect(result.videos.map(v => v.videoId)).toEqual(['new', 'mid', 'old']);
    }
  });

  it('limita o resultado a 10 vídeos mesmo havendo mais candidatos', async () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      playlistItemFull(`v${i}`, `Título ${i}`, new Date(2026, 0, i + 1).toISOString()));
    const videos = Array.from({ length: 15 }, (_, i) => videoDetails(`v${i}`, 'PT1M'));

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { items }))
      .mockResolvedValueOnce(jsonResponse(200, { items: videos }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getRecentPlaylistVideos('pl1');

    expect(result.kind).toBe('videos');
    if (result.kind === 'videos') {
      expect(result.videos).toHaveLength(10);
      // Os 10 mais recentes: dias 15..6 (índices 14..5), ordem decrescente.
      expect(result.videos[0].videoId).toBe('v14');
      expect(result.videos[9].videoId).toBe('v5');
    }
  });

  it('retorna todos os disponíveis quando a playlist tem menos de 10 vídeos válidos', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, {
        items: [playlistItemFull('v1', 'A', '2026-01-01T00:00:00Z'), playlistItemFull('v2', 'B', '2026-01-02T00:00:00Z')],
      }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [videoDetails('v1', 'PT1M'), videoDetails('v2', 'PT2M')] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getRecentPlaylistVideos('pl1');

    expect(result.kind).toBe('videos');
    if (result.kind === 'videos') expect(result.videos).toHaveLength(2);
  });

  it('substitui automaticamente um vídeo ausente em videos.list pelo próximo candidato mais recente, sem reduzir o total', async () => {
    // 3 candidatos ordenados por data desc: v3 (mais novo), v2, v1. v2 não existe em videos.list.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, {
        items: [
          playlistItemFull('v1', 'A', '2026-01-01T00:00:00Z'),
          playlistItemFull('v2', 'B (removido)', '2026-01-02T00:00:00Z'),
          playlistItemFull('v3', 'C', '2026-01-03T00:00:00Z'),
        ],
      }))
      // primeira janela pede os 3 (limit=3): v3, v2, v1 -> só v3 e v1 voltam (v2 ausente)
      .mockResolvedValueOnce(jsonResponse(200, { items: [videoDetails('v3', 'PT1M'), videoDetails('v1', 'PT2M')] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getRecentPlaylistVideos('pl1', { limit: 3 });

    expect(result.kind).toBe('videos');
    if (result.kind === 'videos') {
      expect(result.videos.map(v => v.videoId)).toEqual(['v3', 'v1']);
      expect(result.skippedInvalidCount).toBe(1);
    }
  });

  it('ignora itens com título-sentinela (Private video / Deleted video) sem interromper os demais', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, {
        items: [
          playlistItemFull('v1', 'Private video', '2026-01-01T00:00:00Z'),
          playlistItemFull('v2', 'Vídeo válido', '2026-01-02T00:00:00Z'),
        ],
      }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [videoDetails('v2', 'PT1M')] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getRecentPlaylistVideos('pl1');

    expect(result.kind).toBe('videos');
    if (result.kind === 'videos') expect(result.videos.map(v => v.videoId)).toEqual(['v2']);
  });

  it('mapeia erro de playlistItems.list para o resultado de erro (ex.: 403 outro, não confundido com quota/expiração)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(403, { error: { message: 'algo', errors: [{ reason: 'somethingElse' }] } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getRecentPlaylistVideos('pl1');

    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.error.kind).toBe('forbidden_other');
  });

  it('retorna incomplete (nunca uma lista definitiva de "vídeos recentes") quando o teto de páginas de playlistItems.list é atingido antes do fim real, preservando resumePageToken', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, {
        items: [playlistItemFull('v1', 'A', '2026-01-01T00:00:00Z')],
        nextPageToken: 'p2',
      }))
      .mockResolvedValueOnce(jsonResponse(200, {
        items: [playlistItemFull('v2', 'B', '2026-01-02T00:00:00Z')],
        nextPageToken: 'p3',
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getRecentPlaylistVideos('pl1', { maxPages: 2 });

    expect(result).toEqual({ kind: 'incomplete', resumePageToken: 'p3' });
    // Nenhuma chamada a videos.list deveria ter acontecido — resultado parcial
    // de playlistItems.list nunca é promovido a lista definitiva de vídeos.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('nenhum vídeo do resultado contém o token em qualquer campo', async () => {
    vi.mocked(getInMemoryYoutubeAccessToken).mockReturnValue('super-secret-xyz');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [playlistItemFull('v1', 'A', '2026-01-01T00:00:00Z')] }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [videoDetails('v1', 'PT1M')] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getRecentPlaylistVideos('pl1');

    expect(JSON.stringify(result)).not.toContain('super-secret-xyz');
  });
});
