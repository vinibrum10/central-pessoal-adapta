import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Meta } from '../types';

export const metasRepository = {
  async listar(userId: string): Promise<Meta[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('metas')
      .select('*')
      .eq('user_id', userId)
      .order('rank', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToMeta);
  },

  async criar(userId: string, meta: Meta): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('metas').insert(metaToRow(userId, meta));
    if (error) throw error;
  },

  async atualizar(meta: Meta): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase
      .from('metas')
      .update({ ...metaToRow(null, meta), updated_at: new Date().toISOString() })
      .eq('id', meta.id);
    if (error) throw error;
  },

  async excluir(id: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('metas').delete().eq('id', id);
    if (error) throw error;
  },
};

function metaToRow(userId: string | null, m: Meta) {
  return {
    id: m.id,
    ...(userId ? { user_id: userId } : {}),
    nome: m.nome,
    rank: m.grau,
    categoria: m.categoria,
    status: m.status,
    motivo: m.motivo,
    resultado_esperado: m.resultadoEsperado,
    data_inicio: m.dataInicio ?? null,
    prazo_final: m.prazoFinal,
    classificacao_prazo: m.classificacaoPrazo ?? null,
    frequencia_revisao: m.frequenciaRevisao,
    data_ultima_revisao: m.dataUltimaRevisao ?? null,
    data_ultima_acao: m.dataUltimaAcao ?? null,
    etapas: m.etapas ?? [],
    updated_at: new Date().toISOString(),
  };
}

function rowToMeta(row: Record<string, unknown>): Meta {
  return {
    id: row.id as string,
    nome: row.nome as string,
    categoria: row.categoria as Meta['categoria'],
    grau: row.rank as number,
    status: row.status as Meta['status'],
    motivo: row.motivo as string,
    resultadoEsperado: row.resultado_esperado as string,
    dataInicio: (row.data_inicio as string) ?? undefined,
    prazoFinal: row.prazo_final as string,
    classificacaoPrazo: (row.classificacao_prazo as Meta['classificacaoPrazo']) ?? undefined,
    frequenciaRevisao: row.frequencia_revisao as Meta['frequenciaRevisao'],
    dataCriacao: row.created_at as string,
    dataUltimaRevisao: (row.data_ultima_revisao as string | null) ?? null,
    dataUltimaAcao: (row.data_ultima_acao as string | null) ?? null,
    etapas: Array.isArray(row.etapas) ? row.etapas as Meta['etapas'] : [],
  };
}
