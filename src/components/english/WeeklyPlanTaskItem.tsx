import { CheckCircle2, Circle, EyeOff, Loader2, RotateCcw } from 'lucide-react';
import type { WeeklyPreparationTask, WeeklyPreparationTaskStatus, WeeklyPreparationTaskType } from '../../types/englishInterview';

interface WeeklyPlanTaskItemProps {
  task: WeeklyPreparationTask;
  saving: boolean;
  onStatusChange: (taskId: string, status: WeeklyPreparationTaskStatus) => void;
}

const typeLabels: Record<WeeklyPreparationTaskType, string> = {
  speaking: 'Speaking',
  vocabulary: 'Vocabulário',
  star: 'STAR',
  mock: 'Mock',
  job_target: 'Vaga',
  application: 'Candidatura',
  follow_up: 'Follow-up',
  review: 'Revisão',
};

const typeClasses: Record<WeeklyPreparationTaskType, string> = {
  speaking: 'bg-primary-500/10 text-primary-700 dark:text-primary-200',
  vocabulary: 'bg-success-500/10 text-success-700 dark:text-success-300',
  star: 'bg-warning-500/10 text-warning-700 dark:text-warning-300',
  mock: 'bg-primary-500/10 text-primary-700 dark:text-primary-200',
  job_target: 'bg-surface-100 text-surface-700 dark:bg-white/10 dark:text-surface-200',
  application: 'bg-success-500/10 text-success-700 dark:text-success-300',
  follow_up: 'bg-danger-500/10 text-danger-700 dark:text-danger-300',
  review: 'bg-surface-100 text-surface-700 dark:bg-white/10 dark:text-surface-200',
};

function statusButtonClass(active: boolean) {
  return active
    ? 'border-primary-500 bg-primary-600 text-white'
    : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50 dark:border-primary-300/15 dark:bg-white/[0.04] dark:text-surface-300 dark:hover:bg-white/10';
}

export function WeeklyPlanTaskItem({ task, saving, onStatusChange }: WeeklyPlanTaskItemProps) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white/75 p-3 dark:border-primary-300/15 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${typeClasses[task.task_type]}`}>
              {typeLabels[task.task_type]}
            </span>
            {task.source_type && (
              <span className="rounded-lg bg-surface-100 px-2 py-1 text-[11px] font-medium text-surface-500 dark:bg-white/10 dark:text-surface-400">
                {task.source_type}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold leading-5 text-surface-950 dark:text-white">{task.title}</p>
          {task.description && <p className="text-xs leading-5 text-surface-600 dark:text-surface-300">{task.description}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => onStatusChange(task.id, 'pending')}
            className={`inline-flex min-h-8 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${statusButtonClass(task.status === 'pending')}`}
          >
            {saving && task.status === 'pending' ? <Loader2 size={13} className="animate-spin" /> : <Circle size={13} />}
            Pendente
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onStatusChange(task.id, 'completed')}
            className={`inline-flex min-h-8 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${statusButtonClass(task.status === 'completed')}`}
          >
            <CheckCircle2 size={13} />
            Concluído
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onStatusChange(task.id, 'ignored')}
            className={`inline-flex min-h-8 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${statusButtonClass(task.status === 'ignored')}`}
          >
            {task.status === 'ignored' ? <EyeOff size={13} /> : <RotateCcw size={13} />}
            Ignorado
          </button>
        </div>
      </div>
    </div>
  );
}
