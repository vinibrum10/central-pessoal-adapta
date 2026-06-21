import { useState, useCallback, useMemo } from 'react';
import {
  Plus, Trash2, Pencil, TrendingUp, TrendingDown,
  CreditCard, AlertTriangle, PiggyBank, Package,
  ChevronLeft, ChevronRight, Info
} from 'lucide-react';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
import { useApp } from '../hooks/useApp';
import { useAuth } from '../contexts/AuthContext';
import { canCreateExpense, canEditExpense, canDeleteExpense } from '../utils/permissions';
import type {
  Receita, Despesa, Cartao, Divida, Reserva, Bem,
  CategoriaFinanceira, FormaPagamento, StatusCartao,
  PrioridadeQuitacao, StatusBem, TipoBem, FaturaCartao
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
import { formatarDinheiro, formatarData, isoParaDataBR, gerarId, hojeISO } from '../utils';

const SELECT_CLASS = 'px-1.5 py-2 rounded-lg border text-sm bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500';

function DateSelectBR({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // ISO format: YYYY-MM-DD → partes[0]=ano, partes[1]=mes, partes[2]=dia
  const partes = value ? value.split('-').map(Number) : [];
  const curY = partes[0] ?? new Date().getFullYear();
  const curM = partes[1] ?? new Date().getMonth() + 1;
  const curD = partes[2] ?? new Date().getDate();
  const diasNoMes = new Date(curY, curM, 0).getDate();
  const clampDay = (day: number, mon: number, yr: number) => Math.min(day, new Date(yr, mon, 0).getDate());
  const emit = (day: number, mon: number, yr: number) =>
    onChange(`${yr}-${String(mon).padStart(2,'0')}-${String(clampDay(day, mon, yr)).padStart(2,'0')}`);
  return (
    <div>
      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">{label}</label>
      <div className="flex gap-1">
        <select value={curD} onChange={e => emit(Number(e.target.value), curM, curY)} className={`w-16 ${SELECT_CLASS}`}>
          {Array.from({length: diasNoMes}, (_, i) => i + 1).map(n => <option key={n} value={n}>{String(n).padStart(2,'0')}</option>)}
        </select>
        <select value={curM} onChange={e => emit(curD, Number(e.target.value), curY)} className={`flex-1 ${SELECT_CLASS}`}>
          {MESES.map((mes, i) => <option key={i} value={i+1}>{mes}</option>)}
        </select>
        <select value={curY} onChange={e => emit(curD, curM, Number(e.target.value))} className={`w-24 ${SELECT_CLASS}`}>
          {[-1,0,1,2,3].map(offset => { const yr = new Date().getFullYear() + offset; return <option key={yr} value={yr}>{yr}</option>; })}
        </select>
      </div>
    </div>
  );
}

type TipoCobrancaCartao = 'avista' | 'parcelado';

interface FormDespesaExtra {
  tipoCobrancaCartao: TipoCobrancaCartao;
  quantidadeParcelas: number;
  mesInicioParcelas: string;
}

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

type Aba = 'resumo' | 'receitas' | 'despesas' | 'cartoes' | 'dividas' | 'reserva' | 'bens';

const categoriasReceita: CategoriaFinanceira[] = ['Salário', 'Freelance', 'Investimentos', 'Outros'];
const categoriasDespesa: CategoriaFinanceira[] = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Dívidas', 'Cartão', 'Reserva', 'Outros'];
const formasPagamento: FormaPagamento[] = ['Dinheiro', 'Cartão de crédito', 'Débito', 'PIX', 'Boleto', 'Transferência'];

export function OrcamentoPage() {
  const { data, setData } = useApp();
  const { perfil } = useAuth();
  const [aba, setAba] = useState<Aba>('resumo');
  const [modal, setModal] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mesFiltro, setMesFiltro] = useState(() => { const h = new Date(); return { mes: h.getMonth(), ano: h.getFullYear() }; });
  const [cartaoSelecionadoId, setCartaoSelecionadoId] = useState<string>('');
  const [modalFatura, setModalFatura] = useState<{ cartaoId: string; competencia: string } | null>(null);
  const [formFatura, setFormFatura] = useState<{ valorInformado: number; observacoes: string }>({ valorInformado: 0, observacoes: '' });

  // Forms
  const [formReceita, setFormReceita] = useState<Omit<Receita, 'id' | 'dataCriacao'>>({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Salário', recorrente: false });
  const [formDespesa, setFormDespesa] = useState<Omit<Despesa, 'id' | 'dataCriacao'>>({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Alimentação', formaPagamento: 'PIX', recorrente: false, essencial: true });
  const [formDespesaExtra, setFormDespesaExtra] = useState<FormDespesaExtra>({ tipoCobrancaCartao: 'avista', quantidadeParcelas: 2, mesInicioParcelas: hojeISO().slice(0, 7) });
  const [formCartao, setFormCartao] = useState<Omit<Cartao, 'id' | 'dataCriacao'>>({ nome: '', limite: 0, faturaAtual: 0, vencimento: 10, status: 'ativo', diaFechamento: undefined });
  const [formDivida, setFormDivida] = useState<Omit<Divida, 'id' | 'dataCriacao'>>({ nome: '', valorTotal: 0, valorParcela: 0, totalParcelas: 1, parcelasPagas: 0, taxaJuros: 0, prioridadeQuitacao: 'média', dataInicio: hojeISO(), diaVencimento: 10, status: 'ativa' });
  const [formReserva, setFormReserva] = useState<Omit<Reserva, 'id' | 'dataCriacao'>>({ nome: '', metaReserva: 0, valorAtual: 0, prazoDesejado: '' });
  const [formBem, setFormBem] = useState<Omit<Bem, 'id' | 'dataCriacao'>>({ nome: '', tipo: 'Carro', valorEstimado: 0, status: 'manter', observacoes: '' });

  // Resumo financeiro do mês filtrado
  const receitasFiltradas = data.receitas.filter(r => new Date(r.data).getMonth() === mesFiltro.mes && new Date(r.data).getFullYear() === mesFiltro.ano);
  // Despesas: não-cartão filtra por data da compra; cartão filtra pela competência da fatura
  const despesasFiltradas = data.despesas.filter(d => {
    if (d.formaPagamento !== 'Cartão de crédito' || !d.faturaId) {
      return new Date(d.data).getMonth() === mesFiltro.mes && new Date(d.data).getFullYear() === mesFiltro.ano;
    }
    const fatura = (data.faturas ?? []).find(f => f.id === d.faturaId);
    if (!fatura) return new Date(d.data).getMonth() === mesFiltro.mes && new Date(d.data).getFullYear() === mesFiltro.ano;
    const [fAno, fMes] = fatura.competencia.split('-').map(Number);
    return fMes === mesFiltro.mes + 1 && fAno === mesFiltro.ano;
  });
  const receitasMes = receitasFiltradas.reduce((a, r) => a + r.valor, 0);

  // Despesas que NÃO são cartão de crédito (evita duplicação com faturas)
  const despesasSemCartao = despesasFiltradas.filter(d => d.formaPagamento !== 'Cartão de crédito');
  // Faturas com competência no mês filtrado
  const faturasMes = (data.faturas ?? []).filter(f => {
    const [anoStr, mesStr] = f.competencia.split('-');
    return Number(mesStr) === mesFiltro.mes + 1 && Number(anoStr) === mesFiltro.ano;
  });
  // Total do mês = despesas sem cartão + valor efetivo das faturas
  const despesasMes = despesasSemCartao.reduce((a, d) => a + d.valor, 0)
    + faturasMes.reduce((a, f) => a + calcularValorEfetivo(f), 0);
  const saldoMes = receitasMes - despesasMes;
  const totalDividas = data.dividas.reduce((a, d) => a + Math.max(0, d.valorTotal - calcularParcelasPagasAuto(d) * d.valorParcela), 0);
  const totalReservas = data.reservas.reduce((a, r) => a + r.valorAtual, 0);
  const totalMetaReservas = data.reservas.reduce((a, r) => a + r.metaReserva, 0);

  // Competência atual no formato YYYY-MM
  const competenciaAtual = useMemo(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
  }, []);

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
  };

  const salvarFatura = useCallback(() => {
    if (!modalFatura) return;
    const { cartaoId, competencia } = modalFatura;
    setData(d => {
      const faturasAtual = [...(d.faturas ?? [])];
      const { fatura, isNova } = obterOuCriarFatura(cartaoId, competencia, faturasAtual);
      const faturaAtualizada: FaturaCartao = {
        ...fatura,
        valorInformado: formFatura.valorInformado > 0 ? formFatura.valorInformado : null,
        observacoes: formFatura.observacoes || undefined,
      };
      const faturaRecalculada = recalcularFatura(faturaAtualizada, d.despesas);
      if (isNova) {
        return { ...d, faturas: [...faturasAtual, faturaRecalculada] };
      }
      return { ...d, faturas: faturasAtual.map(f => f.id === faturaRecalculada.id ? faturaRecalculada : f) };
    });
  }, [modalFatura, formFatura, setData]);

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
          descricao: 'Ajuste de fatura não detalhado',
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
        };
        novasDespesas = [...d.despesas, novaDespesa];
      }
      const faturasAtual = (d.faturas ?? []).map(f =>
        f.id === fatura.id ? recalcularFatura(f, novasDespesas) : f
      );
      return { ...d, despesas: novasDespesas, faturas: faturasAtual };
    });
  }, [setData]);

  const salvarReceita = useCallback(() => {
    setData(d => ({
      ...d,
      receitas: editandoId
        ? d.receitas.map(r => r.id === editandoId ? { ...r, ...formReceita } : r)
        : [...d.receitas, { id: gerarId(), ...formReceita, dataCriacao: hojeISO() }],
    }));
    setModal(null);
    setEditandoId(null);
    setFormReceita({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Salário', recorrente: false });
  }, [formReceita, editandoId, setData]);

  const salvarDespesa = useCallback(() => {
    const isCartao = formDespesa.formaPagamento === 'Cartão de crédito';
    const isParcelado = isCartao && formDespesaExtra.tipoCobrancaCartao === 'parcelado' && !editandoId;

    if (isParcelado) {
      const qtd = formDespesaExtra.quantidadeParcelas;
      const valorParcela = formDespesa.valor / qtd;
      const grupoId = crypto.randomUUID();
      const [ano, mes] = formDespesaExtra.mesInicioParcelas.split('-').map(Number);
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
            descricao: `${formDespesa.descricao} — Parcela ${i + 1}/${qtd}`,
            valor: valorParcela,
            data: dataStr,
            categoria: formDespesa.categoria,
            formaPagamento: formDespesa.formaPagamento,
            recorrente: false,
            essencial: formDespesa.essencial,
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
    } else if (!editandoId && formDespesa.recorrente) {
      // Gera despesa do mês atual + próximos 11 meses (total 12)
      setData(d => {
        const dataBase = new Date(formDespesa.data + 'T12:00:00');
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
            dep.descricao === formDespesa.descricao &&
            new Date(dep.data).getMonth() === mesDt &&
            new Date(dep.data).getFullYear() === anoDt
          );
          if (!jaExiste) {
            novasDespesas.push({
              id: gerarId(),
              ...formDespesa,
              data: dataStr,
              dataCriacao: hojeISO(),
            });
          }
        }
        return { ...d, despesas: [...d.despesas, ...novasDespesas] };
      });
    } else {
      setData(d => {
        if (editandoId) {
          return {
            ...d,
            despesas: d.despesas.map(dep => dep.id === editandoId ? { ...dep, ...formDespesa } : dep),
          };
        }
        // Nova despesa à vista com cartão
        const cartaoId = isCartao && cartaoSelecionadoId ? cartaoSelecionadoId : undefined;
        const cartao = cartaoId ? d.cartoes.find(c => c.id === cartaoId) : undefined;
        let faturasAtual = [...(d.faturas ?? [])];
        let faturaId: string | undefined;

        if (cartaoId) {
          const competencia = obterCompetenciaFatura(formDespesa.data, cartao?.diaFechamento);
          const { fatura, isNova } = obterOuCriarFatura(cartaoId, competencia, faturasAtual);
          if (isNova) faturasAtual = [...faturasAtual, fatura];
          faturaId = fatura.id;
        }

        const novaDespesa: Despesa = {
          id: gerarId(),
          ...formDespesa,
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
    setFormDespesaExtra({ tipoCobrancaCartao: 'avista', quantidadeParcelas: 2, mesInicioParcelas: hojeISO().slice(0, 7) });
  }, [formDespesa, formDespesaExtra, editandoId, setData]);

  const salvarCartao = useCallback(() => {
    setData(d => ({
      ...d,
      cartoes: editandoId
        ? d.cartoes.map(c => c.id === editandoId ? { ...c, ...formCartao } : c)
        : [...d.cartoes, { id: gerarId(), ...formCartao, dataCriacao: hojeISO() }],
    }));
    setModal(null);
  }, [formCartao, editandoId, setData]);

  const salvarDivida = useCallback(() => {
    setData(d => ({
      ...d,
      dividas: editandoId
        ? d.dividas.map(div => div.id === editandoId ? { ...div, ...formDivida } : div)
        : [...d.dividas, { id: gerarId(), ...formDivida, dataCriacao: hojeISO() }],
    }));
    setModal(null);
  }, [formDivida, editandoId, setData]);

  const salvarReserva = useCallback(() => {
    setData(d => ({
      ...d,
      reservas: editandoId
        ? d.reservas.map(r => r.id === editandoId ? { ...r, ...formReserva } : r)
        : [...d.reservas, { id: gerarId(), ...formReserva, dataCriacao: hojeISO() }],
    }));
    setModal(null);
  }, [formReserva, editandoId, setData]);

  const salvarBem = useCallback(() => {
    setData(d => ({
      ...d,
      bens: editandoId
        ? d.bens.map(b => b.id === editandoId ? { ...b, ...formBem } : b)
        : [...d.bens, { id: gerarId(), ...formBem, dataCriacao: hojeISO() }],
    }));
    setModal(null);
  }, [formBem, editandoId, setData]);

  const tabs: { id: Aba; label: string }[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'receitas', label: 'Receitas' },
    { id: 'despesas', label: 'Despesas' },
    { id: 'cartoes', label: 'Cartões' },
    { id: 'dividas', label: 'Dívidas' },
    { id: 'reserva', label: 'Reserva' },
    { id: 'bens', label: 'Bens' },
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
      <div className="flex overflow-x-auto gap-1 pb-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setAba(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${aba === tab.id ? 'bg-primary-600 text-white' : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* RESUMO */}
      {aba === 'resumo' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Receitas do mês', valor: receitasMes, icon: <TrendingUp size={18} />, cor: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/20' },
              { label: 'Despesas do mês', valor: despesasMes, icon: <TrendingDown size={18} />, cor: 'text-danger-600 dark:text-danger-400', bg: 'bg-danger-50 dark:bg-danger-900/20' },
              { label: 'Total de dívidas', valor: totalDividas, icon: <AlertTriangle size={18} />, cor: 'text-warning-600 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-warning-900/20' },
              { label: 'Reserva atual', valor: totalReservas, icon: <PiggyBank size={18} />, cor: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20' },
            ].map(item => (
              <Card key={item.label}>
                <CardBody>
                  <div className={`w-9 h-9 rounded-lg ${item.bg} ${item.cor} flex items-center justify-center mb-3`}>{item.icon}</div>
                  <p className={`text-xl font-bold ${item.cor}`}>{formatarDinheiro(item.valor)}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{item.label}</p>
                </CardBody>
              </Card>
            ))}
          </div>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Saldo do mês</span>
                <span className={`text-lg font-bold ${saldoMes >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                  {formatarDinheiro(saldoMes)}
                </span>
              </div>
              <ProgressBar value={receitasMes > 0 ? Math.min(100, (despesasMes / receitasMes) * 100) : 0} color={despesasMes / receitasMes > 0.9 ? 'danger' : 'primary'} height="md" />
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                {receitasMes > 0 ? `${Math.round((despesasMes / receitasMes) * 100)}% da renda comprometida` : 'Sem receitas cadastradas este mês'}
              </p>
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
            <Button icon={<Plus size={16} />} onClick={() => { setFormReceita({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Salário', recorrente: false }); abrirModal('receita'); }}>
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
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-200 dark:border-surface-700">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-success-50 dark:bg-success-900/20 flex items-center justify-center">
                          <TrendingUp size={14} className="text-success-600 dark:text-success-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-900 dark:text-white">{r.descricao}</p>
                          <p className="text-xs text-surface-400 dark:text-surface-500">{formatarData(r.data)} · {r.categoria}{r.recorrente ? ' · Recorrente' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-success-600 dark:text-success-400">{formatarDinheiro(r.valor)}</span>
                        <button onClick={() => { setFormReceita({ descricao: r.descricao, valor: r.valor, data: r.data, categoria: r.categoria, recorrente: r.recorrente }); abrirModal('receita', r); }} className="p-1.5 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
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
              <Button icon={<Plus size={16} />} onClick={() => { setFormDespesa({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Alimentação', formaPagamento: 'PIX', recorrente: false, essencial: true }); setFormDespesaExtra({ tipoCobrancaCartao: 'avista', quantidadeParcelas: 2, mesInicioParcelas: hojeISO().slice(0, 7) }); abrirModal('despesa'); }}>
                Nova Despesa
              </Button>
            )}
          </div>
          <Card>
            <CardBody className="!px-4 !pb-4">
              {despesasFiltradas.length === 0 ? (
                <p className="text-center py-8 text-surface-400">Nenhuma despesa em {MESES[mesFiltro.mes]} {mesFiltro.ano}</p>
              ) : (
                <div className="space-y-2">
                  {despesasFiltradas.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-200 dark:border-surface-700">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${d.essencial ? 'bg-surface-100 dark:bg-surface-700' : 'bg-warning-50 dark:bg-warning-900/20'}`}>
                          <TrendingDown size={14} className="text-danger-600 dark:text-danger-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-900 dark:text-white">{d.descricao}</p>
                          <p className="text-xs text-surface-400 dark:text-surface-500">
                            {formatarData(d.data)} · {d.categoria} · {d.formaPagamento}
                            {!d.essencial && ' · ⚠ Não essencial'}
                            {d.recorrente && ' · Recorrente'}
                            {d.faturaId && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-[10px] font-medium">Compõe fatura do cartão</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-danger-600 dark:text-danger-400">{formatarDinheiro(d.valor)}</span>
                        {canEditExpense(perfil) && (
                          <button onClick={() => { setFormDespesa({ descricao: d.descricao, valor: d.valor, data: d.data, categoria: d.categoria, formaPagamento: d.formaPagamento, recorrente: d.recorrente, essencial: d.essencial }); abrirModal('despesa', d); }} className="p-1.5 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                        )}
                        {canDeleteExpense(perfil) && (
                          <button onClick={() => setData(prev => ({ ...prev, despesas: prev.despesas.filter(x => x.id !== d.id) }))} className="p-1.5 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                        )}
                      </div>
                    </div>
                  ))}
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
            <Button icon={<Plus size={16} />} onClick={() => { setFormCartao({ nome: '', limite: 0, faturaAtual: 0, vencimento: 10, status: 'ativo', diaFechamento: undefined }); abrirModal('cartao'); }}>
              Novo Cartão
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.cartoes.map(c => (
              <Card key={c.id}>
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                        <CreditCard size={14} className="text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-surface-900 dark:text-white text-sm">{c.nome}</p>
                        <p className="text-xs text-surface-400">Vence dia {c.vencimento}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setFormCartao({ nome: c.nome, limite: c.limite, faturaAtual: c.faturaAtual, vencimento: c.vencimento, status: c.status, diaFechamento: c.diaFechamento }); abrirModal('cartao', c); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => setData(d => ({ ...d, cartoes: d.cartoes.filter(x => x.id !== c.id) }))} className="p-1 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {(() => {
                    const faturasMesAtual = (data.faturas ?? []).filter(f => f.cartaoId === c.id && f.competencia === competenciaAtual);
                    const faturaAtualMes = faturasMesAtual[0];
                    const valorEfetivo = faturaAtualMes ? calcularValorEfetivo(faturaAtualMes) : c.faturaAtual;
                    const usarLimite = c.limite > 0;
                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-surface-500">Fatura {MESES[mesFiltro.mes]}</span>
                          <span className="font-semibold text-danger-600 dark:text-danger-400">{formatarDinheiro(valorEfetivo)}</span>
                        </div>
                        {faturaAtualMes && (
                          <>
                            <div className="flex justify-between text-xs text-surface-400">
                              <span>Já detalhado</span>
                              <span>{formatarDinheiro(faturaAtualMes.valorDetalhado)}</span>
                            </div>
                            {faturaAtualMes.valorInformado !== null && faturaAtualMes.diferenca !== 0 && (
                              <div className={`flex justify-between text-xs ${faturaAtualMes.diferenca > 0 ? 'text-warning-500' : 'text-danger-500'}`}>
                                <span>Diferença</span>
                                <span>{formatarDinheiro(Math.abs(faturaAtualMes.diferenca))}{faturaAtualMes.diferenca < 0 ? ' (excede!)' : ''}</span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-surface-500">Limite</span>
                          <span className="text-surface-700 dark:text-surface-300">{formatarDinheiro(c.limite)}</span>
                        </div>
                        {usarLimite && <ProgressBar value={(valorEfetivo / c.limite) * 100} color={valorEfetivo / c.limite > 0.8 ? 'danger' : valorEfetivo / c.limite > 0.5 ? 'warning' : 'success'} showLabel height="md" />}
                        <button
                          onClick={() => abrirModalFatura(c.id, competenciaAtual)}
                          className="w-full mt-1 text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 justify-center"
                        >
                          <Info size={12} /> Informar valor da fatura
                        </button>
                      </div>
                    );
                  })()}
                </CardBody>
              </Card>
            ))}
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
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-surface-900 dark:text-white">{d.nome}</p>
                          {statusD === 'quitada' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 font-medium">Quitada</span>}
                          {statusD === 'pausada' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Pausada</span>}
                        </div>
                        <p className="text-xs text-surface-400 dark:text-surface-500">
                          {parcelasPagasAuto}/{d.totalParcelas} parcelas · {d.taxaJuros > 0 ? `${d.taxaJuros}% a.a.` : 'Sem juros'}
                          {d.dataInicio && ` · Início: ${isoParaDataBR(d.dataInicio)}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setFormDivida({ nome: d.nome, valorTotal: d.valorTotal, valorParcela: d.valorParcela, totalParcelas: d.totalParcelas, parcelasPagas: d.parcelasPagas, taxaJuros: d.taxaJuros, prioridadeQuitacao: d.prioridadeQuitacao, dataInicio: d.dataInicio ?? hojeISO(), diaVencimento: d.diaVencimento ?? 10, status: d.status ?? 'ativa' }); abrirModal('divida', d); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setData(prev => ({ ...prev, dividas: prev.dividas.filter(x => x.id !== d.id) }))} className="p-1 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-surface-500">Saldo devedor</span>
                      <span className={`font-bold ${saldo > 0 ? 'text-danger-600 dark:text-danger-400' : 'text-success-600 dark:text-success-400'}`}>{formatarDinheiro(saldo)}</span>
                    </div>
                    <ProgressBar value={progresso} showLabel color="success" height="md" />
                    <div className="flex justify-between text-xs text-surface-400 mt-1">
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
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-surface-900 dark:text-white">{r.nome}</p>
                      {r.prazoDesejado && <p className="text-xs text-surface-400">Prazo: {formatarData(r.prazoDesejado)}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setFormReserva({ nome: r.nome, metaReserva: r.metaReserva, valorAtual: r.valorAtual, prazoDesejado: r.prazoDesejado }); abrirModal('reserva', r); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => setData(d => ({ ...d, reservas: d.reservas.filter(x => x.id !== r.id) }))} className="p-1 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-surface-500">Acumulado</span>
                    <span className="font-bold text-primary-600 dark:text-primary-400">{formatarDinheiro(r.valorAtual)} / {formatarDinheiro(r.metaReserva)}</span>
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
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
                        <Package size={18} className="text-surface-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-surface-900 dark:text-white">{b.nome}</p>
                        <p className="text-xs text-surface-400">{b.tipo} · {b.status}</p>
                        {b.observacoes && <p className="text-xs text-surface-400 italic mt-0.5">{b.observacoes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-surface-700 dark:text-surface-300">{formatarDinheiro(b.valorEstimado)}</span>
                      <button onClick={() => { setFormBem({ nome: b.nome, tipo: b.tipo, valorEstimado: b.valorEstimado, status: b.status, observacoes: b.observacoes }); abrirModal('bem', b); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
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

      {/* MODAIS */}
      <Modal isOpen={modal === 'receita'} onClose={() => setModal(null)} title={editandoId ? 'Editar Receita' : 'Nova Receita'}>
        <div className="space-y-4">
          <Input id="rec-desc" label="Descrição" required value={formReceita.descricao} onChange={e => setFormReceita(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Salário, freelance..." />
          <div className="grid grid-cols-2 gap-3">
            <Input id="rec-valor" label="Valor (R$)" required type="number" min="0" step="0.01" value={formReceita.valor || ''} onChange={e => setFormReceita(f => ({ ...f, valor: Number(e.target.value) }))} />
            <DateSelectBR label="Data" value={formReceita.data} onChange={v => setFormReceita(f => ({ ...f, data: v }))} />
          </div>
          <Select id="rec-cat" label="Categoria" value={formReceita.categoria} onChange={e => setFormReceita(f => ({ ...f, categoria: e.target.value as CategoriaFinanceira }))}>
            {categoriasReceita.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Checkbox id="rec-rec" label="Receita recorrente" checked={formReceita.recorrente} onChange={e => setFormReceita(f => ({ ...f, recorrente: e.target.checked }))} />
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
            <Input id="desp-valor" label="Valor (R$)" required type="number" min="0" step="0.01" value={formDespesa.valor || ''} onChange={e => setFormDespesa(f => ({ ...f, valor: Number(e.target.value) }))} />
            <DateSelectBR label="Data" value={formDespesa.data} onChange={v => setFormDespesa(f => ({ ...f, data: v }))} />
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
                  {formDespesa.valor > 0 && formDespesaExtra.quantidadeParcelas >= 2 && (
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      Valor por parcela: <strong>{formatarDinheiro(formDespesa.valor / formDespesaExtra.quantidadeParcelas)}</strong>
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
              const valorParcela = formDespesa.valor / qtd;
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
            <Button className="flex-1" onClick={salvarDespesa}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'cartao'} onClose={() => setModal(null)} title={editandoId ? 'Editar Cartão' : 'Novo Cartão'}>
        <div className="space-y-4">
          <Input id="cart-nome" label="Nome do cartão" required value={formCartao.nome} onChange={e => setFormCartao(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Nubank, Bradesco..." />
          <div className="grid grid-cols-2 gap-3">
            <Input id="cart-limite" label="Limite (R$)" type="number" min="0" value={formCartao.limite || ''} onChange={e => setFormCartao(f => ({ ...f, limite: Number(e.target.value) }))} />
            <Input id="cart-fatura" label="Fatura atual (R$)" type="number" min="0" value={formCartao.faturaAtual || ''} onChange={e => setFormCartao(f => ({ ...f, faturaAtual: Number(e.target.value) }))} />
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
            <Input id="div-total" label="Valor total (R$)" type="number" min="0" value={formDivida.valorTotal || ''} onChange={e => setFormDivida(f => ({ ...f, valorTotal: Number(e.target.value) }))} />
            <Input id="div-parcela" label="Valor parcela (R$)" type="number" min="0" value={formDivida.valorParcela || ''} onChange={e => setFormDivida(f => ({ ...f, valorParcela: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="div-totparc" label="Total de parcelas" type="number" min="1" value={formDivida.totalParcelas} onChange={e => setFormDivida(f => ({ ...f, totalParcelas: Number(e.target.value) }))} />
            <Input id="div-pagas" label="Parcelas pagas" type="number" min="0" value={formDivida.parcelasPagas} onChange={e => setFormDivida(f => ({ ...f, parcelasPagas: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DateSelectBR label="Data início" value={formDivida.dataInicio ?? hojeISO()} onChange={v => setFormDivida(f => ({ ...f, dataInicio: v }))} />
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
            <Input id="res-meta" label="Meta (R$)" type="number" min="0" value={formReserva.metaReserva || ''} onChange={e => setFormReserva(f => ({ ...f, metaReserva: Number(e.target.value) }))} />
            <Input id="res-atual" label="Valor atual (R$)" type="number" min="0" value={formReserva.valorAtual || ''} onChange={e => setFormReserva(f => ({ ...f, valorAtual: Number(e.target.value) }))} />
          </div>
          <DateSelectBR label="Prazo desejado" value={formReserva.prazoDesejado || hojeISO()} onChange={v => setFormReserva(f => ({ ...f, prazoDesejado: v }))} />
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
          const mesIdx = Number(mesStr) - 1;
          const cartao = data.cartoes.find(c => c.id === modalFatura.cartaoId);

          return (
            <div className="space-y-4">
              <div className="text-sm text-surface-500 dark:text-surface-400">
                Cartão: <strong className="text-surface-800 dark:text-white">{cartao?.nome ?? '—'}</strong> · {MESES[mesIdx]} {anoStr}
              </div>
              <Input
                id="fat-valor"
                label="Valor total da fatura (R$)"
                type="number"
                min="0"
                step="0.01"
                value={formFatura.valorInformado || ''}
                onChange={e => setFormFatura(f => ({ ...f, valorInformado: Number(e.target.value) }))}
                placeholder="Digite o valor da fatura"
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

      <Modal isOpen={modal === 'bem'} onClose={() => setModal(null)} title={editandoId ? 'Editar Bem' : 'Novo Bem'}>
        <div className="space-y-4">
          <Input id="bem-nome" label="Nome do bem" required value={formBem.nome} onChange={e => setFormBem(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: HB20 2019, Casa na rua..." />
          <div className="grid grid-cols-2 gap-3">
            <Select id="bem-tipo" label="Tipo" value={formBem.tipo} onChange={e => setFormBem(f => ({ ...f, tipo: e.target.value as TipoBem }))}>
              {(['Casa', 'Carro', 'Eletrônico', 'Móvel', 'Outro'] as TipoBem[]).map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input id="bem-valor" label="Valor estimado (R$)" type="number" min="0" value={formBem.valorEstimado || ''} onChange={e => setFormBem(f => ({ ...f, valorEstimado: Number(e.target.value) }))} />
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
    </div>
  );
}
