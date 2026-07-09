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
