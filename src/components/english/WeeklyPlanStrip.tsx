import { CalendarDays } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../Card';
import type { WeeklyPlanDaySummary } from '../../services/english/overviewDashboardAggregator';

interface WeeklyPlanStripProps {
  days: WeeklyPlanDaySummary[];
  goal: string | null;
  completed: number;
  pending: number;
  percentComplete: number;
}

export function WeeklyPlanStrip({ days, goal, completed, pending, percentComplete }: WeeklyPlanStripProps) {
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader
        title="Plano semanal"
        subtitle={goal ?? 'Nenhum plano gerado para esta semana'}
        icon={<CalendarDays size={18} />}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map(day => {
            const isToday = day.date === hoje;
            return (
              <div
                key={day.date}
                className={`flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 ${
                  isToday
                    ? 'border-primary-400 bg-primary-50/60 dark:border-primary-300/50 dark:bg-primary-500/10'
                    : 'border-surface-200/70 bg-surface-50/70 dark:border-white/[0.06] dark:bg-white/[0.03]'
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? 'text-primary-600 dark:text-primary-300' : 'text-surface-400 dark:text-surface-500'}`}>
                  {day.label}
                </span>
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ background: `conic-gradient(#c9823a ${day.percentComplete}%, rgba(148,163,184,0.25) 0)` }}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-surface-700 dark:bg-surface-950 dark:text-surface-200">
                    {day.total > 0 ? `${day.completed}/${day.total}` : '–'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-surface-200/70 pt-3 text-xs text-surface-500 dark:border-white/[0.08] dark:text-surface-400">
          <span><b className="font-mono text-surface-900 dark:text-white">{completed}</b> tarefas concluídas</span>
          <span><b className="font-mono text-surface-900 dark:text-white">{pending}</b> restantes na semana</span>
          <span><b className="font-mono text-surface-900 dark:text-white">{percentComplete}%</b> da meta semanal</span>
        </div>
      </CardBody>
    </Card>
  );
}
