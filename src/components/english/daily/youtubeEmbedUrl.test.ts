import { describe, expect, it } from 'vitest';
import { buildYoutubeEmbedUrl, buildYoutubeWatchUrl, isValidYoutubeVideoId } from './youtubeEmbedUrl';

describe('isValidYoutubeVideoId', () => {
  it('aceita um videoId real de 11 caracteres', () => {
    expect(isValidYoutubeVideoId('dQw4w9WgXcQ')).toBe(true);
  });

  it('rejeita string vazia', () => {
    expect(isValidYoutubeVideoId('')).toBe(false);
  });

  it('rejeita valores claramente inválidos (espaços, barras, muito curto)', () => {
    expect(isValidYoutubeVideoId('abc')).toBe(false);
    expect(isValidYoutubeVideoId('has spaces')).toBe(false);
    expect(isValidYoutubeVideoId('has/slash123')).toBe(false);
  });
});

describe('buildYoutubeEmbedUrl', () => {
  it('constrói a URL no formato https://www.youtube.com/embed/{videoId} para um ID válido', () => {
    expect(buildYoutubeEmbedUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('retorna null para um videoId ausente/inválido — nunca gera uma URL de iframe quebrada', () => {
    expect(buildYoutubeEmbedUrl('')).toBeNull();
    expect(buildYoutubeEmbedUrl('id inválido com espaço')).toBeNull();
  });

  it('nunca inclui HTML/markup na URL gerada — é sempre uma string de URL simples', () => {
    const url = buildYoutubeEmbedUrl('dQw4w9WgXcQ');
    expect(url).not.toMatch(/<|>/);
  });
});

describe('buildYoutubeWatchUrl', () => {
  it('constrói o link de fallback "assistir no YouTube"', () => {
    expect(buildYoutubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('sempre produz um link, mesmo para um videoId suspeito (é só um link, não um iframe)', () => {
    expect(buildYoutubeWatchUrl('')).toBe('https://www.youtube.com/watch?v=');
  });
});
