// Edge Function: inicia o Authorization Code Flow do YouTube.
// Rota "normal" — exige usuário autenticado do Supabase (Authorization: Bearer <jwt>).
//
// Retorna { authorizationUrl } para o frontend fazer um REDIRECT DE PÁGINA
// INTEIRA (window.location.href = ...) — nunca um popup aberto via JS. Isso é
// deliberado: elimina de vez o problema de bloqueio de popup e a fragilidade
// do fluxo antigo baseado em Google Identity Services (Token Model).
import { generateStateToken, OAUTH_STATE_TTL_MS } from '../_shared/oauthState.ts';
import { buildAuthorizationUrl } from '../_shared/googleOAuth.ts';
import { getAuthenticatedUser, jsonResponse, serviceRoleClient } from '../_shared/authenticatedUser.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';

Deno.serve(async req => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const cors = buildCorsHeaders(req);

  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido.' }, cors);

  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse(401, { error: 'Não autenticado.' }, cors);

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const redirectUri = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI'); // URL desta função youtube-oauth-callback, configurada como Secret
  if (!clientId || !redirectUri) {
    return jsonResponse(503, { error: 'Integração com o YouTube não configurada (GOOGLE_CLIENT_ID / GOOGLE_OAUTH_REDIRECT_URI ausentes).' }, cors);
  }

  const state = generateStateToken();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();

  const supabase = serviceRoleClient();
  const { error } = await supabase.from('youtube_oauth_states').insert({
    state,
    user_id: user.id,
    expires_at: expiresAt,
  });
  if (error) {
    console.error('[youtube-oauth-start] falha ao gravar state', { code: error.code });
    return jsonResponse(500, { error: 'Não foi possível iniciar a autorização. Tente novamente.' }, cors);
  }

  const authorizationUrl = buildAuthorizationUrl({ clientId, redirectUri, state });
  return jsonResponse(200, { authorizationUrl }, cors);
});
