// Edge Function: estado da conexão YouTube do usuário autenticado.
// Nunca retorna o refresh_token nem qualquer derivado dele — só metadados.
import { getAuthenticatedUser, jsonResponse, serviceRoleClient } from '../_shared/authenticatedUser.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { toFrontendConnectionStatus } from '../_shared/connectionStatus.ts';

Deno.serve(async req => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const cors = buildCorsHeaders(req);

  if (req.method !== 'GET') return jsonResponse(405, { error: 'Método não permitido.' }, cors);

  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse(401, { error: 'Não autenticado.' }, cors);

  const supabase = serviceRoleClient();
  const { data, error } = await supabase
    .from('youtube_oauth_connections')
    .select('status, granted_scopes, last_refreshed_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[youtube-oauth-status] falha ao consultar conexão', { code: error.code });
    return jsonResponse(500, { error: 'Não foi possível consultar o estado da conexão.' }, cors);
  }

  if (!data) {
    return jsonResponse(200, { connected: false, status: 'none', grantedScopes: [], lastRefreshedAt: null }, cors);
  }

  return jsonResponse(200, {
    connected: data.status === 'active',
    status: toFrontendConnectionStatus(data.status),
    grantedScopes: data.granted_scopes,
    lastRefreshedAt: data.last_refreshed_at,
  }, cors);
});
