create table if not exists public.english_study_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint english_study_data_user_id_unique unique (user_id)
);

create index if not exists idx_english_study_data_user_id
  on public.english_study_data(user_id);

alter table public.english_study_data enable row level security;

drop policy if exists "english_study_data_select_own" on public.english_study_data;
create policy "english_study_data_select_own"
  on public.english_study_data
  for select
  using (auth.uid() = user_id);

drop policy if exists "english_study_data_insert_own" on public.english_study_data;
create policy "english_study_data_insert_own"
  on public.english_study_data
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "english_study_data_update_own" on public.english_study_data;
create policy "english_study_data_update_own"
  on public.english_study_data
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "english_study_data_delete_own" on public.english_study_data;
create policy "english_study_data_delete_own"
  on public.english_study_data
  for delete
  using (auth.uid() = user_id);

drop trigger if exists english_study_data_updated_at on public.english_study_data;
create trigger english_study_data_updated_at
  before update on public.english_study_data
  for each row
  execute function public.update_updated_at();
