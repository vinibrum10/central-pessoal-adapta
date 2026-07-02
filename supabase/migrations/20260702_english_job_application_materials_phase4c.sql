-- Migration: Inglês — Materiais de candidatura por vaga (Fase 4C)
-- Uma versão de materiais por vaga (regerar substitui), isolada por usuário via RLS.

create extension if not exists "pgcrypto";

create table if not exists public.job_application_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_target_id uuid not null references public.job_targets(id) on delete cascade,
  professional_summary_en text,
  resume_bullets_en jsonb,
  linkedin_about_en text,
  recruiter_message_en text,
  cover_letter_en text,
  key_terms_to_include jsonb,
  warnings_pt jsonb,
  tailoring_notes_pt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_target_id)
);

create index if not exists job_application_materials_user_idx
  on public.job_application_materials(user_id, updated_at desc);

alter table public.job_application_materials enable row level security;

drop policy if exists "job_application_materials: own select" on public.job_application_materials;
create policy "job_application_materials: own select"
  on public.job_application_materials for select
  using (auth.uid() = user_id);

drop policy if exists "job_application_materials: own insert" on public.job_application_materials;
create policy "job_application_materials: own insert"
  on public.job_application_materials for insert
  with check (auth.uid() = user_id);

drop policy if exists "job_application_materials: own update" on public.job_application_materials;
create policy "job_application_materials: own update"
  on public.job_application_materials for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "job_application_materials: own delete" on public.job_application_materials;
create policy "job_application_materials: own delete"
  on public.job_application_materials for delete
  using (auth.uid() = user_id);

drop trigger if exists job_application_materials_updated_at on public.job_application_materials;
create trigger job_application_materials_updated_at
  before update on public.job_application_materials
  for each row execute function public.update_updated_at();
