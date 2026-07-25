// Lógica pura (sem JSX) do rótulo do botão principal de ConnectYoutubeStep.tsx —
// extraída para cá para ser testável sem renderizar o componente (o projeto
// não tem @testing-library/react instalado).
import type { YoutubeConnectionStatus } from '../../../types/dailyVideoEnglish';

// Estados que representam uma reconexão de verdade — uma conexão que já
// existiu (refresh_token concedido antes, via OAuth server-side) e ficou
// inválida/expirada/revogada, ou o usuário negou explicitamente. Nenhum deles
// depende de haver ou não uma playlist configurada: a existência de
// youtube_playlist_settings NUNCA prova que existe (ou existiu) uma conexão
// ativa.
export const RECONNECT_STATUSES = new Set<YoutubeConnectionStatus>([
  'reconnect_required',
  'authorization_denied',
  'error',
]);

export function getPrimaryActionLabel(status: YoutubeConnectionStatus): string {
  if (RECONNECT_STATUSES.has(status)) return 'Reconectar ao YouTube';
  // 'not_connected' (nunca autorizado) e qualquer outro caso residual.
  return 'Conectar ao YouTube';
}
