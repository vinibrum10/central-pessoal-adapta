// Tradução do vocabulário INTERNO do banco (coluna
// public.youtube_oauth_connections.status: 'active' | 'revoked' | 'invalid')
// para o vocabulário de CONEXÃO que o frontend espera
// ('connected' | 'reconnect_required' | 'none'). Usada por
// youtube-oauth-status — é o único lugar que deveria decidir essa tradução;
// nenhuma Edge Function deve repassar o valor cru da coluna para o frontend.
export type FrontendConnectionStatus = 'connected' | 'reconnect_required' | 'none';

export function toFrontendConnectionStatus(dbStatus: string): FrontendConnectionStatus {
  if (dbStatus === 'active') return 'connected';
  // 'revoked' | 'invalid' | qualquer valor não previsto: trata como
  // reconexão necessária — nunca finge que um status desconhecido está ok.
  return 'reconnect_required';
}
