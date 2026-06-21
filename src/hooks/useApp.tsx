import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AppData, Tarefa, FaixaTarefa, StatusTarefa, Meta, FrequenciaRevisao, StatusMeta, EventoAgenda, ConfiguracaoAgenda, ClassificacaoPrazoMeta } from '../types';
import { calcularClassificacaoPrazo } from '../utils';
import { dadosDemonstracaoInicial } from '../data/dadosDemonstracao';

const STORAGE_KEY = 'adapta-central-pessoal-v1';

// ---- Migração de metas antigas ----
function migrarMetas(raw: Record<string, unknown>[]): Meta[] {
  const validStatuses: StatusMeta[] = ['ativa', 'planejar futuro', 'pausada', 'concluída', 'cancelada'];

  // Primeiro passo: converter campos
  // 'pausada' → 'planejar futuro' para garantir que nenhuma meta suma
  const metas: Meta[] = raw.map(m => {
    let status: StatusMeta = validStatuses.includes(m.status as StatusMeta)
      ? (m.status as StatusMeta)
      : 'ativa';
    if (status === 'pausada') status = 'planejar futuro';

    const freq: FrequenciaRevisao =
      (['semanal', 'quinzenal', 'mensal', 'sob demanda'] as FrequenciaRevisao[]).includes(m.frequenciaRevisao as FrequenciaRevisao)
        ? (m.frequenciaRevisao as FrequenciaRevisao)
        : 'semanal';

    const prazoFinal = (m.prazoFinal as string) || '';
    const dataInicio = (m.dataInicio as string) || (m.dataCriacao as string) || new Date().toISOString().split('T')[0];
    const classificacaoPrazo: ClassificacaoPrazoMeta | undefined =
      dataInicio && prazoFinal ? calcularClassificacaoPrazo(dataInicio, prazoFinal) : undefined;

    return {
      id: (m.id as string) || '',
      nome: (m.nome as string) || '',
      categoria: (m.categoria as Meta['categoria']) || 'Projetos',
      grau: typeof m.grau === 'number' ? m.grau : 0,
      status,
      motivo: (m.motivo as string) || '',
      resultadoEsperado: (m.resultadoEsperado as string) || '',
      dataInicio,
      prazoFinal,
      classificacaoPrazo,
      frequenciaRevisao: freq,
      dataCriacao: (m.dataCriacao as string) || '',
      dataUltimaRevisao: (m.dataUltimaRevisao as string | null) ?? null,
      dataUltimaAcao: (m.dataUltimaAcao as string | null) ?? null,
      descricao: (m.descricao as string) || '',
      progresso: typeof m.progresso === 'number' ? m.progresso : 0,
      prioridade: (m.prioridade as Meta['prioridade']) ?? undefined,
    };
  });

  // Segundo passo: atribuir graus a metas ativas sem grau
  const prioridadeOrdem: Record<string, number> = { crítica: 4, alta: 3, média: 2, baixa: 1 };

  const ativas = metas.filter(m => m.status === 'ativa');
  const semGrau = ativas.filter(m => m.grau === 0);

  if (semGrau.length > 0) {
    // Ordenar por prioridade antiga + prazo
    semGrau.sort((a, b) => {
      const pa = prioridadeOrdem[a.prioridade ?? 'média'] ?? 2;
      const pb = prioridadeOrdem[b.prioridade ?? 'média'] ?? 2;
      if (pb !== pa) return pb - pa;
      return (a.prazoFinal ?? '').localeCompare(b.prazoFinal ?? '');
    });

    // Descobrir graus já em uso por metas ativas com grau definido
    const grausUsados = new Set(ativas.filter(m => m.grau > 0).map(m => m.grau));

    let grauAtual = ativas.length + semGrau.length;
    for (const meta of semGrau) {
      while (grausUsados.has(grauAtual)) grauAtual--;
      meta.grau = grauAtual;
      grausUsados.add(grauAtual);
      grauAtual--;
    }
  }

  // Terceiro passo: garantir unicidade de graus em metas ativas
  const ativasComGrau = metas.filter(m => m.status === 'ativa').sort((a, b) => b.grau - a.grau);
  const grausVistos = new Set<number>();
  let contador = ativasComGrau.length;
  for (const m of ativasComGrau) {
    if (grausVistos.has(m.grau)) {
      while (grausVistos.has(contador)) contador--;
      m.grau = contador;
      contador--;
    }
    grausVistos.add(m.grau);
  }

  return metas;
}

