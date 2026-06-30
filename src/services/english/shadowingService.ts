import type { ShadowingPractice, ShadowingSentence } from './englishStorage';
import { DEFAULT_SHADOWING } from './englishStorage';

const PLAYLIST_PATTERN = /[?&]list=([A-Za-z0-9_-]+)/;
const VIDEO_PATTERNS = [
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
];

export type ParsedShadowingLink =
  | { type: 'video'; videoId: string }
  | { type: 'playlist'; playlistId: string }
  | null;

export function parseShadowingLink(input: string): ParsedShadowingLink {
  const trimmed = input.trim();

  // Check for playlist first (may also contain a video ID)
  const playlistMatch = trimmed.match(PLAYLIST_PATTERN);
  if (playlistMatch) {
    return { type: 'playlist', playlistId: playlistMatch[1] };
  }

  // Check for video ID
  for (const pattern of VIDEO_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return { type: 'video', videoId: match[1] };
  }

  // Bare 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { type: 'video', videoId: trimmed };
  }

  return null;
}

export function buildShadowingFromLink(parsed: ParsedShadowingLink, existingSentences: ShadowingSentence[]): ShadowingPractice {
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
