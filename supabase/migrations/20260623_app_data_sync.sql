-- Migration: tabela app_data — persistência principal por usuário
-- Resolve divergência de dados entre dispositivos.
-- Armazena o AppData completo como JSONB, vinculado ao user_id.
-- localStorage passa a ser apenas cache local.

create table if not exists app_data (
  id         uuid        not null default gen_random_uuid() primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  data       jsonb       not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint app_data_user_id_unique unique (user_id)
);

create index if not exists idx_app_data_user_id on app_data(user_id);

alter table app_data enable row level security;

create policy "Usuário lê próprios dados"
  on app_data for select
  using (auth.uid() = user_id);

create policy "Usuário insere próprios dados"
  on app_data for insert
  with check (auth.uid() = user_id);

create policy "Usuário atualiza próprios dados"
  on app_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuário deleta próprios dados"
  on app_data for delete
  using (auth.uid() = user_id);

-- Reutiliza função update_updated_at() criada em 001_initial_schema.sql
create or replace trigger app_data_updated_at
  before update on app_data
  for each row execute function update_updated_at();
'
