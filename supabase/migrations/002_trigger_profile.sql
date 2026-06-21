-- ============================================================
-- Trigger automático: cria profile quando novo usuário é criado
-- Idempotente — pode rodar mais de uma vez sem quebrar
-- ============================================================

-- Função que cria o profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
  _role  text;
  _status text;
BEGIN
  -- Verificar se já existe profile para este usuário
  SELECT COUNT(*) INTO _count FROM public.profiles WHERE id = NEW.id;
  IF _count > 0 THEN
    RETURN NEW;
  END IF;

  -- Verificar se é o primeiro usuário do sistema
  SELECT COUNT(*) INTO _count FROM public.profiles;
  IF _count = 0 THEN
    _role   := 'admin';
    _status := 'aprovado';
  ELSE
    _role   := 'visualizador';
    _status := 'pendente';
  END IF;

  INSERT INTO public.profiles (id, nome, email, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    _role,
    _status,
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Remover trigger se já existir (idempotente)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Policy RLS: admin pode ver e editar todos os profiles
-- ============================================================
DROP POLICY IF EXISTS "profiles: admin vê todos" ON public.profiles;
CREATE POLICY "profiles: admin vê todos" ON public.profiles
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid()
      AND p2.role = 'admin'
      AND p2.status = 'aprovado'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid()
      AND p2.role = 'admin'
      AND p2.status = 'aprovado'
    )
  );
