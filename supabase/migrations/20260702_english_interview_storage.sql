-- Migration: Storage privado para respostas gravadas do Inglês — Modo Entrevista
-- Caminho esperado: {user_id}/{answer_id}.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'interview-answers',
  'interview-answers',
  false,
  6291456,
  array[
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/x-m4a'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "interview_answers_storage: own select" on storage.objects;
create policy "interview_answers_storage: own select"
  on storage.objects for select
  using (
    bucket_id = 'interview-answers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "interview_answers_storage: own insert" on storage.objects;
create policy "interview_answers_storage: own insert"
  on storage.objects for insert
  with check (
    bucket_id = 'interview-answers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "interview_answers_storage: own update" on storage.objects;
create policy "interview_answers_storage: own update"
  on storage.objects for update
  using (
    bucket_id = 'interview-answers'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'interview-answers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "interview_answers_storage: own delete" on storage.objects;
create policy "interview_answers_storage: own delete"
  on storage.objects for delete
  using (
    bucket_id = 'interview-answers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
