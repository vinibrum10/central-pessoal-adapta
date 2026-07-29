export type BlocoPergunta = 'Formação Acadêmica' | 'Localização' | 'Elegibilidade e Indicação' | null;

/** Texto de ajuda exibido abaixo do cabeçalho de cada bloco agrupado, em
 * português simples, explicando o que aquele conjunto de perguntas representa. */
export const AJUDA_BLOCO: Record<Exclude<BlocoPergunta, null>, string> = {
  'Formação Acadêmica':
    'Este bloco representa UMA formação (curso, escola, datas de início e fim). ' +
    'Preencha com a formação mais relevante para vagas de Segurança do Trabalho/EHS.',
  Localização:
    'Este bloco reúne os campos de localização pedidos pelo formulário (país e cidade) — ' +
    'preencha com onde você está disponível para atuar.',
  'Elegibilidade e Indicação':
    'Este bloco reúne perguntas de triagem da empresa (autorização de trabalho, indicação ' +
    'por funcionário, aviso de privacidade) — não fazem parte do seu currículo.',
};

export function normalizarTexto(texto: string): string {
  const semAcento = texto
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return semAcento.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Heuristica por palavra-chave — so decide agrupamento visual (cosmetico),
 * nunca decide reaproveitar resposta automaticamente. Uma classificacao errada
 * so produz um cabecalho de bloco no lugar errado, sem risco de dado incorreto
 * ir para um formulario real.
 */
export function classificarBloco(pergunta: string): BlocoPergunta {
  const p = normalizarTexto(pergunta);
  const temAlguma = (...palavras: string[]) => palavras.some(palavra => p.includes(palavra));

  if (
    temAlguma('escola', 'escolaridade', 'disciplina', 'curso', 'formacao academica', 'universidade', 'faculdade') ||
    (temAlguma('ano', 'mes') && temAlguma('inicio', 'termino'))
  ) {
    return 'Formação Acadêmica';
  }

  if (temAlguma('pais', 'localizacao', 'cidade', 'endereco')) {
    return 'Localização';
  }

  if (
    temAlguma(
      'autorizado a trabalhar', 'authorized to work', 'conhece alguem', 'know anyone',
      'foi indicado', 'referred', 'employee', 'funcionario', 'privacy', 'acknowledgement',
      'aviso de privacidade',
    )
  ) {
    return 'Elegibilidade e Indicação';
  }

  return null;
}
