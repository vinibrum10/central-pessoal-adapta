import { supabase } from '../../lib/supabase';
import type { VagaCandidatura } from '../../types/vagas';

interface CandidaturaRow {
  id: string;
  data_prep: string | null;
  vaga: string;
  empresa: string;
  local: string;
  fonte: string;
  score: number | null;
  status: string;
  data_envio: string | null;
  retorno: string;
  link: string;
  observacoes: string;
  created_at: string;
  updated_at: string;
}

function rowToCandidatura(row: CandidaturaRow): VagaCandidatura {
  return {
    id: row.id,
    dataPrep: row.data_prep,
    vaga: row.vaga,
    empresa: row.empresa,
    local: row.local,
    fonte: row.fonte,
    score: row.score,
    status: row.status,
    dataEnvio: row.data_envio,
    retorno: row.retorno,
    link: row.link,
    observacoes: row.observacoes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const candidaturasRepository = {
  async listar(userId: string): Promise<VagaCandidatura[]> {
    const { data, error } = await supabase
      .from('vagas_candidaturas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as CandidaturaRow[]).map(rowToCandidatura);
  },
};