// ---- Migração de tarefas antigas ----
function migrarTarefas(raw: Record<string, unknown>[]): Tarefa[] {
  return raw.map(t => {
    let faixa: FaixaTarefa = 'médio impacto';
    if (t.faixa && ['urgente', 'alto impacto', 'médio impacto', 'baixo impacto'].includes(t.faixa as string)) {
      faixa = t.faixa as FaixaTarefa;
    } else if (t.prioridade) {
      const p = t.prioridade as string;
      if (p === 'crítica') faixa = 'urgente';
      else if (p === 'alta') faixa = 'alto impacto';
      else if (p === 'média') faixa = 'médio impacto';
      else faixa = 'baixo impacto';
    }

    let status: StatusTarefa = 'não iniciado';
    const s = t.status as string;
    if (s === 'não iniciado') status = 'não iniciado';
    else if (s === 'em andamento') status = 'em andamento';
    else if (s === 'concluído' || s === 'concluída') status = 'concluído';
    else if (s === 'pendente' || s === 'reagendada') status = 'não iniciado';
    else if (s === 'cancelada') status = 'não iniciado';

    return {
      id: (t.id as string) || '',
      titulo: (t.titulo as string) || '',
      metaId: (t.metaId as string | null) ?? null,
      categoria: (t.categoria as Tarefa['categoria']) || 'Projetos',
      prazo: (t.prazo as string) || '',
      tempoEstimado: (t.tempoEstimado as number) || 30,
      faixa,
      faixaManual: Boolean(t.faixaManual),
      status,
      energiaNecessaria: (t.energiaNecessaria as Tarefa['energiaNecessaria']) || 'média',
      observacoes: (t.observacoes as string) || '',
      dataCriacao: (t.dataCriacao as string) || '',
      dataConclusao: status === 'concluído' ? ((t.dataConclusao as string | null) ?? null) : null,
    };
  });
}

// ---- Migração de eventos de agenda ----
function migrarEventosAgenda(raw: Record<string, unknown>[]): EventoAgenda[] {
  return raw.map(e => ({
    id: (e.id as string) || '',
    fonte: (e.fonte as EventoAgenda['fonte']) || 'manual',
    titulo: (e.titulo as string) || '',
    descricao: (e.descricao as string | undefined),
    inicio: (e.inicio as string) || '',
    fim: (e.fim as string) || '',
    diaInteiro: Boolean(e.diaInteiro),
    local: (e.local as string | undefined),
    bloqueiaTempo: e.bloqueiaTempo !== false,
    importadoEm: (e.importadoEm as string) || new Date().toISOString(),
    tarefaGeradaId: (e.tarefaGeradaId as string | null | undefined) ?? null,
    ignorado: Boolean(e.ignorado),
  }));
}

