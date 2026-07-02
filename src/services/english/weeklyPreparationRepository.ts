import { supabase } from '../../lib/supabase';
import type {
  GeneratedWeeklyPreparationPlan,
  WeeklyPreparationPlan,
  WeeklyPreparationPlanWithTasks,
  WeeklyPreparationTask,
  WeeklyPreparationTaskStatus,
} from '../../types/englishInterview';

async function throwIfError<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export function getCurrentWeekRange(date = new Date()): { weekStart: string; weekEnd: string } {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const day = copy.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diffToMonday);
  const start = copy.toISOString().slice(0, 10);
  copy.setDate(copy.getDate() + 6);
  const end = copy.toISOString().slice(0, 10);
  return { weekStart: start, weekEnd: end };
}

export async function getWeeklyPreparationPlan(userId: string, weekStart: string): Promise<WeeklyPreparationPlanWithTasks | null> {
  if (!userId) throw new Error('Usuário autenticado não encontrado para carregar o plano semanal.');

  const plan = await throwIfError<WeeklyPreparationPlan | null>(
    supabase
      .from('weekly_preparation_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle() as never,
  );
  if (!plan) return null;

  const tasks = await throwIfError<WeeklyPreparationTask[]>(
    supabase
      .from('weekly_preparation_tasks')
      .select('*')
      .eq('plan_id', plan.id)
      .order('task_date', { ascending: true })
      .order('sort_order', { ascending: true }) as never,
  );

  return { plan, tasks };
}

export async function saveGeneratedWeeklyPreparationPlan(
  userId: string,
  generated: GeneratedWeeklyPreparationPlan,
): Promise<WeeklyPreparationPlanWithTasks> {
  if (!userId) throw new Error('Usuário autenticado não encontrado para salvar o plano semanal.');

  const plan = await throwIfError<WeeklyPreparationPlan>(
    supabase
      .from('weekly_preparation_plans')
      .upsert({
        user_id: userId,
        week_start: generated.week_start,
        week_end: generated.week_end,
        main_goal: generated.main_goal,
        focus_area: generated.focus_area,
        generated_from_snapshot: generated.generated_from_snapshot,
      }, { onConflict: 'user_id,week_start' })
      .select('*')
      .single() as never,
  );

  const { error: deleteError } = await supabase
    .from('weekly_preparation_tasks')
    .delete()
    .eq('plan_id', plan.id);
  if (deleteError) throw deleteError;

  const rows = generated.tasks.map(task => ({
    user_id: userId,
    plan_id: plan.id,
    ...task,
    status: 'pending' as const,
  }));

  const tasks = rows.length > 0
    ? await throwIfError<WeeklyPreparationTask[]>(
        supabase
          .from('weekly_preparation_tasks')
          .insert(rows)
          .select('*')
          .order('task_date', { ascending: true })
          .order('sort_order', { ascending: true }) as never,
      )
    : [];

  return { plan, tasks };
}

export async function updateWeeklyPreparationTaskStatus(
  taskId: string,
  status: WeeklyPreparationTaskStatus,
): Promise<WeeklyPreparationTask> {
  return throwIfError<WeeklyPreparationTask>(
    supabase
      .from('weekly_preparation_tasks')
      .update({ status })
      .eq('id', taskId)
      .select('*')
      .single() as never,
  );
}
