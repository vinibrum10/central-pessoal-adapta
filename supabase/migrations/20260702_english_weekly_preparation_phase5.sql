-- Migration: Inglês — Plano semanal automático de preparação (Fase 5)
-- Plano e tarefas manuais por usuário, gerados a partir dos dados existentes.

create extension if not exists "pgcrypto";

create table if not exists public.weekly_preparation_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  main_goal text,
  focus_area text,
  generated_from_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists public.weekly_preparation_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.weekly_preparation_plans(id) on delete cascade,
  task_date date not null,
  title text not null,
  description text,
  task_type text not null check (task_type in ('speaking', 'vocabulary', 'star', 'mock', 'job_target', 'application', 'follow_up', 'review')),
  source_type text,
  source_ref_id text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'ignored')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists weekly_preparation_plans_user_week_idx
  on public.weekly_preparation_plans(user_id, week_start desc);

create index if not exists weekly_preparation_tasks_plan_date_idx
  on public.weekly_preparation_tasks(plan_id, task_date, sort_order);

create index if not exists weekly_preparation_tasks_user_status_idx
  on public.weekly_preparation_tasks(user_id, status);

alter table public.weekly_preparation_plans enable row level security;
alter table public.weekly_preparation_tasks enable row level security;

drop policy if exists "weekly_preparation_plans: own select" on public.weekly_preparation_plans;
create policy "weekly_preparation_plans: own select"
  on public.weekly_preparation_plans for select
  using (auth.uid() = user_id);

drop policy if exists "weekly_preparation_plans: own insert" on public.weekly_preparation_plans;
create policy "weekly_preparation_plans: own insert"
  on public.weekly_preparation_plans for insert
  with check (auth.uid() = user_id);

drop policy if exists "weekly_preparation_plans: own update" on public.weekly_preparation_plans;
create policy "weekly_preparation_plans: own update"
  on public.weekly_preparation_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "weekly_preparation_plans: own delete" on public.weekly_preparation_plans;
create policy "weekly_preparation_plans: own delete"
  on public.weekly_preparation_plans for delete
  using (auth.uid() = user_id);

drop policy if exists "weekly_preparation_tasks: own select" on public.weekly_preparation_tasks;
create policy "weekly_preparation_tasks: own select"
  on public.weekly_preparation_tasks for select
  using (auth.uid() = user_id);

drop policy if exists "weekly_preparation_tasks: own insert" on public.weekly_preparation_tasks;
create policy "weekly_preparation_tasks: own insert"
  on public.weekly_preparation_tasks for insert
  with check (auth.uid() = user_id);

drop policy if exists "weekly_preparation_tasks: own update" on public.weekly_preparation_tasks;
create policy "weekly_preparation_tasks: own update"
  on public.weekly_preparation_tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "weekly_preparation_tasks: own delete" on public.weekly_preparation_tasks;
create policy "weekly_preparation_tasks: own delete"
  on public.weekly_preparation_tasks for delete
  using (auth.uid() = user_id);

drop trigger if exists weekly_preparation_plans_updated_at on public.weekly_preparation_plans;
create trigger weekly_preparation_plans_updated_at
  before update on public.weekly_preparation_plans
  for each row execute function public.update_updated_at();

drop trigger if exists weekly_preparation_tasks_updated_at on public.weekly_preparation_tasks;
create trigger weekly_preparation_tasks_updated_at
  before update on public.weekly_preparation_tasks
  for each row execute function public.update_updated_at();
