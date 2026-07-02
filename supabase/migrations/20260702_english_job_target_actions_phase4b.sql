-- Migration: Inglês — Preparação direcionada por vaga (Fase 4B)
-- glossary_terms é conteúdo compartilhado com escrita restrita ao service role,
-- então a inserção de termos sugeridos por uma vaga usa RPC security definer,
-- seguindo o mesmo padrão de import_legacy_english_vocabulary (Fase 1).

create or replace function public.import_job_target_vocabulary(terms jsonb)
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
  v_definition text;
  inserted_count int := 0;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_typeof(terms) <> 'array' then
    return 0;
  end if;

  for item in select * from jsonb_array_elements(terms) loop
    v_term := nullif(trim(item->>'term'), '');
    if v_term is null or length(v_term) > 120 then
      continue;
    end if;

    -- Termo já existente no glossário compartilhado: não duplicar.
    if exists (select 1 from public.glossary_terms where lower(term) = lower(v_term)) then
      continue;
    end if;

    v_translation := coalesce(nullif(trim(item->>'translation'), ''), 'Tradução pendente — revise este termo');
    v_example := coalesce(nullif(trim(item->>'example'), ''), 'This term appeared in a U.S. job posting I am targeting.');
    v_definition := coalesce(
      nullif(trim(item->>'definition'), ''),
      'A term commonly found in U.S. electrical engineering job postings: ' || v_term || '.'
    );

    -- id explícito: a tabela em produção pode não ter default em glossary_terms.id
    -- (o seed da Fase 3A precisou gerar UUID no cliente pelo mesmo motivo).
    insert into public.glossary_terms (id, term, theme, category, translation_pt, definition_en, example_en, importance_level, source)
    values (gen_random_uuid(), v_term, 'job_posting', 'job_posting', v_translation, v_definition, v_example, 4, 'job_posting');

    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.import_job_target_vocabulary(jsonb) from public;
grant execute on function public.import_job_target_vocabulary(jsonb) to authenticated;
