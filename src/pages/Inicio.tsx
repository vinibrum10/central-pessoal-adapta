import { useState, useMemo, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Target, ListChecks, Zap, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, ArrowRight, ChevronRight,
  Clock, RefreshCw, Lightbulb, Wallet,
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import {
  formatarDinheiro, calcularMinutosDisponiveis, formatarMinutos,
  eAtrasada, revisaoAtrasada, corClassificacaoPrazo, labelClassificacaoPrazo,
} from '../utils';
import {
  obterResumoDashboard, obterRankingMetas, obterMetasEmAtencao,
  obterAcoesPorStatus, obterAcoesPorFaixa, obterMetasPorCategoria,
  obterFocoRecomendado, bgSaude, labelSaude, corGrau,
  siglaFaixaDash, corFaixaDash, type SaudeMeta,
} from '../utils/dashboardMetrics';
import { Button } from '../components/Button';
import { BrandHeader } from '../components/BrandHeader';

// recharts é pesado (só usado aqui) — vira um chunk à parte, carregado sob
// demanda e com Suspense próprio, para não bloquear o resto do dashboard.
const InicioCharts = lazy(() => import('./InicioCharts'));

function ChartsFallback() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-sm h-[220px] flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// TIPOS
// ============================================================
type FiltroCategoria = 'Todas' | 'Profissão' | 'Estudos' | 'Finanças' | 'Projetos' | 'Desenvolvimento Pessoal';
type FiltroSaude = 'todas' | SaudeMeta;

// ============================================================
// KPI CARD GRADIENTE
// ============================================================
function KpiCard({
  label, value, sub, cor, icon, accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  cor?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  icon?: React.ReactNode;
  /** Borda lateral colorida sutil por categoria */
  accent?: 'meta' | 'exec' | 'alerta' | 'financas' | 'none';
}) {
  const paleta = {
    blue:   'bg-primary-50 text-primary-700 ring-primary-100 dark:bg-primary-500/10 dark:text-primary-300 dark:ring-primary-500/20',
    green:  'bg-success-50 text-success-700 ring-success-100 dark:bg-success-500/10 dark:text-success-300 dark:ring-success-500/20',
    yellow: 'bg-warning-50 text-warning-600 ring-warning-100 dark:bg-warning-500/10 dark:text-warning-300 dark:ring-warning-500/20',
    red:    'bg-danger-50 text-danger-700 ring-danger-100 dark:bg-danger-500/10 dark:text-danger-300 dark:ring-danger-500/20',
    purple: 'bg-surface-100 text-surface-700 ring-surface-200 dark:bg-white/10 dark:text-surface-200 dark:ring-white/10',
    gray:   'bg-surface-100 text-surface-700 ring-surface-200 dark:bg-white/10 dark:text-surface-200 dark:ring-white/10',
  };
  const accentBorder: Record<string, string> = {
    meta:     'border-l-[3px] border-l-primary-500 dark:border-l-primary-300',
    exec:     'border-l-[3px] border-l-sky-500 dark:border-l-sky-400',
    alerta:   'border-l-[3px] border-l-warning-500 dark:border-l-warning-400',
    financas: 'border-l-[3px] border-l-success-600 dark:border-l-success-400',
    none:     '',
  };
  const tone = paleta[cor ?? 'blue'];
  const accentClass = accentBorder[accent ?? 'none'] ?? '';

  return (
    <div className={`mobile-card relative overflow-hidden rounded-lg border border-surface-200/80 bg-white/90 px-4 py-3 shadow-sm shadow-surface-200/50 backdrop-blur-sm dark:border-primary-300/15 dark:bg-surface-950/55 dark:shadow-black/25 ${accentClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="mobile-clamp-2 text-[10px] font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400 leading-tight">{label}</p>
          <p className="mt-1 money-responsive font-semibold tracking-tight leading-none text-surface-950 dark:text-white">{value}</p>
          {sub && <p className="mobile-clamp-2 mt-1 text-[10px] text-surface-500 dark:text-surface-400 leading-tight">{sub}</p>}
        </div>
        {icon && <div className={`hidden sm:flex flex-shrink-0 rounded-lg p-2 ring-1 ${tone}`}>{icon}</div>}
      </div>
    </div>
  );
}

// ============================================================
// GAUGE DE EFICIÊNCIA
// ============================================================
function EficienciaCard({ eficiencia, qtd }: { eficiencia: number; qtd: number }) {
  const strokeColor =
    eficiencia >= 85 ? '#86efac' :
    eficiencia >= 60 ? '#fde68a' :
    '#fca5a5';
  const label =
    eficiencia >= 85 ? 'Foco saudável' :
    eficiencia >= 60 ? 'Atenção' :
    'Risco de dispersão';

  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - eficiencia / 100);

  return (
    <div className="mobile-card relative overflow-hidden rounded-lg border border-surface-200/80 border-l-[3px] border-l-primary-500 bg-white/90 px-4 py-3 shadow-sm shadow-surface-200/50 backdrop-blur-sm dark:border-primary-300/15 dark:border-l-primary-300 dark:bg-surface-950/55 dark:shadow-black/25">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">Foco do dia</p>
      <div className="flex items-center gap-2 mt-1">
        <div className="relative flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14">
          <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 56 56" className="-rotate-90">
            <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="7" />
            <circle
              cx="28" cy="28" r={r} fill="none"
              stroke={strokeColor}
              strokeWidth="7"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs sm:text-base font-bold text-surface-950 dark:text-white">{eficiencia}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="mobile-clamp-2 text-sm font-semibold leading-tight text-surface-950 dark:text-white">{label}</p>
          <p className="mobile-clamp-2 text-[10px] text-surface-500 dark:text-surface-400 mt-0.5">{qtd} ativa{qtd !== 1 ? 's' : ''} · ideal ≤3</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PÁGINA
// ============================================================
export function InicioPage() {
  const { data } = useApp();
  const navigate = useNavigate();

  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>('Todas');
  const [filtroSaude, setFiltroSaude] = useState<FiltroSaude>('todas');

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  // Finanças — usa string parsing para evitar bug de fuso horário com datas ISO
  const receitasMes = data.receitas
    .filter(r => {
      const mesData = Number(r.data.slice(5, 7)) - 1;
      const anoData = Number(r.data.slice(0, 4));
      const mesRef = (r.mesReferencia ?? mesData + 1) - 1;
      const anoRef = r.anoReferencia ?? anoData;
      return mesRef === mesAtual && anoRef === anoAtual;
    })
    .reduce((acc, r) => acc + r.valor, 0);
  const despesasMes = data.despesas
    .filter(d => Number(d.data.slice(5, 7)) - 1 === mesAtual && Number(d.data.slice(0, 4)) === anoAtual)
    .reduce((acc, d) => acc + d.valor, 0);
  const saldoMes = receitasMes - despesasMes;
  const minutosDisponiveis = calcularMinutosDisponiveis(data.blocosTempo);

  // Métricas
  const resumo = useMemo(() => obterResumoDashboard(data.metas, data.tarefas), [data.metas, data.tarefas]);
  const rankingCompleto = useMemo(() => obterRankingMetas(data.metas, data.tarefas), [data.metas, data.tarefas]);
  const tarefasAtrasadas = useMemo(() =>
    data.tarefas.filter(t => t.status !== 'concluído' && t.prazo && eAtrasada(t.prazo)).length,
    [data.tarefas]
  );
  const revisoesAtrasadas = useMemo(() =>
    data.metas.filter(m => revisaoAtrasada(m)).length,
    [data.metas]
  );
  const metasAtencao = useMemo(() => obterMetasEmAtencao(data.metas, data.tarefas), [data.metas, data.tarefas]);
  const foco = useMemo(() => obterFocoRecomendado(data.metas, data.tarefas), [data.metas, data.tarefas]);
  const acoesPorStatus = useMemo(() => obterAcoesPorStatus(data.metas, data.tarefas), [data.metas, data.tarefas]);
  const acoesPorFaixa = useMemo(() => obterAcoesPorFaixa(data.metas, data.tarefas), [data.metas, data.tarefas]);
  const metasPorCategoria = useMemo(() => obterMetasPorCategoria(data.metas), [data.metas]);

  // Ranking com filtros
  const rankingFiltrado = useMemo(() =>
    rankingCompleto.filter(mm => {
      const catOk = filtroCategoria === 'Todas' || mm.meta.categoria === filtroCategoria;
      const saudeOk = filtroSaude === 'todas' || mm.saude === filtroSaude;
      return catOk && saudeOk;
    }),
    [rankingCompleto, filtroCategoria, filtroSaude]
  );

  // Dados para gráfico de atendimento
  const dadosAtendimento = useMemo(() =>
    rankingCompleto.map(mm => ({
      nome: mm.meta.nome.length > 24 ? mm.meta.nome.slice(0, 24) + '…' : mm.meta.nome,
      atendimento: mm.percentualAtendimento,
      grau: mm.meta.grau,
      fill: mm.percentualAtendimento >= 70 ? '#22c55e' : mm.percentualAtendimento >= 30 ? '#e11d2e' : '#ef4444',
    })),
    [rankingCompleto]
  );

  const categorias: FiltroCategoria[] = ['Todas', 'Profissão', 'Estudos', 'Finanças', 'Projetos', 'Desenvolvimento Pessoal'];
  const opcoesSaude: { v: FiltroSaude; label: string }[] = [
    { v: 'todas', label: 'Todas' },
    { v: 'crítica', label: 'Crítica' },
    { v: 'atenção', label: 'Atenção' },
    { v: 'boa', label: 'Boa' },
    { v: 'atendida', label: 'Atendida' },
    { v: 'sem ações', label: 'Sem ações' },
  ];

  return (
    <div className="page-stack max-w-screen-2xl mx-auto animate-fade-in pb-10">

      {/* ── CABEÇALHO ── */}
      <BrandHeader
        title="Sistema de Gestão Pessoal"
        subtitle={`Gestão integrada de rotina, estudos, agenda, orçamento e metas. ${format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`}
        actions={
          <>
          <Button size="sm" variant="secondary" onClick={() => navigate('/metas')} icon={<Target size={14} />}>
            Metas
          </Button>
          <Button size="sm" onClick={() => navigate('/plano')} icon={<ListChecks size={14} />}>
            Ver tarefas
          </Button>
          </>
        }
      />

      {/* ── KPIs — 4 GRUPOS ── */}
      <div className="space-y-3">
        {/* Grupo 1: Foco e Metas */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-surface-500 mb-2 px-0.5">Foco e Metas</p>
          <div className="grid grid-cols-1 min-[390px]:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="min-[390px]:col-span-2 lg:col-span-1">
              <EficienciaCard eficiencia={resumo.eficienciaFoco} qtd={resumo.metasAtivas} />
            </div>
            <KpiCard label="Metas ativas" value={resumo.metasAtivas} sub="Em andamento agora" cor="blue" icon={<Target size={36} />} accent="meta" />
            <KpiCard label="Metas futuras" value={resumo.metasFuturo} sub="Fora do foco atual" cor="purple" icon={<Lightbulb size={36} />} accent="meta" />
          </div>
        </div>

        {/* Grupo 2: Execução */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-surface-500 mb-2 px-0.5">Execução</p>
          <div className="grid grid-cols-1 min-[390px]:grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard label="Ações totais" value={resumo.acoesvinculas} sub="Vinculadas às metas ativas" cor="gray" icon={<ListChecks size={36} />} accent="exec" />
            <KpiCard label="Ações concluídas" value={resumo.acoesConcluidas} sub={resumo.acoesvinculas > 0 ? `${Math.round((resumo.acoesConcluidas / resumo.acoesvinculas) * 100)}% do total` : '—'} cor="green" icon={<CheckCircle2 size={36} />} accent="exec" />
            <KpiCard label="Conclusão das ações" value={`${resumo.atendimentoMedio}%`} sub="Média de progresso" cor={resumo.atendimentoMedio >= 70 ? 'green' : resumo.atendimentoMedio >= 30 ? 'yellow' : 'red'} icon={<TrendingUp size={36} />} accent="exec" />
          </div>
        </div>

        {/* Grupo 3: Alertas */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-surface-500 mb-2 px-0.5">Alertas</p>
          <div className="grid grid-cols-1 min-[390px]:grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard label="Metas em atenção" value={resumo.metasEmAtencao} sub="Crítica ou sem ações" cor={resumo.metasEmAtencao > 0 ? 'red' : 'green'} icon={<AlertTriangle size={36} />} accent="alerta" />
            <KpiCard label="Tarefas atrasadas" value={tarefasAtrasadas} sub="Prazo já passou" cor={tarefasAtrasadas > 0 ? 'red' : 'green'} icon={<Zap size={36} />} accent="alerta" />
            <KpiCard label="Revisões atrasadas" value={revisoesAtrasadas} sub="Metas sem revisão recente" cor={revisoesAtrasadas > 0 ? 'yellow' : 'green'} icon={<RefreshCw size={36} />} accent="alerta" />
          </div>
        </div>

        {/* Grupo 4: Apoio */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-surface-500 mb-2 px-0.5">Apoio</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <KpiCard
              label="Saldo do mês"
              value={formatarDinheiro(saldoMes)}
              sub={`R$ ${receitasMes.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} rec · R$ ${despesasMes.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} desp`}
              cor={saldoMes >= 0 ? 'green' : 'red'}
              icon={saldoMes >= 0 ? <TrendingUp size={36} /> : <TrendingDown size={36} />}
              accent="financas"
            />
            <div className="mobile-card relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 px-4 py-3 text-white shadow-md">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Tempo hoje</p>
              {minutosDisponiveis > 0 ? (
                <>
                  <p className="mt-1 money-responsive font-extrabold leading-none">{formatarMinutos(minutosDisponiveis)}</p>
                  <p className="mobile-clamp-2 mt-0.5 text-[10px] opacity-55">disponíveis hoje</p>
                </>
              ) : (
                <>
                  <p className="mobile-clamp-2 mt-1 text-base font-bold leading-none opacity-70">Não cadastrado</p>
                  <button onClick={() => navigate('/agenda')} className="mt-1 text-[10px] opacity-70 hover:opacity-100 underline">
                    Cadastrar →
                  </button>
                </>
              )}
              <div className="opacity-15 absolute right-2 bottom-1">
                <Clock size={36} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── GRÁFICOS ── */}
      <Suspense fallback={<ChartsFallback />}>
        <InicioCharts
          dadosAtendimento={dadosAtendimento}
          acoesPorStatus={acoesPorStatus}
          acoesPorFaixa={acoesPorFaixa}
          metasPorCategoria={metasPorCategoria}
        />
      </Suspense>

      {/* ── FILTROS ── */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 px-5 py-3 shadow-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-3 items-start">
          <div>
            <p className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wide mb-2">Categoria</p>
            <div className="flex flex-wrap gap-1.5">
              {categorias.map(c => (
                <button
                  key={c}
                  onClick={() => setFiltroCategoria(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    filtroCategoria === c
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                  }`}
                >
                  {c === 'Desenvolvimento Pessoal' ? 'Desenv. Pessoal' : c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wide mb-2">Saúde da Meta</p>
            <div className="flex flex-wrap gap-1.5">
              {opcoesSaude.map(o => (
                <button
                  key={o.v}
                  onClick={() => setFiltroSaude(o.v)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    filtroSaude === o.v
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── RANKING DAS METAS ── */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-surface-100 dark:border-surface-700 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-surface-900 dark:text-white">Ranking das Metas</h3>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
              Por grau · revisão · atendimento
              {rankingFiltrado.length !== rankingCompleto.length && (
                <span className="ml-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded text-[10px]">
                  {rankingFiltrado.length}/{rankingCompleto.length} metas
                </span>
              )}
            </p>
          </div>
          <button onClick={() => navigate('/metas')} className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
            Ver todas <ChevronRight size={12} />
          </button>
        </div>

        {rankingFiltrado.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-surface-400 dark:text-surface-500 text-sm">
            Nenhuma meta para este filtro
          </div>
        ) : (
          <>
            {/* Desktop — tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-100 dark:border-surface-700 bg-surface-50 dark:bg-surface-700/30">
                    {['Grau', 'Meta', 'Categoria', 'Prazo', 'Ações', 'Concl.', 'Atendimento', 'Atrasadas', 'Revisão', 'Saúde'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-50 dark:divide-surface-700/50">
                  {rankingFiltrado.map(mm => (
                    <tr key={mm.meta.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${corGrau(mm.meta.grau)}`}>
                          {mm.meta.grau}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-sm font-semibold text-surface-900 dark:text-white leading-tight line-clamp-2">
                          {mm.meta.nome}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-surface-500 dark:text-surface-400">{mm.meta.categoria}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {mm.meta.classificacaoPrazo ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${corClassificacaoPrazo(mm.meta.classificacaoPrazo)}`}>
                            {labelClassificacaoPrazo(mm.meta.classificacaoPrazo)}
                          </span>
                        ) : <span className="text-xs text-surface-300 dark:text-surface-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-bold text-surface-700 dark:text-surface-200">{mm.totalAcoes}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-bold text-surface-700 dark:text-surface-200">{mm.acoesConcluidas}</span>
                      </td>
                      <td className="px-4 py-3 min-w-[130px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                mm.percentualAtendimento >= 70 ? 'bg-emerald-500' :
                                mm.percentualAtendimento >= 30 ? 'bg-primary-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${mm.percentualAtendimento}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-surface-700 dark:text-surface-300 w-8 text-right shrink-0">
                            {mm.percentualAtendimento}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {mm.acoesAtrasadas > 0
                          ? <span className="text-xs font-bold text-red-500">{mm.acoesAtrasadas}</span>
                          : <span className="text-xs text-surface-300 dark:text-surface-600">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {mm.revisaoAtrasada
                          ? <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium"><RefreshCw size={10} /> Atrasada</span>
                          : <span className="text-xs text-emerald-600 dark:text-emerald-400">Em dia</span>
                        }
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${bgSaude(mm.saude)}`}>
                          {labelSaude(mm.saude)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile — lista */}
            <div className="md:hidden divide-y divide-surface-100 dark:divide-surface-700">
              {rankingFiltrado.map(mm => (
                <div key={mm.meta.id} className="p-4 space-y-2.5">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${corGrau(mm.meta.grau)}`}>
                      {mm.meta.grau}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-surface-900 dark:text-white leading-tight">{mm.meta.nome}</p>
                      <p className="text-xs text-surface-400 dark:text-surface-500">{mm.meta.categoria}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${bgSaude(mm.saude)}`}>
                      {labelSaude(mm.saude)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${mm.percentualAtendimento >= 70 ? 'bg-emerald-500' : mm.percentualAtendimento >= 30 ? 'bg-primary-500' : 'bg-red-500'}`}
                        style={{ width: `${mm.percentualAtendimento}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-surface-700 dark:text-surface-300 w-8 text-right">{mm.percentualAtendimento}%</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-400 dark:text-surface-500">
                    <span>{mm.totalAcoes} ações · {mm.acoesConcluidas} concluídas</span>
                    {mm.acoesAtrasadas > 0 && <span className="text-red-500">{mm.acoesAtrasadas} atrasada(s)</span>}
                    {mm.revisaoAtrasada && <span className="text-amber-500">Revisão atrasada</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── METAS EM ATENÇÃO ── */}
      {metasAtencao.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-surface-900 dark:text-white">Metas que exigem atenção</h3>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">Metas sem ações ou em situação crítica — aja agora</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {metasAtencao.map(mm => {
              const alertas: string[] = [];
              if (mm.totalAcoes === 0) alertas.push('Sem ações vinculadas');
              if (mm.revisaoAtrasada) alertas.push('Revisão atrasada');
              if (mm.acoesAtrasadas > 0) alertas.push(`${mm.acoesAtrasadas} ação(ões) atrasada(s)`);
              if (mm.percentualAtendimento < 30 && mm.totalAcoes > 0) alertas.push('Atendimento abaixo de 30%');
              if (mm.meta.grau >= 7 && mm.percentualAtendimento < 50) alertas.push('Alto grau com baixo atendimento');

              return (
                <div key={mm.meta.id} className="bg-white dark:bg-surface-800 rounded-2xl border border-red-200 dark:border-red-700/40 p-4 shadow-sm space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${corGrau(mm.meta.grau)}`}>
                      {mm.meta.grau}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-surface-900 dark:text-white leading-tight">{mm.meta.nome}</p>
                      <p className="text-xs text-surface-400 dark:text-surface-500">{mm.meta.categoria}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {alertas.map((a, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <AlertTriangle size={10} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-red-600 dark:text-red-400">{a}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${mm.percentualAtendimento}%` }} />
                    </div>
                    <span className="text-xs font-bold text-red-500">{mm.percentualAtendimento}%</span>
                  </div>
                  <p className="text-xs text-surface-400 dark:text-surface-500">{mm.totalAcoes} ação(ões) · {mm.acoesConcluidas} concluída(s)</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate('/plano')}
                      className="flex-1 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-700 text-xs font-semibold text-surface-700 dark:text-surface-200 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                    >
                      Ver ações
                    </button>
                    <button
                      onClick={() => navigate('/metas')}
                      className="flex-1 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-xs font-semibold text-white transition-colors"
                    >
                      Abrir meta
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FOCO RECOMENDADO ── */}
      {foco && (
        <div className="bg-gradient-to-br from-primary-700 to-primary-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="opacity-80" />
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-75">Foco recomendado para hoje</h3>
          </div>
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-extrabold flex-shrink-0 bg-white/20 shadow">
              {foco.meta.grau}
            </div>
            <div>
              <p className="text-xl font-extrabold leading-tight">{foco.meta.nome}</p>
              <p className="text-sm opacity-70 mt-1">
                Priorize hoje porque: <span className="font-semibold opacity-90">{foco.motivo}</span>.
              </p>
            </div>
          </div>

          {foco.acoesRecomendadas.length > 0 ? (
            <div className="space-y-2 mb-5">
              <p className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2">Ações sugeridas</p>
              {foco.acoesRecomendadas.map(t => (
                <div key={t.id} className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${corFaixaDash(t.faixa)}`}>
                    {siglaFaixaDash(t.faixa)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate">{t.titulo}</p>
                    <p className="text-xs opacity-55 mt-0.5">{t.tempoEstimado} min{t.prazo ? ` · prazo ${t.prazo}` : ''}</p>
                  </div>
                  <span className="text-xs opacity-50 capitalize whitespace-nowrap">{t.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/10 rounded-xl px-4 py-3 mb-5">
              <p className="text-sm opacity-70">Nenhuma ação pendente para esta meta. Adicione em Plano de Ação.</p>
            </div>
          )}

          <button
            onClick={() => navigate('/plano')}
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-4 py-2.5 text-sm font-bold"
          >
            Ir para Plano de Ação <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* ── TEMPO + FINANÇAS SECUNDÁRIO ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-primary-500" />
              <h3 className="text-sm font-bold text-surface-900 dark:text-white">Tempo disponível hoje</h3>
            </div>
            <button onClick={() => navigate('/agenda')} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Ajustar</button>
          </div>
          {minutosDisponiveis > 0 ? (
            <div className="text-center py-2">
              <p className="text-5xl font-extrabold text-primary-600 dark:text-primary-400">{formatarMinutos(minutosDisponiveis)}</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-2">disponíveis hoje</p>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-surface-400 dark:text-surface-500 mb-3">Nenhum tempo cadastrado para hoje</p>
              <Button size="sm" onClick={() => navigate('/agenda')}>Cadastrar tempo</Button>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-emerald-500" />
              <h3 className="text-sm font-bold text-surface-900 dark:text-white">Finanças do mês</h3>
            </div>
            <button onClick={() => navigate('/orcamento')} className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5">
              Ver mais <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Receitas', valor: receitasMes, cor: 'bg-emerald-500', textCor: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Despesas', valor: despesasMes, cor: 'bg-red-500', textCor: 'text-red-600 dark:text-red-400' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${row.cor}`} />
                  <span className="text-sm text-surface-600 dark:text-surface-400">{row.label}</span>
                </div>
                <span className={`text-sm font-bold ${row.textCor}`}>{formatarDinheiro(row.valor)}</span>
              </div>
            ))}
            <div className="border-t border-surface-100 dark:border-surface-700 pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">Saldo</span>
              <div className="flex items-center gap-1.5">
                {saldoMes >= 0
                  ? <TrendingUp size={14} className="text-emerald-600" />
                  : <TrendingDown size={14} className="text-red-600" />
                }
                <span className={`text-sm font-extrabold ${saldoMes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatarDinheiro(saldoMes)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