// ---- Migração geral do AppData ----
function migrarDados(raw: Record<string, unknown>): AppData {
  const base = dadosDemonstracaoInicial;

  const metasRaw = Array.isArray(raw.metas) ? (raw.metas as Record<string, unknown>[]) : [];
  const tarefasRaw = Array.isArray(raw.tarefas) ? (raw.tarefas as Record<string, unknown>[]) : [];

  return {
    metas: metasRaw.length > 0 ? migrarMetas(metasRaw) : base.metas,
    tarefas: tarefasRaw.length > 0 ? migrarTarefas(tarefasRaw) : base.tarefas,
    blocosTempo: Array.isArray(raw.blocosTempo) ? (raw.blocosTempo as AppData['blocosTempo']) : base.blocosTempo,
    rotinasSemana: Array.isArray(raw.rotinasSemana) ? (raw.rotinasSemana as AppData['rotinasSemana']) : [],
    receitas: Array.isArray(raw.receitas) ? (raw.receitas as AppData['receitas']) : base.receitas,
    despesas: Array.isArray(raw.despesas) ? (raw.despesas as AppData['despesas']) : base.despesas,
    cartoes: Array.isArray(raw.cartoes) ? (raw.cartoes as AppData['cartoes']) : base.cartoes,
    dividas: Array.isArray(raw.dividas) ? (raw.dividas as AppData['dividas']) : base.dividas,
    reservas: Array.isArray(raw.reservas) ? (raw.reservas as AppData['reservas']) : base.reservas,
    bens: Array.isArray(raw.bens) ? (raw.bens as AppData['bens']) : base.bens,
    configuracoes: (raw.configuracoes as AppData['configuracoes']) ?? base.configuracoes,
    // Novos campos — migração segura com fallback para array vazio
    eventosAgenda: Array.isArray(raw.eventosAgenda)
      ? migrarEventosAgenda(raw.eventosAgenda as Record<string, unknown>[])
      : [],
    configuracoesAgenda: Array.isArray(raw.configuracoesAgenda)
      ? (raw.configuracoesAgenda as ConfiguracaoAgenda[])
      : [],
  };
}

interface AppContextType {
  data: AppData;
  setData: (data: AppData | ((prev: AppData) => AppData)) => void;
  resetToDemo: () => void;
  clearAll: () => void;
  exportData: () => void;
  importData: (jsonString: string) => boolean;
  tema: 'claro' | 'escuro';
  toggleTema: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<AppData>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const raw = JSON.parse(stored) as Record<string, unknown>;
        return migrarDados(raw);
      }
    } catch { /* ignore */ }
    return dadosDemonstracaoInicial;
  });

  const [tema, setTema] = useState<'claro' | 'escuro'>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const d = JSON.parse(stored) as Record<string, unknown>;
        const conf = d.configuracoes as { tema?: string } | undefined;
        if (conf?.tema === 'claro') return 'claro';
      }
    } catch { /* ignore */ }
    return 'escuro';
  });

  useEffect(() => {
    if (tema === 'escuro') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [tema]);

  const setData = useCallback((value: AppData | ((prev: AppData) => AppData)) => {
    setDataState(prev => {
      const next = value instanceof Function ? value(prev) : value;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleTema = useCallback(() => {
    setTema(prev => {
      const next = prev === 'escuro' ? 'claro' : 'escuro';
      setData(d => ({ ...d, configuracoes: { ...d.configuracoes, tema: next } }));
      return next;
    });
  }, [setData]);

  const resetToDemo = useCallback(() => {
    setDataState(dadosDemonstracaoInicial);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dadosDemonstracaoInicial));
  }, []);

  const clearAll = useCallback(() => {
    const empty: AppData = {
      ...dadosDemonstracaoInicial,
      metas: [],
      tarefas: [],
      blocosTempo: [],
      receitas: [],
      despesas: [],
      cartoes: [],
      dividas: [],
      reservas: [],
      bens: [],
      eventosAgenda: [],
      configuracoesAgenda: [],
    };
    setDataState(empty);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
  }, []);

  const exportData = useCallback(() => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adapta-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const importData = useCallback((jsonString: string): boolean => {
    try {
      const raw = JSON.parse(jsonString) as Record<string, unknown>;
      const migrado = migrarDados(raw);
      setDataState(migrado);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrado));
      return true;
    } catch {
      return false;
    }
  }, []);

  return (
    <AppContext.Provider value={{ data, setData, resetToDemo, clearAll, exportData, importData, tema, toggleTema }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
