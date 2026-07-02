-- Migration: Inglês — Vagas EUA (Fase 4A)
-- Cadastro de vagas-alvo americanas com análise de preparação gerada por IA.

create extension if not exists "pgcrypto";

create table if not exists public.job_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  company text,
  location text,
  job_url text,
  description text not null,
  status text not null default 'researching'
    check (status in ('researching', 'to_apply', 'applied', 'interview', 'rejected', 'offer', 'archived')),
  ai_analysis jsonb,
  match_score numeric(3,1) check (match_score between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists job_targets_user_status_idx
  on public.job_targets(user_id, status);

create index if not exists job_targets_user_created_idx
  on public.job_targets(user_id, created_at desc);

alter table public.job_targets enable row level security;

drop policy if exists "job_targets: own select" on public.job_targets;
create policy "job_targets: own select"
  on public.job_targets for select
  using (auth.uid() = user_id);

drop policy if exists "job_targets: own insert" on public.job_targets;
create policy "job_targets: own insert"
  on public.job_targets for insert
  with check (auth.uid() = user_id);

drop policy if exists "job_targets: own update" on public.job_targets;
create policy "job_targets: own update"
  on public.job_targets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "job_targets: own delete" on public.job_targets;
create policy "job_targets: own delete"
  on public.job_targets for delete
  using (auth.uid() = user_id);

drop trigger if exists job_targets_updated_at on public.job_targets;
create trigger job_targets_updated_at
  before update on public.job_targets
  for each row execute function public.update_updated_at();
