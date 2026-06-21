import type { Despesa, FaturaCartao } from '../types';

// Calcula em qual competência (YYYY-MM) uma compra entra,
// baseado no dia de fechamento do cartão
export function obterCompetenciaFatura(dataCompra: string, diaFechamento: number | undefined): string {
  const d = new Date(dataCompra + 'T12:00:00');
  const dia = d.getDate();
  const mes = d.getMonth(); // 0-indexed
  const ano = d.getFullYear();

  if (!diaFechamento) {
    // sem fechamento configurado: usa mês da compra
    return `${ano}-${String(mes + 1).padStart(2, '0')}`;
  }

  if (dia <= diaFechamento) {
    // entra na fatura do mês atual
    return `${ano}-${String(mes + 1).padStart(2, '0')}`;
  } else {
    // entra na fatura do mês seguinte
    const proximo = new Date(ano, mes + 1, 1);
    return `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}`;
  }
}

// Calcula valor_detalhado de uma fatura (soma das despesas vinculadas)
export function calcularValorDetalhado(faturaId: string, despesas: Despesa[]): number {
  return despesas
    .filter(d => d.faturaId === faturaId)
    .reduce((acc, d) => acc + d.valor, 0);
}

// Calcula valor efetivo para o RESUMO DO MÊS:
// Só conta se o usuário informou a fatura manualmente.
// Parcelas não entram no total — apenas a fatura confirmada conta.
export function calcularValorEfetivo(fatura: FaturaCartao): number {
  return fatura.valorInformado ?? 0;
}

// Encontra ou cria (em memória) a fatura para o cartão/competência
export function obterOuCriarFatura(
  cartaoId: string,
  competencia: string,
  faturas: FaturaCartao[]
): { fatura: FaturaCartao; isNova: boolean } {
  const existente = faturas.find(f => f.cartaoId === cartaoId && f.competencia === competencia);
  if (existente) return { fatura: existente, isNova: false };
  const [anoStr, mesStr] = competencia.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  return {
    fatura: {
      id: crypto.randomUUID(),
      cartaoId,
      competencia,
      mes,
      ano,
      valorInformado: null,
      valorDetalhado: 0,
      diferenca: 0,
      valorEfetivo: 0,
      status: 'aberta',
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
    },
    isNova: true,
  };
}

// Recalcula os totais de uma fatura com base nas despesas
export function recalcularFatura(fatura: FaturaCartao, despesas: Despesa[]): FaturaCartao {
  const detalhado = calcularValorDetalhado(fatura.id, despesas);
  const informado = fatura.valorInformado;
  const diferenca = informado !== null ? informado - detalhado : 0;
  const efetivo = informado ?? 0; // só conta no resumo se o usuário informou
  return {
    ...fatura,
    valorDetalhado: detalhado,
    diferenca,
    valorEfetivo: efetivo,
    dataAtualizacao: new Date().toISOString(),
  };
}
