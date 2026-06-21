import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Tarefa } from '../types';

export const tarefasRepository = {
  async listar(userId: string): Promise<Tarefa[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('tarefas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToTarefa);
  },

  async criar(userId: string, t: Tarefa): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('tarefas').insert(tarefaToRow(userId, t));
    if (error) throw error;
  },

  async atualizar(t: Tarefa): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase
      .from('tarefas')
      .update({ ...tarefaToRow(null, t), updated_at: new Date().toISOString() })
      .eq('id', t.id);
    if (error) throw error;
  },

  async excluir(id: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('tarefas').delete().eq('id', id);
    if (error) throw error;
  },
};

function tarefaToRow(userId: string | null, t: Tarefa) {
  return {
    id: t.id,
    ...(userId ? { user_id: userId } : {}),
    meta_id: t.metaId ?? null,
    titulo: t.titulo,
    categoria: t.categoria,
    status: t.status,
    faixa: t.faixa,
    faixa_manual: t.faixaManual ?? false,
    tipo_acao: t.tipoAcao ?? 'eventual',
    periodicidade: t.periodicidade ?? null,
    intervalo_dias: t.intervaloDias ?? null,
    tempo_estimado: t.tempoEstimado,
    tempo_minimo_minutos: t.tempoMinimoMinutos ?? null,
    prazo: t.prazo,
    data_proxima_ocorrencia: t.dataProximaOcorrencia ?? null,
    ultima_reabertura: t.ultimaReabertura ?? null,
    energia_necessaria: t.energiaNecessaria,
    observacoes: t.observacoes,
    data_conclusao: t.dataConclusao ?? null,
    updated_at: new Date().toISOString(),
  };
}

function rowToTarefa(row: Record<string, unknown>): Tarefa {
  return {
    id: row.id as string,
    titulo: row.titulo as string,
    metaId: (row.meta_id as string | null) ?? null,
    categoria: row.categoria as Tarefa['categoria'],
    prazo: row.prazo as string,
    tempoEstimado: row.tempo_estimado as number,
    faixa: row.faixa as Tarefa['faixa'],
    faixaManual: row.faixa_manual as boolean,
    status: row.status as Tarefa['status'],
    energiaNecessaria: row.energia_necessaria as Tarefa['energiaNecessaria'],
    observacoes: row.observacoes as string,
    dataCriacao: row.created_at as string,
    dataConclusao: (row.data_conclusao as string | null) ?? null,
    tipoAcao: (row.tipo_acao as Tarefa['tipoAcao']) ?? 'eventual',
    periodicidade: (row.periodicidade as Tarefa['periodicidade']) ?? undefined,
    intervaloDias: (row.intervalo_dias as number | null) ?? undefined,
    tempoMinimoMinutos: (row.tempo_minimo_minutos as number | null) ?? undefined,
    dataProximaOcorrencia: (row.data_proxima_ocorrencia as string | null) ?? null,
    ultimaReabertura: (row.ultima_reabertura as string | null) ?? null,
  };
}
