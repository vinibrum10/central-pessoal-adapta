-- ============================================================
-- Sistema de permissões granulares por módulo e ação
-- Idempotente
-- ============================================================

-- Tabela de permissões por usuário
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  modulo      text NOT NULL,
  acao        text NOT NULL,
  permitido   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, modulo, acao)
);

-- Habilitar RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Usuário pode ler suas próprias permissões
DROP POLICY IF EXISTS "user_permissions: próprio usuário lê" ON public.user_permissions;
CREATE POLICY "user_permissions: próprio usuário lê" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- Admin pode ler e editar todas as permissões
DROP POLICY IF EXISTS "user_permissions: admin gerencia" ON public.user_permissions;
CREATE POLICY "user_permissions: admin gerencia" ON public.user_permissions
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.status = 'aprovado'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.status = 'aprovado'
    )
  );

-- Adicionar campos de último acesso em profiles (idempotente)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ultimo_acesso timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_login_provider text;

-- Adicionar campos de autoria em despesas (idempotente)
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id);
