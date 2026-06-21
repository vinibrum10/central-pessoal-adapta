-- Cria profiles para usuários auth que não têm um ainda
INSERT INTO profiles (id, email, nome, role, status, tipo_acesso, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'nome', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  'usuario',
  'ativo',
  'visualizacao',
  NOW(),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- Corrige status legados
UPDATE profiles SET status = 'ativo', tipo_acesso = 'visualizacao' WHERE status = 'pendente';
UPDATE profiles SET status = 'ativo' WHERE status = 'aprovado';

-- Corrige roles legados
UPDATE profiles SET role = 'usuario' WHERE role IN ('visualizador', 'editor');

-- Garante admins com tipo_acesso total
UPDATE profiles SET tipo_acesso = 'total' WHERE role = 'admin' AND tipo_acesso != 'total';
