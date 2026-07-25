// Edge Function: desconecta/revoga a integração do YouTube do usuário autenticado.
import { GOOGLE_REVOKE_URL } from '../_shared/googleOAuth.ts';
import { decryptRefreshToken } from '../_shared/tokenCrypto.ts';
import { getAuthenticatedUser, jsonResponse, serviceRoleClient } from '../_shared/authenticatedUser.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';

Deno.serve(async req => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const cors = buildCorsHeaders(req);

  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido.' }, cors);

  const user = await getAuthenticatedUser(req);
  if (!user) return jsonResponse(401, { error: 'Não autenticado.' }, cors);

  const supabase = serviceRoleClient();
  const { data, error } = await supabase
    .from('youtube_oauth_connections')
    .select('refresh_token_encrypted, refresh_token_iv')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[youtube-oauth-disconnect] falha ao consultar conexão', { code: error.code });
    return jsonResponse(500, { error: 'Não foi possível desconectar agora.' }, cors);
  }

  if (data) {
    const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY');
    if (encryptionKey) {
      try {
        const refreshToken = await decryptRefreshToken(
          { ciphertextBase64: data.refresh_token_encrypted, ivBase64: data.refresh_token_iv },
          encryptionKey,
        );
        // Melhor-esforço: revogar no Google não deve impedir a remoção local
        // se a chamada falhar (token já pode estar inválido no lado do Google).
        await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' }).catch(() => undefined);
      } catch (err) {
        console.error('[youtube-oauth-disconnect] falha ao decifrar/revogar (prosseguindo com a remoção local)', {
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    }
  }

  const { error: deleteError } = await supabase
    .from('youtube_oauth_connections')
    .delete()
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('[youtube-oauth-disconnect] falha ao remover a conexão', { code: deleteError.code });
    return jsonResponse(500, { error: 'Não foi possível concluir a desconexão.' }, cors);
  }

  return jsonResponse(200, { disconnected: true }, cors);
});
