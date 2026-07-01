import type { AppData, Despesa, Divida, FaturaCartao, Receita, StatusPagamentoMensal } from '../types';
import { calcularValorEfetivo, obterOuCriarFatura, recalcularFatura } from './faturaCartao';
import { gerarId, hojeISO } from '.';

// ---- Estrutura de item a pagar no mês ----
export interface ItemPagar {
  id: string;
  tipo: 'despesa' | 'fatura' | 'divida';
  descricao: string;
  valor: number;
  origemLabel: string;
  pago: boolean;
  // faturas
  cartaoNome?: string;
  faturaId?: string;
  competencia?: string;
  cartaoId?: string;
}

export interface TotaisDespesasMes {
  gastosDesseMes: number;
  parcelasCartao: number;
  emprestimos: number;
  total: number;
  quantidadeGastos: number;
  quantidadeParcelasCartao: number;
  quantidadeEmprestimos: number;
}

function mesAnoDeIso(iso: string): { mes: number; ano: number } {
  const [anoStr, mesStr] = iso.slice(0, 7).split('-');
  return { mes: Number(mesStr) - 1, ano: Number(anoStr) };
}

export function isDespesaPaga(
  despesaId: string,
  mes: number,
  ano: number,
  statusPagamentos: StatusPagamentoMensal[]
): boolean {
  return statusPagamentos.some(
    s => s.itemId === despesaId && s.tipo === 'despesa' && s.mes === mes && s.ano === ano && s.pago
  );
}

export function isDividaParcelaPaga(
  dividaId: string,
  mes: number,
  ano: number,
  statusPagamentos: StatusPagamentoMensal[]
): boolean {
  return statusPagamentos.some(
    s => s.itemId === dividaId && s.tipo === 'divida' && s.mes === mes && s.ano === ano && s.pago
  );
}

export function isFaturaPaga(
  faturaId: string,
  mes: number,
  ano: number,
  statusPagamentos: StatusPagamentoMensal[]
): boolean {
  return statusPagamentos.some(
    s => s.itemId === faturaId && s.tipo === 'fatura' && s.mes === mes && s.ano === ano && s.pago
  );
}

