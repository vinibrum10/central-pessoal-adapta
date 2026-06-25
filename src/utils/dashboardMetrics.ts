import { differenceInDays, parseISO } from 'date-fns';
import type { Meta, Tarefa, FaixaTarefa } from '../types';
import { hojeISO, eAtrasada } from './index';

// ============================================================
// TIPOS
// ============================================================

export type SaudeMeta = 'sem ações' | 'crítica' | 'atenção' | 'boa' | 'atendida';

export interface MetricaMeta {
  meta: Meta;
  totalAcoes: number;
  acoesConcluidas: number;
  acoesAtrasadas: number;
  percentualAtendimento: number;
  revisaoAtrasada: boolean;
  saude: SaudeMeta;
}

export interface ResumoDashboard {
  metasAtivas: number;
  metasFuturo: number;
  eficienciaFoco: number;
  acoesvinculas: number;
  acoesConcluidas: number;
  atendimentoMedio: number;
  metasEmAtencao: number;
}

export interface AcaoPorStatus {
  name: string;
  value: number;
  fill: string;
}

export interface AcaoPorFaixa {
  name: string;
  sigla: string;
  value: number;
  fill: string;
}

export interface MetaPorCategoria {
  name: string;
  value: number;
  fill: string;
}

// ============================================================
// CÁLCULOS INDIVIDUAIS
// ============================================================

export function calcularAtendimentoMeta(meta: Meta, tarefas: Tarefa[]): number {
  const ativas = tarefas.filter(t => t.metaId === meta.id);
  if (ativas.length === 0) return 0;
  const concluidas = ativas.filter(t => t.status === 'concluído').length;
  return Math.round((concluidas / ativas.length) * 100);
}

export function calcularRevisaoAtrasada(meta: Meta): boolean {
  if (meta.status !== 'ativa') return false;
  if (!meta.frequenciaRevisao || meta.frequenciaRevisao === 'sob demanda') return false;
  const limite = meta.frequenciaRevisao === 'semanal' ? 7
    : meta.frequenciaRevisao === 'quinzenal' ? 15
    : meta.frequenciaRevisao === 'mensal' ? 30
    : 9999;
  if (!meta.dataUltimaRevisao) return true;
  try {
    return differenceInDays(new Date(), parseISO(meta.dataUltimaRevisao)) > limite;
  } catch {
    return false;
  }
}

export function calcularSaudeMeta(
  percentual: number,
  totalAcoes: number,
  revisaoAtrasada: boolean,
  acoesAtrasadas: number
): SaudeMeta {
  if (totalAcoes === 0) return 'sem ações';
  if (percentual === 100) return 'atendida';
  if (revisaoAtrasada || percentual < 30 || acoesAtrasadas > 0) return 'crítica';
  if (percentual < 70) return 'atenção';
  return 'boa';
}

export function calcularEficienciaFoco(qtdAtivas: number): number {
  if (qtdAtivas <= 3) return 100;
  return Math.max(20, Math.round((3 / qtdAtivas) * 100));
}

// ============================================================
// MÉTRICAS COMPLETAS POR META
// ============================================================

export function calcularMetricasMeta(meta: Meta, tarefas: Tarefa[]): MetricaMeta {
  const acoesDaMeta = tarefas.filter(t => t.metaId === meta.id);
  const totalAcoes = acoesDaMeta.length;
  const acoesConcluidas = acoesDaMeta.filter(t => t.status === 'concluído').length;
  const acoesAtrasadas = acoesDaMeta.filter(
    t => t.status !== 'concluído' && t.prazo && eAtrasada(t.prazo)
  ).length;
  const percentualAtendimento = totalAcoes > 0
    ? Math.round((acoesConcluidas / totalAcoes) * 100)
    : 0;
  const revisaoAt = calcularRevisaoAtrasada(meta);
  const saude = calcularSaudeMeta(percentualAtendimento, totalAcoes, revisaoAt, acoesAtrasadas);

  return {
    meta,
    totalAcoes,
    acoesConcluidas,
    acoesAtrasadas,
    percentualAtendimento,
    revisaoAtrasada: revisaoAt,
    saude,
  };
}

// ============================================================
// RESUMO GERAL DO DASHBOARD
// ============================================================

