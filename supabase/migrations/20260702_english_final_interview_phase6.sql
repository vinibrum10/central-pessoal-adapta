-- Migration: Inglês — Simulado final de entrevista técnica de 30 minutos (Fase 6)
-- Tabelas novas apenas; nenhuma tabela antiga é alterada.
-- O áudio das respostas usa o bucket existente 'interview-answers' sob o prefixo {user_id}/,
-- então as policies de Storage já existentes cobrem o simulado sem mudanças.

create extension if not exists "pgcrypto";

create table if not exists public.final_interview_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  focus_area text,
  job_target_id uuid references public.job_targets(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed', 'evaluated', 'archived')),
  estimated_duration_min int not null default 30,
  question_count int not null default 10,
  overall_feedback jsonb,
  readiness_score numeric(5,1),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.final_interview_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  simulation_id uuid not null references public.final_interview_simulations(id) on delete cascade,
  question_text text not null,
  question_category text,
  guidance text,
  suggested_duration_sec int not null default 180,
  sort_order int not null default 0,
  source_type text,
  source_ref_id text,
  answer_id uuid references public.interview_answers(id) on delete set null,
  audio_path text,
  duration_sec int,
  individual_feedback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists final_interview_simulations_user_idx
  on public.final_interview_simulations(user_id, created_at desc);

create index if not exists final_interview_questions_simulation_idx
  on public.final_interview_questions(simulation_id, sort_order);

create index if not exists final_interview_questions_user_idx
  on public.final_interview_questions(user_id);

alter table public.final_interview_simulations enable row level security;
alter table public.final_interview_questions enable row level security;

drop policy if exists "final_interview_simulations: own select" on public.final_interview_simulations;
create policy "final_interview_simulations: own select"
  on public.final_interview_simulations for select
  using (auth.uid() = user_id);

drop policy if exists "final_interview_simulations: own insert" on public.final_interview_simulations;
create policy "final_interview_simulations: own insert"
  on public.final_interview_simulations for insert
  with check (auth.uid() = user_id);

drop policy if exists "final_interview_simulations: own update" on public.final_interview_simulations;
create policy "final_interview_simulations: own update"
  on public.final_interview_simulations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "final_interview_simulations: own delete" on public.final_interview_simulations;
create policy "final_interview_simulations: own delete"
  on public.final_interview_simulations for delete
  using (auth.uid() = user_id);

drop policy if exists "final_interview_questions: own select" on public.final_interview_questions;
create policy "final_interview_questions: own select"
  on public.final_interview_questions for select
  using (auth.uid() = user_id);

drop policy if exists "final_interview_questions: own insert" on public.final_interview_questions;
create policy "final_interview_questions: own insert"
  on public.final_interview_questions for insert
  with check (auth.uid() = user_id);

drop policy if exists "final_interview_questions: own update" on public.final_interview_questions;
create policy "final_interview_questions: own update"
  on public.final_interview_questions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "final_interview_questions: own delete" on public.final_interview_questions;
create policy "final_interview_questions: own delete"
  on public.final_interview_questions for delete
  using (auth.uid() = user_id);

drop trigger if exists final_interview_simulations_updated_at on public.final_interview_simulations;
create trigger final_interview_simulations_updated_at
  before update on public.final_interview_simulations
  for each row execute function public.update_updated_at();

drop trigger if exists final_interview_questions_updated_at on public.final_interview_questions;
create trigger final_interview_questions_updated_at
  before update on public.final_interview_questions
  for each row execute function public.update_updated_at();
