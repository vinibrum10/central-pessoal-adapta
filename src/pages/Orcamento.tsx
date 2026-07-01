import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, Pencil, TrendingUp, TrendingDown,
  AlertTriangle, PiggyBank, Package,
  ChevronLeft, ChevronRight, Info, CheckCircle, RotateCcw
} from 'lucide-react';
import { parseBRLMoney, moneyToInputBR } from '../utils/money';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
import { useApp } from '../hooks/useApp';
import { useAuth } from '../contexts/AuthContext';
import { canCreateExpense, canEditExpense, canDeleteExpense } from '../utils/permissions';
import type {
  Receita, Despesa, Cartao, Divida, Reserva, Bem,
  CategoriaFinanceira, FormaPagamento, StatusCartao,
  PrioridadeQuitacao, StatusBem, TipoBem, FaturaCartao,
  AReceber
} from '../types';
import {
  obterCompetenciaFatura,
  obterOuCriarFatura,
  recalcularFatura,
  calcularValorEfetivo,
} from '../utils/faturaCartao';
import { Card, CardHeader, CardBody } from '../components/Card';
import { ProgressBar } from '../components/Badge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input, Select, Textarea, Checkbox } from '../components/FormFields';
import { DateInputBR } from '../components/DateInputBR';
import { formatarDinheiro, formatarData, isoParaDataBR, gerarId, hojeISO } from '../utils';
import {
  calcularAReceberMes,
  calcularLimiteDisponivelCartao,
  calcularLimiteUsadoCartao,
  calcularTotaisDespesasMes,
  converterRecebimentoEmReceita,
  desfazerPagamentoItem,
  gerarItensPagarMes,
  marcarItemComoPago,
  marcarRecebimentoComoRecebido,
  verificarPendenciasMesAnterior,
  ajustarFaturaCartao,
  removerDespesa,
  type ItemPagar,
} from '../utils/orcamento';

type TipoCobrancaCartao = 'avista' | 'parcelado';

interface FormDespesaExtra {
  tipoCobrancaCartao: TipoCobrancaCartao;
  quantidadeParcelas: number;
  mesInicioParcelas: string;
}

type FormAReceber = Omit<AReceber, 'id' | 'dataCriacao' | 'dataAtualizacao'>;

const CARTAO_COR_PADRAO = '#2563eb';
const CARTAO_CORES = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#475569'];

const novoFormAReceber = (mes: number, ano: number): FormAReceber => ({
  pessoa: '',
  descricao: '',
  valor: 0,
  mes,
  ano,
  status: 'a_receber',
  tipoRecebimento: 'unico',
  diaPrevisto: 10,
});

const novoCartaoForm = (): Omit<Cartao, 'id' | 'dataCriacao'> => ({
  nome: '',
  banco: '',
  cor: CARTAO_COR_PADRAO,
  icone: '',
  limite: 0,
  faturaAtual: 0,
  vencimento: 10,
  status: 'ativo',
  diaFechamento: undefined,
});

const corCartao = (cartao?: Pick<Cartao, 'cor'>) => cartao?.cor || CARTAO_COR_PADRAO;

const iconeCartao = (cartao?: Pick<Cartao, 'icone' | 'banco' | 'nome'>) => {
  const base = cartao?.icone || cartao?.banco || cartao?.nome || '?';
  return base.trim().slice(0, 2).toUpperCase();
};

function calcularParcelasPagasAuto(divida: { dataInicio?: string; diaVencimento?: number; totalParcelas: number; parcelasPagas: number }): number {
  if (!divida.dataInicio) return divida.parcelasPagas;
  const inicio = new Date(divida.dataInicio + 'T12:00:00');
  const hoje = new Date();
  const mesesDecorridos = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
  const calculado = Math.max(0, Math.min(mesesDecorridos, divida.totalParcelas));
  // Usa o maior entre calculado e o informado manualmente
  return Math.max(calculado, divida.parcelasPagas);
}

