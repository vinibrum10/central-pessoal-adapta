import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Configuracoes } from '../types';

export const configuracoesRepository = {
  async salvar(userId: string, config: Configuracoes): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      nome: config.nomeUsuario,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  },

  async carregar(userId: string): Promise<{ nome: string } | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', userId)
      .single();
    if (error) return null;
    return { nome: (data as Record<string, unknown>)?.nome as string ?? '' };
  },
};
