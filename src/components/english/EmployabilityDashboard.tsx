import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Award, BookOpen, Edit3, Loader2, MessageSquareText, Mic, Sparkles, Timer } from 'lucide-react';
import { formatDuration } from '../../services/english/interviewAudio';
import { loadEvolutionDashboard, type EvolutionDashboardData } from '../../services/english/employabilityDashboardRepository';
import { getCurrentWeekRange, getWeeklyPreparationPlan } from '../../services/english/weeklyPreparationRepository';
import { listJobTargets } from '../../services/english/jobTargetsRepository';
import {
  summarizeJobPipeline,
  summarizeWeeklyPlanByDay,
  summarizeWeeklyPlanTasks,
  type JobPipelineSummary,
  type WeeklyPlanDaySummary,
} from '../../services/english/overviewDashboardAggregator';
import { EvolutionStatCard } from './EvolutionStatCard';
import { NextActionCard } from './NextActionCard';
import { WeeklyPlanStrip } from './WeeklyPlanStrip';
import { JobPipelinePanel } from './JobPipelinePanel';

interface EmployabilityDashboardProps {
  userId: string;
}

interface EmployabilityPageData {
  evolution: EvolutionDashboardData;
  weeklyPlanDays: WeeklyPlanDaySummary[];
  weeklyPlanGoal: string | null;
  weeklyPlanCompleted: number;
  weeklyPlanPending: number;
  weeklyPlanPercent: number;
  jobPipeline: JobPipelineSummary;
}

function formatScore(value: number | null): string {
  return value === null ? '—' : `${value}/10`;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '—';
}

const MOCK_STATUS_LABELS = { draft: 'Rascunho', in_progress: 'Em andamento' } as const;

async function loadEmployabilityPageData(userId: string): Promise<EmployabilityPageData> {
  const { weekStart } = getCurrentWeekRange();

  const [evolution, weeklyPlan, jobTargets] = await Promise.all([
    loadEvolutionDashboard(userId),
    getWeeklyPreparationPlan(userId, weekStart),
    listJobTargets(),
  ]);

  const tasks = weeklyPlan?.tasks ?? [];
  const weeklyPlanSummary = summarizeWeeklyPlanTasks(tasks);

  return {
    evolution,
    weeklyPlanDays: summarizeWeeklyPlanByDay(tasks, weekStart),
    weeklyPlanGoal: weeklyPlan?.plan.main_goal ?? null,
    weeklyPlanCompleted: weeklyPlanSummary.completed,
    weeklyPlanPending: weeklyPlanSummary.pending,
    weeklyPlanPercent: weeklyPlanSummary.percentComplete,
    jobPipeline: summarizeJobPipeline(jobTargets),
  };
}

export function EmployabilityDashboard({ userId }: EmployabilityDashboardProps) {
  const [data, setData] = useState<EmployabilityPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadEmployabilityPageData(userId));
    } catch (err) {
      console.error('[EnglishEvolution] Failed to load dashboard', err);
      setError('Não foi possível carregar o dashboard de evolução.');
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
        Carregando evolução...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>{error || 'Não foi possível carregar o dashboard de evolução.'}</span>
      </div>
    );
  }

  const { answers, speakingTime, aiScores, vocabulary, star, mock } = data.evolution;

  return (
    <div className="space-y-4">
      <NextActionCard nextAction={data.evolution.nextAction} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <EvolutionStatCard
          title="Respostas"
          icon={<Mic size={16} />}
          iconVariant="copper"
          value={String(answers.totalAnswers)}
          caption="respostas gravadas no total"
          delta={{ label: `+${answers.answersLast7Days} essa semana`, tone: answers.answersLast7Days > 0 ? 'up' : 'flat' }}
          rows={[
            { label: 'Perguntas diferentes', value: String(answers.distinctQuestions) },
            { label: 'Últimos 30 dias', value: String(answers.answersLast30Days) },
          ]}
        />

        <EvolutionStatCard
          title="Tempo falando"
          icon={<Timer size={16} />}
          iconVariant="blue"
          value={formatDuration(speakingTime.totalSec)}
          caption="tempo total falando inglês"
          delta={{ label: `+${formatDuration(speakingTime.last7DaysSec)} 7d`, tone: speakingTime.last7DaysSec > 0 ? 'up' : 'flat' }}
          rows={[
            { label: 'Últimos 30 dias', value: formatDuration(speakingTime.last30DaysSec) },
          ]}
        />

        <EvolutionStatCard
          title="Nota média IA"
          icon={<Sparkles size={16} />}
          iconVariant="purple"
          value={formatScore(aiScores.averageOverall)}
          caption={`${aiScores.evaluatedCount} respostas avaliadas com Gemini`}
          rows={[
            { label: 'Últimos 7 dias', value: formatScore(aiScores.averageLast7Days) },
            { label: 'Melhor nota', value: formatScore(aiScores.bestScore) },
            { label: 'Última nota', value: formatScore(aiScores.latestScore) },
          ]}
        />

        <EvolutionStatCard
          title="Vocabulário EUA"
          icon={<BookOpen size={16} />}
          iconVariant="copper"
          value={`${vocabulary.masteredPercent}%`}
          caption={`dominado de ${vocabulary.totalJobPostingTerms} termos`}
          rows={[
            { label: 'Domino', value: String(vocabulary.mastered) },
            { label: 'Revisar', value: String(vocabulary.review) },
            { label: 'Ainda não domino', value: String(vocabulary.notMastered) },
          ]}
        />

        <EvolutionStatCard
          title="Respostas STAR"
          icon={<Edit3 size={16} />}
          iconVariant="warning"
          value={String(star.totalStarAnswers)}
          caption="respostas STAR criadas"
          rows={[
            { label: 'Perguntas com STAR', value: String(star.distinctQuestionsWithStar) },
            { label: 'Última atualização', value: formatDate(star.lastUpdatedAt) },
          ]}
        />

        <EvolutionStatCard
          title="Mock mensal"
          icon={<Award size={16} />}
          iconVariant="success"
          value={String(mock.completedCount)}
          caption="mocks concluídos"
          rows={[
            { label: 'Nota do último', value: formatScore(mock.lastCompleted?.overallScore ?? null) },
            { label: 'Melhor mock', value: formatScore(mock.bestOverallScore) },
          ]}
        >
          {mock.currentMock && (
            <p className="rounded-lg bg-primary-500/10 px-2 py-1.5 text-xs font-semibold text-primary-700 dark:text-primary-200">
              <MessageSquareText size={12} className="mr-1 inline" />
              Mock atual: {mock.currentMock.title?.trim() || `criado em ${formatDate(mock.currentMock.createdAt)}`} · {MOCK_STATUS_LABELS[mock.currentMock.status]}
            </p>
          )}
        </EvolutionStatCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <WeeklyPlanStrip
          days={data.weeklyPlanDays}
          goal={data.weeklyPlanGoal}
          completed={data.weeklyPlanCompleted}
          pending={data.weeklyPlanPending}
          percentComplete={data.weeklyPlanPercent}
        />
        <JobPipelinePanel byStatus={data.jobPipeline.byStatus} activeCount={data.jobPipeline.activeCount} />
      </div>
    </div>
  );
}
