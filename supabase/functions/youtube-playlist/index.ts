// Edge Function: proxy autenticado para a YouTube Data API v3.
// O access_token de curta duração vive só na memória desta invocação — nunca
// é persistido, nunca retorna ao frontend. O frontend só enxerga os
// resultados já processados (playlist encontrada, vídeos, erros tipados).
import { refreshAccessToken } from '../_shared/googleOAuth.ts';
import { decryptRefreshToken } from '../_shared/tokenCrypto.ts';
import { getAuthenticatedUser, jsonResponse, serviceRoleClient } from '../_shared/authenticatedUser.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';

const TARGET_PLAYLIST_TITLE = 'SGP — Inglês';
const MAX_PAGES = 5;
const RECENT_VIDEOS_LIMIT = 10;

type ConnectionRow = {
  refresh_token_encrypted: string;
  refresh_token_iv: string;
};

async function getValidAccessToken(
  supabase: ReturnType<typeof serviceRoleClient>,
  userId: string,
): Promise<{ kind: 'ok'; accessToken: string } | { kind: 'not_connected' } | { kind: 'reconnect_required' } | { kind: 'server_error' }> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY');
  if (!clientId || !clientSecret || !encryptionKey) return { kind: 'server_error' };

  const { data, error } = await supabase
    .from('youtube_oauth_connections')
    .select('refresh_token_encrypted, refresh_token_iv, status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { kind: 'server_error' };
  if (!data || data.status !== 'active') return data ? { kind: 'reconnect_required' } : { kind: 'not_connected' };

  const row = data as ConnectionRow;
  const refreshToken = await decryptRefreshToken(
    { ciphertextBase64: row.refresh_token_encrypted, ivBase64: row.refresh_token_iv },
    encryptionKey,
  );

  const result = await refreshAccessToken(fetch, { refreshToken, clientId, clientSecret });

  if (result.kind === 'invalid_grant') {
    await supabase.from('youtube_oauth_connections').update({ status: 'invalid' }).eq('user_id', userId);
    return { kind: 'reconnect_required' };
  }
  if (result.kind !== 'success') return { kind: 'server_error' };

  await supabase.from('youtube_oauth_connections').update({ last_refreshed_at: new Date().toISOString() }).eq('user_id', userId);
  return { kind: 'ok', accessToken: result.accessToken };
}

interface DiscoveredPlaylist {
  playlistId: string;
  playlistTitle: string;
}

async function fetchAllOwnedPlaylists(accessToken: string): Promise<
  { kind: 'complete'; playlists: DiscoveredPlaylist[] } | { kind: 'incomplete'; playlists: DiscoveredPlaylist[] } | { kind: 'error'; status: number }
> {
  const playlists: DiscoveredPlaylist[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlists');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('mine', 'true');
    url.searchParams.set('maxResults', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) return { kind: 'error', status: resp.status };
    const body = await resp.json();
    for (const item of body.items ?? []) {
      playlists.push({ playlistId: item.id, playlistTitle: item.snippet?.title ?? '' });
    }
    pageToken = body.nextPageToken;
    if (!pageToken) return { kind: 'complete', playlists };
  }
  return { kind: 'incomplete', playlists };
}

function parseIso8601DurationToSeconds(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

async function fetchRecentVideos(accessToken: string, playlistId: string) {
  const items: Array<{ videoId: string; title: string; thumbnailUrl: string | null; addedAt: string }> = [];
  let pageToken: string | undefined;
  let incomplete = false;

  for (let page = 0; page < MAX_PAGES && items.length < RECENT_VIDEOS_LIMIT; page++) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) return { kind: 'error' as const, status: resp.status };
    const body = await resp.json();
    for (const item of body.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      items.push({
        videoId,
        title: item.snippet?.title ?? '',
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
        addedAt: item.snippet?.publishedAt ?? new Date().toISOString(),
      });
    }
    pageToken = body.nextPageToken;
    if (!pageToken) break;
    if (page === MAX_PAGES - 1) incomplete = true;
  }

  // Mais recentemente adicionados primeiro.
  items.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  const limited = items.slice(0, RECENT_VIDEOS_LIMIT);

  if (limited.length === 0) return { kind: incomplete ? ('incomplete' as const) : ('empty' as const) };

  const videoIds = limited.map(v => v.videoId).join(',');
  const durationsResp = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(videoIds)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!durationsResp.ok) return { kind: 'error' as const, status: durationsResp.status };
  const durationsBody = await durationsResp.json();
  const durationById = new Map<string, string>();
  for (const item of durationsBody.items ?? []) durationById.set(item.id, item.contentDetails?.duration ?? 'PT0S');

  const videos = limited
    .filter(v => durationById.has(v.videoId))
    .map(v => {
      const durationIso = durationById.get(v.videoId) ?? 'PT0S';
      const durationSeconds = parseIso8601DurationToSeconds(durationIso);
      return {
        videoId: v.videoId,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        addedAt: v.addedAt,
        durationIso,
        durationSeconds,
        durationFormatted: formatDuration(durationSeconds),
      };
    });

  return { kind: incomplete ? ('incomplete' as const) : ('videos' as const), videos, skippedInvalidCount: limited.length - videos.length };
}

Deno.serve(async req => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const cors = buildCorsHeaders(req);

  if (req.method !== 'GET') return jsonResponse(405, { error: 'Método não permitido.' }, cors);

  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse(401, { error: 'Não autenticado.' }, cors);

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const supabase = serviceRoleClient();

  const tokenResult = await getValidAccessToken(supabase, user.id);
  if (tokenResult.kind === 'not_connected') return jsonResponse(200, { kind: 'not_connected' }, cors);
  if (tokenResult.kind === 'reconnect_required') return jsonResponse(200, { kind: 'reconnect_required' }, cors);
  if (tokenResult.kind === 'server_error') return jsonResponse(503, { error: 'Integração com o YouTube não configurada.' }, cors);

  const accessToken = tokenResult.accessToken;

  if (action === 'discover') {
    const result = await fetchAllOwnedPlaylists(accessToken);
    if (result.kind === 'error') return jsonResponse(200, { kind: 'error', error: { kind: 'unknown_error', message: `YouTube retornou ${result.status}.`, status: result.status } }, cors);

    const matches = result.playlists.filter(p => p.playlistTitle === TARGET_PLAYLIST_TITLE);
    if (result.kind === 'incomplete' && matches.length === 0) {
      return jsonResponse(200, { kind: 'incomplete', playlistsSeenSoFar: matches }, cors);
    }
    if (matches.length === 0) return jsonResponse(200, { kind: 'not_found' }, cors);
    if (matches.length > 1) return jsonResponse(200, { kind: 'duplicate', playlists: matches }, cors);
    return jsonResponse(200, { kind: 'found', playlist: matches[0] }, cors);
  }

  if (action === 'videos') {
    const playlistId = url.searchParams.get('playlistId');
    if (!playlistId) return jsonResponse(400, { error: 'playlistId é obrigatório.' }, cors);
    const result = await fetchRecentVideos(accessToken, playlistId);
    if (result.kind === 'error') return jsonResponse(200, { kind: 'error', error: { kind: 'unknown_error', message: `YouTube retornou ${result.status}.`, status: result.status } }, cors);
    return jsonResponse(200, result, cors);
  }

  return jsonResponse(400, { error: 'Parâmetro action inválido (use discover ou videos).' }, cors);
});
