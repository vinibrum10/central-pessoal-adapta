// Construção segura da URL de incorporação do YouTube — nunca usa HTML
// recebido da API (sem dangerouslySetInnerHTML, sem player embed code de
// terceiros). A URL é sempre montada a partir do videoId, no formato oficial
// documentado pelo YouTube (https://www.youtube.com/embed/{videoId}), depois
// de validar que o formato do ID é o esperado — protege contra um videoId
// corrompido/vazio virar uma URL de iframe malformada.
const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{10,12}$/; // IDs reais do YouTube têm 11 caracteres; pequena folga proposital

export function isValidYoutubeVideoId(videoId: string): boolean {
  return YOUTUBE_VIDEO_ID_PATTERN.test(videoId);
}

/** `null` quando o videoId não tem o formato esperado — o chamador deve tratar isso como "player indisponível". */
export function buildYoutubeEmbedUrl(videoId: string): string | null {
  if (!isValidYoutubeVideoId(videoId)) return null;
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
}

/** Link de fallback "Assistir no YouTube" — sempre construído, mesmo se o videoId for suspeito (é só um link, não um iframe). */
export function buildYoutubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}
