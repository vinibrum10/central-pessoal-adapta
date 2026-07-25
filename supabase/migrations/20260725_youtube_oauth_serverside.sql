-- Migration: Inglês Diário — OAuth 2.0 server-side (Authorization Code Flow, access_type=offline)
--
-- Substitui a necessidade de reautorização manual a cada F5: o refresh_token
-- fica armazenado (criptografado) no backend, associado ao usuário, e as
-- Edge Functions o usam para obter access_tokens novos sem interação.
--
-- NENHUMA destas tabelas é acessível pela Data API para os papéis `anon`/
-- `authenticated` — de propósito. Só o `service_role` (usado exclusivamente
-- pelas Edge Functions, nunca pelo frontend) pode ler/escrever aqui. Isso é
-- reforçado tanto por RLS habilitado sem nenhuma policy para esses papéis,
-- quanto pela ausência de qualquer GRANT para eles nestas tabelas.
--
-- O valor de `refresh_token_encrypted` é sempre AES-256-GCM, cifrado/decifrado
-- somente dentro das Edge Functions com TOKEN_ENCRYPTION_KEY (Supabase Secret,
-- nunca no banco, nunca no frontend). O banco armazena apenas o ciphertext e o
-- IV — nunca teria como decifrar sozinho, mesmo com acesso de leitura via
-- service_role vazado.

create extension if not exists "pgcrypto";

-- ============================================================
-- Conexão OAuth do YouTube por usuário (no máximo 1 linha por user_id)
-- ============================================================
create table if not exists public.youtube_oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  refresh_token_encrypted text not null,
  refresh_token_iv text not null,
  granted_scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked', 'invalid')),
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ============================================================
-- State CSRF de uso único para o Authorization Code Flow
-- ============================================================
create table if not exists public.youtube_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

-- "limpeza"/consulta por validade: cobre a checagem "state válido e não expirado".
create index if not exists youtube_oauth_states_expires_at_idx
  on public.youtube_oauth_states(expires_at);

-- ============================================================
-- RLS — habilitado, SEM NENHUMA policy para anon/authenticated.
-- Só service_role acessa, e mesmo assim só com os GRANTs explícitos abaixo
-- (privilégio mínimo: nada de ALL/ownership implícito).
-- ============================================================
alter table public.youtube_oauth_connections enable row level security;
alter table public.youtube_oauth_states enable row level security;

-- Revoga de PUBLIC também (não só anon/authenticated): PUBLIC é o papel
-- implícito do qual todo papel do Postgres herda privilégios por padrão, então
-- sem este revoke explícito um novo papel criado no futuro poderia herdar
-- acesso a estas tabelas sem ninguém ter concedido nada de propósito.
revoke all on public.youtube_oauth_connections from public, anon, authenticated;
revoke all on public.youtube_oauth_states from public, anon, authenticated;

-- Concede ao service_role só o necessário (select/insert/update/delete —
-- nunca truncate/references/trigger, que ALL incluiria desnecessariamente).
grant select, insert, update, delete
  on public.youtube_oauth_connections
  to service_role;

grant select, insert, update, delete
  on public.youtube_oauth_states
  to service_role;

-- ============================================================
-- Trigger de updated_at (reaproveita public.update_updated_at(), já criada em 001_initial_schema.sql)
-- ============================================================
drop trigger if exists youtube_oauth_connections_updated_at on public.youtube_oauth_connections;
create trigger youtube_oauth_connections_updated_at
  before update on public.youtube_oauth_connections
  for each row execute function public.update_updated_at();
