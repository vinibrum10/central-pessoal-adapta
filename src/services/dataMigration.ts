/**
 * Serviço de migração de dados do LocalStorage para o Supabase.
 * Executado manualmente pelo usuário nas Configurações.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AppData } from '../types';

const STORAGE_KEY = 'adapta-central-pessoal-v1';
const MIGRATION_KEY = 'adapta-migracao-concluida-v1';

export function possuiDadosLocais(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw) as Record<string, unknown>;
    const metas = d.metas as unknown[];
    return Array.isArray(metas) && metas.length > 0;
  } catch {
    return false;
  }
}

export function migracaoConcluida(): boolean {
  return localStorage.getItem(MIGRATION_KEY) === 'true';
}

export function marcarMigracaoConcluida(): void {
  localStorage.setItem(MIGRATION_KEY, 'true');
}

export async function migrarDadosParaSupabase(
  data: AppData,
  userId: string,
  onProgresso?: (msg: string) => void
): Promise<{ ok: boolean; erro?: string }> {
  if (!isSupabaseConfigured) return { ok: false, erro: 'Supabase não configurado.' };

  try {
    const log = (msg: string) => onProgresso?.(msg);

    // Metas
    if (data.metas.length > 0) {
      log(`Migrando ${data.metas.length} metas...`);
      const metas = data.metas.map(m => ({
        id: m.id,
        user_id: userId,
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
        created_at: m.dataCriacao ? new Date(m.dataCriacao).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('metas').upsert(metas, { onConflict: 'id' });
      if (error) throw new Error(`Metas: ${error.message}`);
    }

    // Tarefas
    if (data.tarefas.length > 0) {
      log(`Migrando ${data.tarefas.length} tarefas...`);
      const tarefas = data.tarefas.map(t => ({
        id: t.id,
        user_id: userId,
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
        created_at: t.dataCriacao ? new Date(t.dataCriacao).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('tarefas').upsert(tarefas, { onConflict: 'id' });
      if (error) throw new Error(`Tarefas: ${error.message}`);
    }

    // Receitas
    if (data.receitas.length > 0) {
      log(`Migrando ${data.receitas.length} receitas...`);
      const receitas = data.receitas.map(r => ({
        id: r.id, user_id: userId, descricao: r.descricao, valor: r.valor,
        data: r.data, categoria: r.categoria, recorrente: r.recorrente,
        created_at: r.dataCriacao ? new Date(r.dataCriacao).toISOString() : new Date().toISOString(),
      }));
      const { error } = await supabase.from('receitas').upsert(receitas, { onConflict: 'id' });
      if (error) throw new Error(`Receitas: ${error.message}`);
    }

    // Despesas
    if (data.despesas.length > 0) {
      log(`Migrando ${data.despesas.length} despesas...`);
      const despesas = data.despesas.map(d => ({
        id: d.id, user_id: userId, descricao: d.descricao, valor: d.valor,
        data: d.data, categoria: d.categoria, forma_pagamento: d.formaPagamento,
        recorrente: d.recorrente, essencial: d.essencial,
        created_at: d.dataCriacao ? new Date(d.dataCriacao).toISOString() : new Date().toISOString(),
      }));
      const { error } = await supabase.from('despesas').upsert(despesas, { onConflict: 'id' });
      if (error) throw new Error(`Despesas: ${error.message}`);
    }

    log('Migração concluída com sucesso!');
    marcarMigracaoConcluida();
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
