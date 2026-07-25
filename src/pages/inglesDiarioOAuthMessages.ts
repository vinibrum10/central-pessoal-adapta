// Mensagens sanitizadas para o retorno do redirect OAuth do YouTube
// (?youtube_auth=... em src/hooks/useDailyVideoConnection.ts). Nunca inclui
// códigos, states, tokens ou qualquer detalhe interno — só um resumo amigável
// do que houve, em português. Lógica pura, extraída para cá para ser
// testável sem renderizar o componente (o projeto não tem
// @testing-library/react instalado).
const OAUTH_REDIRECT_MESSAGES: Record<string, string> = {
  denied: 'Você não concluiu a autorização do YouTube (acesso negado ou cancelado). Tente novamente quando quiser.',
  invalid_state: 'Não foi possível confirmar a autorização do YouTube. Tente conectar novamente.',
  expired: 'A autorização do YouTube expirou antes de ser concluída. Tente novamente.',
  already_used: 'Essa tentativa de autorização já foi usada. Clique em "Conectar ao YouTube" para tentar novamente.',
  invalid_request: 'Não foi possível concluir a autorização do YouTube. Tente novamente.',
  server_error: 'Ocorreu um erro ao concluir a conexão com o YouTube. Tente novamente em instantes.',
  no_refresh_token: 'O Google não concedeu a permissão necessária para manter a conexão. Tente novamente.',
};

const GENERIC_FAILURE_MESSAGE = 'Não foi possível concluir a conexão com o YouTube. Tente novamente.';

/**
 * `reason` é o valor bruto de `?youtube_auth=...`. Retorna `null` para
 * "sucesso" (nada a exibir) ou ausência de retorno — só produz uma mensagem
 * quando há de fato algo a comunicar ao usuário.
 */
export function describeOAuthRedirectFailure(reason: string | null): string | null {
  if (!reason || reason === 'success') return null;
  return OAUTH_REDIRECT_MESSAGES[reason] ?? GENERIC_FAILURE_MESSAGE;
}
