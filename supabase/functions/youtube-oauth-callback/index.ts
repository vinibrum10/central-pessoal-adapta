// Edge Function: recebe o redirect do Google após o consentimento.
//
// ÚNICO endpoint público deste conjunto — não pode exigir Authorization:
// Bearer <jwt> porque é o NAVEGADOR sendo redirecionado pelo Google via GET,
// não um fetch autenticado do frontend. A segurança aqui vem inteiramente da
// validação rigorosa do `state`: de uso único, com expiração curta (5 min) e
// vinculado a um user_id específico no momento em que youtube-oauth-start o
// criou. Um state inválido/expirado/reusado é sempre rejeitado ANTES de
// qualquer troca de código com o Google.
import { validateStateRecord, type OAuthStateRecord } from '../_shared/oauthState.ts';
import { exchangeCodeForTokens } from '../_shared/googleOAuth.ts';
import { encryptRefreshToken } from '../_shared/tokenCrypto.ts';
import { serviceRoleClient } from '../_shared/authenticatedUser.ts';

function redirectToApp(appUrl: string, query: Record<string, string>): Response {
  const url = new URL('/estudo/ingles-diario', appUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async req => {
  const appUrl = Deno.env.get('APP_URL'); // ex.: https://seu-dominio.com — usado só para montar o redirect final
  if (!appUrl) return new Response('APP_URL não configurada.', { status: 500 });

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const googleError = url.searchParams.get('error');

  if (googleError) {
    return redirectToApp(appUrl, { youtube_auth: 'denied' });
  }
  if (!code || !state) {
    return redirectToApp(appUrl, { youtube_auth: 'invalid_request' });
  }

  const supabase = serviceRoleClient();

  // Passo 1 — SELECT só para classificar a mensagem de erro (not_found vs.
  // expired vs. already_used) num caso comum, sem corrida. A garantia de
  // atomicidade de verdade NÃO vem daqui — vem do UPDATE logo abaixo, que é a
  // única operação que decide se este state pode ser consumido.
  const { data: stateRows, error: stateSelectError } = await supabase
    .from('youtube_oauth_states')
    .select('state, user_id, expires_at, used_at')
    .eq('state', state)
    .limit(1);

  if (stateSelectError) {
    console.error('[youtube-oauth-callback] falha ao consultar state', { code: stateSelectError.code });
    return redirectToApp(appUrl, { youtube_auth: 'server_error' });
  }

  const record = (stateRows?.[0] ?? null) as OAuthStateRecord | null;
  const preValidation = validateStateRecord(record, new Date());
  if (preValidation.kind !== 'valid') {
    return redirectToApp(appUrl, { youtube_auth: preValidation.kind === 'not_found' ? 'invalid_state' : preValidation.kind });
  }

  // Passo 2 — a ÚNICA operação atômica que realmente decide se este state
  // pode ser consumido: um único UPDATE com `used_at is null` E `expires_at >
  // now()` na mesma cláusula WHERE. O Postgres serializa UPDATEs concorrentes
  // na mesma linha via lock de linha — de duas requisições simultâneas com o
  // mesmo state, só uma consegue casar a condição e alterar a linha; a outra
  // sempre recebe 0 linhas afetadas, mesmo que ambas tenham passado pela
  // pré-checagem acima (que é só informativa, não é o que protege contra reuso).
  const nowIso = new Date().toISOString();
  const { data: markUsedRows, error: markUsedError } = await supabase
    .from('youtube_oauth_states')
    .update({ used_at: nowIso })
    .eq('state', state)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .select('user_id');

  if (markUsedError || !markUsedRows || markUsedRows.length === 0) {
    // 0 linhas afetadas cobre TODOS os casos de corrida/borda numa só
    // verificação: já usado por outra requisição, expirou entre o passo 1 e
    // aqui, ou nunca existiu. Nunca prossegue com a troca do código nesses casos.
    return redirectToApp(appUrl, { youtube_auth: 'already_used' });
  }

  const userId = markUsedRows[0].user_id as string;

  // Passo 2 — troca o authorization code por tokens, SOMENTE aqui no backend.
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const redirectUri = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI');
  const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY');
  if (!clientId || !clientSecret || !redirectUri || !encryptionKey) {
    console.error('[youtube-oauth-callback] Secrets ausentes (GOOGLE_CLIENT_ID/SECRET, GOOGLE_OAUTH_REDIRECT_URI ou TOKEN_ENCRYPTION_KEY)');
    return redirectToApp(appUrl, { youtube_auth: 'server_error' });
  }

  const tokenResult = await exchangeCodeForTokens(fetch, { code, clientId, clientSecret, redirectUri });

  if (tokenResult.kind === 'denied') return redirectToApp(appUrl, { youtube_auth: 'denied' });
  if (tokenResult.kind !== 'success') {
    console.error('[youtube-oauth-callback] troca de code falhou', { kind: tokenResult.kind });
    return redirectToApp(appUrl, { youtube_auth: 'server_error' });
  }
  if (!tokenResult.refreshToken) {
    // Não deveria acontecer com access_type=offline + prompt=consent, mas sem
    // refresh_token não há como manter a conexão sem reautorizar a cada F5 —
    // melhor falhar de forma explícita do que fingir sucesso.
    console.error('[youtube-oauth-callback] Google não retornou refresh_token');
    return redirectToApp(appUrl, { youtube_auth: 'no_refresh_token' });
  }

  // Passo 3 — cifra o refresh_token (nunca gravado em texto puro) e salva.
  const encrypted = await encryptRefreshToken(tokenResult.refreshToken, encryptionKey);

  const { error: upsertError } = await supabase.from('youtube_oauth_connections').upsert(
    {
      user_id: userId,
      refresh_token_encrypted: encrypted.ciphertextBase64,
      refresh_token_iv: encrypted.ivBase64,
      granted_scopes: tokenResult.grantedScopes,
      status: 'active',
      last_refreshed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (upsertError) {
    console.error('[youtube-oauth-callback] falha ao salvar a conexão', { code: upsertError.code });
    return redirectToApp(appUrl, { youtube_auth: 'server_error' });
  }

  console.log('[youtube-oauth-callback] conexão estabelecida com sucesso', { userIdPrefix: userId.slice(0, 8) });
  return redirectToApp(appUrl, { youtube_auth: 'success' });
});