export function gerarItensPagarMes(mes: number, ano: number, data: AppData): ItemPagar[] {
  const statusPagamentos = data.statusPagamentos ?? [];
  const competencia = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const items: ItemPagar[] = [];

  // 1. Despesas não-cartão. Cartão de crédito sempre entra por fatura consolidada.
  data.despesas
    .filter(d => {
      if (d.formaPagamento === 'Cartão de crédito') return false;
      const { mes: dm, ano: da } = mesAnoDeIso(d.data);
      return dm === mes && da === ano;
    })
    .forEach(d => {
      items.push({
        id: d.id,
        tipo: 'despesa',
        descricao: d.descricao,
        valor: d.valor,
        origemLabel: d.formaPagamento,
        pago: isDespesaPaga(d.id, mes, ano, statusPagamentos),
      });
    });

  // 2. Faturas de cartão do mês
  (data.faturas ?? [])
    .filter(f => f.competencia === competencia)
    .forEach(f => {
      const cartao = data.cartoes.find(c => c.id === f.cartaoId);
      const valor = calcularValorEfetivo(f);
      if (valor > 0 || f.valorDetalhado > 0) {
        items.push({
          id: f.id,
          tipo: 'fatura',
          descricao: `Fatura ${cartao?.nome ?? 'Cartão'}`,
          valor: Math.max(valor, f.valorDetalhado),
          origemLabel: 'Cartão de crédito',
          pago: f.status === 'paga' || isFaturaPaga(f.id, mes, ano, statusPagamentos),
          cartaoNome: cartao?.nome,
          faturaId: f.id,
          competencia: f.competencia,
          cartaoId: f.cartaoId,
        });
      }
    });

  // 2.1 Fallback consolidado para despesas de cartão antigas sem fatura vinculada.
  const cartaoSemFaturaPorCartao = new Map<string, number>();
  data.despesas
    .filter(d => {
      if (d.formaPagamento !== 'Cartão de crédito' || d.faturaId || !d.cartaoId) return false;
      const { mes: dm, ano: da } = mesAnoDeIso(d.data);
      return dm === mes && da === ano;
    })
    .forEach(d => {
      cartaoSemFaturaPorCartao.set(d.cartaoId!, (cartaoSemFaturaPorCartao.get(d.cartaoId!) ?? 0) + d.valor);
    });

  cartaoSemFaturaPorCartao.forEach((valor, cartaoId) => {
    const cartao = data.cartoes.find(c => c.id === cartaoId);
    const faturaExistente = items.find(item => item.tipo === 'fatura' && item.cartaoId === cartaoId);
    if (faturaExistente) {
      const faturaOriginal = (data.faturas ?? []).find(f => f.id === faturaExistente.faturaId);
      if (!faturaOriginal || faturaOriginal.valorInformado === null) {
        faturaExistente.valor += valor;
      }
      return;
    }
    items.push({
      id: `fatura-${cartaoId}-${competencia}`,
      tipo: 'fatura',
      descricao: `Fatura ${cartao?.nome ?? 'Cartão'}`,
      valor,
      origemLabel: 'Cartão de crédito',
      pago: false,
      cartaoNome: cartao?.nome,
      competencia,
      cartaoId,
    });
  });

  // 3. Parcelas de dívidas
  (data.dividas ?? [])
    .filter(d => (d.status === 'ativa' || !d.status) && d.dataInicio)
    .forEach(div => {
      const [inicioAno, inicioMes] = div.dataInicio!.slice(0, 7).split('-').map(Number);
      const mesesDecorridos = (ano - inicioAno) * 12 + (mes - (inicioMes - 1));
      const numeroParcela = mesesDecorridos + 1;
      if (numeroParcela >= 1 && numeroParcela <= div.totalParcelas) {
        items.push({
          id: div.id,
          tipo: 'divida',
          descricao: `${div.nome} — Parcela ${numeroParcela}/${div.totalParcelas}`,
          valor: div.valorParcela,
          origemLabel: 'Dívida',
          pago: isDividaParcelaPaga(div.id, mes, ano, statusPagamentos),
        });
      }
    });

  return items;
}

export function calcularTotaisDespesasMes(
  mes: number,
  ano: number,
  despesas: Despesa[],
  dividas: Divida[],
  faturas: FaturaCartao[] = [],
): TotaisDespesasMes {
  const competencia = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const despesasDoMes = despesas.filter(d => {
    if (d.formaPagamento === 'Cartão de crédito' && d.faturaId) {
      const fatura = faturas.find(f => f.id === d.faturaId);
      return fatura?.competencia === competencia;
    }
    const dataDespesa = mesAnoDeIso(d.data);
    return dataDespesa.mes === mes && dataDespesa.ano === ano;
  });

  const isParcelaCartao = (d: Despesa) =>
    d.formaPagamento === 'Cartão de crédito' &&
    (d.tipoCobrancaCartao === 'parcelado' || (d.quantidadeParcelas ?? 1) > 1 || Boolean(d.grupoParcelamentoId && d.parcelaAtual));

  const parcelasCartaoItens = despesasDoMes.filter(isParcelaCartao);
  const gastosDesseMesItens = despesasDoMes.filter(d => !isParcelaCartao(d));

  const emprestimosItens = dividas
    .filter(d => (d.status === 'ativa' || !d.status) && d.dataInicio)
    .filter(div => {
      const [inicioAno, inicioMes] = div.dataInicio!.slice(0, 7).split('-').map(Number);
      const mesesDecorridos = (ano - inicioAno) * 12 + (mes - (inicioMes - 1));
      const numeroParcela = mesesDecorridos + 1;
      return numeroParcela >= 1 && numeroParcela <= div.totalParcelas;
    });

  const gastosDesseMes = gastosDesseMesItens.reduce((acc, d) => acc + d.valor, 0);
  const parcelasCartao = parcelasCartaoItens.reduce((acc, d) => acc + d.valor, 0);
  const emprestimos = emprestimosItens.reduce((acc, d) => acc + d.valorParcela, 0);

  return {
    gastosDesseMes,
    parcelasCartao,
    emprestimos,
    total: gastosDesseMes + parcelasCartao + emprestimos,
    quantidadeGastos: gastosDesseMesItens.length,
    quantidadeParcelasCartao: parcelasCartaoItens.length,
    quantidadeEmprestimos: emprestimosItens.length,
  };
}

