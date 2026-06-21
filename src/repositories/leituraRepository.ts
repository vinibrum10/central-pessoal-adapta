import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { LeituraDiaria } from '../types';

export const leituraRepository = {
  async listar(userId: string): Promise<LeituraDiaria[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('leituras_diarias')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToLeitura);
  },

  async criar(userId: string, l: LeituraDiaria): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('leituras_diarias').insert({
      id: l.id, user_id: userId, origem: l.origem, titulo: l.titulo,
      resumo: l.resumo ?? null, tipo: l.tipo, url: l.url ?? null,
      drive_file_id: l.driveFileId ?? null, categoria: l.categoria,
      prioridade: l.prioridade, status: l.status,
      data_leitura: l.dataLeitura ?? null,
      created_at: l.dataCriacao, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  },

  async atualizar(l: Partial<LeituraDiaria> & { id: string }): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase
      .from('leituras_diarias')
      .update({ status: l.status, data_leitura: l.dataLeitura ?? null, updated_at: new Date().toISOString() })
      .eq('id', l.id);
    if (error) throw error;
  },

  async excluir(id: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('leituras_diarias').delete().eq('id', id);
    if (error) throw error;
  },

  async sincronizarDrive(userId: string, itens: LeituraDiaria[]): Promise<{ novos: number }> {
    if (!isSupabaseConfigured || itens.length === 0) return { novos: 0 };
    // Buscar driveFileIds já existentes
    const { data: existentes } = await supabase
      .from('leituras_diarias')
      .select('drive_file_id')
      .eq('user_id', userId)
      .not('drive_file_id', 'is', null);

    const idsExistentes = new Set((existentes ?? []).map((r: Record<string, unknown>) => r.drive_file_id as string));
    const novos = itens.filter(i => i.driveFileId && !idsExistentes.has(i.driveFileId));

    for (const item of novos) {
      await leituraRepository.criar(userId, item);
    }

    return { novos: novos.length };
  },
};

function rowToLeitura(row: Record<string, unknown>): LeituraDiaria {
  return {
    id: row.id as string,
    origem: row.origem as string,
    titulo: row.titulo as string,
    resumo: (row.resumo as string | null) ?? undefined,
    tipo: row.tipo as LeituraDiaria['tipo'],
    url: (row.url as string | null) ?? undefined,
    driveFileId: (row.drive_file_id as string | null) ?? undefined,
    categoria: row.categoria as string,
    prioridade: row.prioridade as LeituraDiaria['prioridade'],
    status: row.status as LeituraDiaria['status'],
    dataLeitura: (row.data_leitura as string | null) ?? null,
    dataCriacao: row.created_at as string,
  };
}
