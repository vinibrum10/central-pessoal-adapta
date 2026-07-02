-- Migration: status explícito de domínio para vocabulário de empregabilidade
-- Não substitui glossary_reviews; mantém SRS separado do status simples da UI.

create extension if not exists "pgcrypto";

create table if not exists public.user_glossary_term_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id uuid not null references public.glossary_terms(id) on delete cascade,
  status text not null check (status in ('mastered', 'review', 'not_mastered')),
  updated_at timestamptz not null default now(),
  unique (user_id, term_id)
);

create index if not exists user_glossary_term_status_user_idx
  on public.user_glossary_term_status(user_id, updated_at desc);

create index if not exists user_glossary_term_status_term_idx
  on public.user_glossary_term_status(term_id);

alter table public.user_glossary_term_status enable row level security;

drop policy if exists "user_glossary_term_status: own select" on public.user_glossary_term_status;
create policy "user_glossary_term_status: own select"
  on public.user_glossary_term_status for select
  using (auth.uid() = user_id);

drop policy if exists "user_glossary_term_status: own insert" on public.user_glossary_term_status;
create policy "user_glossary_term_status: own insert"
  on public.user_glossary_term_status for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_glossary_term_status: own update" on public.user_glossary_term_status;
create policy "user_glossary_term_status: own update"
  on public.user_glossary_term_status for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_glossary_term_status: own delete" on public.user_glossary_term_status;
create policy "user_glossary_term_status: own delete"
  on public.user_glossary_term_status for delete
  using (auth.uid() = user_id);

drop trigger if exists user_glossary_term_status_updated_at on public.user_glossary_term_status;
create trigger user_glossary_term_status_updated_at
  before update on public.user_glossary_term_status
  for each row execute function public.update_updated_at();