function proximoVencimento(divida: { dataInicio?: string; diaVencimento?: number; parcelasPagas: number }): string | null {
  if (!divida.dataInicio) return null;
  const inicio = new Date(divida.dataInicio + 'T12:00:00');
  const dia = divida.diaVencimento ?? inicio.getDate();
  const hoje = new Date();
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
  if (d < hoje) d.setMonth(d.getMonth() + 1);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

type Aba = 'resumo' | 'receitas' | 'despesas' | 'cartoes' | 'dividas' | 'reserva' | 'bens' | 'aReceber';

const categoriasReceita: CategoriaFinanceira[] = ['Salário', 'Freelance', 'Investimentos', 'Outros'];
const categoriasDespesa: CategoriaFinanceira[] = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Dívidas', 'Cartão', 'Reserva', 'Outros'];
const formasPagamento: FormaPagamento[] = ['Dinheiro', 'Cartão de crédito', 'Débito', 'PIX', 'Boleto', 'Transferência'];

type FormReceita = Omit<Receita, 'id' | 'dataCriacao'>;

const dataCompetencia = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}-01`;

const novaReceitaForm = (): FormReceita => {
  const hoje = hojeISO();
  const mesReferencia = Number(hoje.slice(5, 7));
  const anoReferencia = Number(hoje.slice(0, 4));
  return {
    descricao: '',
    valor: 0,
    data: dataCompetencia(anoReferencia, mesReferencia),
    mesReferencia,
    anoReferencia,
    categoria: 'Salário',
    recorrente: false,
    recorrenciaId: null,
    recorrenciaTemTermino: false,
    recorrenciaMesTermino: null,
    recorrenciaAnoTermino: null,
  };
};

function mesesRecorrenciaReceita(form: FormReceita): { mes: number; ano: number }[] {
  const inicioMes = form.mesReferencia ?? Number(form.data.slice(5, 7));
  const inicioAno = form.anoReferencia ?? Number(form.data.slice(0, 4));
  const fimMes = form.recorrenciaTemTermino ? form.recorrenciaMesTermino ?? inicioMes : 12;
  const fimAno = form.recorrenciaTemTermino ? form.recorrenciaAnoTermino ?? inicioAno : Math.max(2026, inicioAno);
  const meses: { mes: number; ano: number }[] = [];
  for (let ano = inicioAno; ano <= fimAno; ano++) {
    const de = ano === inicioAno ? inicioMes : 1;
    const ate = ano === fimAno ? fimMes : 12;
    for (let mes = de; mes <= ate; mes++) meses.push({ mes, ano });
  }
  return meses;
}

function prepararProximoAnoReceitas(receitas: Receita[], hoje = new Date()): Receita[] {
  if (hoje.getMonth() !== 11) return receitas;
  const proximoAno = hoje.getFullYear() + 1;
  const series = new Map<string, Receita>();
  for (const receita of receitas) {
    if (receita.recorrente && receita.recorrenciaId && !receita.recorrenciaTemTermino && !series.has(receita.recorrenciaId)) {
      series.set(receita.recorrenciaId, receita);
    }
  }

  const novas: Receita[] = [];
  for (const receitaBase of series.values()) {
    for (let mes = 1; mes <= 12; mes++) {
      const jaExiste = receitas.some(r =>
        r.recorrenciaId === receitaBase.recorrenciaId &&
        r.mesReferencia === mes &&
        r.anoReferencia === proximoAno
      );
      if (!jaExiste) {
        novas.push({
          ...receitaBase,
          id: gerarId(),
          data: dataCompetencia(proximoAno, mes),
          mesReferencia: mes,
          anoReferencia: proximoAno,
          dataCriacao: hojeISO(),
        });
      }
    }
  }
  return novas.length > 0 ? [...receitas, ...novas] : receitas;
}

export function OrcamentoPage() {
  const { data, setData, recoverAReceberFromLocalStorage } = useApp();
  const { perfil } = useAuth();
  const [aba, setAba] = useState<Aba>('resumo');
  const [modal, setModal] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mesFiltro, setMesFiltro] = useState(() => { const h = new Date(); return { mes: h.getMonth(), ano: h.getFullYear() }; });
  const [cartaoSelecionadoId, setCartaoSelecionadoId] = useState<string>('');
  const [modalFatura, setModalFatura] = useState<{ cartaoId: string; competencia: string } | null>(null);
  const [formFatura, setFormFatura] = useState<{ valorInformado: number; observacoes: string }>({ valorInformado: 0, observacoes: '' });
  const [modalEscopoParcela, setModalEscopoParcela] = useState<null | { despesaId: string; grupoId: string }>(null);

  // Forms
  const [formReceita, setFormReceita] = useState<FormReceita>(novaReceitaForm());
  const [formReceitaValorStr, setFormReceitaValorStr] = useState('');
  const [formDespesa, setFormDespesa] = useState<Omit<Despesa, 'id' | 'dataCriacao'>>({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Alimentação', formaPagamento: 'PIX', recorrente: false, essencial: true });
  const [formDespesaValorStr, setFormDespesaValorStr] = useState('');
  const [formDespesaMesFatura, setFormDespesaMesFatura] = useState<string>(hojeISO().slice(0, 7)); // YYYY-MM para edição de cartão
  const [formDespesaExtra, setFormDespesaExtra] = useState<FormDespesaExtra>({ tipoCobrancaCartao: 'avista', quantidadeParcelas: 2, mesInicioParcelas: hojeISO().slice(0, 7) });
  const [formCartao, setFormCartao] = useState<Omit<Cartao, 'id' | 'dataCriacao'>>(() => novoCartaoForm());
  const [formCartaoLimiteStr, setFormCartaoLimiteStr] = useState('');
  const [formCartaoFaturaStr, setFormCartaoFaturaStr] = useState('');
  const [formDivida, setFormDivida] = useState<Omit<Divida, 'id' | 'dataCriacao'>>({ nome: '', valorTotal: 0, valorParcela: 0, totalParcelas: 1, parcelasPagas: 0, taxaJuros: 0, prioridadeQuitacao: 'média', dataInicio: hojeISO(), diaVencimento: 10, status: 'ativa' });
  const [formDividaTotalStr, setFormDividaTotalStr] = useState('');
  const [formDividaParcelaStr, setFormDividaParcelaStr] = useState('');
  const [formReserva, setFormReserva] = useState<Omit<Reserva, 'id' | 'dataCriacao'>>({ nome: '', metaReserva: 0, valorAtual: 0, prazoDesejado: '' });
  const [formReservaMetaStr, setFormReservaMetaStr] = useState('');
  const [formReservaAtualStr, setFormReservaAtualStr] = useState('');
  const [formBem, setFormBem] = useState<Omit<Bem, 'id' | 'dataCriacao'>>({ nome: '', tipo: 'Carro', valorEstimado: 0, status: 'manter', observacoes: '' });
  const [formBemValorStr, setFormBemValorStr] = useState('');
  const [formFaturaValorStr, setFormFaturaValorStr] = useState('');
  const [formAReceber, setFormAReceber] = useState<FormAReceber>(() => novoFormAReceber(new Date().getMonth() + 1, new Date().getFullYear()));
  const [formAReceberValorStr, setFormAReceberValorStr] = useState('');
  const [erroAReceber, setErroAReceber] = useState('');
  const [modalAReceberAcao, setModalAReceberAcao] = useState<null | { itemId: string; tipo: 'receber' | 'desfazer' }>(null);
  const [modalExcluirAReceber, setModalExcluirAReceber] = useState<null | { itemId: string; escopo?: 'item' | 'grupo' }>(null);
  const [mostrarContasPagas, setMostrarContasPagas] = useState(false);
  const [pendenciasAnterior, setPendenciasAnterior] = useState<null | { mes: number; ano: number; itens: ItemPagar[] }>(null);
  const [msgOrcamento, setMsgOrcamento] = useState('');
  const [msgAReceberRecuperacao, setMsgAReceberRecuperacao] = useState('');

  useEffect(() => {
    setData(d => {
      const receitasAtualizadas = prepararProximoAnoReceitas(d.receitas);
      return receitasAtualizadas === d.receitas ? d : { ...d, receitas: receitasAtualizadas };
    });
  }, [setData]);

  // Resumo financeiro do mês filtrado
  // Lê mês/ano diretamente da string ISO para evitar bug de fuso horário (UTC vs local)
  const mesAnoDeData = (iso: string) => {
    const [anoStr, mesStr] = iso.slice(0, 7).split('-');
    return { mes: Number(mesStr) - 1, ano: Number(anoStr) };
  };
  const receitasFiltradas = data.receitas.filter(r => {
    const { mes, ano } = mesAnoDeData(r.data);
    const mesRef = (r.mesReferencia ?? mes + 1) - 1;
    const anoRef = r.anoReferencia ?? ano;
    return mesRef === mesFiltro.mes && anoRef === mesFiltro.ano;
  });
  // Despesas: não-cartão filtra por mês de referência; cartão filtra pela competência da fatura
  const despesasFiltradas = data.despesas.filter(d => {
    if (d.formaPagamento !== 'Cartão de crédito' || !d.faturaId) {
      const { mes, ano } = mesAnoDeData(d.data);
      return mes === mesFiltro.mes && ano === mesFiltro.ano;
    }
    const fatura = (data.faturas ?? []).find(f => f.id === d.faturaId);
    if (!fatura) {
      const { mes, ano } = mesAnoDeData(d.data);
      return mes === mesFiltro.mes && ano === mesFiltro.ano;
    }
    const [fAno, fMes] = fatura.competencia.split('-').map(Number);
    return fMes === mesFiltro.mes + 1 && fAno === mesFiltro.ano;
  });
  const receitasMes = receitasFiltradas.reduce((a, r) => a + r.valor, 0);

  // Faturas com competência no mês filtrado
  const competenciaMesFiltro = `${mesFiltro.ano}-${String(mesFiltro.mes + 1).padStart(2, '0')}`;
  // Parcelas de dívidas ativas que vencem no mês filtrado (calculado automaticamente, sem duplicar em data.despesas)
  const parcelasDividasNoMes = useMemo(() => {
    return (data.dividas ?? [])
      .filter(d => (d.status === 'ativa' || !d.status) && d.dataInicio)
      .flatMap(d => {
        const [inicioAno, inicioMes] = d.dataInicio!.slice(0, 7).split('-').map(Number);
        const mesesDecorridos = (mesFiltro.ano - inicioAno) * 12 + (mesFiltro.mes - (inicioMes - 1));
        const numeroParcela = mesesDecorridos + 1;
        if (numeroParcela < 1 || numeroParcela > d.totalParcelas) return [];
        return [{
          virtualId: `vd-${d.id}-${mesFiltro.ano}-${mesFiltro.mes}`,
          dividaId: d.id,
          nome: d.nome,
          valorParcela: d.valorParcela,
          numeroParcela,
          totalParcelas: d.totalParcelas,
        }];
      });
  }, [data.dividas, mesFiltro]);

  const totalDividas = data.dividas.reduce((a, d) => a + Math.max(0, d.valorTotal - calcularParcelasPagasAuto(d) * d.valorParcela), 0);
  const totalReservas = data.reservas.reduce((a, r) => a + r.valorAtual, 0);
  const totalMetaReservas = data.reservas.reduce((a, r) => a + r.metaReserva, 0);
  const totaisDespesasMes = useMemo(
    () => calcularTotaisDespesasMes(mesFiltro.mes, mesFiltro.ano, data.despesas, data.dividas, data.faturas ?? []),
    [data.despesas, data.dividas, data.faturas, mesFiltro.ano, mesFiltro.mes],
  );
  const itensPagarMes = useMemo(() => gerarItensPagarMes(mesFiltro.mes, mesFiltro.ano, data), [mesFiltro.mes, mesFiltro.ano, data]);
  const itensEmAberto = itensPagarMes.filter(item => !item.pago);
  const itensPagos = itensPagarMes.filter(item => item.pago);
  const despesasMes = itensPagarMes.reduce((acc, item) => acc + item.valor, 0);
  const saldoMes = receitasMes - despesasMes;
  const totalPagoMes = itensPagos.reduce((acc, item) => acc + item.valor, 0);
  const totalEmAbertoMes = itensEmAberto.reduce((acc, item) => acc + item.valor, 0);
  const aReceberMes = useMemo(() => calcularAReceberMes(mesFiltro.mes, mesFiltro.ano, data), [mesFiltro.mes, mesFiltro.ano, data]);
  const aReceberAcaoItem = modalAReceberAcao
    ? (data.aReceber ?? []).find(item => item.id === modalAReceberAcao.itemId)
    : null;
  const aReceberExcluirItem = modalExcluirAReceber
    ? (data.aReceber ?? []).find(item => item.id === modalExcluirAReceber.itemId)
    : null;
  const itensAReceberPendentes = aReceberMes.lista.filter(item => item.status === 'a_receber');
  const itensAReceberRecebidos = aReceberMes.lista.filter(item => item.status === 'recebido');
  const totalAReceberGeral = (data.aReceber ?? []).filter(item => item.status !== 'cancelado').length;
  const [mostrarAReceberRecebidos, setMostrarAReceberRecebidos] = useState(false);

  useEffect(() => {
    if (aba !== 'resumo') return;
    const hoje = new Date();
    const estaNoMesAtual = mesFiltro.mes === hoje.getMonth() && mesFiltro.ano === hoje.getFullYear();
    if (!estaNoMesAtual) {
      setPendenciasAnterior(null);
      return;
    }
    const pendencias = verificarPendenciasMesAnterior(mesFiltro.mes, mesFiltro.ano, data);
    if (pendencias.itens.length === 0) return;
    const key = `sgp-orcamento-pendencias-${pendencias.ano}-${pendencias.mes}`;
    if (localStorage.getItem(key) === 'visto') return;
    setPendenciasAnterior(pendencias);
  }, [aba, data, mesFiltro.ano, mesFiltro.mes]);

  const abrirModal = (tipo: string, item?: { id: string }) => {
    setEditandoId(item?.id ?? null);
    setModal(tipo);
  };

  const abrirModalFatura = (cartaoId: string, competencia: string) => {
    const faturas = data.faturas ?? [];
    const fatura = faturas.find(f => f.cartaoId === cartaoId && f.competencia === competencia);
    setModalFatura({ cartaoId, competencia });
    setFormFatura({
      valorInformado: fatura?.valorInformado ?? 0,
      observacoes: fatura?.observacoes ?? '',
    });
    setFormFaturaValorStr(fatura?.valorInformado ? moneyToInputBR(fatura.valorInformado) : '');
  };

  const salvarFatura = useCallback(() => {
    if (!modalFatura) return;
    const { cartaoId, competencia } = modalFatura;
    const valorFaturaFinal = parseBRLMoney(formFaturaValorStr);
    setData(d => {
      const resultado = ajustarFaturaCartao(d, cartaoId, competencia, valorFaturaFinal, formFatura.observacoes);
      if (resultado.aviso) setMsgOrcamento(resultado.aviso);
      return resultado.data;
    });
  }, [modalFatura, formFatura, formFaturaValorStr, setData]);

  const criarAjusteDiferenca = useCallback((fatura: FaturaCartao) => {
    setData(d => {
      const ajusteExistente = d.despesas.find(dep => dep.origemAjuste === true && dep.faturaId === fatura.id);
      let novasDespesas: Despesa[];
      if (ajusteExistente) {
        novasDespesas = d.despesas.map(dep =>
          dep.id === ajusteExistente.id ? { ...dep, valor: fatura.diferenca } : dep
        );
      } else {
        const novaDespesa: Despesa = {
          id: gerarId(),
          descricao: 'GASTO NÃO IDENTIFICADO',
          valor: fatura.diferenca,
          data: hojeISO(),
          categoria: 'Outros',
          formaPagamento: 'Cartão de crédito',
          recorrente: false,
          essencial: false,
          dataCriacao: hojeISO(),
          cartaoId: fatura.cartaoId,
          faturaId: fatura.id,
          origemAjuste: true,
          adjustmentCartaoId: fatura.cartaoId,
          adjustmentMes: fatura.mes,
          adjustmentAno: fatura.ano,
        };
        novasDespesas = [...d.despesas, novaDespesa];
      }
      const faturasAtual = (d.faturas ?? []).map(f =>
        f.id === fatura.id ? recalcularFatura(f, novasDespesas) : f
      );
      return { ...d, despesas: novasDespesas, faturas: faturasAtual };
    });
  }, [setData]);

  const alterarPagamentoMensal = useCallback((item: ItemPagar, pago: boolean) => {
    setData(d => pago
      ? marcarItemComoPago(d, item, mesFiltro.mes, mesFiltro.ano)
      : desfazerPagamentoItem(d, item, mesFiltro.mes, mesFiltro.ano));
  }, [mesFiltro.ano, mesFiltro.mes, setData]);

  const salvarAReceber = useCallback(() => {
    const valor = parseBRLMoney(formAReceberValorStr);
    const tipoRecebimento = formAReceber.tipoRecebimento ?? 'unico';
    const totalParcelas = Math.max(1, Number(formAReceber.totalParcelas ?? 1));
    const dataAtualizacao = hojeISO();
    const itemAtual = editandoId ? (data.aReceber ?? []).find(a => a.id === editandoId) : undefined;
    const grupoAtual = itemAtual?.grupoRecebimentoId
      ? (data.aReceber ?? []).filter(a => a.grupoRecebimentoId === itemAtual.grupoRecebimentoId)
      : itemAtual
        ? [itemAtual]
        : [];

    setErroAReceber('');

    const dividirEmParcelas = (valorTotal: number, quantidade: number) => {
      const totalCentavos = Math.round(valorTotal * 100);
      const centavosBase = Math.floor(totalCentavos / quantidade);
      const resto = totalCentavos % quantidade;
      return Array.from({ length: quantidade }, (_, index) => (centavosBase + (index < resto ? 1 : 0)) / 100);
    };

    if (editandoId && itemAtual?.grupoRecebimentoId && tipoRecebimento === 'unico' && grupoAtual.length > 1) {
      setErroAReceber('Este item faz parte de um recebimento parcelado. Para evitar parcelas órfãs, a conversão para única parcela foi bloqueada por enquanto.');
      return;
    }

    if (editandoId && itemAtual?.grupoRecebimentoId && tipoRecebimento === 'parcelado') {
      const existemParcelasRecebidas = grupoAtual.some(item => item.status === 'recebido' || item.receitaVinculadaId);
      const totalParcelasAtual = itemAtual.totalParcelas ?? grupoAtual.length;
      if (existemParcelasRecebidas && totalParcelas !== totalParcelasAtual) {
        setErroAReceber('Não é possível alterar o parcelamento porque já existem parcelas recebidas.');
        return;
      }
    }

    if (tipoRecebimento === 'unico' || totalParcelas === 1) {
      const registro: AReceber = {
        id: editandoId ?? gerarId(),
        ...formAReceber,
        tipoRecebimento: 'unico',
        valor,
        totalParcelas: undefined,
        parcelaAtual: undefined,
        grupoRecebimentoId: undefined,
        dataCriacao: editandoId
          ? itemAtual?.dataCriacao ?? dataAtualizacao
          : dataAtualizacao,
        dataAtualizacao,
      };
      setData(d => ({
        ...d,
        aReceber: editandoId
          ? (d.aReceber ?? []).map(a => a.id === editandoId ? registro : a)
          : [...(d.aReceber ?? []), registro],
      }));
    } else {
      const grupoRecebimentoId = itemAtual?.grupoRecebimentoId ?? gerarId();
      const valoresParcelas = dividirEmParcelas(valor, totalParcelas);
      const registros: AReceber[] = Array.from({ length: totalParcelas }, (_, index) => {
        const mesIndex = formAReceber.mes - 1 + index;
        const ano = formAReceber.ano + Math.floor(mesIndex / 12);
        const mes = (mesIndex % 12) + 1;
        const existente = grupoAtual.find(item => item.parcelaAtual === index + 1) ?? (index === 0 ? itemAtual : undefined);
        return {
          id: existente?.id ?? gerarId(),
          ...formAReceber,
          valor: valoresParcelas[index],
          mes,
          ano,
          status: existente?.status ?? (index === 0 ? formAReceber.status : 'a_receber'),
          tipoRecebimento: 'parcelado',
          grupoRecebimentoId,
          parcelaAtual: index + 1,
          totalParcelas,
          dataRecebimento: existente?.dataRecebimento,
          receitaVinculadaId: existente?.receitaVinculadaId,
          dataCriacao: existente?.dataCriacao ?? dataAtualizacao,
          dataAtualizacao,
        };
      });
      setData(d => {
        const idsSubstituidos = new Set([
          ...(itemAtual ? [itemAtual.id] : []),
          ...grupoAtual.map(item => item.id),
        ]);
        return {
          ...d,
          aReceber: [
            ...(d.aReceber ?? []).filter(item => !idsSubstituidos.has(item.id)),
            ...registros,
          ],
        };
      });
    }

    setModal(null);
    setEditandoId(null);
    setFormAReceber(novoFormAReceber(mesFiltro.mes + 1, mesFiltro.ano));
    setFormAReceberValorStr('');
    setErroAReceber('');
  }, [data.aReceber, editandoId, formAReceber, formAReceberValorStr, mesFiltro.ano, mesFiltro.mes, setData]);

  const excluirAReceber = useCallback((idsAReceber: string[], removerReceitasVinculadas: boolean) => {
    setData(d => {
      const itensRemovidos = (d.aReceber ?? []).filter(item => idsAReceber.includes(item.id));
      const receitasVinculadas = itensRemovidos
        .map(item => item.receitaVinculadaId)
        .filter((id): id is string => Boolean(id));
      const idsRemovidos = new Set(idsAReceber);
      const receitasSet = new Set(receitasVinculadas);
      return {
        ...d,
        aReceber: (d.aReceber ?? []).filter(item => !idsRemovidos.has(item.id)),
        receitas: removerReceitasVinculadas
          ? d.receitas.filter(receita => !receitasSet.has(receita.id))
          : d.receitas.map(receita => receitasSet.has(receita.id)
            ? {
              ...receita,
              aReceberOrigemId: undefined,
              parcelaAReceber: undefined,
              totalParcelasAReceber: undefined,
              statusAReceber: undefined,
            }
            : receita),
      };
    });
    setModalExcluirAReceber(null);
  }, [setData]);

  const salvarReceita = useCallback(() => {
    const valorFinal = parseBRLMoney(formReceitaValorStr);
    const mesReferencia = formReceita.mesReferencia ?? Number(formReceita.data.slice(5, 7));
    const anoReferencia = formReceita.anoReferencia ?? Number(formReceita.data.slice(0, 4));
    const baseReceita: FormReceita = {
      ...formReceita,
      valor: valorFinal,
      data: dataCompetencia(anoReferencia, mesReferencia),
      mesReferencia,
      anoReferencia,
    };

    setData(d => {
      if (editandoId) {
        const atual = d.receitas.find(r => r.id === editandoId);
        const recorrenciaId = atual?.recorrenciaId ?? baseReceita.recorrenciaId ?? null;
        return {
          ...d,
          receitas: d.receitas.map(r =>
            r.id === editandoId
              ? { ...r, ...baseReceita, recorrenciaId, data: dataCompetencia(baseReceita.anoReferencia!, baseReceita.mesReferencia!) }
              : r
          ),
        };
      }

      if (baseReceita.recorrente) {
        const recorrenciaId = crypto.randomUUID();
        const meses = mesesRecorrenciaReceita(baseReceita);
        const novas = meses
          .filter(({ mes, ano }) => !d.receitas.some(r =>
            r.recorrenciaId === recorrenciaId && r.mesReferencia === mes && r.anoReferencia === ano
          ))
          .map(({ mes, ano }) => ({
            id: gerarId(),
            ...baseReceita,
            data: dataCompetencia(ano, mes),
            mesReferencia: mes,
            anoReferencia: ano,
            recorrenciaId,
            dataCriacao: hojeISO(),
          }));
        return { ...d, receitas: [...d.receitas, ...novas] };
      }

      return {
        ...d,
        receitas: [
          ...d.receitas,
          {
            id: gerarId(),
            ...baseReceita,
            data: dataCompetencia(baseReceita.anoReferencia!, baseReceita.mesReferencia!),
            dataCriacao: hojeISO(),
          },
        ],
      };
    });
    setModal(null);
    setEditandoId(null);
    setFormReceita(novaReceitaForm());
    setFormReceitaValorStr('');
  }, [formReceita, formReceitaValorStr, editandoId, setData]);

  const salvarDespesa = useCallback(() => {
    const valorDespesa = parseBRLMoney(formDespesaValorStr);
    // Usar dia 1 do mês de referência como data interna da despesa
    const dataDoMes = `${formDespesaMesFatura}-01`;
    const formDespesaComValor = { ...formDespesa, valor: valorDespesa, data: dataDoMes };
    const isCartao = formDespesaComValor.formaPagamento === 'Cartão de crédito';
    const isParcelado = isCartao && formDespesaExtra.tipoCobrancaCartao === 'parcelado' && !editandoId;

    if (isParcelado) {
      const qtd = formDespesaExtra.quantidadeParcelas;
      const valorParcela = formDespesaComValor.valor / qtd;
      const grupoId = crypto.randomUUID();
      // Usar o mês de referência escolhido como início das parcelas
      const mesInicioEfetivo = formDespesaMesFatura;
      const [ano, mes] = mesInicioEfetivo.split('-').map(Number);
      const cartaoId = cartaoSelecionadoId || undefined;
      const cartao = cartaoId ? data.cartoes.find(c => c.id === cartaoId) : undefined;

      setData(d => {
        let faturasAtual = [...(d.faturas ?? [])];
        const novasDespesas: Despesa[] = Array.from({ length: qtd }, (_, i) => {
          const dt = new Date(ano, mes - 1 + i, 1);
          const dataStr = dt.toISOString().slice(0, 10);

          // Calcular competência de cada parcela
          let faturaId: string | undefined;
          if (cartaoId) {
            const competencia = obterCompetenciaFatura(dataStr, cartao?.diaFechamento);
            const { fatura, isNova } = obterOuCriarFatura(cartaoId, competencia, faturasAtual);
            if (isNova) faturasAtual = [...faturasAtual, fatura];
            faturaId = fatura.id;
          }

          return {
            id: gerarId(),
            descricao: `${formDespesaComValor.descricao} — Parcela ${i + 1}/${qtd}`,
            valor: valorParcela,
            data: dataStr,
            categoria: formDespesaComValor.categoria,
            formaPagamento: formDespesaComValor.formaPagamento,
            recorrente: false,
            essencial: formDespesaComValor.essencial,
            dataCriacao: hojeISO(),
            grupoParcelamentoId: grupoId,
            parcelaAtual: i + 1,
            quantidadeParcelas: qtd,
            tipoCobrancaCartao: 'parcelado' as const,
            cartaoId,
            faturaId,
            mesInicioCobranca: formDespesaExtra.mesInicioParcelas,
          };
        });

        // Recalcular todas as faturas afetadas
        const todasDespesas = [...d.despesas, ...novasDespesas];
        faturasAtual = faturasAtual.map(f => recalcularFatura(f, todasDespesas));

        return { ...d, despesas: todasDespesas, faturas: faturasAtual };
      });
    } else if (!editandoId && formDespesaComValor.recorrente) {
      // Gera despesa do mês atual + próximos 11 meses (total 12)
      setData(d => {
        const dataBase = new Date(formDespesaComValor.data + 'T12:00:00');
        const cartaoId = isCartao && cartaoSelecionadoId ? cartaoSelecionadoId : undefined;
        const cartao = cartaoId ? d.cartoes.find(c => c.id === cartaoId) : undefined;
        let faturasAtual = [...(d.faturas ?? [])];
        const novasDespesas: Despesa[] = [];
        for (let i = 0; i < 12; i++) {
          const dt = new Date(dataBase);
          dt.setMonth(dt.getMonth() + i);
          const dataStr = dt.toISOString().slice(0, 10);
          const mesDt = dt.getMonth();
          const anoDt = dt.getFullYear();
          // Verificar duplicata: mesma descrição, recorrente, mesmo mês/ano
          const jaExiste = d.despesas.some(dep =>
            dep.recorrente === true &&
            dep.descricao === formDespesaComValor.descricao &&
            new Date(dep.data).getMonth() === mesDt &&
            new Date(dep.data).getFullYear() === anoDt
          );
          if (!jaExiste) {
            let faturaId: string | undefined;
            if (cartaoId) {
              const competencia = obterCompetenciaFatura(dataStr, cartao?.diaFechamento);
              const { fatura, isNova } = obterOuCriarFatura(cartaoId, competencia, faturasAtual);
              if (isNova) faturasAtual = [...faturasAtual, fatura];
              faturaId = fatura.id;
            }
            novasDespesas.push({
              id: gerarId(),
              ...formDespesaComValor,
              data: dataStr,
              dataCriacao: hojeISO(),
              cartaoId,
              faturaId,
              tipoCobrancaCartao: isCartao ? 'avista' : undefined,
            });
          }
        }
        const todasDespesas = [...d.despesas, ...novasDespesas];
        faturasAtual = faturasAtual.map(f => recalcularFatura(f, todasDespesas));
        return { ...d, despesas: todasDespesas, faturas: faturasAtual };
      });
    } else {
      setData(d => {
        if (editandoId) {
          const depAtual = d.despesas.find(dep => dep.id === editandoId);
          // Se for cartão de crédito, atualizar faturaId conforme mês da fatura selecionado
          let faturasAtual = [...(d.faturas ?? [])];
          let faturaIdEditado = depAtual?.faturaId;
          if (formDespesaComValor.formaPagamento === 'Cartão de crédito' && cartaoSelecionadoId) {
            const { fatura, isNova } = obterOuCriarFatura(cartaoSelecionadoId, formDespesaMesFatura, faturasAtual);
            if (isNova) faturasAtual = [...faturasAtual, fatura];
            faturaIdEditado = fatura.id;
          }
          const despesasAtual = d.despesas.map(dep =>
            dep.id === editandoId
              ? { ...dep, ...formDespesaComValor, cartaoId: cartaoSelecionadoId || depAtual?.cartaoId, faturaId: faturaIdEditado, grupoParcelamentoId: depAtual?.grupoParcelamentoId, parcelaAtual: depAtual?.parcelaAtual, quantidadeParcelas: depAtual?.quantidadeParcelas }
              : dep
          );
          const faturasRecalculadas = faturasAtual.map(f => recalcularFatura(f, despesasAtual));
          return { ...d, despesas: despesasAtual, faturas: faturasRecalculadas };
        }
        // Nova despesa à vista com cartão
        const cartaoId = isCartao && cartaoSelecionadoId ? cartaoSelecionadoId : undefined;
        let faturasAtual = [...(d.faturas ?? [])];
        let faturaId: string | undefined;

        if (cartaoId) {
          // Usar diretamente o mês de referência escolhido pelo usuário como competência da fatura
          const { fatura, isNova } = obterOuCriarFatura(cartaoId, formDespesaMesFatura, faturasAtual);
          if (isNova) faturasAtual = [...faturasAtual, fatura];
          faturaId = fatura.id;
        }

        const novaDespesa: Despesa = {
          id: gerarId(),
          ...formDespesaComValor,
          dataCriacao: hojeISO(),
          cartaoId,
          faturaId,
          tipoCobrancaCartao: isCartao ? 'avista' : undefined,
        };

        const todasDespesas = [...d.despesas, novaDespesa];
        faturasAtual = faturasAtual.map(f => recalcularFatura(f, todasDespesas));

        return { ...d, despesas: todasDespesas, faturas: faturasAtual };
      });
    }
    setModal(null);
    setEditandoId(null);
    setCartaoSelecionadoId('');
    setFormDespesa({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Alimentação', formaPagamento: 'PIX', recorrente: false, essencial: true });
    setFormDespesaValorStr('');
    setFormDespesaMesFatura(hojeISO().slice(0, 7));
    setFormDespesaExtra({ tipoCobrancaCartao: 'avista', quantidadeParcelas: 2, mesInicioParcelas: hojeISO().slice(0, 7) });
  }, [formDespesa, formDespesaValorStr, formDespesaMesFatura, formDespesaExtra, editandoId, cartaoSelecionadoId, setData]);

  // Chamado pelo botão Salvar do modal de despesa
  const handleSalvarDespesa = useCallback(() => {
    if (editandoId) {
      const depAtual = data.despesas.find(d => d.id === editandoId);
      if (depAtual?.grupoParcelamentoId) {
        // Tem grupo: perguntar escopo antes de salvar
        setModalEscopoParcela({ despesaId: editandoId, grupoId: depAtual.grupoParcelamentoId });
        return;
      }
    }
    salvarDespesa();
  }, [editandoId, data.despesas, salvarDespesa]);

  // Aplicar edição a parcelas futuras do mesmo grupo
  const aplicarEdicaoFuturas = useCallback((escopo: 'esta' | 'futuras') => {
    setModalEscopoParcela(null);
    if (escopo === 'esta') {
      salvarDespesa();
      return;
    }
    // Atualiza esta parcela + todas as futuras do mesmo grupo
    setData(d => {
      const depAtual = d.despesas.find(dep => dep.id === editandoId);
      if (!depAtual || !depAtual.grupoParcelamentoId) return d;
      const parcelaAtual = depAtual.parcelaAtual ?? 0;
      const despesasAtualizadas = d.despesas.map(dep => {
        if (dep.grupoParcelamentoId !== depAtual.grupoParcelamentoId) return dep;
        if ((dep.parcelaAtual ?? 0) < parcelaAtual) return dep; // anteriores: não muda
        // Esta e futuras: atualiza valor, categoria, essencial (mantém descrição com número da parcela)
        // formDespesaValorStr já contém o valor da parcela (não o total), não dividir novamente
        return {
          ...dep,
          valor: parseBRLMoney(formDespesaValorStr),
          categoria: formDespesa.categoria,
          essencial: formDespesa.essencial,
        };
      });
      const faturasAtualizadas = (d.faturas ?? []).map(f => recalcularFatura(f, despesasAtualizadas));
      return {
        ...d,
        despesas: despesasAtualizadas,
        faturas: faturasAtualizadas,
      };
    });
    setModal(null);
    setEditandoId(null);
    setCartaoSelecionadoId('');
    setFormDespesa({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Alimentação', formaPagamento: 'PIX', recorrente: false, essencial: true });
    setFormDespesaValorStr('');
    setFormDespesaMesFatura(hojeISO().slice(0, 7));
    setFormDespesaExtra({ tipoCobrancaCartao: 'avista', quantidadeParcelas: 2, mesInicioParcelas: hojeISO().slice(0, 7) });
  }, [editandoId, formDespesa, formDespesaValorStr, salvarDespesa, setData]);

  const salvarCartao = useCallback(() => {
    const cartaoComValor = {
      ...formCartao,
      limite: parseBRLMoney(formCartaoLimiteStr),
      faturaAtual: parseBRLMoney(formCartaoFaturaStr),
    };
    setData(d => ({
      ...d,
      cartoes: editandoId
        ? d.cartoes.map(c => c.id === editandoId ? { ...c, ...cartaoComValor } : c)
        : [...d.cartoes, { id: gerarId(), ...cartaoComValor, dataCriacao: hojeISO() }],
    }));
    setModal(null);
  }, [formCartao, formCartaoLimiteStr, formCartaoFaturaStr, editandoId, setData]);

  const salvarDivida = useCallback(() => {
    const dividaComValor = {
      ...formDivida,
      valorTotal: parseBRLMoney(formDividaTotalStr),
      valorParcela: parseBRLMoney(formDividaParcelaStr),
    };
    setData(d => ({
      ...d,
      dividas: editandoId
        ? d.dividas.map(div => div.id === editandoId ? { ...div, ...dividaComValor } : div)
        : [...d.dividas, { id: gerarId(), ...dividaComValor, dataCriacao: hojeISO() }],
    }));
    setModal(null);
  }, [formDivida, formDividaTotalStr, formDividaParcelaStr, editandoId, setData]);

  const salvarReserva = useCallback(() => {
    const reservaComValor = {
      ...formReserva,
      metaReserva: parseBRLMoney(formReservaMetaStr),
      valorAtual: parseBRLMoney(formReservaAtualStr),
    };
    setData(d => ({
      ...d,
      reservas: editandoId
        ? d.reservas.map(r => r.id === editandoId ? { ...r, ...reservaComValor } : r)
        : [...d.reservas, { id: gerarId(), ...reservaComValor, dataCriacao: hojeISO() }],
    }));
    setModal(null);
  }, [formReserva, formReservaMetaStr, formReservaAtualStr, editandoId, setData]);

  const salvarBem = useCallback(() => {
    const bemComValor = {
      ...formBem,
      valorEstimado: parseBRLMoney(formBemValorStr),
    };
    setData(d => ({
      ...d,
      bens: editandoId
        ? d.bens.map(b => b.id === editandoId ? { ...b, ...bemComValor } : b)
        : [...d.bens, { id: gerarId(), ...bemComValor, dataCriacao: hojeISO() }],
    }));
    setModal(null);
  }, [formBem, formBemValorStr, editandoId, setData]);

  const renderAReceberItem = (item: AReceber) => (
    <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-surface-200 p-3 dark:border-surface-700 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="mobile-clamp-2 text-sm font-medium text-surface-900 dark:text-white">{item.descricao}</p>
        <p className="mobile-text text-xs text-surface-400">
          {item.pessoa} · {item.status}
          {item.tipoRecebimento === 'parcelado' && item.parcelaAtual && item.totalParcelas ? ` · parcela ${item.parcelaAtual}/${item.totalParcelas}` : ''}
          {item.diaPrevisto ? ` · dia ${item.diaPrevisto}` : ''}
        </p>
      </div>
      <div className="action-row-responsive sm:w-auto sm:flex-nowrap sm:justify-end">
        <span className="money-responsive-sm font-semibold text-primary-600 dark:text-primary-400">{formatarDinheiro(item.valor)}</span>
        <button onClick={() => {
          const grupo = item.grupoRecebimentoId
            ? (data.aReceber ?? [])
              .filter(a => a.grupoRecebimentoId === item.grupoRecebimentoId)
              .sort((a, b) => (a.parcelaAtual ?? 0) - (b.parcelaAtual ?? 0))
            : [];
          const primeiraParcela = grupo[0] ?? item;
          const valorTotalGrupo = grupo.length > 0
            ? grupo.reduce((total, parcela) => total + parcela.valor, 0)
            : item.valor;
          setEditandoId(item.id);
          setFormAReceber({
            pessoa: item.pessoa,
            descricao: item.descricao,
            valor: valorTotalGrupo,
            mes: primeiraParcela.mes,
            ano: primeiraParcela.ano,
            diaPrevisto: primeiraParcela.diaPrevisto,
            formaPrevista: primeiraParcela.formaPrevista,
            observacao: item.observacao,
            status: item.status,
            dataRecebimento: item.dataRecebimento,
            receitaVinculadaId: item.receitaVinculadaId,
            tipoRecebimento: item.tipoRecebimento ?? 'unico',
            grupoRecebimentoId: item.grupoRecebimentoId,
            parcelaAtual: item.parcelaAtual,
            totalParcelas: item.totalParcelas ?? (grupo.length > 0 ? grupo.length : undefined),
          });
          setFormAReceberValorStr(moneyToInputBR(valorTotalGrupo));
          setErroAReceber('');
          setModal('aReceber');
        }} className="p-1.5 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
        <button
          onClick={() => setModalExcluirAReceber({ itemId: item.id })}
          className="p-1.5 rounded text-surface-400 hover:text-danger-600 transition-colors"
          title="Excluir"
        >
          <Trash2 size={13} />
        </button>
        <Button
          size="sm"
          variant={item.status === 'recebido' ? 'secondary' : 'success'}
          icon={item.status === 'recebido' ? <RotateCcw size={13} /> : <CheckCircle size={13} />}
          onClick={() => {
            setModalAReceberAcao({ itemId: item.id, tipo: item.status === 'recebido' ? 'desfazer' : 'receber' });
          }}
        >
          {item.status === 'recebido' ? 'Desfazer' : 'Recebido'}
        </Button>
      </div>
    </div>
  );

  const tabs: { id: Aba; label: string }[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'receitas', label: 'Receitas' },
    { id: 'despesas', label: 'Despesas' },
    { id: 'cartoes', label: 'Cartões' },
    { id: 'dividas', label: 'Dívidas' },
    { id: 'reserva', label: 'Reserva' },
    { id: 'bens', label: 'Bens' },
    { id: 'aReceber', label: 'A Receber' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">Orçamento</h2>
        <p className="text-sm text-surface-500 dark:text-surface-400">Seu dinheiro está te aproximando ou afastando das suas metas?</p>
      </div>

      {/* Seletor de mês */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setMesFiltro(m => {
            if (m.mes === 0) return { mes: 11, ano: m.ano - 1 };
            return { mes: m.mes - 1, ano: m.ano };
          })}
          className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-surface-700 dark:text-surface-300 min-w-[140px] text-center">
          {MESES[mesFiltro.mes]} {mesFiltro.ano}
        </span>
        <button
          onClick={() => setMesFiltro(m => {
            if (m.mes === 11) return { mes: 0, ano: m.ano + 1 };
            return { mes: m.mes + 1, ano: m.ano };
          })}
          className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setAba(tab.id)}
            className={`min-h-11 flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${aba === tab.id ? 'bg-primary-600 text-white' : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* RESUMO */}
      {aba === 'resumo' && (
        <div className="space-y-4 animate-fade-in">
          {msgOrcamento && (
            <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:border-warning-800 dark:bg-warning-900/20 dark:text-warning-300">
              {msgOrcamento}
            </div>
          )}
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Receitas do mês', valor: receitasMes, icon: <TrendingUp size={18} />, cor: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/20' },
              { label: 'Despesas do mês', valor: despesasMes, icon: <TrendingDown size={18} />, cor: 'text-danger-600 dark:text-danger-400', bg: 'bg-danger-50 dark:bg-danger-900/20' },
              { label: 'Total de dívidas', valor: totalDividas, icon: <AlertTriangle size={18} />, cor: 'text-warning-600 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-warning-900/20' },
              { label: 'Reserva atual', valor: totalReservas, icon: <PiggyBank size={18} />, cor: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20' },
            ].map(item => (
              <Card key={item.label}>
                <CardBody className="min-h-[132px] p-4 overflow-hidden">
                  <div className={`w-9 h-9 rounded-lg ${item.bg} ${item.cor} flex items-center justify-center mb-3`}>{item.icon}</div>
                  <p className={`money-responsive font-bold ${item.cor}`} title={formatarDinheiro(item.valor)}>{formatarDinheiro(item.valor)}</p>
                  <p className="mobile-clamp-2 text-xs text-surface-500 dark:text-surface-400 mt-0.5" title={item.label}>{item.label}</p>
                </CardBody>
              </Card>
            ))}
          </div>

          <Card>
            <CardBody>
              <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Saldo do mês</span>
                <span className={`money-responsive font-bold ${saldoMes >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                  {formatarDinheiro(saldoMes)}
                </span>
              </div>
              <ProgressBar value={receitasMes > 0 ? Math.min(100, (despesasMes / receitasMes) * 100) : 0} color={despesasMes / receitasMes > 0.9 ? 'danger' : 'primary'} height="md" />
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                {receitasMes > 0 ? `${Math.round((despesasMes / receitasMes) * 100)}% da renda comprometida` : 'Sem receitas cadastradas este mês'}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="grid grid-cols-1 min-[390px]:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-surface-400">A receber</p>
                  <p className="money-responsive-sm font-bold text-primary-600 dark:text-primary-400">{formatarDinheiro(aReceberMes.totalAReceber)}</p>
                </div>
                <div>
                  <p className="text-xs text-surface-400">Recebido</p>
                  <p className="money-responsive-sm font-bold text-success-600 dark:text-success-400">{formatarDinheiro(aReceberMes.totalRecebido)}</p>
                </div>
                <div>
                  <p className="text-xs text-surface-400">Em aberto</p>
                  <p className="money-responsive-sm font-bold text-warning-600 dark:text-warning-400">{formatarDinheiro(aReceberMes.totalEmAberto)}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contas do mês" icon={<CheckCircle size={18} />} />
            <CardBody>
              <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg bg-danger-50 dark:bg-danger-900/20 px-3 py-2">
                  <p className="text-xs text-danger-600 dark:text-danger-300">Em aberto</p>
                  <p className="money-responsive-sm font-bold text-danger-700 dark:text-danger-200">{formatarDinheiro(totalEmAbertoMes)}</p>
                </div>
                <div className="rounded-lg bg-success-50 dark:bg-success-900/20 px-3 py-2">
                  <p className="text-xs text-success-600 dark:text-success-300">Pago</p>
                  <p className="money-responsive-sm font-bold text-success-700 dark:text-success-200">{formatarDinheiro(totalPagoMes)}</p>
                </div>
              </div>

              {itensPagarMes.length === 0 ? (
                <p className="text-center py-6 text-surface-400">Nenhuma conta para pagar em {MESES[mesFiltro.mes]} {mesFiltro.ano}</p>
              ) : (
                <div className="space-y-4">
                  {[
                    { titulo: 'Em aberto', itens: itensEmAberto },
                    ...(mostrarContasPagas ? [{ titulo: 'Pago', itens: itensPagos }] : []),
                  ].map(grupo => (
                    <div key={grupo.titulo} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-surface-400">{grupo.titulo}</h4>
                        <span className="text-xs text-surface-400">{grupo.itens.length} item{grupo.itens.length === 1 ? '' : 's'}</span>
                      </div>
                      {grupo.itens.length === 0 ? (
                        <p className="text-xs text-surface-400">Nenhum item.</p>
                      ) : grupo.itens.map(item => (
                        <div key={`${item.tipo}-${item.id}`} className="flex flex-col gap-3 rounded-xl border border-surface-200 p-3 dark:border-surface-700 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="mobile-clamp-2 text-sm font-medium text-surface-900 dark:text-white" title={item.descricao}>{item.descricao}</p>
                            <p className="mobile-text text-xs text-surface-400 dark:text-surface-500">{item.origemLabel} · {item.tipo}</p>
                          </div>
                          <div className="action-row-responsive sm:w-auto sm:flex-nowrap sm:justify-end">
                            <span className={`money-responsive-sm font-semibold ${item.pago ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>{formatarDinheiro(item.valor)}</span>
                            {item.tipo === 'fatura' && item.cartaoId && item.competencia && (
                              <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" icon={<Info size={13} />} onClick={() => abrirModalFatura(item.cartaoId!, item.competencia!)}>
                                Ajustar
                              </Button>
                            )}
                            {item.pago ? (
                              <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" icon={<RotateCcw size={13} />} onClick={() => alterarPagamentoMensal(item, false)}>
                                Desfazer
                              </Button>
                            ) : (
                              <Button size="sm" variant="success" className="flex-1 sm:flex-none" icon={<CheckCircle size={13} />} onClick={() => alterarPagamentoMensal(item, true)}>
                                Pago
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {itensPagos.length > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => setMostrarContasPagas(v => !v)}
                    >
                      {mostrarContasPagas ? `Ocultar pagos (${itensPagos.length})` : `Mostrar pagos (${itensPagos.length})`}
                    </Button>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {totalMetaReservas > 0 && (
            <Card>
              <CardHeader title="Progresso das Reservas" icon={<PiggyBank size={18} />} />
              <CardBody>
                {data.reservas.map(r => (
                  <div key={r.id} className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-surface-700 dark:text-surface-300">{r.nome}</span>
                      <span className="text-surface-500">{formatarDinheiro(r.valorAtual)} / {formatarDinheiro(r.metaReserva)}</span>
                    </div>
                    <ProgressBar value={(r.valorAtual / r.metaReserva) * 100} showLabel height="md" />
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* RECEITAS */}
      {aba === 'receitas' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => { setFormReceita(novaReceitaForm()); setFormReceitaValorStr(''); abrirModal('receita'); }}>
              Nova Receita
            </Button>
          </div>
          <Card>
            <CardBody className="!px-4 !pb-4">
              {receitasFiltradas.length === 0 ? (
                <p className="text-center py-8 text-surface-400">Nenhuma receita em {MESES[mesFiltro.mes]} {mesFiltro.ano}</p>
              ) : (
                <div className="space-y-2">
                  {receitasFiltradas.map(r => (
                    <div key={r.id} className="flex flex-col gap-3 p-3 rounded-xl border border-surface-200 dark:border-surface-700 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-success-50 dark:bg-success-900/20 flex items-center justify-center">
                          <TrendingUp size={14} className="text-success-600 dark:text-success-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="mobile-clamp-2 text-sm font-medium text-surface-900 dark:text-white" title={r.descricao}>{r.descricao}</p>
                          <p className="mobile-text text-xs text-surface-400 dark:text-surface-500">
                            Ref.: {MESES[(r.mesReferencia ?? Number(r.data.slice(5, 7))) - 1]} {r.anoReferencia ?? Number(r.data.slice(0, 4))} · {r.categoria}{r.recorrente ? ' · Recorrente' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="action-row-responsive sm:w-auto sm:flex-nowrap sm:justify-end">
                        <span className="money-responsive-sm font-semibold text-success-600 dark:text-success-400">{formatarDinheiro(r.valor)}</span>
                        <button onClick={() => { setFormReceita({ descricao: r.descricao, valor: r.valor, data: dataCompetencia(r.anoReferencia ?? Number(r.data.slice(0, 4)), r.mesReferencia ?? Number(r.data.slice(5, 7))), mesReferencia: r.mesReferencia ?? Number(r.data.slice(5, 7)), anoReferencia: r.anoReferencia ?? Number(r.data.slice(0, 4)), categoria: r.categoria, recorrente: r.recorrente, recorrenciaId: r.recorrenciaId ?? null, recorrenciaTemTermino: r.recorrenciaTemTermino ?? false, recorrenciaMesTermino: r.recorrenciaMesTermino ?? null, recorrenciaAnoTermino: r.recorrenciaAnoTermino ?? null }); setFormReceitaValorStr(moneyToInputBR(r.valor)); abrirModal('receita', r); }} className="p-1.5 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setData(d => ({ ...d, receitas: d.receitas.filter(x => x.id !== r.id) }))} className="p-1.5 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* DESPESAS */}
      {aba === 'despesas' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            {canCreateExpense(perfil) && (
              <Button icon={<Plus size={16} />} onClick={() => { setFormDespesa({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Alimentação', formaPagamento: 'PIX', recorrente: false, essencial: true }); setFormDespesaValorStr(''); setFormDespesaMesFatura(hojeISO().slice(0, 7)); setFormDespesaExtra({ tipoCobrancaCartao: 'avista', quantidadeParcelas: 2, mesInicioParcelas: hojeISO().slice(0, 7) }); abrirModal('despesa'); }}>
                Nova Despesa
              </Button>
            )}
          </div>
          {(despesasFiltradas.length > 0 || parcelasDividasNoMes.length > 0) && (() => {
            const countTotal = despesasFiltradas.length + parcelasDividasNoMes.length;
            return (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
                <span className="text-sm text-surface-500 dark:text-surface-400">
                  {countTotal} {countTotal === 1 ? 'despesa' : 'despesas'} em {MESES[mesFiltro.mes]} {mesFiltro.ano}
                </span>
                <div className="flex flex-col sm:items-end gap-0.5">
                  <span className="text-xs text-surface-400 dark:text-surface-500">
                    Gastos desse mês ({totaisDespesasMes.quantidadeGastos}): <span className="font-semibold text-danger-600 dark:text-danger-400">{formatarDinheiro(totaisDespesasMes.gastosDesseMes)}</span>
                  </span>
                  {totaisDespesasMes.quantidadeParcelasCartao > 0 && (
                    <span className="text-xs text-surface-400 dark:text-surface-500">
                      Parcelas cartão ({totaisDespesasMes.quantidadeParcelasCartao}): <span className="font-semibold text-warning-600 dark:text-warning-400">{formatarDinheiro(totaisDespesasMes.parcelasCartao)}</span>
                    </span>
                  )}
                  {totaisDespesasMes.quantidadeEmprestimos > 0 && (
                    <span className="text-xs text-surface-400 dark:text-surface-500">
                      Empréstimos ({totaisDespesasMes.quantidadeEmprestimos}): <span className="font-semibold text-amber-600 dark:text-amber-400">{formatarDinheiro(totaisDespesasMes.emprestimos)}</span>
                    </span>
                  )}
                  <span className="text-base font-bold text-danger-600 dark:text-danger-400">
                    Total: {formatarDinheiro(totaisDespesasMes.total)}
                  </span>
                </div>
              </div>
            );
          })()}
          <Card>
            <CardBody className="!px-4 !pb-4">
              {despesasFiltradas.length === 0 && parcelasDividasNoMes.length === 0 ? (
                <p className="text-center py-8 text-surface-400">Nenhuma despesa em {MESES[mesFiltro.mes]} {mesFiltro.ano}</p>
              ) : (
                <div className="space-y-2">
                  {despesasFiltradas.map(d => {
                    const isCartaoCredito = d.formaPagamento === 'Cartão de crédito';
                    const cartaoDespesa = isCartaoCredito && d.cartaoId ? data.cartoes.find(c => c.id === d.cartaoId) : undefined;
                    const destaqueCartao = corCartao(cartaoDespesa);
                    return (
                    <div
                      key={d.id}
                      className={`flex flex-col gap-3 p-3 rounded-xl border sm:flex-row sm:items-center sm:justify-between ${isCartaoCredito ? 'border-l-4 border-primary-200 bg-primary-50/60 dark:border-primary-800 dark:bg-primary-950/20' : 'border-surface-200 dark:border-surface-700'}`}
                      style={isCartaoCredito ? { borderLeftColor: destaqueCartao } : undefined}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center ${isCartaoCredito ? 'text-xs font-bold' : d.essencial ? 'bg-surface-100 dark:bg-surface-700' : 'bg-warning-50 dark:bg-warning-900/20'}`}
                          style={isCartaoCredito ? { backgroundColor: `${destaqueCartao}20`, color: destaqueCartao } : undefined}
                        >
                          {isCartaoCredito ? iconeCartao(cartaoDespesa) : <TrendingDown size={14} className="text-danger-600 dark:text-danger-400" />}
                        </div>
                        <div className="min-w-0">
                          <p className="mobile-clamp-2 text-sm font-medium text-surface-900 dark:text-white" title={d.descricao}>{d.descricao}</p>
                          <p className="mobile-text text-xs text-surface-400 dark:text-surface-500">
                            {formatarData(d.data)} · {d.categoria} · {d.formaPagamento}
                            {cartaoDespesa && ` · ${cartaoDespesa.banco ? `${cartaoDespesa.banco} • ` : ''}${cartaoDespesa.nome}`}
                            {!d.essencial && ' · Não essencial'}
                            {d.recorrente && ' · Recorrente'}
                          </p>
                          {isCartaoCredito && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <span
                                className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                                style={{ backgroundColor: `${destaqueCartao}20`, color: destaqueCartao }}
                              >
                                Cartão: {cartaoDespesa ? `${cartaoDespesa.banco ? `${cartaoDespesa.banco} • ` : ''}${cartaoDespesa.nome}` : 'não vinculado'}
                              </span>
                              {d.faturaId && <span className="px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-[10px] font-medium">Compõe fatura do cartão</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="action-row-responsive sm:w-auto sm:flex-nowrap sm:justify-end">
                        <span className="money-responsive-sm font-semibold text-danger-600 dark:text-danger-400">{formatarDinheiro(d.valor)}</span>
                        {canEditExpense(perfil) && (
                          <button onClick={() => {
                            setFormDespesa({ descricao: d.descricao, valor: d.valor, data: d.data, categoria: d.categoria, formaPagamento: d.formaPagamento, recorrente: d.recorrente, essencial: d.essencial });
                            setFormDespesaValorStr(moneyToInputBR(d.valor));
                            setCartaoSelecionadoId(d.cartaoId ?? '');
                            // Popular mês da fatura para edição de cartão
                            if (d.formaPagamento === 'Cartão de crédito' && d.faturaId) {
                              const fat = (data.faturas ?? []).find(f => f.id === d.faturaId);
                              setFormDespesaMesFatura(fat?.competencia ?? hojeISO().slice(0, 7));
                            } else {
                              setFormDespesaMesFatura(d.data.slice(0, 7));
                            }
                            abrirModal('despesa', d);
                          }} className="p-1.5 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                        )}
                        {canDeleteExpense(perfil) && (
                          <button onClick={() => setData(prev => removerDespesa(prev, d.id))} className="p-1.5 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                  {parcelasDividasNoMes.length > 0 && (
                    <>
                      {despesasFiltradas.length > 0 && <div className="border-t border-surface-100 dark:border-surface-700 my-1" />}
                      <p className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wide px-1 pt-1">Empréstimos e dívidas (automático)</p>
                      {parcelasDividasNoMes.map(p => (
                        <div key={p.virtualId} className="flex flex-col gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/40 dark:border-amber-700/50 dark:bg-amber-900/10 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                              <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="mobile-clamp-2 text-sm font-medium text-surface-900 dark:text-white">{p.nome}</p>
                              <p className="mobile-text text-xs text-surface-400 dark:text-surface-500">
                                Parcela {p.numeroParcela}/{p.totalParcelas} · Dívidas · Débito
                                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-medium">Automático</span>
                              </p>
                            </div>
                          </div>
                          <span className="money-responsive-sm font-semibold text-danger-600 dark:text-danger-400">{formatarDinheiro(p.valorParcela)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* CARTÕES */}
      {aba === 'cartoes' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => { setFormCartao(novoCartaoForm()); setFormCartaoLimiteStr(''); setFormCartaoFaturaStr(''); abrirModal('cartao'); }}>
              Novo Cartão
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.cartoes.map(c => {
              const destaqueCartao = corCartao(c);
              return (
              <Card key={c.id} className="overflow-hidden">
                <CardBody>
                  <div className="h-1 -mx-5 mb-4" style={{ backgroundColor: destaqueCartao }} />
                  <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: `${destaqueCartao}20`, color: destaqueCartao }}
                      >
                        {iconeCartao(c)}
                      </div>
                      <div className="min-w-0">
                        <p className="mobile-clamp-2 font-semibold text-surface-900 dark:text-white text-sm">{c.nome}</p>
                        <p className="mobile-text text-xs text-surface-400">{c.banco ? `${c.banco} · ` : ''}Vence dia {c.vencimento}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setFormCartao({ nome: c.nome, banco: c.banco ?? '', cor: corCartao(c), icone: c.icone ?? '', limite: c.limite, faturaAtual: c.faturaAtual, vencimento: c.vencimento, status: c.status, diaFechamento: c.diaFechamento }); setFormCartaoLimiteStr(moneyToInputBR(c.limite)); setFormCartaoFaturaStr(moneyToInputBR(c.faturaAtual)); abrirModal('cartao', c); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => setData(d => ({ ...d, cartoes: d.cartoes.filter(x => x.id !== c.id) }))} className="p-1 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <span className="px-2 py-1 rounded-full text-[10px] font-semibold" style={{ backgroundColor: `${destaqueCartao}20`, color: destaqueCartao }}>
                      {iconeCartao(c)} · {c.banco || c.nome}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-surface-100 text-[10px] font-medium text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                      {c.status}
                    </span>
                  </div>
                  {(() => {
                    const faturasMesAtual = (data.faturas ?? []).filter(f => f.cartaoId === c.id && f.competencia === competenciaMesFiltro);
                    const faturaAtualMes = faturasMesAtual[0];
                    const valorEfetivo = faturaAtualMes ? calcularValorEfetivo(faturaAtualMes) : c.faturaAtual;
                    const itemFatura = faturaAtualMes ? itensPagarMes.find(item => item.tipo === 'fatura' && item.faturaId === faturaAtualMes.id) : undefined;
                    const limiteUsado = calcularLimiteUsadoCartao(c.id, data);
                    const limiteDisponivel = calcularLimiteDisponivelCartao(c.id, c.limite, data);
                    const usarLimite = c.limite > 0;
                    return (
                      <div className="space-y-2">
                        <div className="flex flex-col gap-1 text-sm min-[390px]:flex-row min-[390px]:justify-between">
                          <span className="text-surface-500">Fatura {MESES[mesFiltro.mes]}</span>
                          <span className="money-responsive-sm font-semibold text-danger-600 dark:text-danger-400">{formatarDinheiro(valorEfetivo)}</span>
                        </div>
                        {faturaAtualMes && (
                          <>
                            <div className="flex flex-col gap-0.5 text-xs text-surface-400 min-[390px]:flex-row min-[390px]:justify-between">
                              <span>Já detalhado</span>
                              <span>{formatarDinheiro(faturaAtualMes.valorDetalhado)}</span>
                            </div>
                            {faturaAtualMes.valorInformado !== null && faturaAtualMes.diferenca !== 0 && (
                              <div className={`flex flex-col gap-0.5 text-xs min-[390px]:flex-row min-[390px]:justify-between ${faturaAtualMes.diferenca > 0 ? 'text-warning-500' : 'text-danger-500'}`}>
                                <span>Diferença</span>
                                <span>{formatarDinheiro(Math.abs(faturaAtualMes.diferenca))}{faturaAtualMes.diferenca < 0 ? ' (excede!)' : ''}</span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex flex-col gap-1 text-sm min-[390px]:flex-row min-[390px]:justify-between">
                          <span className="text-surface-500">Limite</span>
                          <span className="money-responsive-sm text-surface-700 dark:text-surface-300">{formatarDinheiro(c.limite)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 text-xs text-surface-400 min-[390px]:flex-row min-[390px]:justify-between">
                          <span>Usado: {formatarDinheiro(limiteUsado)}</span>
                          <span>Disponível: {formatarDinheiro(limiteDisponivel)}</span>
                        </div>
                        {usarLimite && <ProgressBar value={(limiteUsado / c.limite) * 100} color={limiteUsado / c.limite > 0.8 ? 'danger' : limiteUsado / c.limite > 0.5 ? 'warning' : 'success'} showLabel height="md" />}
                        {itemFatura && (
                          <Button
                            size="sm"
                            variant={itemFatura.pago ? 'secondary' : 'success'}
                            icon={itemFatura.pago ? <RotateCcw size={13} /> : <CheckCircle size={13} />}
                            className="w-full"
                            onClick={() => alterarPagamentoMensal(itemFatura, !itemFatura.pago)}
                          >
                            {itemFatura.pago ? 'Desfazer pagamento' : 'Marcar fatura paga'}
                          </Button>
                        )}
                        <button
                          onClick={() => abrirModalFatura(c.id, competenciaMesFiltro)}
                          className="w-full mt-1 text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 justify-center"
                        >
                          <Info size={12} /> Informar valor da fatura
                        </button>
                      </div>
                    );
                  })()}
                </CardBody>
              </Card>
              );
            })}
            {data.cartoes.length === 0 && (
              <div className="col-span-2 text-center py-10 text-surface-400">Nenhum cartão cadastrado</div>
            )}
          </div>
        </div>
      )}

      {/* DÍVIDAS */}
      {aba === 'dividas' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => { setFormDivida({ nome: '', valorTotal: 0, valorParcela: 0, totalParcelas: 1, parcelasPagas: 0, taxaJuros: 0, prioridadeQuitacao: 'média' }); abrirModal('divida'); }}>
              Nova Dívida
            </Button>
          </div>
          <div className="space-y-3">
            {data.dividas.map(d => {
              const parcelasPagasAuto = calcularParcelasPagasAuto(d);
              const saldo = Math.max(0, d.valorTotal - parcelasPagasAuto * d.valorParcela);
              const progresso = (parcelasPagasAuto / d.totalParcelas) * 100;
              const statusD = parcelasPagasAuto >= d.totalParcelas ? 'quitada' : (d.status ?? 'ativa');
              const proximo = statusD !== 'quitada' ? proximoVencimento(d) : null;
              return (
                <Card key={d.id} className={statusD === 'quitada' ? 'opacity-60' : ''}>
                  <CardBody>
                    <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="mobile-clamp-2 font-semibold text-surface-900 dark:text-white">{d.nome}</p>
                          {statusD === 'quitada' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 font-medium">Quitada</span>}
                          {statusD === 'pausada' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Pausada</span>}
                        </div>
                        <p className="mobile-text text-xs text-surface-400 dark:text-surface-500">
                          {parcelasPagasAuto}/{d.totalParcelas} parcelas · {d.taxaJuros > 0 ? `${d.taxaJuros}% a.a.` : 'Sem juros'}
                          {d.dataInicio && ` · Início: ${isoParaDataBR(d.dataInicio)}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setFormDivida({ nome: d.nome, valorTotal: d.valorTotal, valorParcela: d.valorParcela, totalParcelas: d.totalParcelas, parcelasPagas: d.parcelasPagas, taxaJuros: d.taxaJuros, prioridadeQuitacao: d.prioridadeQuitacao, dataInicio: d.dataInicio ?? hojeISO(), diaVencimento: d.diaVencimento ?? 10, status: d.status ?? 'ativa' }); setFormDividaTotalStr(moneyToInputBR(d.valorTotal)); setFormDividaParcelaStr(moneyToInputBR(d.valorParcela)); abrirModal('divida', d); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setData(prev => ({ ...prev, dividas: prev.dividas.filter(x => x.id !== d.id) }))} className="p-1 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-sm mb-2 min-[390px]:flex-row min-[390px]:justify-between">
                      <span className="text-surface-500">Saldo devedor</span>
                      <span className={`money-responsive-sm font-bold ${saldo > 0 ? 'text-danger-600 dark:text-danger-400' : 'text-success-600 dark:text-success-400'}`}>{formatarDinheiro(saldo)}</span>
                    </div>
                    <ProgressBar value={progresso} showLabel color="success" height="md" />
                    <div className="flex flex-col gap-0.5 text-xs text-surface-400 mt-1 min-[390px]:flex-row min-[390px]:justify-between">
                      <span>Parcela: {formatarDinheiro(d.valorParcela)}/mês</span>
                      {proximo && <span>Próximo vencimento: {proximo}</span>}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
            {data.dividas.length === 0 && (
              <div className="text-center py-10 text-surface-400">Nenhuma dívida cadastrada 🎉</div>
            )}
          </div>
        </div>
      )}

      {/* RESERVA */}
      {aba === 'reserva' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => { setFormReserva({ nome: '', metaReserva: 0, valorAtual: 0, prazoDesejado: '' }); abrirModal('reserva'); }}>
              Nova Reserva
            </Button>
          </div>
          <div className="space-y-3">
            {data.reservas.map(r => (
              <Card key={r.id}>
                <CardBody>
                  <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="mobile-clamp-2 font-semibold text-surface-900 dark:text-white">{r.nome}</p>
                      {r.prazoDesejado && <p className="text-xs text-surface-400">Prazo: {formatarData(r.prazoDesejado)}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setFormReserva({ nome: r.nome, metaReserva: r.metaReserva, valorAtual: r.valorAtual, prazoDesejado: r.prazoDesejado }); setFormReservaMetaStr(moneyToInputBR(r.metaReserva)); setFormReservaAtualStr(moneyToInputBR(r.valorAtual)); abrirModal('reserva', r); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => setData(d => ({ ...d, reservas: d.reservas.filter(x => x.id !== r.id) }))} className="p-1 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-sm mb-2 min-[390px]:flex-row min-[390px]:justify-between">
                    <span className="text-surface-500">Acumulado</span>
                    <span className="money-responsive-sm font-bold text-primary-600 dark:text-primary-400">{formatarDinheiro(r.valorAtual)} / {formatarDinheiro(r.metaReserva)}</span>
                  </div>
                  <ProgressBar value={r.metaReserva > 0 ? (r.valorAtual / r.metaReserva) * 100 : 0} showLabel color="primary" height="md" />
                </CardBody>
              </Card>
            ))}
            {data.reservas.length === 0 && (
              <div className="text-center py-10 text-surface-400">Nenhuma reserva cadastrada</div>
            )}
          </div>
        </div>
      )}

      {/* BENS */}
      {aba === 'bens' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => { setFormBem({ nome: '', tipo: 'Carro', valorEstimado: 0, status: 'manter', observacoes: '' }); abrirModal('bem'); }}>
              Novo Bem
            </Button>
          </div>
          <div className="space-y-3">
            {data.bens.map(b => (
              <Card key={b.id}>
                <CardBody>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
                        <Package size={18} className="text-surface-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="mobile-clamp-2 font-semibold text-surface-900 dark:text-white">{b.nome}</p>
                        <p className="mobile-text text-xs text-surface-400">{b.tipo} · {b.status}</p>
                        {b.observacoes && <p className="mobile-clamp-2 text-xs text-surface-400 italic mt-0.5">{b.observacoes}</p>}
                      </div>
                    </div>
                    <div className="action-row-responsive sm:w-auto sm:flex-nowrap sm:justify-end">
                      <span className="money-responsive-sm font-bold text-surface-700 dark:text-surface-300">{formatarDinheiro(b.valorEstimado)}</span>
                      <button onClick={() => { setFormBem({ nome: b.nome, tipo: b.tipo, valorEstimado: b.valorEstimado, status: b.status, observacoes: b.observacoes }); setFormBemValorStr(moneyToInputBR(b.valorEstimado)); abrirModal('bem', b); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => setData(d => ({ ...d, bens: d.bens.filter(x => x.id !== b.id) }))} className="p-1 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
            {data.bens.length === 0 && <div className="text-center py-10 text-surface-400">Nenhum bem cadastrado</div>}
          </div>
        </div>
      )}

      {/* A RECEBER */}
      {aba === 'aReceber' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button
              icon={<Plus size={16} />}
              onClick={() => {
                setEditandoId(null);
                setFormAReceber(novoFormAReceber(mesFiltro.mes + 1, mesFiltro.ano));
                setFormAReceberValorStr('');
                setErroAReceber('');
                setModal('aReceber');
              }}
            >
              Novo valor a receber
            </Button>
          </div>
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
            <Card>
              <CardBody>
                <p className="text-xs text-surface-400">A receber</p>
                <p className="money-responsive font-bold text-primary-600 dark:text-primary-400">{formatarDinheiro(aReceberMes.totalAReceber)}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-surface-400">Recebido</p>
                <p className="money-responsive font-bold text-success-600 dark:text-success-400">{formatarDinheiro(aReceberMes.totalRecebido)}</p>
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardBody className="!px-4 !pb-4">
              {aReceberMes.lista.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-surface-400">Nenhum valor a receber em {MESES[mesFiltro.mes]} {mesFiltro.ano}</p>
                  {totalAReceberGeral > 0 && (
                    <p className="mt-2 text-xs text-surface-500 dark:text-surface-400">
                      Existem {totalAReceberGeral} valores salvos em outros meses. Use as setas do mês para consultar.
                    </p>
                  )}
                  {msgAReceberRecuperacao && (
                    <p className="mt-3 text-xs text-surface-500 dark:text-surface-400">{msgAReceberRecuperacao}</p>
                  )}
                  <div className="mt-4 flex justify-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const recuperados = recoverAReceberFromLocalStorage();
                        setMsgAReceberRecuperacao(
                          recuperados > 0
                            ? `${recuperados} valor(es) recuperado(s). Se não aparecerem neste mês, navegue pelos meses.`
                            : 'Não encontrei valores antigos de A Receber salvos neste navegador.'
                        );
                      }}
                    >
                      Procurar dados salvos
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-surface-400">A receber</h4>
                      <span className="text-xs text-surface-400">{itensAReceberPendentes.length} item{itensAReceberPendentes.length === 1 ? '' : 's'}</span>
                    </div>
                    {itensAReceberPendentes.length === 0 ? (
                      <p className="text-xs text-surface-400">Nenhum item pendente.</p>
                    ) : itensAReceberPendentes.map(renderAReceberItem)}
                  </div>

                  {itensAReceberRecebidos.length > 0 && (
                    <div className="space-y-2 border-t border-surface-100 pt-3 dark:border-surface-700">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-surface-400">Recebido</h4>
                          <p className="text-xs text-surface-400">{formatarDinheiro(aReceberMes.totalRecebido)} · {itensAReceberRecebidos.length} item{itensAReceberRecebidos.length === 1 ? '' : 's'}</p>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => setMostrarAReceberRecebidos(v => !v)}>
                          {mostrarAReceberRecebidos ? 'Ocultar recebidos' : 'Mostrar recebidos'}
                        </Button>
                      </div>
                      {mostrarAReceberRecebidos && (
                        <div className="space-y-2">
                          {itensAReceberRecebidos.map(renderAReceberItem)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* MODAIS */}
      <Modal
        isOpen={modalExcluirAReceber !== null && aReceberExcluirItem !== null}
        onClose={() => setModalExcluirAReceber(null)}
        title="Excluir A Receber"
        size="md"
      >
        {aReceberExcluirItem && (() => {
          const grupo = aReceberExcluirItem.grupoRecebimentoId
            ? (data.aReceber ?? []).filter(item => item.grupoRecebimentoId === aReceberExcluirItem.grupoRecebimentoId)
            : [aReceberExcluirItem];
          const isParcelado = Boolean(aReceberExcluirItem.grupoRecebimentoId && grupo.length > 1);
          const precisaEscolherEscopo = isParcelado && !modalExcluirAReceber?.escopo;
          const escopo = modalExcluirAReceber?.escopo ?? 'item';
          const itensAlvo = escopo === 'grupo' ? grupo : [aReceberExcluirItem];
          const idsAlvo = itensAlvo.map(item => item.id);
          const temReceitaVinculada = itensAlvo.some(item => item.receitaVinculadaId);
          const temRecebido = itensAlvo.some(item => item.status === 'recebido');

          const escolherEscopo = (novoEscopo: 'item' | 'grupo') => {
            const alvo = novoEscopo === 'grupo' ? grupo : [aReceberExcluirItem];
            const alvoTemReceita = alvo.some(item => item.receitaVinculadaId);
            if (alvoTemReceita) {
              setModalExcluirAReceber({ itemId: aReceberExcluirItem.id, escopo: novoEscopo });
              return;
            }
            excluirAReceber(alvo.map(item => item.id), false);
          };

          return (
            <div className="space-y-4">
              <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                <p className="text-sm font-semibold text-surface-900 dark:text-white">{aReceberExcluirItem.descricao}</p>
                <p className="mt-1 text-xs text-surface-400">
                  {aReceberExcluirItem.pessoa} · {formatarDinheiro(aReceberExcluirItem.valor)}
                  {aReceberExcluirItem.parcelaAtual && aReceberExcluirItem.totalParcelas ? ` · parcela ${aReceberExcluirItem.parcelaAtual}/${aReceberExcluirItem.totalParcelas}` : ''}
                </p>
              </div>

              {precisaEscolherEscopo ? (
                <>
                  <p className="text-sm text-surface-600 dark:text-surface-300">
                    Este item faz parte de um recebimento parcelado. O que deseja excluir?
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button variant="danger" onClick={() => escolherEscopo('item')}>Excluir apenas esta parcela</Button>
                    <Button variant="danger" onClick={() => escolherEscopo('grupo')}>Excluir todas as parcelas deste recebimento</Button>
                    <Button variant="ghost" onClick={() => setModalExcluirAReceber(null)}>Cancelar</Button>
                  </div>
                </>
              ) : temReceitaVinculada ? (
                <>
                  <p className="text-sm text-surface-600 dark:text-surface-300">
                    Este recebimento possui receita vinculada. O que deseja fazer?
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button variant="danger" onClick={() => excluirAReceber(idsAlvo, true)}>
                      Excluir A Receber e remover receita vinculada
                    </Button>
                    <Button variant="secondary" onClick={() => excluirAReceber(idsAlvo, false)}>
                      Excluir A Receber e manter receita
                    </Button>
                    <Button variant="ghost" onClick={() => setModalExcluirAReceber(null)}>Cancelar</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-surface-600 dark:text-surface-300">
                    {temRecebido ? 'Este valor já foi marcado como recebido. Deseja excluir mesmo assim?' : 'Deseja excluir este valor a receber?'}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => setModalExcluirAReceber(null)}>Cancelar</Button>
                    <Button variant="danger" className="flex-1" onClick={() => excluirAReceber(idsAlvo, false)}>Excluir</Button>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </Modal>

      <Modal
        isOpen={modalAReceberAcao !== null && aReceberAcaoItem !== null}
        onClose={() => setModalAReceberAcao(null)}
        title={modalAReceberAcao?.tipo === 'desfazer' ? 'Desfazer recebimento' : 'Marcar como recebido'}
        size="md"
      >
        {aReceberAcaoItem && (
          <div className="space-y-4">
            <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
              <p className="text-sm font-semibold text-surface-900 dark:text-white">{aReceberAcaoItem.descricao}</p>
              <p className="mt-1 text-xs text-surface-400">
                {aReceberAcaoItem.pessoa} · {formatarDinheiro(aReceberAcaoItem.valor)}
                {aReceberAcaoItem.parcelaAtual && aReceberAcaoItem.totalParcelas ? ` · parcela ${aReceberAcaoItem.parcelaAtual}/${aReceberAcaoItem.totalParcelas}` : ''}
              </p>
            </div>

            {modalAReceberAcao?.tipo === 'receber' ? (
              <>
                <p className="text-sm text-surface-600 dark:text-surface-300">
                  Como deseja registrar este recebimento?
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="success"
                    onClick={() => {
                      setData(d => {
                        const recebido = marcarRecebimentoComoRecebido(d, aReceberAcaoItem.id);
                        return aReceberAcaoItem.receitaVinculadaId
                          ? recebido
                          : converterRecebimentoEmReceita(recebido, aReceberAcaoItem.id);
                      });
                      setModalAReceberAcao(null);
                    }}
                  >
                    Recebido e criar receita
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setData(d => marcarRecebimentoComoRecebido(d, aReceberAcaoItem.id));
                      setModalAReceberAcao(null);
                    }}
                  >
                    Recebido sem criar receita
                  </Button>
                  <Button variant="ghost" onClick={() => setModalAReceberAcao(null)}>Cancelar</Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-surface-600 dark:text-surface-300">
                  Deseja voltar este item para “A receber”?
                </p>
                <div className="flex flex-col gap-2">
                  {aReceberAcaoItem.receitaVinculadaId && (
                    <Button
                      variant="danger"
                      onClick={() => {
                        setData(d => ({
                          ...d,
                          receitas: d.receitas.filter(r => r.id !== aReceberAcaoItem.receitaVinculadaId),
                          aReceber: (d.aReceber ?? []).map(a => a.id === aReceberAcaoItem.id
                            ? { ...a, status: 'a_receber', dataRecebimento: undefined, receitaVinculadaId: undefined, dataAtualizacao: hojeISO() }
                            : a),
                        }));
                        setModalAReceberAcao(null);
                      }}
                    >
                      Desfazer e remover receita
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setData(d => ({
                        ...d,
                        aReceber: (d.aReceber ?? []).map(a => a.id === aReceberAcaoItem.id
                          ? { ...a, status: 'a_receber', dataRecebimento: undefined, dataAtualizacao: hojeISO() }
                          : a),
                      }));
                      setModalAReceberAcao(null);
                    }}
                  >
                    Desfazer recebimento
                  </Button>
                  <Button variant="ghost" onClick={() => setModalAReceberAcao(null)}>Cancelar</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={aba === 'resumo' && pendenciasAnterior !== null}
        onClose={() => {
          if (pendenciasAnterior) localStorage.setItem(`sgp-orcamento-pendencias-${pendenciasAnterior.ano}-${pendenciasAnterior.mes}`, 'visto');
          setPendenciasAnterior(null);
        }}
        title="Pendências do mês anterior"
        size="lg"
      >
        {pendenciasAnterior && (
          <div className="space-y-4">
            <p className="text-sm text-surface-600 dark:text-surface-300">
              Existem itens de {MESES[pendenciasAnterior.mes]} {pendenciasAnterior.ano} ainda em aberto. Você já pagou esses itens?
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {pendenciasAnterior.itens.map(item => (
                <div key={`${item.tipo}-${item.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-surface-200 p-3 dark:border-surface-700">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{item.descricao}</p>
                    <p className="text-xs text-surface-400">{item.origemLabel} · {item.tipo}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-danger-600 dark:text-danger-400">{formatarDinheiro(item.valor)}</span>
                    <Button size="sm" variant="success" onClick={() => {
                      setData(d => marcarItemComoPago(d, item, pendenciasAnterior.mes, pendenciasAnterior.ano));
                      setPendenciasAnterior(p => p ? { ...p, itens: p.itens.filter(i => !(i.id === item.id && i.tipo === item.tipo)) } : p);
                    }}>
                      Pago
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                variant="success"
                onClick={() => {
                  setData(d => pendenciasAnterior.itens.reduce((acc, item) => marcarItemComoPago(acc, item, pendenciasAnterior.mes, pendenciasAnterior.ano), d));
                  localStorage.setItem(`sgp-orcamento-pendencias-${pendenciasAnterior.ano}-${pendenciasAnterior.mes}`, 'visto');
                  setPendenciasAnterior(null);
                }}
              >
                Sim, marcar todos
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  localStorage.setItem(`sgp-orcamento-pendencias-${pendenciasAnterior.ano}-${pendenciasAnterior.mes}`, 'visto');
                  setPendenciasAnterior(null);
                }}
              >
                Não, manter
              </Button>
              <Button variant="secondary" onClick={() => setAba('resumo')}>
                Revisar itens
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modal === 'receita'} onClose={() => setModal(null)} title={editandoId ? 'Editar Receita' : 'Nova Receita'}>
        <div className="space-y-4">
          <Input id="rec-desc" label="Descrição" required value={formReceita.descricao} onChange={e => setFormReceita(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Salário, freelance..." />
          <Input id="rec-valor" label="Valor (R$)" required type="text" inputMode="decimal" placeholder="0,00" value={formReceitaValorStr} onChange={e => setFormReceitaValorStr(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select id="rec-mes-ref" label="Mês de referência" value={String(formReceita.mesReferencia ?? Number(formReceita.data.slice(5, 7)))} onChange={e => setFormReceita(f => ({ ...f, mesReferencia: Number(e.target.value) }))}>
              {MESES.map((mes, i) => <option key={mes} value={i + 1}>{mes}</option>)}
            </Select>
            <Input id="rec-ano-ref" label="Ano de referência" type="number" min="2020" max="2035" value={formReceita.anoReferencia ?? Number(formReceita.data.slice(0, 4))} onChange={e => setFormReceita(f => ({ ...f, anoReferencia: Number(e.target.value) }))} />
          </div>
          <Select id="rec-cat" label="Categoria" value={formReceita.categoria} onChange={e => setFormReceita(f => ({ ...f, categoria: e.target.value as CategoriaFinanceira }))}>
            {categoriasReceita.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Checkbox id="rec-rec" label="Receita recorrente" checked={formReceita.recorrente} onChange={e => setFormReceita(f => ({ ...f, recorrente: e.target.checked }))} />
          {formReceita.recorrente && (
            <div className="space-y-3 rounded-xl border border-surface-200 dark:border-surface-700 p-3">
              <Checkbox id="rec-tem-fim" label="Essa receita tem término?" checked={!!formReceita.recorrenciaTemTermino} onChange={e => setFormReceita(f => ({ ...f, recorrenciaTemTermino: e.target.checked }))} />
              {formReceita.recorrenciaTemTermino ? (
                <div className="grid grid-cols-2 gap-3">
                  <Select id="rec-mes-fim" label="Mês de término" value={String(formReceita.recorrenciaMesTermino ?? formReceita.mesReferencia ?? 12)} onChange={e => setFormReceita(f => ({ ...f, recorrenciaMesTermino: Number(e.target.value) }))}>
                    {MESES.map((mes, i) => <option key={mes} value={i + 1}>{mes}</option>)}
                  </Select>
                  <Input id="rec-ano-fim" label="Ano de término" type="number" min="2026" max="2035" value={formReceita.recorrenciaAnoTermino ?? formReceita.anoReferencia ?? 2026} onChange={e => setFormReceita(f => ({ ...f, recorrenciaAnoTermino: Number(e.target.value) }))} />
                </div>
              ) : (
                <p className="text-xs text-surface-400 dark:text-surface-500">Sem término: cria inicialmente os meses restantes de 2026 e mantém vínculo da série recorrente.</p>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarReceita}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'despesa'} onClose={() => setModal(null)} title={editandoId ? 'Editar Despesa' : 'Nova Despesa'} size="lg">
        <div className="space-y-3">
          <Input id="desp-desc" label="Descrição" required value={formDespesa.descricao} onChange={e => setFormDespesa(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel, supermercado..." />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="desp-valor"
              label={!editandoId && formDespesa.formaPagamento === 'Cartão de crédito' && formDespesaExtra.tipoCobrancaCartao === 'parcelado' ? 'Valor total da compra (R$)' : 'Valor (R$)'}
              required
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={formDespesaValorStr}
              onChange={e => setFormDespesaValorStr(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Mês de referência</label>
              <div className="flex gap-2">
                <select
                  value={formDespesaMesFatura.split('-')[1] ?? ''}
                  onChange={e => {
                    const ano = formDespesaMesFatura.split('-')[0] ?? new Date().getFullYear().toString();
                    setFormDespesaMesFatura(`${ano}-${e.target.value}`);
                  }}
                  className="flex-1 px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {MESES.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                </select>
                <select
                  value={formDespesaMesFatura.split('-')[0] ?? ''}
                  onChange={e => {
                    const mes = formDespesaMesFatura.split('-')[1] ?? '01';
                    setFormDespesaMesFatura(`${e.target.value}-${mes}`);
                  }}
                  className="w-24 px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {[-1, 0, 1, 2].map(offset => { const y = new Date().getFullYear() + offset; return <option key={y} value={y}>{y}</option>; })}
                </select>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select id="desp-cat" label="Categoria" value={formDespesa.categoria} onChange={e => setFormDespesa(f => ({ ...f, categoria: e.target.value as CategoriaFinanceira }))}>
              {categoriasDespesa.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select id="desp-forma" label="Forma de pagamento" value={formDespesa.formaPagamento} onChange={e => setFormDespesa(f => ({ ...f, formaPagamento: e.target.value as FormaPagamento }))}>
              {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
            </Select>
          </div>

          {/* Seletor de cartão — apenas quando cartão de crédito */}
          {formDespesa.formaPagamento === 'Cartão de crédito' && (() => {
            const cartoes = data.cartoes ?? [];
            if (cartoes.length === 0) {
              return (
                <p className="text-xs text-surface-400 dark:text-surface-500 bg-warning-50 dark:bg-warning-900/10 rounded-lg px-3 py-2">
                  Nenhum cartão cadastrado. Adicione um cartão na aba Cartões.
                </p>
              );
            }
            return (
              <Select
                id="desp-cartao"
                label="Cartão"
                value={cartaoSelecionadoId}
                onChange={e => setCartaoSelecionadoId(e.target.value)}
              >
                <option value="">Selecione o cartão</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            );
          })()}

          {/* Parcelamento — apenas cartão de crédito */}
          {formDespesa.formaPagamento === 'Cartão de crédito' && !editandoId && (
            <div className="bg-surface-50 dark:bg-surface-700/30 rounded-xl p-3 space-y-3">
              <Select
                id="desp-tipo-cobranca"
                label="Tipo de cobrança"
                value={formDespesaExtra.tipoCobrancaCartao}
                onChange={e => setFormDespesaExtra(f => ({ ...f, tipoCobrancaCartao: e.target.value as TipoCobrancaCartao }))}
              >
                <option value="avista">À vista</option>
                {!formDespesa.recorrente && <option value="parcelado">Parcelado</option>}
              </Select>

              {formDespesaExtra.tipoCobrancaCartao === 'parcelado' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      id="desp-parcelas"
                      label="Nº de parcelas"
                      type="number"
                      min="2"
                      max="72"
                      value={formDespesaExtra.quantidadeParcelas}
                      onChange={e => setFormDespesaExtra(f => ({ ...f, quantidadeParcelas: Math.max(2, Math.min(72, Number(e.target.value))) }))}
                    />
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Mês de início</label>
                      <div className="flex gap-2">
                        <select
                          value={formDespesaExtra.mesInicioParcelas.split('-')[1] ?? ''}
                          onChange={e => {
                            const ano = formDespesaExtra.mesInicioParcelas.split('-')[0] ?? new Date().getFullYear().toString();
                            setFormDespesaExtra(f => ({ ...f, mesInicioParcelas: `${ano}-${e.target.value}` }));
                          }}
                          className="flex-1 px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
                            <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={formDespesaExtra.mesInicioParcelas.split('-')[0] ?? ''}
                          onChange={e => {
                            const mes = formDespesaExtra.mesInicioParcelas.split('-')[1] ?? '01';
                            setFormDespesaExtra(f => ({ ...f, mesInicioParcelas: `${e.target.value}-${mes}` }));
                          }}
                          className="w-24 px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          {[0,1,2].map(d => {
                            const y = new Date().getFullYear() + d;
                            return <option key={y} value={y}>{y}</option>;
                          })}
                        </select>
                      </div>
                    </div>
                  </div>
                  {parseBRLMoney(formDespesaValorStr) > 0 && formDespesaExtra.quantidadeParcelas >= 2 && (
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      Valor por parcela: <strong>{formatarDinheiro(parseBRLMoney(formDespesaValorStr) / formDespesaExtra.quantidadeParcelas)}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Previsão de fatura */}
          {formDespesa.formaPagamento === 'Cartão de crédito' && cartaoSelecionadoId && (() => {
            const cartao = data.cartoes.find(c => c.id === cartaoSelecionadoId);
            const isParc = formDespesaExtra.tipoCobrancaCartao === 'parcelado';
            if (isParc && formDespesaExtra.quantidadeParcelas >= 2) {
              const qtd = formDespesaExtra.quantidadeParcelas;
              const valorParcela = parseBRLMoney(formDespesaValorStr) / qtd;
              const [ano, mes] = formDespesaExtra.mesInicioParcelas.split('-').map(Number);
              const primeiraData = new Date(ano, mes - 1, 1).toISOString().slice(0, 10);
              const competencia = obterCompetenciaFatura(primeiraData, cartao?.diaFechamento);
              const [cAno, cMes] = competencia.split('-').map(Number);
              return (
                <div className="text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/10 rounded-lg px-3 py-2">
                  Serão criadas <strong>{qtd}</strong> parcelas de <strong>{formatarDinheiro(valorParcela)}</strong>. Primeira fatura: <strong>{MESES[(cMes ?? 1) - 1]} {cAno}</strong>.
                </div>
              );
            } else if (!isParc && formDespesa.data) {
              const competencia = obterCompetenciaFatura(formDespesa.data, cartao?.diaFechamento);
              const [cAno, cMes] = competencia.split('-').map(Number);
              return (
                <div className="text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/10 rounded-lg px-3 py-2">
                  Esta compra entrará na fatura de <strong>{MESES[(cMes ?? 1) - 1]} {cAno}</strong>.
                </div>
              );
            }
            return null;
          })()}

          {(() => {
            const isParcelado = formDespesa.formaPagamento === 'Cartão de crédito' && formDespesaExtra.tipoCobrancaCartao === 'parcelado';
            return (
              <div className="space-y-2">
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="desp-rec"
                      label="Recorrente"
                      checked={isParcelado ? false : formDespesa.recorrente}
                      onChange={e => setFormDespesa(f => ({ ...f, recorrente: e.target.checked }))}
                      disabled={isParcelado}
                    />
                    {isParcelado && (
                      <span className="text-xs text-surface-400 dark:text-surface-500">Parcelado não pode ser recorrente</span>
                    )}
                  </div>
                  <Checkbox id="desp-ess" label="Essencial" checked={formDespesa.essencial} onChange={e => setFormDespesa(f => ({ ...f, essencial: e.target.checked }))} />
                </div>
                {formDespesa.recorrente && !isParcelado && (
                  <div className="text-xs text-surface-400 dark:text-surface-500 bg-blue-50 dark:bg-blue-900/10 rounded-lg px-3 py-2">
                    <strong>Recorrente:</strong> repete-se automaticamente todo mês (ex: aluguel, internet). Diferente de parcelado, não tem data de fim obrigatória.
                  </div>
                )}
              </div>
            );
          })()}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSalvarDespesa}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'cartao'} onClose={() => setModal(null)} title={editandoId ? 'Editar Cartão' : 'Novo Cartão'}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: `${corCartao(formCartao)}20`, color: corCartao(formCartao) }}
            >
              {iconeCartao(formCartao)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{formCartao.nome || 'Novo cartão'}</p>
              <p className="text-xs text-surface-400">{formCartao.banco || 'Banco não informado'}</p>
            </div>
          </div>
          <Input id="cart-nome" label="Nome do cartão" required value={formCartao.nome} onChange={e => setFormCartao(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Nubank, Bradesco..." />
          <div className="grid grid-cols-2 gap-3">
            <Input id="cart-banco" label="Banco / emissor" value={formCartao.banco ?? ''} onChange={e => setFormCartao(f => ({ ...f, banco: e.target.value }))} placeholder="Ex: Santander" />
            <Input id="cart-icone" label="Símbolo" maxLength={3} value={formCartao.icone ?? ''} onChange={e => setFormCartao(f => ({ ...f, icone: e.target.value }))} placeholder="Ex: NU" />
          </div>
          <div className="space-y-2">
            <Input id="cart-cor" label="Cor do cartão" type="color" value={corCartao(formCartao)} onChange={e => setFormCartao(f => ({ ...f, cor: e.target.value }))} />
            <div className="flex flex-wrap gap-2">
              {CARTAO_CORES.map(cor => (
                <button
                  key={cor}
                  type="button"
                  className="h-7 w-7 rounded-full border border-surface-200 dark:border-surface-700"
                  style={{ backgroundColor: cor }}
                  onClick={() => setFormCartao(f => ({ ...f, cor }))}
                  aria-label={`Selecionar cor ${cor}`}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="cart-limite" label="Limite (R$)" type="text" inputMode="decimal" placeholder="0,00" value={formCartaoLimiteStr} onChange={e => setFormCartaoLimiteStr(e.target.value)} />
            <Input id="cart-fatura" label="Fatura atual (R$)" type="text" inputMode="decimal" placeholder="0,00" value={formCartaoFaturaStr} onChange={e => setFormCartaoFaturaStr(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="cart-venc" label="Dia vencimento" type="number" min="1" max="31" value={formCartao.vencimento} onChange={e => setFormCartao(f => ({ ...f, vencimento: Number(e.target.value) }))} />
            <Input id="cart-fechamento" label="Dia fechamento (opcional)" type="number" min="1" max="31" value={formCartao.diaFechamento ?? ''} onChange={e => setFormCartao(f => ({ ...f, diaFechamento: e.target.value ? Number(e.target.value) : undefined }))} placeholder="Ex: 5" />
          </div>
          <Select id="cart-status" label="Status" value={formCartao.status} onChange={e => setFormCartao(f => ({ ...f, status: e.target.value as StatusCartao }))}>
            <option value="ativo">Ativo</option>
            <option value="bloqueado">Bloqueado</option>
            <option value="cancelado">Cancelado</option>
          </Select>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarCartao}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'divida'} onClose={() => setModal(null)} title={editandoId ? 'Editar Dívida' : 'Nova Dívida'}>
        <div className="space-y-4">
          <Input id="div-nome" label="Nome da dívida" required value={formDivida.nome} onChange={e => setFormDivida(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Empréstimo banco..." />
          <div className="grid grid-cols-2 gap-3">
            <Input id="div-total" label="Valor total (R$)" type="text" inputMode="decimal" placeholder="0,00" value={formDividaTotalStr} onChange={e => setFormDividaTotalStr(e.target.value)} />
            <Input id="div-parcela" label="Valor parcela (R$)" type="text" inputMode="decimal" placeholder="0,00" value={formDividaParcelaStr} onChange={e => setFormDividaParcelaStr(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="div-totparc" label="Total de parcelas" type="number" min="1" value={formDivida.totalParcelas} onChange={e => setFormDivida(f => ({ ...f, totalParcelas: Number(e.target.value) }))} />
            <Input id="div-pagas" label="Parcelas pagas" type="number" min="0" value={formDivida.parcelasPagas} onChange={e => setFormDivida(f => ({ ...f, parcelasPagas: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DateInputBR id="div-data-inicio" label="Data início" value={formDivida.dataInicio ?? hojeISO()} onChange={v => setFormDivida(f => ({ ...f, dataInicio: v }))} />
            <Input id="div-diavenc" label="Dia vencimento" type="number" min="1" max="31" value={formDivida.diaVencimento ?? 10} onChange={e => setFormDivida(f => ({ ...f, diaVencimento: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="div-juros" label="Taxa de juros (% a.a.)" type="number" min="0" step="0.1" value={formDivida.taxaJuros || ''} onChange={e => setFormDivida(f => ({ ...f, taxaJuros: Number(e.target.value) }))} />
            <Select id="div-prio" label="Prioridade quitação" value={formDivida.prioridadeQuitacao} onChange={e => setFormDivida(f => ({ ...f, prioridadeQuitacao: e.target.value as PrioridadeQuitacao }))}>
              <option value="baixa">Baixa</option>
              <option value="média">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </Select>
          </div>
          <div className="text-xs text-surface-400 dark:text-surface-500 bg-surface-50 dark:bg-surface-700/30 rounded-lg p-3">
            O sistema calcula automaticamente as parcelas pagas com base na data de início. Você pode ajustar manualmente no campo "Parcelas pagas" se necessário.
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarDivida}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'reserva'} onClose={() => setModal(null)} title={editandoId ? 'Editar Reserva' : 'Nova Reserva'}>
        <div className="space-y-4">
          <Input id="res-nome" label="Nome da reserva" required value={formReserva.nome} onChange={e => setFormReserva(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Reserva para EUA..." />
          <div className="grid grid-cols-2 gap-3">
            <Input id="res-meta" label="Meta (R$)" type="text" inputMode="decimal" placeholder="0,00" value={formReservaMetaStr} onChange={e => setFormReservaMetaStr(e.target.value)} />
            <Input id="res-atual" label="Valor atual (R$)" type="text" inputMode="decimal" placeholder="0,00" value={formReservaAtualStr} onChange={e => setFormReservaAtualStr(e.target.value)} />
          </div>
          <DateInputBR id="res-prazo" label="Prazo desejado" value={formReserva.prazoDesejado || ''} onChange={v => setFormReserva(f => ({ ...f, prazoDesejado: v }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarReserva}>Salvar</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL INFORMAR FATURA */}
      <Modal
        isOpen={modalFatura !== null}
        onClose={() => setModalFatura(null)}
        title="Informar valor da fatura"
      >
        {modalFatura && (() => {
          const faturas = data.faturas ?? [];
          const fatura = faturas.find(f => f.cartaoId === modalFatura.cartaoId && f.competencia === modalFatura.competencia);
          const [anoStr, mesStr] = modalFatura.competencia.split('-');
          const cartao = data.cartoes.find(c => c.id === modalFatura.cartaoId);

          const handleCompetenciaChange = (novaCompetencia: string) => {
            const faturaExistente = (data.faturas ?? []).find(f => f.cartaoId === modalFatura.cartaoId && f.competencia === novaCompetencia);
            setModalFatura({ ...modalFatura, competencia: novaCompetencia });
            setFormFatura({ valorInformado: faturaExistente?.valorInformado ?? 0, observacoes: faturaExistente?.observacoes ?? '' });
            setFormFaturaValorStr(faturaExistente?.valorInformado ? moneyToInputBR(faturaExistente.valorInformado) : '');
          };

          return (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  Cartão: <strong className="text-surface-800 dark:text-white">{cartao?.nome ?? '—'}</strong>
                </p>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Mês de referência</label>
                  <div className="flex gap-2">
                    <select
                      value={mesStr}
                      onChange={e => handleCompetenciaChange(`${anoStr}-${e.target.value}`)}
                      className="flex-1 px-3 py-2 rounded-xl border text-sm bg-white dark:bg-surface-700 border-surface-200 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {MESES.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                    </select>
                    <select
                      value={anoStr}
                      onChange={e => handleCompetenciaChange(`${e.target.value}-${mesStr}`)}
                      className="w-24 px-3 py-2 rounded-xl border text-sm bg-white dark:bg-surface-700 border-surface-200 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {[-1, 0, 1, 2].map(offset => { const y = new Date().getFullYear() + offset; return <option key={y} value={y}>{y}</option>; })}
                    </select>
                  </div>
                </div>
              </div>
              <Input
                id="fat-valor"
                label="Valor total da fatura (R$)"
                type="text"
                inputMode="decimal"
                value={formFaturaValorStr}
                onChange={e => setFormFaturaValorStr(e.target.value)}
                placeholder="0,00"
              />
              <Textarea
                id="fat-obs"
                label="Observações (opcional)"
                value={formFatura.observacoes}
                onChange={e => setFormFatura(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Notas sobre esta fatura..."
              />
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setModalFatura(null)}>Cancelar</Button>
                <Button className="flex-1" onClick={() => { salvarFatura(); }}>Salvar</Button>
              </div>
              {fatura && (
                <div className="border-t border-surface-200 dark:border-surface-700 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500">Valor informado</span>
                    <span className="font-semibold">{fatura.valorInformado !== null ? formatarDinheiro(fatura.valorInformado) : '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500">Já detalhado</span>
                    <span>{formatarDinheiro(fatura.valorDetalhado)}</span>
                  </div>
                  {fatura.valorInformado !== null && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-surface-500">Diferença</span>
                        <span className={fatura.diferenca < 0 ? 'text-danger-600 dark:text-danger-400 font-semibold' : fatura.diferenca > 0 ? 'text-warning-600 dark:text-warning-400 font-semibold' : 'text-success-600 dark:text-success-400'}>
                          {fatura.diferenca === 0 ? '✓ Fatura totalmente detalhada' : formatarDinheiro(Math.abs(fatura.diferenca))}
                        </span>
                      </div>
                      {fatura.diferenca < 0 && (
                        <div className="text-xs text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/10 rounded-lg px-3 py-2">
                          Despesas detalhadas ultrapassam o valor da fatura informado.
                        </div>
                      )}
                      {fatura.diferenca > 0 && (
                        <Button
                          variant="secondary"
                          className="w-full text-sm"
                          onClick={() => { criarAjusteDiferenca(fatura); setModalFatura(null); }}
                        >
                          Criar ajuste da diferença ({formatarDinheiro(fatura.diferenca)})
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Modal escopo de edição de parcela */}
      <Modal isOpen={modalEscopoParcela !== null} onClose={() => setModalEscopoParcela(null)} title="Editar parcela" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-surface-600 dark:text-surface-300">
            Esta despesa faz parte de um parcelamento. O que deseja alterar?
          </p>
          <div className="space-y-3">
            <button
              onClick={() => aplicarEdicaoFuturas('esta')}
              className="w-full text-left border border-surface-200 dark:border-surface-600 rounded-xl p-4 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors"
            >
              <p className="text-sm font-semibold text-surface-900 dark:text-white">Somente esta parcela</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">Altera apenas a parcela selecionada</p>
            </button>
            <button
              onClick={() => aplicarEdicaoFuturas('futuras')}
              className="w-full text-left border border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">Esta e todas as parcelas futuras</p>
              <p className="text-xs text-primary-500 dark:text-primary-400 mt-0.5">Atualiza valor, categoria e essencial de todas as parcelas a partir desta</p>
            </button>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => setModalEscopoParcela(null)}>Cancelar</Button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'bem'} onClose={() => setModal(null)} title={editandoId ? 'Editar Bem' : 'Novo Bem'}>
        <div className="space-y-4">
          <Input id="bem-nome" label="Nome do bem" required value={formBem.nome} onChange={e => setFormBem(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: HB20 2019, Casa na rua..." />
          <div className="grid grid-cols-2 gap-3">
            <Select id="bem-tipo" label="Tipo" value={formBem.tipo} onChange={e => setFormBem(f => ({ ...f, tipo: e.target.value as TipoBem }))}>
              {(['Casa', 'Carro', 'Eletrônico', 'Móvel', 'Outro'] as TipoBem[]).map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input id="bem-valor" label="Valor estimado (R$)" type="text" inputMode="decimal" placeholder="0,00" value={formBemValorStr} onChange={e => setFormBemValorStr(e.target.value)} />
          </div>
          <Select id="bem-status" label="Status" value={formBem.status} onChange={e => setFormBem(f => ({ ...f, status: e.target.value as StatusBem }))}>
            <option value="manter">Manter</option>
            <option value="avaliar venda">Avaliar venda</option>
            <option value="à venda">À venda</option>
            <option value="vendido">Vendido</option>
          </Select>
          <Textarea id="bem-obs" label="Observações" value={formBem.observacoes} onChange={e => setFormBem(f => ({ ...f, observacoes: e.target.value }))} placeholder="Detalhes sobre o bem..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarBem}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'aReceber'} onClose={() => { setModal(null); setErroAReceber(''); }} title={editandoId ? 'Editar A Receber' : 'Novo A Receber'} size="md">
        <div className="space-y-4">
          {erroAReceber && (
            <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:border-warning-800 dark:bg-warning-900/20 dark:text-warning-300">
              {erroAReceber}
            </div>
          )}
          <Input id="ar-pessoa" label="Pessoa / origem" required value={formAReceber.pessoa} onChange={e => setFormAReceber(f => ({ ...f, pessoa: e.target.value }))} placeholder="Ex: Cliente, empresa, familiar..." />
          <Input id="ar-desc" label="Descrição" required value={formAReceber.descricao} onChange={e => setFormAReceber(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Reembolso, freelance..." />
          <Select
            id="ar-tipo-recebimento"
            label="Tipo de recebimento"
            value={formAReceber.tipoRecebimento ?? 'unico'}
            onChange={e => setFormAReceber(f => ({
              ...f,
              tipoRecebimento: e.target.value as AReceber['tipoRecebimento'],
              totalParcelas: e.target.value === 'parcelado' ? f.totalParcelas ?? 2 : undefined,
              parcelaAtual: undefined,
              grupoRecebimentoId: e.target.value === 'parcelado' ? f.grupoRecebimentoId : f.grupoRecebimentoId,
              status: e.target.value === 'parcelado' ? 'a_receber' : f.status,
            }))}
          >
            <option value="unico">Única parcela</option>
            <option value="parcelado">Parcelado</option>
          </Select>
          <Input
            id="ar-valor"
            label={(formAReceber.tipoRecebimento ?? 'unico') === 'parcelado' ? 'Valor total (R$)' : 'Valor (R$)'}
            required
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={formAReceberValorStr}
            onChange={e => setFormAReceberValorStr(e.target.value)}
          />
          {(formAReceber.tipoRecebimento ?? 'unico') === 'parcelado' && (
            <Input
              id="ar-total-parcelas"
              label="Quantidade de parcelas"
              required
              type="number"
              min="2"
              max="120"
              value={formAReceber.totalParcelas ?? 2}
              onChange={e => setFormAReceber(f => ({ ...f, totalParcelas: Math.max(2, Number(e.target.value) || 2) }))}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Select id="ar-mes" label={(formAReceber.tipoRecebimento ?? 'unico') === 'parcelado' ? 'Mês inicial' : 'Mês'} value={String(formAReceber.mes)} onChange={e => setFormAReceber(f => ({ ...f, mes: Number(e.target.value) }))}>
              {MESES.map((mes, i) => <option key={mes} value={i + 1}>{mes}</option>)}
            </Select>
            <Input id="ar-ano" label={(formAReceber.tipoRecebimento ?? 'unico') === 'parcelado' ? 'Ano inicial' : 'Ano'} type="number" min="2020" max="2035" value={formAReceber.ano} onChange={e => setFormAReceber(f => ({ ...f, ano: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="ar-dia-previsto"
              label="Dia previsto"
              type="number"
              min="1"
              max="31"
              value={formAReceber.diaPrevisto ?? ''}
              onChange={e => setFormAReceber(f => ({ ...f, diaPrevisto: e.target.value ? Number(e.target.value) : undefined }))}
            />
            <Select id="ar-forma-prevista" label="Forma prevista" value={formAReceber.formaPrevista ?? ''} onChange={e => setFormAReceber(f => ({ ...f, formaPrevista: e.target.value || undefined }))}>
              <option value="">Não definida</option>
              <option value="PIX">PIX</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Transferência">Transferência</option>
              <option value="Débito">Débito</option>
              <option value="Boleto">Boleto</option>
              <option value="Outro">Outro</option>
            </Select>
          </div>
          <Select id="ar-status" label="Status" value={formAReceber.status} disabled={!editandoId && (formAReceber.tipoRecebimento ?? 'unico') === 'parcelado'} onChange={e => setFormAReceber(f => ({ ...f, status: e.target.value as AReceber['status'], dataRecebimento: e.target.value === 'recebido' ? hojeISO() : undefined }))}>
            <option value="a_receber">A receber</option>
            <option value="recebido">Recebido</option>
            <option value="cancelado">Cancelado</option>
          </Select>
          <Textarea id="ar-obs" label="Observação" value={formAReceber.observacao ?? ''} onChange={e => setFormAReceber(f => ({ ...f, observacao: e.target.value }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setModal(null); setErroAReceber(''); }}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarAReceber}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
