import { listarArquivosDaPasta } from './googleDrive';
import type { EnglishDriveMaterial } from '../types/englishStudy';

const ENGLISH_DRIVE_FOLDER_ID = (import.meta.env.VITE_ENGLISH_DRIVE_FOLDER_ID || import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID) as string | undefined;

export function isEnglishDriveConfigured(): boolean {
  return Boolean(ENGLISH_DRIVE_FOLDER_ID && ENGLISH_DRIVE_FOLDER_ID.trim() !== '');
}

export function getEnglishDriveConfigMessage(): string {
  return 'Google Drive de Inglês não configurado. Configure VITE_ENGLISH_DRIVE_FOLDER_ID ou VITE_GOOGLE_DRIVE_FOLDER_ID para listar materiais.';
}

export async function listarMateriaisIngles(): Promise<EnglishDriveMaterial[]> {
  if (!isEnglishDriveConfigured()) throw new Error(getEnglishDriveConfigMessage());
  const files = await listarArquivosDaPasta(ENGLISH_DRIVE_FOLDER_ID);
  return files.map(file => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink,
  }));
}
