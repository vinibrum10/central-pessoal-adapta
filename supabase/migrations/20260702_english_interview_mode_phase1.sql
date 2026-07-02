-- Migration: Inglês — Modo Entrevista (Fase 1 + schema completo)
-- Conteúdo compartilhado: leitura para usuários autenticados, escrita apenas via service role.
-- Dados por usuário: isolados por user_id = auth.uid().

create extension if not exists "pgcrypto";

-- ============================================================
-- Conteúdo compartilhado
-- ============================================================
create table if not exists public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  theme text not null,
  translation_pt text not null,
  definition_en text not null,
  example_en text not null,
  source text not null default 'seed',
  created_at timestamptz not null default now()
);

create table if not exists public.interview_questions (
  id text primary key,
  category text not null,
  question_en text not null,
  o_que_avaliam text not null,
  como_responder text not null,
  temas_relacionados text[] not null default '{}',
  timer_sugerido_min int not null default 3
);

create table if not exists public.listening_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null,
  url text not null
);

create table if not exists public.listening_episodes (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.listening_sources(id) on delete set null,
  title text not null,
  url text not null,
  duration_sec int,
  themes text[] not null default '{}',
  transcript text,
  vocab_extracted boolean not null default false,
  level text not null default 'advanced',
  created_at timestamptz not null default now()
);

create unique index if not exists listening_episodes_url_unique
  on public.listening_episodes(url);

-- ============================================================
-- Dados por usuário
-- ============================================================
create table if not exists public.glossary_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id uuid not null references public.glossary_terms(id) on delete cascade,
  box int not null default 1 check (box between 1 and 5),
  next_review date not null default current_date,
  last_result text check (last_result in ('acertou', 'errou')),
  reviewed_at timestamptz,
  unique (user_id, term_id)
);

create table if not exists public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.interview_questions(id) on delete cascade,
  audio_path text,
  duration_sec int,
  self_rating int check (self_rating between 1 and 10),
  gemini_feedback jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mock_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  teacher text,
  rating numeric(3,1) check (rating between 0 and 10),
  notes text,
  recording_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null default current_date,
  episode_id uuid references public.listening_episodes(id) on delete set null,
  step_listening_done boolean not null default false,
  step_shadowing_done boolean not null default false,
  step_cards_done boolean not null default false,
  step_question_done boolean not null default false,
  question_id text references public.interview_questions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_date)
);

create index if not exists glossary_terms_theme_idx on public.glossary_terms(theme);
create unique index if not exists glossary_terms_term_lower_unique
  on public.glossary_terms(lower(term));
create index if not exists glossary_reviews_user_next_idx on public.glossary_reviews(user_id, next_review);
create index if not exists listening_episodes_themes_idx on public.listening_episodes using gin(themes);
create index if not exists interview_questions_category_idx on public.interview_questions(category);
create index if not exists interview_answers_user_question_idx on public.interview_answers(user_id, question_id);
create index if not exists mock_sessions_user_date_idx on public.mock_sessions(user_id, session_date desc);
create index if not exists daily_sessions_user_date_idx on public.daily_sessions(user_id, session_date desc);

-- ============================================================
-- RLS
-- ============================================================
alter table public.glossary_terms enable row level security;
alter table public.interview_questions enable row level security;
alter table public.listening_sources enable row level security;
alter table public.listening_episodes enable row level security;
alter table public.glossary_reviews enable row level security;
alter table public.interview_answers enable row level security;
alter table public.mock_sessions enable row level security;
alter table public.daily_sessions enable row level security;

drop policy if exists "glossary_terms: authenticated read" on public.glossary_terms;
create policy "glossary_terms: authenticated read"
  on public.glossary_terms for select
  using (auth.role() = 'authenticated');

drop policy if exists "interview_questions: authenticated read" on public.interview_questions;
create policy "interview_questions: authenticated read"
  on public.interview_questions for select
  using (auth.role() = 'authenticated');

drop policy if exists "listening_sources: authenticated read" on public.listening_sources;
create policy "listening_sources: authenticated read"
  on public.listening_sources for select
  using (auth.role() = 'authenticated');

drop policy if exists "listening_episodes: authenticated read" on public.listening_episodes;
create policy "listening_episodes: authenticated read"
  on public.listening_episodes for select
  using (auth.role() = 'authenticated');

