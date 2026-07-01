import { describe, it, expect } from 'vitest';
import type { AppData, Cartao, Despesa, FaturaCartao } from '../types';
import { obterOuCriarFatura, recalcularFatura } from './faturaCartao';
import { calcularTotaisDespesasMes, gerarItensPagarMes, removerDespesa, recalcularTodasAsFaturas } from './orcamento';

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

describe('correção adicional: normalização centralizada de faturas antigas (recalcularTodasAsFaturas)', () => {
  it('Teste 1 — fatura congelada antiga: corrige valorDetalhado/diferenca sem apagar valorInformado', () => {
    const dataBase = criarAppDataBase(); // despesas atuais do C6 somam R$ 7.650,00
    const faturaC6Original = dataBase.faturas.find(f => f.cartaoId === 'cartao-c6')!;

    // Simula uma fatura que ficou "congelada" com valorDetalhado de uma despesa já excluída
    // (o R$10 do bug relatado), como se tivesse sido salva antes da correção de removerDespesa.
    const faturaCongelada: FaturaCartao = {
      ...faturaC6Original,
      valorInformado: 8000, // valor informado manualmente pelo usuário, deve ser preservado
      valorDetalhado: 7660, // congelado/errado (despesas atuais somam 7650)
      diferenca: 8000 - 7660, // também desatualizado
      valorEfetivo: 8000,
    };
    const dataComFaturaCongelada: AppData = {
      ...dataBase,
      faturas: [faturaCongelada],
    };

    const dataNormalizada = recalcularTodasAsFaturas(dataComFaturaCongelada);
    const faturaCorrigida = dataNormalizada.faturas.find(f => f.id === faturaCongelada.id)!;

    expect(faturaCorrigida.valorDetalhado).toBeCloseTo(7650, 2);
    expect(faturaCorrigida.valorInformado).toBe(8000); // preservado
    expect(faturaCorrigida.diferenca).toBeCloseTo(8000 - 7650, 2); // recalculada com base no detalhado correto
    expect(faturaCorrigida.valorEfetivo).toBe(8000); // valorInformado continua prevalecendo
  });

  it('Teste 2 — reload: valor errado não volta após serializar/desserializar o localStorage', () => {
    const dataBase = criarAppDataBase();
    const faturaC6Original = dataBase.faturas.find(f => f.cartaoId === 'cartao-c6')!;
    const faturaCongelada: FaturaCartao = {
      ...faturaC6Original,
      valorDetalhado: 7660,
      diferenca: 0,
      valorEfetivo: 7660,
    };
    const dataComFaturaCongelada: AppData = { ...dataBase, faturas: [faturaCongelada] };

    // Simula o que acontece ao carregar do localStorage (migrarDados/setData sempre
    // passam os dados por recalcularTodasAsFaturas antes de expor ao app).
    const dataSerializada = JSON.parse(JSON.stringify(dataComFaturaCongelada)) as AppData;
    const dataAoCarregar = recalcularTodasAsFaturas(dataSerializada);

    expect(dataAoCarregar.faturas.find(f => f.id === faturaCongelada.id)!.valorDetalhado).toBeCloseTo(7650, 2);

    // Um segundo reload (idempotência) não deve reintroduzir o valor antigo nem recriar faturas
    const dataSegundoReload = recalcularTodasAsFaturas(JSON.parse(JSON.stringify(dataAoCarregar)) as AppData);
    expect(dataSegundoReload.faturas).toHaveLength(1);
    expect(dataSegundoReload.faturas[0].valorDetalhado).toBeCloseTo(7650, 2);
  });

  it('Teste 3 — não apaga campos manuais da fatura (observações, status, valorInformado, statusPagamentos)', () => {
    const dataBase = criarAppDataBase();
    const faturaC6Original = dataBase.faturas.find(f => f.cartaoId === 'cartao-c6')!;
    const faturaComDadosManuais: FaturaCartao = {
      ...faturaC6Original,
      valorInformado: 7700,
      observacoes: 'Fatura conferida manualmente com o extrato do banco',
      status: 'paga',
      valorDetalhado: 7660, // congelado, deve ser corrigido
    };
    const dataComDadosManuais: AppData = {
      ...dataBase,
      faturas: [faturaComDadosManuais],
      statusPagamentos: [
        {
          id: 'status-1',
          itemId: faturaComDadosManuais.id,
          tipo: 'fatura',
          mes: MES,
          ano: ANO,
          pago: true,
          dataPagamento: '2026-07-10',
          dataCriacao: '2026-07-10',
        },
      ],
    };

    const dataNormalizada = recalcularTodasAsFaturas(dataComDadosManuais);
    const faturaCorrigida = dataNormalizada.faturas.find(f => f.id === faturaComDadosManuais.id)!;

    // Campos manuais preservados
    expect(faturaCorrigida.observacoes).toBe('Fatura conferida manualmente com o extrato do banco');
    expect(faturaCorrigida.status).toBe('paga');
    expect(faturaCorrigida.valorInformado).toBe(7700);
    expect(faturaCorrigida.cartaoId).toBe(faturaComDadosManuais.cartaoId);
    expect(faturaCorrigida.competencia).toBe(faturaComDadosManuais.competencia);
    expect(faturaCorrigida.dataCriacao).toBe(faturaComDadosManuais.dataCriacao);
    // Status de pagamento (registro separado) não é tocado pela normalização de faturas
    expect(dataNormalizada.statusPagamentos).toEqual(dataComDadosManuais.statusPagamentos);
    // Só o campo calculado é corrigido
    expect(faturaCorrigida.valorDetalhado).toBeCloseTo(7650, 2);
  });
});
