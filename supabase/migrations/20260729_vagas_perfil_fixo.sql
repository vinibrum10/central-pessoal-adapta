-- Migration: perfil de candidatura fixo (fatos verificados, preenchidos uma vez).
-- Uma linha por usuario — segue o padrao da tabela profiles (PK = user_id).

create table if not exists vagas_perfil_fixo (
  user_id                     uuid primary key references auth.users(id) on delete cascade,
  escola                      text not null default '',
  curso                       text not null default '',
  ano_inicio                  integer,
  ano_termino                 integer,
  linkedin_url                text not null default '',
  nivel_ingles                text not null default '',
  autorizado_trabalhar_brasil boolean not null default false,
  piso_salarial               numeric(12,2),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
alter table vagas_perfil_fixo enable row level security;
create policy "vagas_perfil_fixo: próprio usuário" on vagas_perfil_fixo
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace trigger vagas_perfil_fixo_updated_at
  before update on vagas_perfil_fixo for each row execute function update_updated_at();