export function obterResumoDashboard(
  metas: Meta[],
  tarefas: Tarefa[]
): ResumoDashboard {
  const metasAtivas = metas.filter(m => m.status === 'ativa');
  const metasFuturo = metas.filter(m => m.status === 'planejar futuro' || m.status === 'pausada');

  const acoesVinculadas = tarefas.filter(
    t => t.metaId && metasAtivas.some(m => m.id === t.metaId)
  );
  const acoesConcluidas = acoesVinculadas.filter(t => t.status === 'concluído').length;

  const metricas = metasAtivas.map(m => calcularMetricasMeta(m, tarefas));

  const atendimentoMedio = metricas.length > 0
    ? Math.round(metricas.reduce((acc, m) => acc + m.percentualAtendimento, 0) / metricas.length)
    : 0;

  const metasEmAtencao = metricas.filter(
    m => m.saude === 'sem ações' || m.saude === 'crítica'
  ).length;

  return {
    metasAtivas: metasAtivas.length,
    metasFuturo: metasFuturo.length,
    eficienciaFoco: calcularEficienciaFoco(metasAtivas.length),
    acoesvinculas: acoesVinculadas.length,
    acoesConcluidas,
    atendimentoMedio,
    metasEmAtencao,
  };
}

// ============================================================
// METAS EM ATENÇÃO
// ============================================================

export function obterMetasEmAtencao(metas: Meta[], tarefas: Tarefa[]): MetricaMeta[] {
  return metas
    .filter(m => m.status === 'ativa')
    .map(m => calcularMetricasMeta(m, tarefas))
    .filter(m => m.saude === 'sem ações' || m.saude === 'crítica')
    .sort((a, b) => b.meta.grau - a.meta.grau);
}

// ============================================================
// RANKING COMPLETO DAS METAS ATIVAS
// ============================================================

export function obterRankingMetas(metas: Meta[], tarefas: Tarefa[]): MetricaMeta[] {
  return metas
    .filter(m => m.status === 'ativa')
    .map(m => calcularMetricasMeta(m, tarefas))
    .sort((a, b) => {
      // 1. maior grau primeiro
      if (b.meta.grau !== a.meta.grau) return b.meta.grau - a.meta.grau;
      // 2. revisão atrasada primeiro
      if (a.revisaoAtrasada !== b.revisaoAtrasada) return a.revisaoAtrasada ? -1 : 1;
      // 3. menor atendimento primeiro
      return a.percentualAtendimento - b.percentualAtendimento;
    });
}

// ============================================================
// DADOS PARA GRÁFICOS
// ============================================================

export function obterAcoesPorStatus(metas: Meta[], tarefas: Tarefa[]): AcaoPorStatus[] {
  const metasAtivas = metas.filter(m => m.status === 'ativa');
  const acoes = tarefas.filter(t => t.metaId && metasAtivas.some(m => m.id === t.metaId));

  const naoIniciado = acoes.filter(t => t.status === 'não iniciado').length;
  const emAndamento = acoes.filter(t => t.status === 'em andamento').length;
  const concluido = acoes.filter(t => t.status === 'concluído').length;

  return [
    { name: 'Não iniciado', value: naoIniciado, fill: '#73736b' },
    { name: 'Em andamento', value: emAndamento, fill: '#e11d2e' },
    { name: 'Concluído', value: concluido, fill: '#22c55e' },
  ].filter(d => d.value > 0);
}

export function obterAcoesPorFaixa(metas: Meta[], tarefas: Tarefa[]): AcaoPorFaixa[] {
  const metasAtivas = metas.filter(m => m.status === 'ativa');
  const acoes = tarefas.filter(t => t.metaId && metasAtivas.some(m => m.id === t.metaId));

  const contFaixa = (f: FaixaTarefa) => acoes.filter(t => t.faixa === f).length;

  return [
    { name: 'Urgente', sigla: 'UG', value: contFaixa('urgente'), fill: '#ef4444' },
    { name: 'Alto Impacto', sigla: 'AI', value: contFaixa('alto impacto'), fill: '#f59e0b' },
    { name: 'Médio Impacto', sigla: 'MI', value: contFaixa('médio impacto'), fill: '#e11d2e' },
    { name: 'Baixo Impacto', sigla: 'BI', value: contFaixa('baixo impacto'), fill: '#73736b' },
  ];
}

export function obterMetasPorCategoria(metas: Meta[]): MetaPorCategoria[] {
  const ativas = metas.filter(m => m.status === 'ativa');
  const categorias = ['Profissão', 'Estudos', 'Finanças', 'Projetos', 'Desenvolvimento Pessoal'];
  const cores = ['#e11d2e', '#22c55e', '#10b981', '#8a0f18', '#f59e0b'];

  return categorias.map((cat, i) => ({
    name: cat === 'Desenvolvimento Pessoal' ? 'Desenv. Pessoal' : cat,
    value: ativas.filter(m => m.categoria === cat).length,
    fill: cores[i],
  })).filter(d => d.value > 0);
}

// ============================================================
// FOCO RECOMENDADO
// ============================================================

export interface FocoRecomendado {
  meta: Meta;
  motivo: string;
  acoesRecomendadas: Tarefa[];
}

