import { format, isToday, isBefore, differenceInDays, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Meta, Tarefa, BlocoTempo, NivelEnergia, FaixaTarefa, FrequenciaRevisao } from '../types';

// ---- Formatação ----
export const formatarData = (dateStr: string) =>
  format(parseISO(dateStr), "dd 'de' MMM", { locale: ptBR });

export const formatarDataCompleta = (dateStr: string) =>
  format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });

export const formatarDinheiro = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

export const formatarMinutos = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

// ---- Datas ----
export const hojeISO = () => format(new Date(), 'yyyy-MM-dd');

export const eHoje = (dateStr: string) => isToday(parseISO(dateStr));

export const eAtrasada = (dateStr: string) =>
  isBefore(parseISO(dateStr), new Date()) && !isToday(parseISO(dateStr));

export const diasRestantes = (dateStr: string) =>
  differenceInDays(parseISO(dateStr), new Date());

export const eSemanaAtual = (dateStr: string) => {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = endOfWeek(new Date(), { weekStartsOn: 1 });
  return isWithinInterval(parseISO(dateStr), { start, end });
};

// ---- Faixa helpers (tarefas) ----
export const labelFaixa = (f: FaixaTarefa): string => {
  switch (f) {
    case 'urgente': return 'URGENTE (UG)';
    case 'alto impacto': return 'ALTO IMPACTO (AI)';
    case 'médio impacto': return 'MÉDIO IMPACTO (MI)';
    case 'baixo impacto': return 'BAIXO IMPACTO (BI)';
  }
};

export const siglaFaixa = (f: FaixaTarefa): string => {
  switch (f) {
    case 'urgente': return 'UG';
    case 'alto impacto': return 'AI';
    case 'médio impacto': return 'MI';
    case 'baixo impacto': return 'BI';
  }
};

export const corFaixa = (f: FaixaTarefa): string => {
  switch (f) {
    case 'urgente':
      return 'text-danger-700 bg-danger-100 dark:bg-danger-600/25 dark:text-danger-300 font-bold';
    case 'alto impacto':
      return 'text-amber-700 bg-amber-100 dark:bg-amber-600/25 dark:text-amber-300 font-semibold';
    case 'médio impacto':
      return 'text-primary-700 bg-primary-100 dark:bg-primary-600/25 dark:text-primary-300';
    case 'baixo impacto':
      return 'text-surface-500 bg-surface-100 dark:bg-surface-700 dark:text-surface-400';
  }
};

// ---- Metas — Revisão ----
export const diasLimiteRevisao = (freq: FrequenciaRevisao): number => {
  switch (freq) {
    case 'semanal': return 7;
    case 'quinzenal': return 15;
    case 'mensal': return 30;
    case 'sob demanda': return 9999;
  }
};

export const revisaoAtrasada = (meta: Meta): boolean => {
  if (meta.status !== 'ativa') return false;
  if (meta.frequenciaRevisao === 'sob demanda') return false;
  const limite = diasLimiteRevisao(meta.frequenciaRevisao);
  if (!meta.dataUltimaRevisao) return true;
  return differenceInDays(new Date(), parseISO(meta.dataUltimaRevisao)) > limite;
};

export const proximaRevisaoISO = (meta: Meta): string | null => {
  if (meta.frequenciaRevisao === 'sob demanda') return null;
  const base = meta.dataUltimaRevisao ?? meta.dataCriacao;
  const dias = diasLimiteRevisao(meta.frequenciaRevisao);
  return format(new Date(parseISO(base).getTime() + dias * 86400000), 'yyyy-MM-dd');
};

export const labelFrequencia = (f: FrequenciaRevisao): string => {
  switch (f) {
    case 'semanal': return 'Semanal';
    case 'quinzenal': return 'Quinzenal';
    case 'mensal': return 'Mensal';
    case 'sob demanda': return 'Sob demanda';
  }
};

// ---- Eficiência de Foco ----
export const calcularEficienciaFoco = (qtdMetasAtivas: number): number => {
  const limiteIdeal = 3;
  if (qtdMetasAtivas <= limiteIdeal) return 100;
  return Math.max(20, Math.round((limiteIdeal / qtdMetasAtivas) * 100));
};

export const mensagemEficiencia = (eficiencia: number): string => {
  if (eficiencia >= 85) return 'Seu foco está saudável.';
  if (eficiencia >= 60) return 'Atenção: você já está dividindo energia entre muitas metas.';
  return 'Risco alto de dispersão. Considere mover algumas metas para Planejar para o Futuro.';
};

export const corEficiencia = (eficiencia: number): string => {
  if (eficiencia >= 85) return 'text-success-600 dark:text-success-400';
  if (eficiencia >= 60) return 'text-warning-600 dark:text-warning-400';
  return 'text-danger-600 dark:text-danger-400';
};

export const corBarraEficiencia = (eficiencia: number): string => {
  if (eficiencia >= 85) return 'bg-success-500';
  if (eficiencia >= 60) return 'bg-warning-500';
  return 'bg-danger-500';
};

// ---- Lógica de negócio ----
export const eMetaEmRisco = (meta: Meta, tarefas: Tarefa[]): boolean => {
  if (meta.status !== 'ativa') return false;
  const tarefasDaMeta = tarefas.filter(t => t.metaId === meta.id && t.status === 'concluído');
  if (tarefasDaMeta.length === 0) return true;
  const ultimaConclusao = tarefasDaMeta
    .filter(t => t.dataConclusao)
    .sort((a, b) => (a.dataConclusao! > b.dataConclusao! ? -1 : 1))[0];
  if (!ultimaConclusao?.dataConclusao) return true;
  return differenceInDays(new Date(), parseISO(ultimaConclusao.dataConclusao)) > 7;
};

