-- Migration: origem completa da pergunta pendente no banco de respostas.
-- ultima_vaga nunca era realmente atualizada apos a criacao (dedup por match
-- exato nunca reescreve linha existente), entao "vaga_origem" descreve melhor
-- o comportamento real. Adiciona tambem empresa_origem, ausente ate agora.

alter table vagas_respostas_banco rename column ultima_vaga to vaga_origem;
alter table vagas_respostas_banco add column if not exists empresa_origem text not null default '';

-- Backfill: as linhas existentes vieram todas dos testes contra vagas da Capco.
update vagas_respostas_banco set empresa_origem = 'capco' where empresa_origem = '';