export function obterFocoRecomendado(
  metas: Meta[],
  tarefas: Tarefa[]
): FocoRecomendado | null {
  const ativas = metas.filter(m => m.status === 'ativa');
  if (ativas.length === 0) return null;

  const metricas = ativas.map(m => calcularMetricasMeta(m, tarefas));

  // Pontuação: maior grau + revisão atrasada + baixo atendimento
  const pontuada = metricas.map(mm => {
    let score = mm.meta.grau * 10;
    if (mm.revisaoAtrasada) score += 30;
    if (mm.acoesAtrasadas > 0) score += 20;
    score += (100 - mm.percentualAtendimento) / 5;
    const temUgAi = tarefas.some(
      t => t.metaId === mm.meta.id &&
        t.status !== 'concluído' &&
        (t.faixa === 'urgente' || t.faixa === 'alto impacto')
    );
    if (temUgAi) score += 15;
    return { mm, score };
  });

  pontuada.sort((a, b) => b.score - a.score);
  const { mm } = pontuada[0];

  // Montar motivo
  const motivos: string[] = [];
  if (mm.meta.grau >= 8) motivos.push('meta de alto grau');
  if (mm.revisaoAtrasada) motivos.push('revisão atrasada');
  if (mm.acoesAtrasadas > 0) motivos.push(`${mm.acoesAtrasadas} ação(ões) atrasada(s)`);
  if (mm.percentualAtendimento < 30) motivos.push('baixo atendimento');
  if (motivos.length === 0) motivos.push('maior grau entre as metas ativas');

  // Ações recomendadas (pendentes, ordenadas por urgência/prazo)
  const acoesPendentes = tarefas
    .filter(t => t.metaId === mm.meta.id && t.status !== 'concluído')
    .sort((a, b) => {
      const faixaOrd: Record<string, number> = {
        urgente: 4, 'alto impacto': 3, 'médio impacto': 2, 'baixo impacto': 1,
      };
      const fa = faixaOrd[a.faixa] ?? 0;
      const fb = faixaOrd[b.faixa] ?? 0;
      if (fb !== fa) return fb - fa;
      return (a.prazo ?? '').localeCompare(b.prazo ?? '');
    })
    .slice(0, 3);

  return {
    meta: mm.meta,
    motivo: motivos.join(', '),
    acoesRecomendadas: acoesPendentes,
  };
}

// ============================================================
// HELPERS DE COR E LABEL
// ============================================================

export const corSaude = (s: SaudeMeta): string => {
  switch (s) {
    case 'atendida': return 'text-success-600 dark:text-success-400';
    case 'boa': return 'text-primary-600 dark:text-primary-400';
    case 'atenção': return 'text-warning-600 dark:text-warning-400';
    case 'crítica': return 'text-danger-600 dark:text-danger-400';
    case 'sem ações': return 'text-surface-500 dark:text-surface-400';
  }
};

export const bgSaude = (s: SaudeMeta): string => {
  switch (s) {
    case 'atendida': return 'bg-success-100 text-success-700 dark:bg-success-600/20 dark:text-success-300';
    case 'boa': return 'bg-primary-100 text-primary-700 dark:bg-primary-600/20 dark:text-primary-300';
    case 'atenção': return 'bg-warning-100 text-warning-700 dark:bg-warning-600/20 dark:text-warning-300';
    case 'crítica': return 'bg-danger-100 text-danger-700 dark:bg-danger-600/20 dark:text-danger-300';
    case 'sem ações': return 'bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400';
  }
};

export const labelSaude = (s: SaudeMeta): string => {
  switch (s) {
    case 'atendida': return '✓ Atendida';
    case 'boa': return '● Boa';
    case 'atenção': return '▲ Atenção';
    case 'crítica': return '✕ Crítica';
    case 'sem ações': return '— Sem ações';
  }
};

export const corGrau = (grau: number): string => {
  if (grau >= 9) return 'bg-danger-600 text-white';
  if (grau >= 7) return 'bg-amber-500 text-white';
  if (grau >= 5) return 'bg-primary-600 text-white';
  return 'bg-surface-500 text-white';
};

export const siglaFaixaDash = (f: string): string => {
  if (f === 'urgente') return 'UG';
  if (f === 'alto impacto') return 'AI';
  if (f === 'médio impacto') return 'MI';
  return 'BI';
};

export const corFaixaDash = (f: string): string => {
  if (f === 'urgente') return 'bg-danger-100 text-danger-700 dark:bg-danger-600/20 dark:text-danger-300';
  if (f === 'alto impacto') return 'bg-amber-100 text-amber-700 dark:bg-amber-600/20 dark:text-amber-300';
  if (f === 'médio impacto') return 'bg-primary-100 text-primary-700 dark:bg-primary-600/20 dark:text-primary-300';
  return 'bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400';
};

export const hoje = (): string => hojeISO();
