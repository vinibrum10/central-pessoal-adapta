-- Migration: workspaces compartilhados para dados do SGP
-- Mantém app_data em JSONB, mas troca a fonte de verdade de usuário individual
-- para workspace/família. Idempotente para aplicar em ambientes existentes.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Família',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists idx_workspaces_owner_id on public.workspaces(owner_id);
create index if not exists idx_workspace_members_user_id on public.workspace_members(user_id);
create index if not exists idx_workspace_members_workspace_id on public.workspace_members(workspace_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists "workspaces: membros leem" on public.workspaces;
create policy "workspaces: membros leem" on public.workspaces
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );

drop policy if exists "workspaces: usuario cria proprio" on public.workspaces;
create policy "workspaces: usuario cria proprio" on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists "workspaces: owner admin atualiza" on public.workspaces;
create policy "workspaces: owner admin atualiza" on public.workspaces
  for update using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
        and wm.status = 'active'
    )
  )
  with check (
    owner_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
        and wm.status = 'active'
    )
  );

drop policy if exists "workspace_members: membros leem" on public.workspace_members;
create policy "workspace_members: membros leem" on public.workspace_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_members.workspace_id
        and w.owner_id = auth.uid()
    )
  );

drop policy if exists "workspace_members: usuario cria proprio owner" on public.workspace_members;
create policy "workspace_members: usuario cria proprio owner" on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_members.workspace_id
        and w.owner_id = auth.uid()
    )
  );

drop policy if exists "workspace_members: owner admin gerencia" on public.workspace_members;
create policy "workspace_members: owner admin gerencia" on public.workspace_members
  for update using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_members.workspace_id
        and w.owner_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_members.workspace_id
        and w.owner_id = auth.uid()
    )
  );

alter table public.app_data add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.app_data drop constraint if exists app_data_user_id_unique;

do $$
declare
  row record;
  v_workspace_id uuid;
begin
  for row in select distinct user_id from public.app_data where user_id is not null loop
    select id into v_workspace_id
    from public.workspaces
    where owner_id = row.user_id
    order by created_at
    limit 1;

    if v_workspace_id is null then
      insert into public.workspaces (owner_id, name)
      values (row.user_id, 'Família')
      returning id into v_workspace_id;
    end if;

    insert into public.workspace_members (workspace_id, user_id, role, status)
    values (v_workspace_id, row.user_id, 'owner', 'active')
    on conflict (workspace_id, user_id)
    do update set role = 'owner', status = 'active', updated_at = now();

    update public.app_data
    set workspace_id = v_workspace_id
    where user_id = row.user_id and app_data.workspace_id is null;
  end loop;
end $$;

create unique index if not exists app_data_workspace_id_unique
  on public.app_data(workspace_id)
  where workspace_id is not null;

drop policy if exists "Usuário lê próprios dados" on public.app_data;
drop policy if exists "Usuário insere próprios dados" on public.app_data;
drop policy if exists "Usuário atualiza próprios dados" on public.app_data;
drop policy if exists "Usuário deleta próprios dados" on public.app_data;
drop policy if exists "app_data: membros leem workspace" on public.app_data;
drop policy if exists "app_data: membros inserem workspace" on public.app_data;
drop policy if exists "app_data: membros atualizam workspace" on public.app_data;
drop policy if exists "app_data: membros deletam workspace" on public.app_data;

create policy "app_data: membros leem workspace" on public.app_data
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = app_data.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
    or auth.uid() = user_id
  );

create policy "app_data: membros inserem workspace" on public.app_data
  for insert with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = app_data.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
        and wm.role in ('owner', 'admin', 'editor', 'viewer')
    )
  );

create policy "app_data: membros atualizam workspace" on public.app_data
  for update using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = app_data.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = app_data.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );

create policy "app_data: membros deletam workspace" on public.app_data
  for delete using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = app_data.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
        and wm.role in ('owner', 'admin')
    )
  );

create or replace trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function update_updated_at();

create or replace trigger workspace_members_updated_at
  before update on public.workspace_members
  for each row execute function update_updated_at();