export const getTarefasHoje = (tarefas: Tarefa[]) =>
  tarefas.filter(t => t.status !== 'concluído' && eHoje(t.prazo));

export const getTarefasAtrasadas = (tarefas: Tarefa[]) =>
  tarefas.filter(t => t.status !== 'concluído' && eAtrasada(t.prazo));

export type TarefaSugerida = Tarefa & { motivo: string };

export const sugerirTarefas = (
  tarefas: Tarefa[],
  metas: Meta[],
  minutosDisponiveis: number,
  energiaDisponivel: NivelEnergia = 'média'
): TarefaSugerida[] => {
  const pendentes = tarefas.filter(
    t => t.status === 'não iniciado' || t.status === 'em andamento'
  );

  const metasEmRisco = metas
    .filter(m => eMetaEmRisco(m, tarefas))
    .map(m => m.id);

  const energiaNum: Record<NivelEnergia, number> = { baixa: 1, média: 2, alta: 3 };
  const dispNum = energiaNum[energiaDisponivel];

  const pontuacao = (t: Tarefa): number => {
    let pts = 0;
    // Faixa
    if (t.faixa === 'urgente') pts += 100;
    else if (t.faixa === 'alto impacto') pts += 70;
    else if (t.faixa === 'médio impacto') pts += 40;
    else pts += 10;
    // Grau da meta vinculada
    const meta = metas.find(m => m.id === t.metaId && m.status === 'ativa');
    if (meta) pts += meta.grau * 2;
    // Prazo próximo
    const dias = diasRestantes(t.prazo);
    if (dias <= 0) pts += 80;
    else if (dias <= 3) pts += 60;
    else if (dias <= 7) pts += 30;
    // Meta em risco
    if (t.metaId && metasEmRisco.includes(t.metaId)) pts += 50;
    // Quick win
    if (t.tempoEstimado <= 30) pts += 20;
    // Penalidade energia
    const tarefaEnergiaN = energiaNum[t.energiaNecessaria];
    if (tarefaEnergiaN > dispNum) pts -= 40;
    return pts;
  };

  const buildMotivo = (t: Tarefa): string => {
    const partes: string[] = [];
    const dias = diasRestantes(t.prazo);
    if (dias <= 0) partes.push('prazo já passou');
    else if (dias <= 3) partes.push(`prazo em ${dias} dia${dias > 1 ? 's' : ''}`);
    if (t.faixa === 'urgente') partes.push('urgente');
    else if (t.faixa === 'alto impacto') partes.push('alto impacto');
    if (t.metaId && metasEmRisco.includes(t.metaId)) partes.push('meta em risco');
    if (t.tempoEstimado <= 30) partes.push('tempo curto');
    const energiaTarefa = energiaNum[t.energiaNecessaria];
    if (energiaTarefa <= dispNum) partes.push('cabe na sua energia de hoje');
    if (t.tempoEstimado <= minutosDisponiveis) partes.push('cabe no tempo disponível');
    if (partes.length === 0) return 'Tarefa pendente sem urgência específica.';
    return `Sugerida porque: ${partes.join(', ')}.`;
  };

  const ordenadas = [...pendentes].sort((a, b) => pontuacao(b) - pontuacao(a));

  let tempoAcumulado = 0;
  const sugestoes: TarefaSugerida[] = [];
  for (const t of ordenadas) {
    if (tempoAcumulado + t.tempoEstimado <= minutosDisponiveis) {
      sugestoes.push({ ...t, motivo: buildMotivo(t) });
      tempoAcumulado += t.tempoEstimado;
    }
    if (sugestoes.length >= 5) break;
  }
  return sugestoes;
};

export const calcularMinutosDisponiveis = (blocos: BlocoTempo[]): number => {
  const hoje = hojeISO();
  return blocos
    .filter(b => b.data === hoje)
    .reduce((acc, b) => acc + b.horasDisponiveis * 60, 0);
};

// ---- Cores por prioridade (para metas legadas) ----
export const corPrioridade = (p: string) => {
  switch (p) {
    case 'crítica': return 'text-danger-600 bg-danger-50 dark:bg-danger-600/20 dark:text-danger-400';
    case 'alta': return 'text-orange-600 bg-orange-50 dark:bg-orange-600/20 dark:text-orange-400';
    case 'média': return 'text-warning-600 bg-warning-50 dark:bg-warning-600/20 dark:text-warning-400';
    default: return 'text-surface-500 bg-surface-100 dark:bg-surface-700 dark:text-surface-400';
  }
};

// ---- Cores por status ----
export const corStatus = (s: string) => {
  switch (s) {
    case 'concluído':
    case 'concluída': return 'text-success-600 bg-success-50 dark:bg-success-600/20 dark:text-success-400';
    case 'em andamento': return 'text-primary-600 bg-primary-50 dark:bg-primary-600/20 dark:text-primary-400';
    default: return 'text-surface-600 bg-surface-100 dark:bg-surface-700 dark:text-surface-300';
  }
};

export const corCategoria = (c: string) => {
  switch (c) {
    case 'Profissão': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'Estudos': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'Finanças': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'Projetos': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'Desenvolvimento Pessoal': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    default: return 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300';
  }
};

// ---- ID gerador ----
export const gerarId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
