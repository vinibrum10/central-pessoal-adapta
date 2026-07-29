import { describe, expect, it } from 'vitest';
import { classificarBloco, normalizarTexto } from './blocoClassificacao';

describe('normalizarTexto', () => {
  it('remove acentos, minusculiza e normaliza espacos/pontuacao', () => {
    expect(normalizarTexto('País*')).toBe('pais');
    expect(normalizarTexto('Localização (Cidade)*')).toBe('localizacao cidade');
    expect(normalizarTexto('Educação   Superior')).toBe('educacao superior');
  });
});

describe('classificarBloco', () => {
  it('agrupa perguntas de formacao academica', () => {
    expect(classificarBloco('Escola*')).toBe('Formação Acadêmica');
    expect(classificarBloco('Escolaridade*')).toBe('Formação Acadêmica');
    expect(classificarBloco('Disciplina*')).toBe('Formação Acadêmica');
    expect(classificarBloco('Ano da data de início*')).toBe('Formação Acadêmica');
    expect(classificarBloco('Mês da data de término*')).toBe('Formação Acadêmica');
  });

  it('agrupa perguntas de localizacao', () => {
    expect(classificarBloco('País*')).toBe('Localização');
    expect(classificarBloco('Localização (Cidade)*')).toBe('Localização');
  });

  it('agrupa perguntas de elegibilidade e indicacao', () => {
    expect(classificarBloco('Are you authorized to work in the country in which you’re applying?*')).toBe('Elegibilidade e Indicação');
    expect(classificarBloco('Do you know anyone or are you related to anyone who works at Capco?*')).toBe('Elegibilidade e Indicação');
    expect(classificarBloco('Capco Job Candidate Privacy Notice Acknowledgement*')).toBe('Elegibilidade e Indicação');
  });

  it('nao agrupa perguntas independentes', () => {
    expect(classificarBloco('Qual sua expectativa salarial?*')).toBe(null);
    expect(classificarBloco('Aceita atuação hibrida no Rio de Janeiro - Centro?*')).toBe(null);
    expect(classificarBloco('Possui inglês avançado?*')).toBe(null);
  });
});
