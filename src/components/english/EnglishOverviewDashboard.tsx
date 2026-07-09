import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Award, Briefcase, CalendarDays, Loader2 } from 'lucide-react';
import { EvolutionMetricCard } from './EvolutionMetricCard';
import { NextActionCard } from './NextActionCard';
import { loadEvolutionDashboard, type EvolutionDashboardData } from '../../services/english/employabilityDashboardRepository';
import { getCurrentWeekRange, getWeeklyPreparationPlan } from '../../services/english/weeklyPreparationRepository';
import { listJobTargets } from '../../services/english/jobTargetsRepository';
import { listFinalInterviewSimulations } from '../../services/english/finalInterviewRepository';
import {
  summarizeFinalReadiness,
  summarizeJobPipeline,
  summarizeWeeklyPlanTasks,
  type FinalReadinessSummary,
  type JobPipelineSummary,
  type WeeklyPlanSummary,
} from '../../services/english/overviewDashboardAggregator';
import { JOB_TARGET_STATUS_LABELS } from '../../types/englishInterview';

interface EnglishOverviewDashboardProps {
  userId: string;
}

interface OverviewData {
  nextAction: string;
  vocabularyMasteredPercent: number;
  weeklyPlan: WeeklyPlanSummary;
  weeklyPlanGoal: string | null;
  jobPipeline: JobPipelineSummary;
  finalReadiness: FinalReadinessSummary;
}

function formatScore(value: number | null): string {
  return value === null ? '—' : `${value}/100`;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '—';
}

async function loadOverviewData(userId: string): Promise<OverviewData> {
  const { weekStart } = getCurrentWeekRange();

  const [evolution, weeklyPlan, jobTargets, finalSimulations]: [
    EvolutionDashboardData,
    Awaited<ReturnType<typeof getWeeklyPreparationPlan>>,
    Awaited<ReturnType<typeof listJobTargets>>,
    Awaited<ReturnType<typeof listFinalInterviewSimulations>>,
  ] = await Promise.all([
    loadEvolutionDashboard(userId),
    getWeeklyPreparationPlan(userId, weekStart),
    listJobTargets(),
    listFinalInterviewSimulations(),
  ]);

  return {
    nextAction: evolution.nextAction,
    vocabularyMasteredPercent: evolution.vocabulary.masteredPercent,
    weeklyPlan: summarizeWeeklyPlanTasks(weeklyPlan?.tasks ?? []),
    weeklyPlanGoal: weeklyPlan?.plan.main_goal ?? null,
    jobPipeline: summarizeJobPipeline(jobTargets),
    finalReadiness: summarizeFinalReadiness(finalSimulations),
  };
}

export function EnglishOverviewDashboard({ userId }: EnglishOverviewDashboardProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadOverviewData(userId));
    } catch (err) {
      console.error('[EnglishOverview] Failed to load dashboard', err);
      setError('Não foi possível carregar a visão geral do módulo de inglês.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
        <Loader2 size={16} className="animate-spin" />
        Carregando visão geral...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>{error || 'Não foi possível carregar a visão geral do módulo de inglês.'}</span>
      </div>
    );
  }

  const { weeklyPlan, jobPipeline, finalReadiness } = data;
  const pipelineLines = (['applied', 'interview', 'offer'] as const).map(status => ({
    label: JOB_TARGET_STATUS_LABELS[status],
    value: String(jobPipeline.byStatus[status] ?? 0),
  }));

  return (
    <div className="space-y-4">
      <NextActionCard nextAction={data.nextAction} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <EvolutionMetricCard
          title="Plano semanal"
          subtitle={weeklyPlan.total > 0 ? data.weeklyPlanGoal ?? 'Preparação desta semana' : 'Nenhum plano gerado para esta semana'}
          icon={<CalendarDays size={18} />}
          highlight={`${weeklyPlan.percentComplete}%`}
          highlightLabel={`${weeklyPlan.completed} de ${weeklyPlan.total} tarefas concluídas`}
          lines={[
            { label: 'Pendentes', value: String(weeklyPlan.pending) },
            { label: 'Ignoradas', value: String(weeklyPlan.ignored) },
            { label: 'Vocabulário dominado (EUA)', value: `${data.vocabularyMasteredPercent}%` },
          ]}
        />

        <EvolutionMetricCard
          title="Pipeline de vagas (EUA)"
          subtitle="Candidaturas ativas no funil"
          icon={<Briefcase size={18} />}
          highlight={String(jobPipeline.activeCount)}
          highlightLabel="vagas ativas (exclui rejeitadas/arquivadas)"
          lines={pipelineLines}
        />

        <EvolutionMetricCard
          title="Simulado final"
          subtitle="Prontidão para a entrevista de 30 minutos"
          icon={<Award size={18} />}
          highlight={formatScore(finalReadiness.bestScore)}
          highlightLabel="melhor nota de prontidão"
          lines={[
            { label: 'Simulados concluídos', value: String(finalReadiness.completedCount) },
            { label: 'Última nota', value: formatScore(finalReadiness.lastScore) },
            { label: 'Última data', value: formatDate(finalReadiness.lastCompletedAt) },
          ]}
        />
      </div>
    </div>
  );
}
