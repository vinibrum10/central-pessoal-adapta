import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { EventoAgenda } from '../types';

export const agendaRepository = {
  async listar(userId: string): Promise<EventoAgenda[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('eventos_agenda')
      .select('*')
      .eq('user_id', userId)
      .order('inicio', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToEvento);
  },

  async upsertLote(userId: string, eventos: EventoAgenda[]): Promise<{ inseridos: number }> {
    if (!isSupabaseConfigured || eventos.length === 0) return { inseridos: 0 };
    const rows = eventos.map(e => ({
      id: e.id, user_id: userId, fonte: e.fonte, titulo: e.titulo,
      descricao: e.descricao ?? null, inicio: e.inicio, fim: e.fim,
      dia_inteiro: e.diaInteiro, local: e.local ?? null,
      bloqueia_tempo: e.bloqueiaTempo, ignorado: e.ignorado ?? false,
      importado_em: e.importadoEm, tarefa_gerada_id: e.tarefaGeradaId ?? null,
    }));
    const { error } = await supabase.from('eventos_agenda').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    return { inseridos: rows.length };
  },

  async marcarIgnorado(id: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('eventos_agenda').update({ ignorado: true }).eq('id', id);
    if (error) throw error;
  },
};

function rowToEvento(row: Record<string, unknown>): EventoAgenda {
  return {
    id: row.id as string,
    fonte: row.fonte as EventoAgenda['fonte'],
    titulo: row.titulo as string,
    descricao: (row.descricao as string | null) ?? undefined,
    inicio: row.inicio as string,
    fim: row.fim as string,
    diaInteiro: row.dia_inteiro as boolean,
    local: (row.local as string | null) ?? undefined,
    bloqueiaTempo: row.bloqueia_tempo as boolean,
    importadoEm: row.importado_em as string,
    tarefaGeradaId: (row.tarefa_gerada_id as string | null) ?? null,
    ignorado: (row.ignorado as boolean) ?? false,
  };
}