// Limite usado = soma de todas as despesas do cartão cujas faturas ainda NÃO foram pagas
export function calcularLimiteUsadoCartao(cartaoId: string, data: AppData): number {
  const faturas = data.faturas ?? [];
  return data.despesas
    .filter(d => d.cartaoId === cartaoId)
    .reduce((total, dep) => {
      if (!dep.faturaId) return total + dep.valor;
      const fatura = faturas.find(f => f.id === dep.faturaId);
      if (!fatura) return total + dep.valor;
      if (fatura.status === 'paga') return total;
      return total + dep.valor;
    }, 0);
}

export function calcularLimiteDisponivelCartao(cartaoId: string, limite: number, data: AppData): number {
  return Math.max(0, limite - calcularLimiteUsadoCartao(cartaoId, data));
}

export function calcularFaturaCartaoMes(
  cartaoId: string,
  mes: number,
  ano: number,
  data: AppData
): number {
  const competencia = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const fatura = (data.faturas ?? []).find(f => f.cartaoId === cartaoId && f.competencia === competencia);
  if (fatura) return fatura.valorInformado ?? fatura.valorDetalhado;
  // Sem fatura: soma despesas do cartão no mês (fallback)
  return data.despesas
    .filter(d => {
      if (d.cartaoId !== cartaoId || !d.faturaId) return false;
      const fat = (data.faturas ?? []).find(f => f.id === d.faturaId);
      return fat?.competencia === competencia;
    })
    .reduce((s, d) => s + d.valor, 0);
}

// Fonte única de verdade para os totais de fatura: recalcula valorDetalhado/diferenca/valorEfetivo
// de TODAS as faturas em data.faturas a partir das despesas atuais (data.despesas), usando o
// vínculo despesa.faturaId já mantido pelo sistema (equivalente a "despesas do mesmo cartão/mês").
// Preserva id, cartaoId, competencia, mes, ano, valorInformado, observacoes, status e dataCriacao —
// só os três campos calculados (+ dataAtualizacao, apenas quando algo realmente mudou) são tocados.
// Chamar sempre que despesas ou faturas mudarem: cria/edita/exclui despesa, edita parcelas futuras,
// informa fatura manualmente, ou ao carregar/migrar dados — nunca confiar em valorDetalhado salvo.
export function recalcularTodasAsFaturas(data: AppData): AppData {
  const faturas = data.faturas ?? [];
  if (faturas.length === 0) return data;
  let mudou = false;
  const faturasAtualizadas = faturas.map(f => {
    const recalculada = recalcularFatura(f, data.despesas);
    const semAlteracao =
      recalculada.valorDetalhado === f.valorDetalhado &&
      recalculada.diferenca === f.diferenca &&
      recalculada.valorEfetivo === f.valorEfetivo;
    if (semAlteracao) return f;
    mudou = true;
    return recalculada;
  });
  return mudou ? { ...data, faturas: faturasAtualizadas } : data;
}

// Remove uma despesa e recalcula todas as faturas a partir das despesas restantes,
// evitando que valorDetalhado/diferenca/valorEfetivo fiquem presos ao estado anterior à exclusão.
export function removerDespesa(data: AppData, despesaId: string): AppData {
  const despesasAtualizadas = data.despesas.filter(d => d.id !== despesaId);
  return recalcularTodasAsFaturas({ ...data, despesas: despesasAtualizadas });
}

