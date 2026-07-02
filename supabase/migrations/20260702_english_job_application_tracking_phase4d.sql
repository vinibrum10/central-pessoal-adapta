-- Migration: Inglês — Controle de candidaturas EUA (Fase 4D)
-- Campos manuais de acompanhamento no funil de vagas.

alter table public.job_targets
  add column if not exists applied_at timestamptz,
  add column if not exists interview_at timestamptz,
  add column if not exists follow_up_at timestamptz,
  add column if not exists next_action text,
  add column if not exists application_notes text,
  add column if not exists recruiter_name text,
  add column if not exists recruiter_contact text,
  add column if not exists salary_range text,
  add column if not exists work_model text check (work_model is null or work_model in ('remote', 'hybrid', 'onsite')),
  add column if not exists visa_sponsorship text,
  add column if not exists priority text check (priority is null or priority in ('low', 'medium', 'high'));

create index if not exists job_targets_user_follow_up_idx
  on public.job_targets(user_id, follow_up_at)
  where follow_up_at is not null;

create index if not exists job_targets_user_interview_idx
  on public.job_targets(user_id, interview_at)
  where interview_at is not null;

create index if not exists job_targets_user_priority_idx
  on public.job_targets(user_id, priority)
  where priority is not null;
