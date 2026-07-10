import { describe, expect, it } from 'vitest';
import { encontrarUrls } from './linkify';

describe('encontrarUrls', () => {
  it('encontra uma URL simples cercada de texto', () => {
    const texto = 'Candidate-se em: https://www.gupy.io/vaga/9999 hoje mesmo.';
    const matches = encontrarUrls(texto);

    expect(matches).toHaveLength(1);
    expect(matches[0].url).toBe('https://www.gupy.io/vaga/9999');
  });

  it('preserva o ponto final da frase em vez de descartá-lo (bug corrigido)', () => {
    const texto = 'Link: https://example.com/vaga1. Boa sorte!';
    const matches = encontrarUrls(texto);

    expect(matches).toHaveLength(1);
    expect(matches[0].url).toBe('https://example.com/vaga1');
    expect(matches[0].sufixo).toBe('.');
  });

  it('separa marcadores de markdown (**url**) da URL em vez de incluí-los no link (bug corrigido)', () => {
    const texto = 'Vaga: **https://example.com/vaga1** confira!';
    const matches = encontrarUrls(texto);

    expect(matches).toHaveLength(1);
    expect(matches[0].url).toBe('https://example.com/vaga1');
    expect(matches[0].sufixo).toBe('**');
  });

  it('encontra várias URLs no mesmo texto, cada uma com seus próprios limites', () => {
    const texto = [
      '#1 — Link: https://br.linkedin.com/jobs/vaga-1',
      '#2 — Link: https://www.gupy.io/vaga/2222.',
    ].join('\n');
    const matches = encontrarUrls(texto);

    expect(matches.map(m => m.url)).toEqual([
      'https://br.linkedin.com/jobs/vaga-1',
      'https://www.gupy.io/vaga/2222',
    ]);
  });

  it('encontra uma URL que está no início ou no fim exato da string', () => {
    expect(encontrarUrls('https://example.com/inicio resto do texto')[0].url).toBe('https://example.com/inicio');
    expect(encontrarUrls('resto do texto https://example.com/fim')[0].url).toBe('https://example.com/fim');
  });

  it('retorna lista vazia quando não há nenhuma URL', () => {
    expect(encontrarUrls('Nenhum link por aqui.')).toEqual([]);
  });

  it('os índices start/end permitem reconstruir o texto original ao redor da URL', () => {
    const texto = 'antes https://example.com/x depois';
    const [match] = encontrarUrls(texto);

    expect(texto.slice(0, match.start)).toBe('antes ');
    expect(texto.slice(match.end)).toBe(' depois');
  });
});
