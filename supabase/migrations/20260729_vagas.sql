-- Migration: módulo Vagas — candidaturas do agente automático + banco de respostas
-- Idempotente (usa IF NOT EXISTS). Segue o padrão de RLS do 001_initial_schema.sql:
-- uma linha por usuário, restrita via auth.uid() = user_id.

create extension if not exists "pgcrypto";

-- ── VAGAS CANDIDATURAS ────────────────────────────────────────
create table if not exists vagas_candidaturas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  data_prep   date,
  vaga        text not null,
  empresa     text not null default '',
  local       text not null default '',
  fonte       text not null default '',
  score       integer check (score is null or (score >= 0 and score <= 100)),
  status      text not null default '',
  data_envio  date,
  retorno     text not null default '',
  link        text not null default '',
  observacoes text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table vagas_candidaturas enable row level security;
create policy "vagas_candidaturas: próprio usuário" on vagas_candidaturas
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists vagas_candidaturas_user_id_idx on vagas_candidaturas(user_id);

-- ── VAGAS RESPOSTAS BANCO ──────────────────────────────────────
create table if not exists vagas_respostas_banco (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  pergunta              text not null,
  tipo                  text not null default '',
  opcoes                text not null default '',
  resposta              text not null default '',
  sempre_usar           boolean not null default false,
  ultima_vaga           text not null default '',
  possivel_duplicata_de text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table vagas_respostas_banco enable row level security;
create policy "vagas_respostas_banco: próprio usuário" on vagas_respostas_banco
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists vagas_respostas_banco_user_id_idx on vagas_respostas_banco(user_id);

-- ── updated_at automático (reusa a função já criada em 001_initial_schema.sql) ──
create or replace trigger vagas_candidaturas_updated_at
  before update on vagas_candidaturas for each row execute function update_updated_at();
create or replace trigger vagas_respostas_banco_updated_at
  before update on vagas_respostas_banco for each row execute function update_updated_at();
