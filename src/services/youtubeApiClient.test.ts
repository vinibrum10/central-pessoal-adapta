import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./youtubeAuth', () => ({
  notifyYoutubeTokenRejected: vi.fn(),
  getInMemoryYoutubeAccessToken: vi.fn(),
}));

import { getInMemoryYoutubeAccessToken, notifyYoutubeTokenRejected } from './youtubeAuth';
import { isYoutubeApiError, paginateYoutubeList, youtubeApiGet } from './youtubeApiClient';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function malformedJsonResponse(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => { throw new SyntaxError('unexpected token'); },
  };
}

function emptyBodyResponse(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => null,
  };
}

describe('youtubeApiGet', () => {
  beforeEach(() => {
    // Token resolvido internamente por padrão — cada teste que precisa
    // simular "sem token" sobrescreve isso explicitamente.
    vi.mocked(getInMemoryYoutubeAccessToken).mockReturnValue('t');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('obtém o token internamente via getInMemoryYoutubeAccessToken() — nenhum accessToken é passado como parâmetro', async () => {
    vi.mocked(getInMemoryYoutubeAccessToken).mockReturnValue('secret-token-abc');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await youtubeApiGet('playlists', { part: 'snippet', mine: 'true' });

    expect(getInMemoryYoutubeAccessToken).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true');
    expect(init.headers.Authorization).toBe('Bearer secret-token-abc');
  });

  it('sem token válido em memória, NÃO chama fetch e lança um erro tipado de autorização', async () => {
    vi.mocked(getInMemoryYoutubeAccessToken).mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {})).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('omite parâmetros undefined da URL (ex.: pageToken ausente)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await youtubeApiGet('playlists', { part: 'snippet', pageToken: undefined });

    const [url] = fetchMock.mock.calls[0];
    expect(url).not.toContain('pageToken');
  });

  it('classifica 401 com JSON válido como unauthorized e limpa o token (notifyYoutubeTokenRejected)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: 'Invalid Credentials' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {}))
      .rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    expect(notifyYoutubeTokenRejected).toHaveBeenCalledTimes(1);
  });

  it('classifica 401 com corpo vazio como unauthorized e limpa o token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyBodyResponse(401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {}))
      .rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    expect(notifyYoutubeTokenRejected).toHaveBeenCalledTimes(1);
  });

  it('classifica 401 com JSON malformado como unauthorized (nunca invalid_response) e limpa o token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(malformedJsonResponse(401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {}))
      .rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    expect(notifyYoutubeTokenRejected).toHaveBeenCalledTimes(1);
  });

  it('NUNCA chama notifyYoutubeTokenRejected para um erro que não seja 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(403, { error: { message: 'quota', errors: [{ reason: 'quotaExceeded' }] } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {})).rejects.toMatchObject({ kind: 'quota_exceeded' });
    expect(notifyYoutubeTokenRejected).not.toHaveBeenCalled();
  });

  it('classifica 403 com reason quotaExceeded como quota_exceeded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(403, { error: { message: 'quota', errors: [{ reason: 'quotaExceeded' }] } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlistItems', {}))
      .rejects.toMatchObject({ kind: 'quota_exceeded', reason: 'quotaExceeded' });
  });

  it('classifica 403 com reason insufficientPermissions como insufficient_permissions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(403, { error: { message: 'forbidden', errors: [{ reason: 'insufficientPermissions' }] } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {}))
      .rejects.toMatchObject({ kind: 'insufficient_permissions' });
  });

  it('classifica 403 com reason accessNotConfigured como api_not_enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(403, { error: { message: 'API not enabled', errors: [{ reason: 'accessNotConfigured' }] } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {}))
      .rejects.toMatchObject({ kind: 'api_not_enabled' });
  });

  it.each([
    ['forbidden'],
    ['accessDenied'],
    ['playlistForbidden'],
    ['playlistItemsNotAccessible'],
    ['somethingElse'], // qualquer reason 403 não reconhecido
  ])('classifica 403 com reason "%s" como forbidden_other, nunca como insufficient_permissions', async reason => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(403, { error: { message: 'forbidden', errors: [{ reason }] } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {}))
      .rejects.toMatchObject({ kind: 'forbidden_other', reason });
  });

  it('classifica 403 com corpo ilegível (JSON malformado) como forbidden_other, não como invalid_response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(malformedJsonResponse(403));
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {}))
      .rejects.toMatchObject({ kind: 'forbidden_other', status: 403 });
  });

  it('classifica 403 com corpo vazio como forbidden_other', async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyBodyResponse(403));
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {}))
      .rejects.toMatchObject({ kind: 'forbidden_other', status: 403 });
  });

  it('classifica 404 como not_found', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: 'not found' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {}))
      .rejects.toMatchObject({ kind: 'not_found', status: 404 });
  });

  it('classifica falha de fetch (rede) como network_error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {}))
      .rejects.toMatchObject({ kind: 'network_error' });
  });

  it('classifica um status de erro não mapeado (ex.: 500) com corpo ilegível pelo próprio status HTTP (unknown_error), não como invalid_response — só 401/403 têm tratamento dedicado de corpo ilegível', async () => {
    const fetchMock = vi.fn().mockResolvedValue(malformedJsonResponse(500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {}))
      .rejects.toMatchObject({ kind: 'unknown_error', status: 500 });
  });

  it('classifica resposta 200 com JSON inválido como invalid_response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('unexpected token'); },
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(youtubeApiGet('playlists', {}))
      .rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('nunca inclui o access token na URL, no header exposto pelo mock de erro, nem na mensagem de erro lançada', async () => {
    vi.mocked(getInMemoryYoutubeAccessToken).mockReturnValue('super-secret-token-xyz');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: 'Invalid Credentials' } }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      await youtubeApiGet('playlists', {});
      expect.unreachable('deveria ter lançado');
    } catch (err) {
      expect(isYoutubeApiError(err)).toBe(true);
      expect(JSON.stringify(err)).not.toContain('super-secret-token-xyz');
    }

    const [url] = fetchMock.mock.calls[0];
    expect(url).not.toContain('super-secret-token-xyz');
  });
});

