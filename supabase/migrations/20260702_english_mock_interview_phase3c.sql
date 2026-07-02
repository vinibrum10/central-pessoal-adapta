-- Migration: Inglês — Mock Interview mensal (Fase 3C)
-- Extensão incremental: mock_sessions já existe (Fase 1, uso legado de mock com professor).
-- Aqui adicionamos os campos necessários para o Mock Interview mensal orientado a perguntas
-- do banco interview_questions, sem remover ou quebrar o uso legado (session_date/teacher/rating/notes/recording_path).

create extension if not exists "pgcrypto";

-- ============================================================
-- mock_sessions: novos campos para o mock mensal
-- ============================================================
alter table public.mock_sessions
  add column if not exists title text,
  add column if not exists status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed')),
  add column if not exists question_ids text[] not null default '{}',
  add column if not exists overall_feedback jsonb,
  add column if not exists total_duration_sec int,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Permite criar um mock sem informar session_date explicitamente (uso legado exigia a data manual).
alter table public.mock_sessions
  alter column session_date set default current_date;

create index if not exists mock_sessions_user_status_idx
  on public.mock_sessions(user_id, status);

drop trigger if exists mock_sessions_updated_at on public.mock_sessions;
create trigger mock_sessions_updated_at
  before update on public.mock_sessions
  for each row execute function public.update_updated_at();

-- ============================================================
-- mock_session_questions: perguntas selecionadas para cada mock
-- ============================================================
create table if not exists public.mock_session_questions (
  id uuid primary key default gen_random_uuid(),
  mock_session_id uuid not null references public.mock_sessions(id) on delete cascade,
  question_id text not null references public.interview_questions(id) on delete cascade,
  position int not null default 0,
  answer_id uuid references public.interview_answers(id) on delete set null,
  score numeric(4,1),
  created_at timestamptz not null default now()
);

create unique index if not exists mock_session_questions_session_question_unique
  on public.mock_session_questions(mock_session_id, question_id);

create index if not exists mock_session_questions_session_idx
  on public.mock_session_questions(mock_session_id, position);

alter table public.mock_session_questions enable row level security;

drop policy if exists "mock_session_questions: own select" on public.mock_session_questions;
create policy "mock_session_questions: own select"
  on public.mock_session_questions for select
  using (exists (
    select 1 from public.mock_sessions ms
    where ms.id = mock_session_questions.mock_session_id and ms.user_id = auth.uid()
  ));

drop policy if exists "mock_session_questions: own insert" on public.mock_session_questions;
create policy "mock_session_questions: own insert"
  on public.mock_session_questions for insert
  with check (exists (
    select 1 from public.mock_sessions ms
    where ms.id = mock_session_questions.mock_session_id and ms.user_id = auth.uid()
  ));

drop policy if exists "mock_session_questions: own update" on public.mock_session_questions;
create policy "mock_session_questions: own update"
  on public.mock_session_questions for update
  using (exists (
    select 1 from public.mock_sessions ms
    where ms.id = mock_session_questions.mock_session_id and ms.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.mock_sessions ms
    where ms.id = mock_session_questions.mock_session_id and ms.user_id = auth.uid()
  ));

drop policy if exists "mock_session_questions: own delete" on public.mock_session_questions;
create policy "mock_session_questions: own delete"
  on public.mock_session_questions for delete
  using (exists (
    select 1 from public.mock_sessions ms
    where ms.id = mock_session_questions.mock_session_id and ms.user_id = auth.uid()
  ));

-- ============================================================
-- interview_answers: vínculo opcional com um mock
-- ============================================================
alter table public.interview_answers
  add column if not exists mock_session_id uuid references public.mock_sessions(id) on delete set null;

create index if not exists interview_answers_mock_session_idx
  on public.interview_answers(mock_session_id);
