-- ============================================================
-- CENTRAL PESSOAL ADAPTA — Schema inicial
-- Execute no Supabase: Dashboard → SQL Editor → New Query
-- ============================================================

-- Habilitar extensão UUID
create extension if not exists "pgcrypto";

-- ── PROFILES ────────────────────────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null default '',
  email      text,
  role       text not null default 'visualizador',
  status     text not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "profiles: próprio usuário" on profiles
  using (auth.uid() = id) with check (auth.uid() = id);

-- ── METAS ────────────────────────────────────────────────────
create table if not exists metas (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  nome                text not null,
  rank                integer not null default 0,
  categoria           text not null,
  status              text not null default 'ativa',
  motivo              text not null default '',
  resultado_esperado  text not null default '',
  data_inicio         date,
  prazo_final         date not null,
  classificacao_prazo text,
  frequencia_revisao  text not null default 'semanal',
  data_ultima_revisao date,
  data_ultima_acao    date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table metas enable row level security;
create policy "metas: próprio usuário" on metas
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists metas_user_id_idx on metas(user_id);

-- ── TAREFAS ──────────────────────────────────────────────────
create table if not exists tarefas (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  meta_id                  uuid references metas(id) on delete set null,
  titulo                   text not null,
  categoria                text not null,
  status                   text not null default 'não iniciado',
  faixa                    text not null default 'médio impacto',
  faixa_manual             boolean not null default false,
  tipo_acao                text not null default 'eventual',
  periodicidade            text,
  intervalo_dias           integer,
  tempo_estimado           integer not null default 30,
  tempo_minimo_minutos     integer,
  prazo                    date not null,
  data_proxima_ocorrencia  date,
  ultima_reabertura        date,
  energia_necessaria       text not null default 'média',
  observacoes              text not null default '',
  data_conclusao           date,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
alter table tarefas enable row level security;
create policy "tarefas: próprio usuário" on tarefas
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists tarefas_user_id_idx on tarefas(user_id);

-- ── RECEITAS ─────────────────────────────────────────────────
create table if not exists receitas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  descricao   text not null,
  valor       numeric(12,2) not null,
  data        date not null,
  categoria   text not null,
  recorrente  boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table receitas enable row level security;
create policy "receitas: próprio usuário" on receitas
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── DESPESAS ─────────────────────────────────────────────────
create table if not exists despesas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  descricao       text not null,
  valor           numeric(12,2) not null,
  data            date not null,
  categoria       text not null,
  forma_pagamento text not null,
  recorrente      boolean not null default false,
  essencial       boolean not null default true,
  created_at      timestamptz not null default now()
);
alter table despesas enable row level security;
create policy "despesas: próprio usuário" on despesas
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── CARTÕES ──────────────────────────────────────────────────
create table if not exists cartoes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  nome         text not null,
  limite       numeric(12,2) not null default 0,
  fatura_atual numeric(12,2) not null default 0,
  vencimento   integer not null,
  status       text not null default 'ativo',
  created_at   timestamptz not null default now()
);
alter table cartoes enable row level security;
create policy "cartoes: próprio usuário" on cartoes
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── DÍVIDAS ──────────────────────────────────────────────────
create table if not exists dividas (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  nome                 text not null,
  valor_total          numeric(12,2) not null,
  valor_parcela        numeric(12,2) not null,
  total_parcelas       integer not null,
  parcelas_pagas       integer not null default 0,
  taxa_juros           numeric(6,3) not null default 0,
  prioridade_quitacao  text not null default 'média',
  created_at           timestamptz not null default now()
);
alter table dividas enable row level security;
create policy "dividas: próprio usuário" on dividas
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── RESERVAS ─────────────────────────────────────────────────
create table if not exists reservas (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  nome           text not null,
  meta_reserva   numeric(12,2) not null,
  valor_atual    numeric(12,2) not null default 0,
  prazo_desejado date,
  created_at     timestamptz not null default now()
);
alter table reservas enable row level security;
create policy "reservas: próprio usuário" on reservas
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── BENS ─────────────────────────────────────────────────────
create table if not exists bens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  nome            text not null,
  tipo            text not null,
  valor_estimado  numeric(12,2) not null,
  status          text not null default 'manter',
  observacoes     text not null default '',
  created_at      timestamptz not null default now()
);
alter table bens enable row level security;
create policy "bens: próprio usuário" on bens
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── EVENTOS AGENDA ────────────────────────────────────────────
create table if not exists eventos_agenda (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  fonte            text not null,
  external_id      text,
  titulo           text not null,
  descricao        text,
  inicio           timestamptz not null,
  fim              timestamptz not null,
  dia_inteiro      boolean not null default false,
  local            text,
  bloqueia_tempo   boolean not null default true,
  tarefa_gerada_id uuid references tarefas(id) on delete set null,
  ignorado         boolean not null default false,
  importado_em     timestamptz not null default now()
);
alter table eventos_agenda enable row level security;
create policy "eventos_agenda: próprio usuário" on eventos_agenda
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists eventos_agenda_user_id_idx on eventos_agenda(user_id);
create index if not exists eventos_agenda_inicio_idx on eventos_agenda(inicio);

-- ── CONFIGURAÇÕES AGENDA ─────────────────────────────────────
create table if not exists configuracoes_agenda (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  fonte            text not null,
  nome             text not null,
  ativa            boolean not null default true,
  sincronizada_em  timestamptz
);
alter table configuracoes_agenda enable row level security;
create policy "configuracoes_agenda: próprio usuário" on configuracoes_agenda
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── LEITURAS DIÁRIAS ─────────────────────────────────────────
create table if not exists leituras_diarias (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  origem          text not null default 'manual',
  titulo          text not null,
  resumo          text,
  tipo            text not null default 'geral',
  url             text,
  drive_file_id   text,
  categoria       text not null default 'Geral',
  prioridade      text not null default 'normal',
  status          text not null default 'pendente',
  data_leitura    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table leituras_diarias enable row level security;
create policy "leituras_diarias: próprio usuário" on leituras_diarias
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists leituras_diarias_user_id_idx on leituras_diarias(user_id);
-- Evitar duplicação de arquivos do Drive
create unique index if not exists leituras_diarias_drive_unique
  on leituras_diarias(user_id, drive_file_id)
  where drive_file_id is not null;

-- ── FONTES DE LEITURA ─────────────────────────────────────────
create table if not exists fontes_leitura (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  nome                 text not null,
  tipo                 text not null,
  drive_folder_id      text,
  ativa                boolean not null default true,
  ultima_sincronizacao timestamptz
);
alter table fontes_leitura enable row level security;
create policy "fontes_leitura: próprio usuário" on fontes_leitura
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── TRIGGER: updated_at automático ────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger metas_updated_at
  before update on metas for each row execute function update_updated_at();
create or replace trigger tarefas_updated_at
  before update on tarefas for each row execute function update_updated_at();
create or replace trigger leituras_updated_at
  before update on leituras_diarias for each row execute function update_updated_at();
create or replace trigger profiles_updated_at
  before update on profiles for each row execute function update_updated_at();
