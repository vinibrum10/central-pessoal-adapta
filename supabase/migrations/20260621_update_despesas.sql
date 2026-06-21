-- Adiciona colunas de parcelamento e recorrência à tabela despesas
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS cartao_id uuid REFERENCES cartoes(id) ON DELETE SET NULL;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS tipo_cobranca_cartao text CHECK (tipo_cobranca_cartao IN ('avista', 'parcelado'));
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS quantidade_parcelas integer;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS parcela_atual integer;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS mes_inicio_cobranca text;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS grupo_parcelamento_id uuid;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente boolean NOT NULL DEFAULT false;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS periodicidade_recorrencia text DEFAULT 'mensal';
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_inicio_recorrencia date;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_fim_recorrencia date;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS proxima_ocorrencia date;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrencia_ativa boolean DEFAULT true;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);