describe('paginateYoutubeList', () => {
  it('retorna incomplete=false quando a primeira página já não tem nextPageToken', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: [1, 2, 3] });

    const result = await paginateYoutubeList(fetchPage);

    expect(result).toEqual({ items: [1, 2, 3], incomplete: false, resumePageToken: null });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(undefined);
  });

  it('retoma a partir de startPageToken em vez de reiniciar da primeira página', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: ['c', 'd'] });

    const result = await paginateYoutubeList(fetchPage, { startPageToken: 'p3' });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith('p3');
    expect(result).toEqual({ items: ['c', 'd'], incomplete: false, resumePageToken: null });
  });

  it('percorre múltiplas páginas seguindo nextPageToken até o fim real', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ items: ['a', 'b'], nextPageToken: 'p2' })
      .mockResolvedValueOnce({ items: ['c'], nextPageToken: 'p3' })
      .mockResolvedValueOnce({ items: ['d'] });

    const result = await paginateYoutubeList(fetchPage);

    expect(result).toEqual({ items: ['a', 'b', 'c', 'd'], incomplete: false, resumePageToken: null });
    expect(fetchPage).toHaveBeenNthCalledWith(1, undefined);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'p2');
    expect(fetchPage).toHaveBeenNthCalledWith(3, 'p3');
  });

  it('sinaliza incomplete=true (nunca finge ter terminado) ao atingir o teto defensivo de páginas', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ items: ['a'], nextPageToken: 'p2' })
      .mockResolvedValueOnce({ items: ['b'], nextPageToken: 'p3' });

    const result = await paginateYoutubeList(fetchPage, { maxPages: 2 });

    expect(result.incomplete).toBe(true);
    expect(result.resumePageToken).toBe('p3');
    expect(result.items).toEqual(['a', 'b']);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
