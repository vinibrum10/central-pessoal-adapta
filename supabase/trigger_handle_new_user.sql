CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_first_user boolean;
BEGIN
  SELECT (COUNT(*) = 0) INTO is_first_user FROM public.profiles;
  INSERT INTO public.profiles (id, email, nome, role, status, tipo_acesso, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE WHEN is_first_user THEN 'admin' ELSE 'usuario' END,
    'ativo',
    CASE WHEN is_first_user THEN 'total' ELSE 'visualizacao' END,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