drop policy if exists "glossary_reviews: own select" on public.glossary_reviews;
create policy "glossary_reviews: own select"
  on public.glossary_reviews for select
  using (auth.uid() = user_id);

drop policy if exists "glossary_reviews: own insert" on public.glossary_reviews;
create policy "glossary_reviews: own insert"
  on public.glossary_reviews for insert
  with check (auth.uid() = user_id);

drop policy if exists "glossary_reviews: own update" on public.glossary_reviews;
create policy "glossary_reviews: own update"
  on public.glossary_reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "glossary_reviews: own delete" on public.glossary_reviews;
create policy "glossary_reviews: own delete"
  on public.glossary_reviews for delete
  using (auth.uid() = user_id);

drop policy if exists "interview_answers: own select" on public.interview_answers;
create policy "interview_answers: own select"
  on public.interview_answers for select
  using (auth.uid() = user_id);

drop policy if exists "interview_answers: own insert" on public.interview_answers;
create policy "interview_answers: own insert"
  on public.interview_answers for insert
  with check (auth.uid() = user_id);

drop policy if exists "interview_answers: own update" on public.interview_answers;
create policy "interview_answers: own update"
  on public.interview_answers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "interview_answers: own delete" on public.interview_answers;
create policy "interview_answers: own delete"
  on public.interview_answers for delete
  using (auth.uid() = user_id);

drop policy if exists "mock_sessions: own select" on public.mock_sessions;
create policy "mock_sessions: own select"
  on public.mock_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "mock_sessions: own insert" on public.mock_sessions;
create policy "mock_sessions: own insert"
  on public.mock_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "mock_sessions: own update" on public.mock_sessions;
create policy "mock_sessions: own update"
  on public.mock_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "mock_sessions: own delete" on public.mock_sessions;
create policy "mock_sessions: own delete"
  on public.mock_sessions for delete
  using (auth.uid() = user_id);

drop policy if exists "daily_sessions: own select" on public.daily_sessions;
create policy "daily_sessions: own select"
  on public.daily_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "daily_sessions: own insert" on public.daily_sessions;
create policy "daily_sessions: own insert"
  on public.daily_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "daily_sessions: own update" on public.daily_sessions;
create policy "daily_sessions: own update"
  on public.daily_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "daily_sessions: own delete" on public.daily_sessions;
create policy "daily_sessions: own delete"
  on public.daily_sessions for delete
  using (auth.uid() = user_id);

drop trigger if exists daily_sessions_updated_at on public.daily_sessions;
create trigger daily_sessions_updated_at
  before update on public.daily_sessions
  for each row execute function public.update_updated_at();

-- ============================================================
-- Importação única de cards legados do localStorage
-- ============================================================
create or replace function public.import_legacy_english_vocabulary(cards jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_user_id uuid := auth.uid();
  v_term text;
  v_translation text;
  v_example text;
  v_term_id uuid;
  imported_count int := 0;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_typeof(cards) <> 'array' then
    return 0;
  end if;

  for item in select * from jsonb_array_elements(cards) loop
    v_term := nullif(trim(item->>'word'), '');
    if v_term is null then
      continue;
    end if;

    v_translation := coalesce(nullif(trim(item->>'meaning'), ''), 'Importado do Inglês Diário');
    v_example := coalesce(nullif(trim(item->>'example'), ''), 'I used this term in my English study routine.');

    select id into v_term_id
    from public.glossary_terms
    where lower(term) = lower(v_term)
    limit 1;

    if v_term_id is null then
      insert into public.glossary_terms (term, theme, translation_pt, definition_en, example_en, source)
      values (
        v_term,
        'legacy',
        v_translation,
        'Legacy vocabulary imported from the previous English Daily module.',
        v_example,
        'legacy'
      )
      returning id into v_term_id;
    end if;

    insert into public.glossary_reviews (user_id, term_id, box, next_review)
    values (
      v_user_id,
      v_term_id,
      case when item->>'reviewStatus' = 'known' then 5 else 1 end,
      coalesce(nullif(item->>'nextReviewAt', '')::date, current_date)
    )
    on conflict (user_id, term_id) do nothing;

    imported_count := imported_count + 1;
  end loop;

  return imported_count;
end;
$$;

revoke all on function public.import_legacy_english_vocabulary(jsonb) from public;
grant execute on function public.import_legacy_english_vocabulary(jsonb) to authenticated;
