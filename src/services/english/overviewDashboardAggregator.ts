import type { FinalInterviewSimulation, JobTarget, JobTargetStatus, WeeklyPreparationTask } from '../../types/englishInterview';

export interface WeeklyPlanSummary {
  completed: number;
  pending: number;
  ignored: number;
  total: number;
  percentComplete: number;
}

export function summarizeWeeklyPlanTasks(tasks: WeeklyPreparationTask[]): WeeklyPlanSummary {
  const completed = tasks.filter(task => task.status === 'completed').length;
  const pending = tasks.filter(task => task.status === 'pending').length;
  const ignored = tasks.filter(task => task.status === 'ignored').length;
  const total = tasks.length;
  const percentComplete = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { completed, pending, ignored, total, percentComplete };
}

const DIA_SEMANA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface WeeklyPlanDaySummary {
  date: string;
  label: string;
  total: number;
  completed: number;
  percentComplete: number;
}

/**
 * Agrupa as tarefas do plano semanal por dia, começando em weekStart (segunda-feira) e
 * cobrindo os 7 dias seguintes — inclusive dias sem nenhuma tarefa, para o strip semanal
 * sempre mostrar os 7 dias corridos independentemente de quantas tarefas existem.
 */
export function summarizeWeeklyPlanByDay(tasks: WeeklyPreparationTask[], weekStart: string): WeeklyPlanDaySummary[] {
  const inicio = new Date(`${weekStart}T12:00:00`);
  const dias: WeeklyPlanDaySummary[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const dia = new Date(inicio);
    dia.setDate(dia.getDate() + offset);
    const date = dia.toISOString().slice(0, 10);

    const tarefasDoDia = tasks.filter(task => task.task_date === date);
    const completed = tarefasDoDia.filter(task => task.status === 'completed').length;
    const total = tarefasDoDia.length;

    dias.push({
      date,
      label: DIA_SEMANA_LABELS[dia.getDay()],
      total,
      completed,
      percentComplete: total === 0 ? 0 : Math.round((completed / total) * 100),
    });
  }

  return dias;
}

const CLOSED_JOB_STATUSES: JobTargetStatus[] = ['rejected', 'archived'];

export interface JobPipelineSummary {
  activeCount: number;
  byStatus: Partial<Record<JobTargetStatus, number>>;
}

export function summarizeJobPipeline(jobTargets: JobTarget[]): JobPipelineSummary {
  const byStatus: Partial<Record<JobTargetStatus, number>> = {};
  for (const jobTarget of jobTargets) {
    byStatus[jobTarget.status] = (byStatus[jobTarget.status] ?? 0) + 1;
  }

  const activeCount = jobTargets.filter(jobTarget => !CLOSED_JOB_STATUSES.includes(jobTarget.status)).length;

  return { activeCount, byStatus };
}

export interface FinalReadinessSummary {
  completedCount: number;
  bestScore: number | null;
  lastScore: number | null;
  lastCompletedAt: string | null;
}

export function summarizeFinalReadiness(simulations: FinalInterviewSimulation[]): FinalReadinessSummary {
  const completedSimulations = simulations
    .filter((simulation): simulation is FinalInterviewSimulation & { completed_at: string; readiness_score: number } =>
      simulation.completed_at !== null && simulation.readiness_score !== null)
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

  if (completedSimulations.length === 0) {
    return { completedCount: 0, bestScore: null, lastScore: null, lastCompletedAt: null };
  }

  const bestScore = Math.max(...completedSimulations.map(simulation => simulation.readiness_score));
  const [latest] = completedSimulations;

  return {
    completedCount: completedSimulations.length,
    bestScore,
    lastScore: latest.readiness_score,
    lastCompletedAt: latest.completed_at,
  };
}
