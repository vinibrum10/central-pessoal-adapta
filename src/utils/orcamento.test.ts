import { describe, it, expect } from 'vitest';
import type { AppData, Cartao, Despesa } from '../types';
import { obterOuCriarFatura, recalcularFatura } from './faturaCartao';
import { calcularTotaisDespesasMes, gerarItensPagarMes, removerDespesa } from './orcamento';

// Julho/2026 = mes 6 (0-indexed), ano 2026
const MES = 6;
const ANO = 2026;

function criarAppDataBase(): AppData {
  const cartaoC6: Cartao = {
    id: 'cartao-c6',
    nome: 'C6 Bank',
    limite: 10000,
    faturaAtual: 0,
    vencimento: 10,
    status: 'ativo',
    dataCriacao: '2026-01-01',
  };

  const despesasExistentes: Despesa[] = [
    {
      id: 'desp-c6-1',
      descricao: 'Mercado',
      valor: 3820,
      data: '2026-07-01',
      categoria: 'Alimentação',
      formaPagamento: 'Cartão de crédito',
      recorrente: false,
      essencial: true,
      dataCriacao: '2026-07-01',
      cartaoId: 'cartao-c6',
    },
    {
      id: 'desp-c6-2',
      descricao: 'Combustível',
      valor: 3830,
      data: '2026-07-01',
      categoria: 'Transporte',
      formaPagamento: 'Cartão de crédito',
      recorrente: false,
      essencial: true,
      dataCriacao: '2026-07-01',
      cartaoId: 'cartao-c6',
    },
  ];

  const competencia = `${ANO}-07`;
  let faturas = [] as ReturnType<typeof recalcularFatura>[];
  const despesasComFatura = despesasExistentes.map(d => {
    const { fatura, isNova } = obterOuCriarFatura(d.cartaoId!, competencia, faturas);
    if (isNova) faturas = [...faturas, fatura];
    return { ...d, faturaId: fatura.id };
  });
  faturas = faturas.map(f => recalcularFatura(f, despesasComFatura));

  return {
    metas: [],
    tarefas: [],
    blocosTempo: [],
    rotinasSemana: [],
    receitas: [],
    despesas: despesasComFatura,
    cartoes: [cartaoC6],
    dividas: [],
    reservas: [],
    bens: [],
    configuracoes: {} as AppData['configuracoes'],
    eventosAgenda: [],
    configuracoesAgenda: [],
    leiturasDiarias: [],
    fontesLeitura: [],
    faturas,
    sugestoes: [],
    statusPagamentos: [],
    aReceber: [],
  };
}

function totalFaturaC6(data: AppData): number {
  return data.faturas.find(f => f.cartaoId === 'cartao-c6')!.valorDetalhado;
}

function totalItensPagarMes(data: AppData): number {
  return gerarItensPagarMes(MES, ANO, data).reduce((acc, item) => acc + item.valor, 0);
}

describe('bug: exclusão de despesa de cartão deixa total da fatura desatualizado', () => {
  it('ao criar e depois excluir uma despesa de R$10 no C6 Bank, todos os totais voltam exatamente ao valor anterior', () => {
    const dataBase = criarAppDataBase();

    const totalFaturaAntes = totalFaturaC6(dataBase);
    const totalItensAntes = totalItensPagarMes(dataBase);
    const totalDespesasMesAntes = calcularTotaisDespesasMes(MES, ANO, dataBase.despesas, dataBase.dividas, dataBase.faturas).total;

    // Cria despesa de R$10,00 no C6 Bank em Julho/2026
    const competencia = `${ANO}-07`;
    const { fatura, isNova } = obterOuCriarFatura('cartao-c6', competencia, dataBase.faturas);
    let faturasComNova = isNova ? [...dataBase.faturas, fatura] : dataBase.faturas;

    const novaDespesa: Despesa = {
      id: 'desp-c6-nova-10',
      descricao: 'Lanche',
      valor: 10,
      data: '2026-07-01',
      categoria: 'Alimentação',
      formaPagamento: 'Cartão de crédito',
      recorrente: false,
      essencial: false,
      dataCriacao: '2026-07-01',
      cartaoId: 'cartao-c6',
      faturaId: fatura.id,
    };

    const despesasComNova = [...dataBase.despesas, novaDespesa];
    faturasComNova = faturasComNova.map(f => recalcularFatura(f, despesasComNova));
    const dataComNovaDespesa: AppData = { ...dataBase, despesas: despesasComNova, faturas: faturasComNova };

    // Totais devem aumentar exatamente R$10,00
    expect(totalFaturaC6(dataComNovaDespesa)).toBeCloseTo(totalFaturaAntes + 10, 2);
    expect(totalItensPagarMes(dataComNovaDespesa)).toBeCloseTo(totalItensAntes + 10, 2);
    expect(
      calcularTotaisDespesasMes(MES, ANO, dataComNovaDespesa.despesas, dataComNovaDespesa.dividas, dataComNovaDespesa.faturas).total,
    ).toBeCloseTo(totalDespesasMesAntes + 10, 2);

    // Exclui a despesa recém-criada
    const dataAposExclusao = removerDespesa(dataComNovaDespesa, novaDespesa.id);

    // Todos os totais devem voltar EXATAMENTE ao valor anterior (sem R$10 preso na fatura)
    expect(totalFaturaC6(dataAposExclusao)).toBeCloseTo(totalFaturaAntes, 2);
    expect(totalItensPagarMes(dataAposExclusao)).toBeCloseTo(totalItensAntes, 2);
    expect(
      calcularTotaisDespesasMes(MES, ANO, dataAposExclusao.despesas, dataAposExclusao.dividas, dataAposExclusao.faturas).total,
    ).toBeCloseTo(totalDespesasMesAntes, 2);

    // Resumo (itensPagarMes) e aba Despesas (calcularTotaisDespesasMes) precisam bater entre si
    expect(totalItensPagarMes(dataAposExclusao)).toBeCloseTo(
      calcularTotaisDespesasMes(MES, ANO, dataAposExclusao.despesas, dataAposExclusao.dividas, dataAposExclusao.faturas).total,
      2,
    );

    // Persistência: serializar/desserializar (simula refresh) não deve reintroduzir o valor antigo
    const dataAposReload = JSON.parse(JSON.stringify(dataAposExclusao)) as AppData;
    expect(totalFaturaC6(dataAposReload)).toBeCloseTo(totalFaturaAntes, 2);
    expect(dataAposReload.despesas.find(d => d.id === novaDespesa.id)).toBeUndefined();
  });
});
