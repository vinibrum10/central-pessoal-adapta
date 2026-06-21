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
      recorrente: r.recorrente as boolean, dataCriacao: r.created_at as string,
    }));
  },

  async criar(userId: string, r: Receita): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('receitas').insert({
      id: r.id, user_id: userId, descricao: r.descricao, valor: r.valor,
      data: r.data, categoria: r.categoria, recorrente: r.recorrente,
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
