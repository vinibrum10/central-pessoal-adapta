import { describe, expect, it } from 'vitest';
import { parseShadowingLink } from './shadowingService';

describe('parseShadowingLink', () => {
  it('reconhece um link de vídeo simples', () => {
    expect(parseShadowingLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      type: 'video',
      videoId: 'dQw4w9WgXcQ',
    });
  });

  it('reconhece um link youtu.be', () => {
    expect(parseShadowingLink('https://youtu.be/dQw4w9WgXcQ')).toEqual({ type: 'video', videoId: 'dQw4w9WgXcQ' });
  });

  it('BUG CORRIGIDO: link com v= e list= juntos (comum ao copiar de dentro de uma playlist) deve reconhecer o VÍDEO, não a playlist', () => {
    // Antes deste fix, a checagem de playlist rodava primeiro e o vídeo
    // sempre era descartado quando a URL também carregava `list=` — que é o
    // caso mais comum de link copiado do YouTube (ex.: assistindo dentro de
    // uma playlist/mix). Isso fazia o vídeo "sumir" do gerador de frases com
    // IA mesmo aparecendo normalmente no player.
    const result = parseShadowingLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLL8rrkKVLqeRdeFKmygYujTkwOefatZ6G');
    expect(result).toEqual({ type: 'video', videoId: 'dQw4w9WgXcQ' });
  });

  it('BUG CORRIGIDO: reconhece o vídeo mesmo quando list= vem ANTES de v= na query string', () => {
    const result = parseShadowingLink('https://www.youtube.com/watch?list=PLL8rrkKVLqeRdeFKmygYujTkwOefatZ6G&v=dQw4w9WgXcQ');
    expect(result).toEqual({ type: 'video', videoId: 'dQw4w9WgXcQ' });
  });

  it('reconhece uma playlist quando a URL realmente não tem nenhum vídeo específico', () => {
    const result = parseShadowingLink('https://www.youtube.com/playlist?list=PLL8rrkKVLqeRdeFKmygYujTkwOefatZ6G');
    expect(result).toEqual({ type: 'playlist', playlistId: 'PLL8rrkKVLqeRdeFKmygYujTkwOefatZ6G' });
  });

  it('reconhece um ID de vídeo colado sozinho (11 caracteres)', () => {
    expect(parseShadowingLink('dQw4w9WgXcQ')).toEqual({ type: 'video', videoId: 'dQw4w9WgXcQ' });
  });

  it('retorna null para um link inválido', () => {
    expect(parseShadowingLink('não é um link do youtube')).toBeNull();
  });
});