export function calcularAReceberMes(mes: number, ano: number, data: AppData) {
  // Regra de competência: pendentes e recebidos aparecem no mês/ano previsto do recebimento.
  // A dataRecebimento registra quando entrou, mas não muda a competência original do item.
  const lista = (data.aReceber ?? [])
    .filter(a => a.status !== 'cancelado' && a.mes === mes + 1 && a.ano === ano)
    .sort((a, b) => (a.diaPrevisto ?? 1) - (b.diaPrevisto ?? 1) || a.descricao.localeCompare(b.descricao));
  const totalAReceber = lista.filter(a => a.status === 'a_receber').reduce((s, a) => s + a.valor, 0);
  const totalRecebido = lista.filter(a => a.status === 'recebido').reduce((s, a) => s + a.valor, 0);
  return { lista, totalAReceber, totalRecebido, totalEmAberto: totalAReceber };
}

export function calcularResumoMensal(mes: number, ano: number, data: AppData) {
  const itens = gerarItensPagarMes(mes, ano, data);
  const aReceber = calcularAReceberMes(mes, ano, data);
  const totalPagar = itens.reduce((acc, item) => acc + item.valor, 0);
  const totalPago = itens.filter(item => item.pago).reduce((acc, item) => acc + item.valor, 0);
  return { itens, aReceber, totalPagar, totalPago, totalEmAberto: totalPagar - totalPago };
}

export function verificarPendenciasMesAnterior(mes: number, ano: number, data: AppData): { mes: number; ano: number; itens: ItemPagar[] } {
  const anterior = mes === 0 ? { mes: 11, ano: ano - 1 } : { mes: mes - 1, ano };
  const itens = gerarItensPagarMes(anterior.mes, anterior.ano, data).filter(item => !item.pago);
  return { ...anterior, itens };
}

export function marcarItemComoPago(data: AppData, item: ItemPagar, mes: number, ano: number): AppData {
  return alterarStatusPagamentoItem(data, item, mes, ano, true);
}

export function desfazerPagamentoItem(data: AppData, item: ItemPagar, mes: number, ano: number): AppData {
  return alterarStatusPagamentoItem(data, item, mes, ano, false);
}

function alterarStatusPagamentoItem(data: AppData, item: ItemPagar, mes: number, ano: number, pago: boolean): AppData {
  const statusAtual = data.statusPagamentos ?? [];
  const itemId = item.tipo === 'fatura' ? item.faturaId ?? item.id : item.id;
  const existente = statusAtual.find(s => s.itemId === itemId && s.tipo === item.tipo && s.mes === mes && s.ano === ano);
  const status: StatusPagamentoMensal = {
    id: existente?.id ?? gerarId(),
    itemId,
    tipo: item.tipo,
    mes,
    ano,
    pago,
    dataPagamento: pago ? hojeISO() : undefined,
    dataCriacao: existente?.dataCriacao ?? hojeISO(),
  };
  const statusPagamentos = existente
    ? statusAtual.map(s => s.id === existente.id ? status : s)
    : [...statusAtual, status];
  const faturas = item.tipo === 'fatura'
    ? (data.faturas ?? []).map(f => f.id === itemId ? { ...f, status: pago ? 'paga' as const : 'aberta' as const, dataAtualizacao: new Date().toISOString() } : f)
    : data.faturas;
  return { ...data, statusPagamentos, faturas };
}

