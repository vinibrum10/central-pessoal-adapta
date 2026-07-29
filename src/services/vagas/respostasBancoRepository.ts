import { supabase } from '../../lib/supabase';
import type { VagaRespostaBanco } from '../../types/vagas';

interface RespostaRow {
  id: string;
  pergunta: string;
  tipo: string;
  opcoes: string;
  resposta: string;
  sempre_usar: boolean;
  vaga_origem: string;
  empresa_origem: string;
  possivel_duplicata_de: string;
  created_at: string;
  updated_at: string;
}

interface AtualizarRespostaInput {
  resposta?: string;
  sempreUsar?: boolean;
}

function rowToResposta(row: RespostaRow): VagaRespostaBanco {
  return {
    id: row.id,
    pergunta: row.pergunta,
    tipo: row.tipo,
    opcoes: row.opcoes,
    resposta: row.resposta,
    sempreUsar: row.sempre_usar,
    vagaOrigem: row.vaga_origem,
    empresaOrigem: row.empresa_origem,
    possivelDuplicataDe: row.possivel_duplicata_de,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const respostasBancoRepository = {
  async listar(userId: string): Promise<VagaRespostaBanco[]> {
    const { data, error } = await supabase
      .from('vagas_respostas_banco')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as RespostaRow[]).map(rowToResposta);
  },

  async atualizar(id: string, campos: AtualizarRespostaInput): Promise<VagaRespostaBanco> {
    const payload: Record<string, unknown> = {};
    if (campos.resposta !== undefined) payload.resposta = campos.resposta;
    if (campos.sempreUsar !== undefined) payload.sempre_usar = campos.sempreUsar;

    const { data, error } = await supabase
      .from('vagas_respostas_banco')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return rowToResposta(data as RespostaRow);
  },
};
