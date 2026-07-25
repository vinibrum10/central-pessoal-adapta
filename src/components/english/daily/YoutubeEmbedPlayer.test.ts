import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Verificações estruturais (texto-fonte) das propriedades de segurança/UX do
// player exigidas: sem HTML da API, responsivo 16:9, tela cheia permitida,
// sem autoplay, e com o link "Assistir no YouTube" sempre presente como
// alternativa (não é possível detectar via JS se o embed foi bloqueado pelo
// dono do vídeo — ver comentário no próprio componente).
const source = readFileSync(resolve(process.cwd(), 'src/components/english/daily/YoutubeEmbedPlayer.tsx'), 'utf-8');

describe('YoutubeEmbedPlayer', () => {
  it('nunca usa dangerouslySetInnerHTML nem HTML recebido da API', () => {
    expect(source).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it('constrói o iframe a partir de buildYoutubeEmbedUrl (videoId), nunca de um embed code de terceiros', () => {
    expect(source).toMatch(/buildYoutubeEmbedUrl\(videoId\)/);
    expect(source).toMatch(/<iframe[\s\S]*?src=\{embedUrl\}/);
  });

  it('nunca força autoplay=1 na URL de incorporação', () => {
    expect(source).not.toMatch(/autoplay[=:]\s*['"]?1/i);
  });

  it('permite tela cheia (allowFullScreen)', () => {
    expect(source).toMatch(/allowFullScreen/);
  });

  it('mantém proporção 16:9 responsiva (classe aspect-video)', () => {
    expect(source).toMatch(/aspect-video/);
  });

  it('sempre renderiza o link "Assistir no YouTube" (alternativa permanente, não condicional a detecção de falha)', () => {
    expect(source).toMatch(/Assistir no YouTube/);
    expect(source).toMatch(/target="_blank"/);
    expect(source).toMatch(/rel="noopener noreferrer"/);
  });

  it('mostra uma mensagem amigável (não uma área quebrada) quando o embedUrl é null', () => {
    expect(source).toMatch(/Não foi possível carregar o player incorporado/);
  });
});
