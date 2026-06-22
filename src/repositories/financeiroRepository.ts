import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Receita, Despesa, Cartao, Divida, Reserva, Bem } from '../types';

// ---- Receitas ----
export const receitasRepository = {
  async listar(userId: string): Promise<Receita[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('receitas').select('*').eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, descricao: r.descricao as string, valor: r.valor as number,
      data: r.data as string, categoria: r.categoria as Receita['categoria'],
      dataReceita: (r.data_receita as string | null) ?? (r.data as string),
      mesReferencia: (r.mes_referencia as number | null) ?? Number(String(r.data).slice(5, 7)),
      anoReferencia: (r.ano_referencia as number | null) ?? Number(String(r.data).slice(0, 4)),
      recorrente: r.recorrente as boolean,
      recorrenciaId: (r.recorrencia_id as string | null) ?? null,
      recorrenciaTemTermino: Boolean(r.recorrencia_tem_termino),
      recorrenciaMesTermino: (r.recorrencia_mes_termino as number | null) ?? null,
      recorrenciaAnoTermino: (r.recorrencia_ano_termino as number | null) ?? null,
      dataCriacao: r.created_at as string,
    }));
  },

  async criar(userId: string, r: Receita): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('receitas').insert({
      id: r.id, user_id: userId, descricao: r.descricao, valor: r.valor,
      data: r.data, categoria: r.categoria, recorrente: r.recorrente,
      data_receita: r.dataReceita ?? r.data,
      mes_referencia: r.mesReferencia ?? Number(r.data.slice(5, 7)),
      ano_referencia: r.anoReferencia ?? Number(r.data.slice(0, 4)),
      recorrencia_id: r.recorrenciaId ?? null,
      recorrencia_tem_termino: r.recorrenciaTemTermino ?? false,
      recorrencia_mes_termino: r.recorrenciaMesTermino ?? null,
      recorrencia_ano_termino: r.recorrenciaAnoTermino ?? null,
      created_at: r.dataCriacao,
    });
    if (error) throw error;
  },

  async excluir(id: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('receitas').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- Despesas ----
export const despesasRepository = {
  async listar(userId: string): Promise<Despesa[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('despesas').select('*').eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, descricao: r.descricao as string, valor: r.valor as number,
      data: r.data as string, categoria: r.categoria as Despesa['categoria'],
      formaPagamento: r.forma_pagamento as Despesa['formaPagamento'],
      recorrente: r.recorrente as boolean, essencial: r.essencial as boolean,
      dataCriacao: r.created_at as string,
    }));
  },

  async criar(userId: string, d: Despesa): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('despesas').insert({
      id: d.id, user_id: userId, descricao: d.descricao, valor: d.valor,
      data: d.data, categoria: d.categoria, forma_pagamento: d.formaPagamento,
      recorrente: d.recorrente, essencial: d.essencial, created_at: d.dataCriacao,
    });
    if (error) throw error;
  },

  async excluir(id: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('despesas').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- Cartões (apenas tipos exportados para satisfazer imports futuros) ----
export type { Cartao, Divida, Reserva, Bem };
