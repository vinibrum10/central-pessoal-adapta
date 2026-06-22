-- Campos para competência de receitas, recorrência e etapas de metas.
-- Migration idempotente: não apaga dados existentes.

alter table receitas
  add column if not exists data_receita date,
  add column if not exists mes_referencia integer,
  add column if not exists ano_referencia integer,
  add column if not exists recorrencia_id uuid,
  add column if not exists recorrencia_tem_termino boolean not null default false,
  add column if not exists recorrencia_mes_termino integer,
  add column if not exists recorrencia_ano_termino integer;

update receitas
set
  data_receita = coalesce(data_receita, data),
  mes_referencia = coalesce(mes_referencia, extract(month from data)::integer),
  ano_referencia = coalesce(ano_referencia, extract(year from data)::integer)
where data is not null;

create index if not exists receitas_user_competencia_idx
  on receitas(user_id, ano_referencia, mes_referencia);

create unique index if not exists receitas_recorrencia_competencia_unique
  on receitas(user_id, recorrencia_id, ano_referencia, mes_referencia)
  where recorrencia_id is not null;

alter table metas
  add column if not exists etapas jsonb not null default '[]'::jsonb;

alter table tarefas
  add column if not exists etapa_meta_numero integer,
  add column if not exists gerada_por_meta boolean not null default false;

create unique index if not exists tarefas_meta_etapa_unique
  on tarefas(user_id, meta_id, etapa_meta_numero)
  where meta_id is not null and etapa_meta_numero is not null and gerada_por_meta = true;
