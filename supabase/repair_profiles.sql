-- ============================================================
-- REPARO: Sincronizar usuários existentes de auth.users para profiles
-- Execute no SQL Editor do Supabase quando houver usuários sem profile
-- ============================================================

-- 1. Criar profiles ausentes para todos os usuários existentes
INSERT INTO public.profiles (id, email, nome, role, status, created_at, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'nome',
    split_part(u.email, '@', 1)
  ),
  'visualizador',
  'pendente',
  NOW(),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);

-- 2. Promover o usuário admin principal
-- SUBSTITUA pelo e-mail real do administrador
UPDATE public.profiles
SET
  role = 'admin',
  status = 'aprovado',
  updated_at = NOW()
WHERE lower(email) = lower('vinibrum10@gmail.com');

-- 3. Verificar resultado
SELECT id, email, nome, role, status FROM public.profiles ORDER BY created_at;
