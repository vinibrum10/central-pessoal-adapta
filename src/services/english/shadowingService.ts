import type { ShadowingPractice, ShadowingPhrase } from './englishStorage';
import { DEFAULT_SHADOWING } from './englishStorage';

const PLAYLIST_PATTERN = /[?&]list=([A-Za-z0-9_-]+)/;
// `(?:.*&)?v=` (não só `\?v=`) porque links reais do YouTube costumam trazer
// `v=` em qualquer posição da query string, ex.: .../watch?list=PL...&v=XXXXXXXXXXX
// (link copiado de dentro de uma playlist/mix). Ver extractYouTubeVideoId em
// youtubeListeningService.ts, que já usa o mesmo padrão robusto.
const VIDEO_PATTERNS = [
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
];

export type ParsedShadowingLink =
  | { type: 'video'; videoId: string }
  | { type: 'playlist'; playlistId: string }
  | null;

export function parseShadowingLink(input: string): ParsedShadowingLink {
  const trimmed = input.trim();

  // Um vídeo específico tem prioridade sobre a playlist mesmo quando a URL
  // carrega os dois (ex.: .../watch?v=XXX&list=YYY) — a intenção do usuário
  // ao colar esse link é quase sempre "este vídeo", não "a playlist inteira".
  // Bug corrigido: antes a playlist era checada primeiro e o vídeo era
  // descartado sempre que a URL também tinha `list=`.
  for (const pattern of VIDEO_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return { type: 'video', videoId: match[1] };
  }

  const playlistMatch = trimmed.match(PLAYLIST_PATTERN);
  if (playlistMatch) {
    return { type: 'playlist', playlistId: playlistMatch[1] };
  }

  // Bare 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { type: 'video', videoId: trimmed };
  }

  return null;
}

export function buildShadowingFromLink(parsed: ParsedShadowingLink, existingSentences: ShadowingPhrase[]): ShadowingPractice {
  if (!parsed) return DEFAULT_SHADOWING;

  if (parsed.type === 'playlist') {
    return {
      type: 'playlist',
      playlistId: parsed.playlistId,
      watchUrl: `https://youtube.com/playlist?list=${parsed.playlistId}`,
      embedUrl: `https://www.youtube.com/embed/videoseries?list=${parsed.playlistId}`,
      source: 'manual_link',
      sentences: existingSentences,
    };
  }

  return {
    type: 'video',
    youtubeVideoId: parsed.videoId,
    watchUrl: `https://www.youtube.com/watch?v=${parsed.videoId}`,
    embedUrl: `https://www.youtube.com/embed/${parsed.videoId}`,
    source: 'manual_link',
    sentences: existingSentences,
  };
}
