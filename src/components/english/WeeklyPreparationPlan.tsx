import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '../Button';
import { Card, CardBody, CardHeader } from '../Card';
import type { WeeklyPreparationPlanWithTasks, WeeklyPreparationTask, WeeklyPreparationTaskStatus } from '../../types/englishInterview';
import { generateWeeklyPreparationPlan } from '../../services/english/weeklyPreparationPlanner';
import {
  getCurrentWeekRange,
  getWeeklyPreparationPlan,
  saveGeneratedWeeklyPreparationPlan,
  updateWeeklyPreparationTaskStatus,
} from '../../services/english/weeklyPreparationRepository';
import { WeeklyPlanDayCard } from './WeeklyPlanDayCard';
import { WeeklyPlanOverview } from './WeeklyPlanOverview';

interface WeeklyPreparationPlanProps {
  userId: string;
  onTaskAction?: (task: WeeklyPreparationTask) => void;
}

function addDaysISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function WeeklyPreparationPlan({ userId, onTaskAction }: WeeklyPreparationPlanProps) {
  const [{ weekStart }, setWeekRange] = useState(() => getCurrentWeekRange());
  const [planWithTasks, setPlanWithTasks] = useState<WeeklyPreparationPlanWithTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDaysISO(weekStart, index)), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const range = getCurrentWeekRange();
      setWeekRange(range);
      setPlanWithTasks(await getWeeklyPreparationPlan(userId, range.weekStart));
    } catch (err) {
      console.error('[WeeklyPreparation] Failed to load plan', err);
      setError('Não foi possível carregar o plano semanal. Confira se a migration da Fase 5 foi aplicada.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const generated = await generateWeeklyPreparationPlan(userId);
      setPlanWithTasks(await saveGeneratedWeeklyPreparationPlan(userId, generated));
    } catch (err) {
      console.error('[WeeklyPreparation] Failed to generate plan', err);
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o plano semanal.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleTaskStatusChange(taskId: string, status: WeeklyPreparationTaskStatus) {
    setSavingTaskId(taskId);
    setError('');
    try {
      const updated = await updateWeeklyPreparationTaskStatus(taskId, status);
      setPlanWithTasks(prev => prev ? {
        ...prev,
        tasks: prev.tasks.map(task => task.id === taskId ? updated : task),
      } : prev);
    } catch (err) {
      console.error('[WeeklyPreparation] Failed to update task', err);
      setError('Não foi possível atualizar o status da tarefa.');
    } finally {
      setSavingTaskId(null);
    }
  }

  function tasksForDate(dateISO: string): WeeklyPreparationTask[] {
    return (planWithTasks?.tasks ?? [])
      .filter(task => task.task_date === dateISO)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  if (loading) {
    return (
      <Card>
        <CardBody className="flex items-center gap-2 py-6 text-sm text-surface-500 dark:text-surface-400">
          <Loader2 size={16} className="animate-spin" />
          Carregando plano semanal...
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!planWithTasks ? (
        <Card>
          <CardHeader
            title="Plano semanal"
            subtitle="Gere uma sugestão de estudo com base nas suas respostas, vocabulário, mocks e vagas."
            icon={<CalendarDays size={18} />}
          />
          <CardBody className="space-y-4">
            <p className="text-sm leading-6 text-surface-600 dark:text-surface-300">
              O plano é manual e determinístico: ele não envia candidaturas, não agenda eventos e não busca vagas na internet.
            </p>
            <Button type="button" icon={<Sparkles size={16} />} loading={generating} onClick={handleGenerate}>
              Gerar plano da semana
            </Button>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-surface-950 dark:text-white">Plano semanal</h2>
              <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">O que estudar e praticar nesta semana.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" icon={<RefreshCw size={14} />} onClick={load}>
                Atualizar
              </Button>
              <Button type="button" icon={<Sparkles size={16} />} loading={generating} onClick={handleGenerate}>
                Regenerar plano
              </Button>
            </div>
          </div>

          <WeeklyPlanOverview planWithTasks={planWithTasks} />

          <div className="grid gap-4 xl:grid-cols-2">
            {weekDates.map(date => (
              <WeeklyPlanDayCard
                key={date}
                date={date}
                tasks={tasksForDate(date)}
                savingTaskId={savingTaskId}
                onStatusChange={handleTaskStatusChange}
                onTaskAction={onTaskAction}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
