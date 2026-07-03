import type { WeeklyPreparationTask, WeeklyPreparationTaskStatus } from '../../types/englishInterview';
import { WeeklyPlanTaskItem } from './WeeklyPlanTaskItem';

interface WeeklyPlanDayCardProps {
  date: string;
  tasks: WeeklyPreparationTask[];
  savingTaskId: string | null;
  onStatusChange: (taskId: string, status: WeeklyPreparationTaskStatus) => void;
  onTaskAction?: (task: WeeklyPreparationTask) => void;
}

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function dayLabel(dateISO: string) {
  const date = new Date(`${dateISO}T12:00:00`);
  return dayNames[date.getDay()];
}

function shortDate(dateISO: string) {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function WeeklyPlanDayCard({ date, tasks, savingTaskId, onStatusChange, onTaskAction }: WeeklyPlanDayCardProps) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white/70 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-surface-950 dark:text-white">{dayLabel(date)}</h3>
          <p className="text-xs text-surface-500 dark:text-surface-400">{shortDate(date)}</p>
        </div>
        <span className="rounded-lg bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-600 dark:bg-white/10 dark:text-surface-300">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-surface-200 bg-surface-50/70 px-3 py-6 text-center dark:border-primary-300/10 dark:bg-white/[0.02]">
          <p className="text-xs text-surface-500 dark:text-surface-400">Sem ações para este dia.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <WeeklyPlanTaskItem
              key={task.id}
              task={task}
              saving={savingTaskId === task.id}
              onStatusChange={onStatusChange}
              onAction={onTaskAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
