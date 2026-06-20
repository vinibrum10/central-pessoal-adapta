import { format, isToday, isBefore, differenceInDays, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Meta, Tarefa, BlocoTempo } from '../types';

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

// ---- Lógica de negócio ----
export const eMetaEmRisco = (meta: Meta, tarefas: Tarefa[]): boolean => {
  if (meta.status !== 'ativa') return false;
  const tarefasDaMeta = tarefas.filter(t => t.metaId === meta.id && t.status === 'concluída');
  if (tarefasDaMeta.length === 0) return true;
  const ultimaConclusao = tarefasDaMeta
    .filter(t => t.dataConclusao)
    .sort((a, b) => (a.dataConclusao! > b.dataConclusao! ? -1 : 1))[0];
  if (!ultimaConclusao?.dataConclusao) return true;
  return differenceInDays(new Date(), parseISO(ultimaConclusao.dataConclusao)) > 7;
};

export const getTarefasHoje = (tarefas: Tarefa[]) =>
  tarefas.filter(
    t =>
      t.status !== 'concluída' &&
      t.status !== 'cancelada' &&
      (eHoje(t.prazo) || (t.tipo === 'diária' && !eAtrasada(t.prazo)))
  );

export const getTarefasAtrasadas = (tarefas: Tarefa[]) =>
  tarefas.filter(
    t => t.status !== 'concluída' && t.status !== 'cancelada' && eAtrasada(t.prazo)
  );

export const sugerirTarefas = (
  tarefas: Tarefa[],
  metas: Meta[],
  minutosDisponiveis: number
): Tarefa[] => {
  const pendentes = tarefas.filter(
    t => t.status === 'pendente' || t.status === 'em andamento'
  );

  const metasEmRisco = metas
    .filter(m => eMetaEmRisco(m, tarefas))
    .map(m => m.id);

  const pontuacao = (t: Tarefa): number => {
    let pts = 0;
    // Prioridade
    if (t.prioridade === 'crítica') pts += 100;
    else if (t.prioridade === 'alta') pts += 70;
    else if (t.prioridade === 'média') pts += 40;
    else pts += 10;
    // Prazo próximo
    const dias = diasRestantes(t.prazo);
    if (dias <= 0) pts += 80;
    else if (dias <= 3) pts += 60;
    else if (dias <= 7) pts += 30;
    // Meta em risco
    if (t.metaId && metasEmRisco.includes(t.metaId)) pts += 50;
    // Tempo pequeno (quick win)
    if (t.tempoEstimado <= 30) pts += 20;
    return pts;
  };

  const ordenadas = [...pendentes].sort((a, b) => pontuacao(b) - pontuacao(a));

  let tempoAcumulado = 0;
  const sugestoes: Tarefa[] = [];
  for (const t of ordenadas) {
    if (tempoAcumulado + t.tempoEstimado <= minutosDisponiveis) {
      sugestoes.push(t);
      tempoAcumulado += t.tempoEstimado;
    }
  }
  return sugestoes;
};

export const calcularMinutosDisponiveis = (blocos: BlocoTempo[]): number => {
  const hoje = hojeISO();
  return blocos
    .filter(b => b.data === hoje)
    .reduce((acc, b) => acc + b.horasDisponiveis * 60, 0);
};

// ---- Cores por prioridade / status ----
export const corPrioridade = (p: string) => {
  switch (p) {
    case 'crítica': return 'text-danger-600 bg-danger-50 dark:bg-danger-600/20 dark:text-danger-400';
    case 'alta': return 'text-orange-600 bg-orange-50 dark:bg-orange-600/20 dark:text-orange-400';
    case 'média': return 'text-warning-600 bg-warning-50 dark:bg-warning-600/20 dark:text-warning-400';
    default: return 'text-surface-500 bg-surface-100 dark:bg-surface-700 dark:text-surface-400';
  }
};

export const corStatus = (s: string) => {
  switch (s) {
    case 'concluída': return 'text-success-600 bg-success-50 dark:bg-success-600/20 dark:text-success-400';
    case 'em andamento': return 'text-primary-600 bg-primary-50 dark:bg-primary-600/20 dark:text-primary-400';
    case 'cancelada': return 'text-surface-400 bg-surface-100 dark:bg-surface-700';
    case 'reagendada': return 'text-purple-600 bg-purple-50 dark:bg-purple-600/20 dark:text-purple-400';
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
