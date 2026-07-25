-- Migration: Inglês Diário — V1 (configuração de playlist do YouTube, sessão diária, expressões com IA)
-- Tabelas novas apenas; nenhuma tabela do Modo Entrevista é alterada.
-- Dados por usuário: isolados por user_id = auth.uid(), owner-only em todas as tabelas.
-- Nenhuma coluna armazena access_token/refresh_token do Google — o token do YouTube
-- vive somente em memória no navegador (fora do escopo desta migration).

create extension if not exists "pgcrypto";

-- ============================================================
-- Tabelas
-- ============================================================

-- Configuração da playlist do YouTube escolhida pelo usuário.
-- Representa apenas CONFIGURAÇÃO persistida, nunca um estado de autorização:
-- a existência desta linha não significa que o usuário está autorizado agora.
create table if not exists public.youtube_playlist_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  playlist_id text not null,
  playlist_title text not null default 'SGP — Inglês',
  configured_at timestamptz not null default now(),
  last_verified_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- Sessão diária do Inglês Diário: um vídeo estudado, speaking e escala de compreensão.
-- session_date e timezone são snapshots enviados explicitamente pelo frontend na criação
-- (data local do usuário) — nunca um default do servidor e nunca recalculados depois.
create table if not exists public.daily_video_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  timezone text not null,
  youtube_video_id text,
  youtube_video_title text,
  youtube_video_thumbnail_url text,
  speaking_completed boolean not null default false,
  speaking_duration_sec int check (speaking_duration_sec is null or speaking_duration_sec >= 0),
  comprehension_scale smallint check (comprehension_scale is null or comprehension_scale between 1 and 4),
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluida')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_date),
  unique (id, user_id)
);

-- Expressões (1 a 5 por sessão) digitadas pelo usuário, com explicação da IA e
-- estado de revisão futura. A FK composta abaixo garante no banco que uma
-- expressão só pode apontar para uma sessão pertencente ao mesmo usuário.
create table if not exists public.daily_video_expressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  expression_en text not null check (length(trim(expression_en)) > 0),
  context_text text,
  position smallint not null check (position between 1 and 5),
  translation_pt text,
  contextual_explanation_pt text,
  pronunciation_tip_pt text,
  everyday_example_en text,
  career_example_en text,
  used_generic_meaning boolean,
  ai_explained_at timestamptz,
  srs_box smallint not null default 1 check (srs_box between 1 and 5),
  next_review_date date,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, position),
  foreign key (session_id, user_id)
    references public.daily_video_sessions(id, user_id)
    on delete cascade
);

-- ============================================================
-- Índices
-- (evitando redundância com os índices já criados pelas constraints UNIQUE acima)
-- ============================================================

-- "consultas por usuário": daily_video_expressions não tem nenhuma UNIQUE cujo
-- primeiro campo seja user_id, então precisa de índice próprio.
create index if not exists daily_video_expressions_user_idx
  on public.daily_video_expressions(user_id);

-- "consultas por próxima revisão": revisão futura filtrada por usuário + data.
create index if not exists daily_video_expressions_user_next_review_idx
  on public.daily_video_expressions(user_id, next_review_date);

-- Não são criados índices adicionais para:
--  - youtube_playlist_settings: UNIQUE(user_id) já cobre a única consulta prevista (por usuário).
--  - daily_video_sessions: UNIQUE(user_id, session_date) já cobre "por usuário" e "por data";
--    UNIQUE(id, user_id) já cobre a checagem da FK composta e "por sessão + usuário".
--  - daily_video_expressions "por sessão": já coberta por UNIQUE(session_id, position)
--    (session_id é a primeira coluna do índice).

-- ============================================================
-- RLS — owner-only em todas as tabelas, sem exceção
-- ============================================================
alter table public.youtube_playlist_settings enable row level security;
alter table public.daily_video_sessions enable row level security;
alter table public.daily_video_expressions enable row level security;

-- youtube_playlist_settings
drop policy if exists "youtube_playlist_settings: own select" on public.youtube_playlist_settings;
create policy "youtube_playlist_settings: own select"
  on public.youtube_playlist_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "youtube_playlist_settings: own insert" on public.youtube_playlist_settings;
create policy "youtube_playlist_settings: own insert"
  on public.youtube_playlist_settings for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "youtube_playlist_settings: own update" on public.youtube_playlist_settings;
create policy "youtube_playlist_settings: own update"
  on public.youtube_playlist_settings for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "youtube_playlist_settings: own delete" on public.youtube_playlist_settings;
create policy "youtube_playlist_settings: own delete"
  on public.youtube_playlist_settings for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- daily_video_sessions
drop policy if exists "daily_video_sessions: own select" on public.daily_video_sessions;
create policy "daily_video_sessions: own select"
  on public.daily_video_sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "daily_video_sessions: own insert" on public.daily_video_sessions;
create policy "daily_video_sessions: own insert"
  on public.daily_video_sessions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_video_sessions: own update" on public.daily_video_sessions;
create policy "daily_video_sessions: own update"
  on public.daily_video_sessions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_video_sessions: own delete" on public.daily_video_sessions;
create policy "daily_video_sessions: own delete"
  on public.daily_video_sessions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- daily_video_expressions
drop policy if exists "daily_video_expressions: own select" on public.daily_video_expressions;
create policy "daily_video_expressions: own select"
  on public.daily_video_expressions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "daily_video_expressions: own insert" on public.daily_video_expressions;
create policy "daily_video_expressions: own insert"
  on public.daily_video_expressions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_video_expressions: own update" on public.daily_video_expressions;
create policy "daily_video_expressions: own update"
  on public.daily_video_expressions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_video_expressions: own delete" on public.daily_video_expressions;
create policy "daily_video_expressions: own delete"
  on public.daily_video_expressions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================
-- Triggers de updated_at (reaproveita public.update_updated_at(), já criada em 001_initial_schema.sql)
-- ============================================================
drop trigger if exists youtube_playlist_settings_updated_at on public.youtube_playlist_settings;
create trigger youtube_playlist_settings_updated_at
  before update on public.youtube_playlist_settings
  for each row execute function public.update_updated_at();

drop trigger if exists daily_video_sessions_updated_at on public.daily_video_sessions;
create trigger daily_video_sessions_updated_at
  before update on public.daily_video_sessions
  for each row execute function public.update_updated_at();

drop trigger if exists daily_video_expressions_updated_at on public.daily_video_expressions;
create trigger daily_video_expressions_updated_at
  before update on public.daily_video_expressions
  for each row execute function public.update_updated_at();