export function ajustarFaturaCartao(
  data: AppData,
  cartaoId: string,
  competencia: string,
  valorReal: number,
  observacoes?: string,
): { data: AppData; fatura: FaturaCartao; diferenca: number; ajusteCriadoOuAtualizado: boolean; aviso?: string } {
  let faturasAtual = [...(data.faturas ?? [])];
  const { fatura, isNova } = obterOuCriarFatura(cartaoId, competencia, faturasAtual);
  if (isNova) faturasAtual = [...faturasAtual, fatura];
  const faturaBase = recalcularFatura({ ...fatura, valorInformado: null }, data.despesas);
  const diferenca = valorReal - faturaBase.valorDetalhado;
  const [anoStr, mesStr] = competencia.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  let despesas = [...data.despesas];
  let ajusteCriadoOuAtualizado = false;
  if (diferenca > 0) {
    const ajusteExistente = despesas.find(dep =>
      dep.origemAjuste === true &&
      dep.cartaoId === cartaoId &&
      dep.faturaId === fatura.id &&
      dep.adjustmentCartaoId === cartaoId &&
      dep.adjustmentMes === mes &&
      dep.adjustmentAno === ano
    );
    const ajuste: Despesa = {
      id: ajusteExistente?.id ?? gerarId(),
      descricao: 'GASTO NÃO IDENTIFICADO',
      valor: diferenca,
      data: `${competencia}-01`,
      categoria: 'Outros',
      formaPagamento: 'Cartão de crédito',
      recorrente: false,
      essencial: false,
      dataCriacao: ajusteExistente?.dataCriacao ?? hojeISO(),
      cartaoId,
      faturaId: fatura.id,
      tipoCobrancaCartao: 'avista',
      origemAjuste: true,
      adjustmentCartaoId: cartaoId,
      adjustmentMes: mes,
      adjustmentAno: ano,
    };
    despesas = ajusteExistente
      ? despesas.map(dep => dep.id === ajusteExistente.id ? ajuste : dep)
      : [...despesas, ajuste];
    ajusteCriadoOuAtualizado = true;
  }

  // Grava o valor informado/observações manualmente na fatura alvo...
  faturasAtual = faturasAtual.map(f =>
    f.id === fatura.id
      ? { ...f, valorInformado: valorReal > 0 ? valorReal : null, observacoes: observacoes || undefined }
      : f
  );
  // ...e recalcula TODAS as faturas a partir das despesas atuais, garantindo que nenhuma
  // (inclusive faturas de outros cartões/meses) fique com total desatualizado.
  const dataNormalizada = recalcularTodasAsFaturas({ ...data, despesas, faturas: faturasAtual });
  const faturaAtualizada = dataNormalizada.faturas.find(f => f.id === fatura.id)!;

  return {
    data: dataNormalizada,
    fatura: faturaAtualizada,
    diferenca,
    ajusteCriadoOuAtualizado,
    aviso: diferenca < 0 ? 'Valor real menor que o calculado. Revise lançamentos ou registre estorno/crédito.' : undefined,
  };
}

export function marcarRecebimentoComoRecebido(data: AppData, aReceberId: string): AppData {
  return {
    ...data,
    aReceber: (data.aReceber ?? []).map(item => item.id === aReceberId
      ? { ...item, status: 'recebido' as const, dataRecebimento: item.dataRecebimento ?? hojeISO(), dataAtualizacao: hojeISO() }
      : item),
  };
}

export function converterRecebimentoEmReceita(data: AppData, aReceberId: string): AppData {
  const item = (data.aReceber ?? []).find(a => a.id === aReceberId);
  if (!item || item.receitaVinculadaId) return data;
  const receitaId = gerarId();
  const receita: Receita = {
    id: receitaId,
    descricao: item.descricao,
    valor: item.valor,
    data: `${item.ano}-${String(item.mes).padStart(2, '0')}-${String(item.diaPrevisto ?? 1).padStart(2, '0')}`,
    mesReferencia: item.mes,
    anoReferencia: item.ano,
    categoria: 'Outros',
    recorrente: false,
    recorrenciaId: null,
    recorrenciaTemTermino: false,
    recorrenciaMesTermino: null,
    recorrenciaAnoTermino: null,
    aReceberOrigemId: item.id,
    statusAReceber: 'recebido',
    dataCriacao: hojeISO(),
  };
  return {
    ...data,
    receitas: [...data.receitas, receita],
    aReceber: (data.aReceber ?? []).map(a => a.id === item.id ? { ...a, receitaVinculadaId: receitaId, dataAtualizacao: hojeISO() } : a),
  };
}
