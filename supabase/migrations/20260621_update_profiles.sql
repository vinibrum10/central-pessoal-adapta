-- Adiciona colunas novas à tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tipo_acesso text NOT NULL DEFAULT 'visualizacao'
  CHECK (tipo_acesso IN ('visualizacao', 'financas', 'total'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ultimo_login_provider text;

-- Migra status legados
UPDATE profiles SET status = 'ativo', tipo_acesso = 'visualizacao' WHERE status = 'pendente';
UPDATE profiles SET status = 'ativo' WHERE status = 'aprovado';

-- Migra roles legados
UPDATE profiles SET role = 'usuario' WHERE role IN ('visualizador', 'editor');

-- Garante que admins tenham tipo_acesso total
UPDATE profiles SET tipo_acesso = 'total' WHERE role = 'admin' AND tipo_acesso != 'total';

-- Atualiza constraints de role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'usuario'));

-- Atualiza constraints de status
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('ativo', 'bloqueado'));
