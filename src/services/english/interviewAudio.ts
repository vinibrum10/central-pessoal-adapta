export const INTERVIEW_AUDIO_BUCKET = 'interview-answers';
export const MAX_AUDIO_BYTES_FOR_AI = 3_200_000;
export const RECORDER_AUDIO_BITS_PER_SECOND = 40_000;
export const RECORDING_EXTRA_SECONDS = 30;

const MIME_OPTIONS = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

export function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_OPTIONS.find(type => MediaRecorder.isTypeSupported(type)) ?? '';
}

export function extensionFromMimeType(mimeType: string): string {
  const normalized = mimeType.split(';')[0].toLowerCase();
  if (normalized.includes('mp4') || normalized.includes('m4a') || normalized.includes('aac')) return 'm4a';
  if (normalized.includes('mpeg')) return 'mp3';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('ogg')) return 'ogg';
  return 'webm';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number | null | undefined): string {
  const safe = Math.max(0, Math.round(seconds ?? 0));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o áudio gravado.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.readAsDataURL(blob);
  });
}
