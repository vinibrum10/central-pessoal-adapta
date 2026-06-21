-- Migration: faturas_cartao e campos adicionais em despesas/cartoes
-- Idempotente (usa IF NOT EXISTS)

-- Tabela faturas_cartao
CREATE TABLE IF NOT EXISTS public.faturas_cartao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id UUID NOT NULL,
  competencia VARCHAR(7) NOT NULL, -- YYYY-MM
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  valor_informado NUMERIC(12,2),
  valor_detalhado NUMERIC(12,2) DEFAULT 0,
  diferenca NUMERIC(12,2) DEFAULT 0,
  valor_efetivo NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'aberta' CHECK (status IN ('aberta','fechada','paga')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cartao_id, competencia)
);

-- Campos adicionais em despesas
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS cartao_id UUID;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS fatura_id UUID;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS tipo_cobranca_cartao VARCHAR(20);
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS quantidade_parcelas INTEGER;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS parcela_atual INTEGER;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS grupo_parcelamento_id UUID;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS mes_inicio_cobranca VARCHAR(7);
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS origem_ajuste BOOLEAN DEFAULT FALSE;

-- Campos adicionais em cartoes
ALTER TABLE public.cartoes ADD COLUMN IF NOT EXISTS dia_fechamento INTEGER;

-- Índices
CREATE INDEX IF NOT EXISTS idx_faturas_cartao_user_cartao ON public.faturas_cartao(user_id, cartao_id, competencia);
CREATE INDEX IF NOT EXISTS idx_despesas_cartao_fatura ON public.despesas(cartao_id, fatura_id);
CREATE INDEX IF NOT EXISTS idx_despesas_grupo ON public.despesas(grupo_parcelamento_id);

-- RLS faturas_cartao
ALTER TABLE public.faturas_cartao ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "faturas: leitura autenticado" ON public.faturas_cartao FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "faturas: escrita proprio" ON public.faturas_cartao FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
