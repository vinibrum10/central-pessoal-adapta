-- Migration: Inglês — Empregabilidade EUA (Fase 3A + 3B)
-- Extensão incremental do Modo Entrevista: vocabulário de vagas e respostas STAR.

create extension if not exists "pgcrypto";

-- ============================================================
-- Vocabulário de vagas dos EUA
-- ============================================================
alter table public.glossary_terms
  add column if not exists category text,
  add column if not exists importance_level int not null default 3 check (importance_level between 1 and 5);

create index if not exists glossary_terms_category_idx
  on public.glossary_terms(category);

create index if not exists glossary_terms_source_category_idx
  on public.glossary_terms(source, category);

-- ============================================================
-- Banco de respostas STAR
-- ============================================================
create table if not exists public.star_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.interview_questions(id) on delete cascade,
  title text not null,
  situation text not null default '',
  task text not null default '',
  action text not null default '',
  result text not null default '',
  final_answer_en text not null default '',
  notes_pt text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists star_answers_user_question_idx
  on public.star_answers(user_id, question_id);

create index if not exists star_answers_user_updated_idx
  on public.star_answers(user_id, updated_at desc);

alter table public.star_answers enable row level security;

drop policy if exists "star_answers: own select" on public.star_answers;
create policy "star_answers: own select"
  on public.star_answers for select
  using (auth.uid() = user_id);

drop policy if exists "star_answers: own insert" on public.star_answers;
create policy "star_answers: own insert"
  on public.star_answers for insert
  with check (auth.uid() = user_id);

drop policy if exists "star_answers: own update" on public.star_answers;
create policy "star_answers: own update"
  on public.star_answers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "star_answers: own delete" on public.star_answers;
create policy "star_answers: own delete"
  on public.star_answers for delete
  using (auth.uid() = user_id);

drop trigger if exists star_answers_updated_at on public.star_answers;
create trigger star_answers_updated_at
  before update on public.star_answers
  for each row execute function public.update_updated_at();
