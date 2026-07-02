import { CalendarDays, CheckCircle2, Target, TrendingUp } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import type { WeeklyPreparationPlanWithTasks } from '../../types/englishInterview';

interface WeeklyPlanOverviewProps {
  planWithTasks: WeeklyPreparationPlanWithTasks;
}

function formatDate(dateISO: string) {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function WeeklyPlanOverview({ planWithTasks }: WeeklyPlanOverviewProps) {
  const { plan, tasks } = planWithTasks;
  const completed = tasks.filter(task => task.status === 'completed').length;
  const ignored = tasks.filter(task => task.status === 'ignored').length;
  const activeTasks = Math.max(0, tasks.length - ignored);
  const progress = activeTasks === 0 ? 0 : Math.round((completed / activeTasks) * 100);

  const metrics = [
    { label: 'Semana', value: `${formatDate(plan.week_start)} - ${formatDate(plan.week_end)}`, icon: <CalendarDays size={16} /> },
    { label: 'Tarefas', value: String(tasks.length), icon: <Target size={16} /> },
    { label: 'Concluídas', value: String(completed), icon: <CheckCircle2 size={16} /> },
    { label: 'Progresso', value: `${progress}%`, icon: <TrendingUp size={16} /> },
  ];

  return (
    <Card>
      <CardHeader
        title="Visão geral da semana"
        subtitle="O plano é uma sugestão. Ajuste conforme sua rotina."
        icon={<CalendarDays size={18} />}
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(metric => (
            <div key={metric.label} className="rounded-lg border border-surface-200 bg-white/75 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
              <div className="mb-2 flex items-center gap-2 text-surface-500 dark:text-surface-400">
                {metric.icon}
                <span className="text-xs font-semibold uppercase tracking-wide">{metric.label}</span>
              </div>
              <p className="text-xl font-bold text-surface-950 dark:text-white">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-surface-200 bg-surface-50/70 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Objetivo principal</p>
            <p className="mt-2 text-sm leading-6 text-surface-800 dark:text-surface-100">{plan.main_goal || 'Manter consistência de preparação.'}</p>
          </div>
          <div className="rounded-lg border border-surface-200 bg-surface-50/70 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Foco recomendado</p>
            <p className="mt-2 text-sm leading-6 text-surface-800 dark:text-surface-100">{plan.focus_area || 'Manutenção técnica semanal'}</p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-white/10">
          <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </CardBody>
    </Card>
  );
}
