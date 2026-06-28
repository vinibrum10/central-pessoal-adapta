import type { LeituraDiaria } from '../types';

export const LEGACY_DRIVE_FOLDER_IDS = [
  '1IUBsDA5FZWUJWuwrqjTGvzMy87feVbpD',
];

export function isLeituraDriveLegada(item: LeituraDiaria): boolean {
  if (item.origem !== 'drive') return false;
  const haystack = [item.url, item.driveFileId, item.titulo].filter(Boolean).join(' ');
  if (LEGACY_DRIVE_FOLDER_IDS.some(id => haystack.includes(id))) return true;
  if (!item.driveFileId && item.url?.includes('docs.google.com/')) return true;
  return Boolean(item.url?.includes('drive.google.com/drive/folders/'));
}
