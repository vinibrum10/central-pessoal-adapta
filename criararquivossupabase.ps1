# Script gerado automaticamente — cria os arquivos da feature supabase-persistencia
# Execute na raiz do projeto: C:\Users\Vinicius\Documents\1.0-Desenvolvimentos_Projetos\2.GestaoVinicius


# --- supabase/migrations/20260623_app_data_sync.sql ---
New-Item -ItemType Directory -Force -Path "supabase\migrations" | Out-Null
@'
-- Migration: tabela app_data — persistência principal por usuário
-- Resolve divergência de dados entre dispositivos.
-- Armazena o AppData completo como JSONB, vinculado ao user_id.
-- localStorage passa a ser apenas cache local.

create table if not exists app_data (
  id         uuid        not null default gen_random_uuid() primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  data       jsonb       not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint app_data_user_id_unique unique (user_id)
);

create index if not exists idx_app_data_user_id on app_data(user_id);

alter table app_data enable row level security;

create policy "Usuário lê próprios dados"
  on app_data for select
  using (auth.uid() = user_id);

create policy "Usuário insere próprios dados"
  on app_data for insert
  with check (auth.uid() = user_id);

create policy "Usuário atualiza próprios dados"
  on app_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuário deleta próprios dados"
  on app_data for delete
  using (auth.uid() = user_id);

-- Reutiliza função update_updated_at() criada em 001_initial_schema.sql
create or replace trigger app_data_updated_at
  before update on app_data
  for each row execute function update_updated_at();
'
'@ | Set-Content -Encoding UTF8 "supabase\migrations\20260623_app_data_sync.sql"
Write-Host "Criado: supabase\migrations\20260623_app_data_sync.sql"

# --- src/services/appDataRepository.ts ---
New-Item -ItemType Directory -Force -Path "src\services" | Out-Null
@'
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AppData } from '../types';

export async function loadAppData(userId: string): Promise<AppData | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('app_data')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.data as AppData;
}

export async function saveAppData(userId: string, appData: AppData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('app_data')
    .upsert(
      { user_id: userId, data: appData, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}
'
'@ | Set-Content -Encoding UTF8 "src\services\appDataRepository.ts"
Write-Host "Criado: src\services\appDataRepository.ts"

# --- src/components/MigrationBanner.tsx ---
New-Item -ItemType Directory -Force -Path "src\components" | Out-Null
@'
import { UploadCloud, Download, X } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../hooks/useApp';

export function MigrationBanner() {
  const { syncStatus, migrateLocalToSupabase, dismissMigrationPrompt, exportData } = useApp();
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState(false);

  if (syncStatus !== 'needs-migration') return null;

  async function handleMigrate() {
    setMigrating(true);
    setError(false);
    const ok = await migrateLocalToSupabase();
    if (!ok) setError(true);
    setMigrating(false);
  }

  return (
    <div className="mx-4 lg:mx-6 mt-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <UploadCloud size={20} className="text-blue-500 flex-shrink-0 mt-0.5 sm:mt-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
          Dados locais detectados
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
          Você tem dados salvos neste dispositivo que ainda não estão na nuvem. Migre para acessá-los em qualquer dispositivo.
        </p>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            Falha ao migrar. Verifique sua conexão e tente novamente.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={exportData}
          title="Exportar backup local"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          <Download size={14} />
          Backup
        </button>
        <button
          onClick={handleMigrate}
          disabled={migrating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          <UploadCloud size={14} />
          {migrating ? 'Migrando…' : 'Migrar para nuvem'}
        </button>
        <button
          onClick={dismissMigrationPrompt}
          title="Ignorar por enquanto"
          className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
'
'@ | Set-Content -Encoding UTF8 "src\components\MigrationBanner.tsx"
Write-Host "Criado: src\components\MigrationBanner.tsx"

# --- src/hooks/useApp.tsx ---
New-Item -ItemType Directory -Force -Path "src\hooks" | Out-Null
@'
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { AppData, Tarefa, FaixaTarefa, StatusTarefa, Meta, FrequenciaRevisao, StatusMeta, EventoAgenda, ConfiguracaoAgenda, ClassificacaoPrazoMeta, SugestaoCalendario } from '../types';
import { calcularClassificacaoPrazo, processarRotinas } from '../utils';
import { dadosDemonstracaoInicial } from '../data/dadosDemonstracao';
import { useAuth } from '../contexts/AuthContext';
import { loadAppData, saveAppData } from '../services/appDataRepository';

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
      etapas: Array.isArray(m.etapas)
        ? (m.etapas as Meta['etapas'])
        : [],
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

    const tipoAcao = (t.tipoAcao as Tarefa['tipoAcao']) ?? 'eventual';
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
      tipoAcao,
      periodicidade: (t.periodicidade as Tarefa['periodicidade']) ?? undefined,
      intervaloDias: typeof t.intervaloDias === 'number' ? t.intervaloDias : undefined,
      tempoMinimoMinutos: typeof t.tempoMinimoMinutos === 'number' ? t.tempoMinimoMinutos : undefined,
      dataProximaOcorrencia: (t.dataProximaOcorrencia as string | null) ?? null,
      ultimaReabertura: (t.ultimaReabertura as string | null) ?? null,
      etapaMetaNumero: typeof t.etapaMetaNumero === 'number' ? t.etapaMetaNumero : undefined,
      geradaPorMeta: Boolean(t.geradaPorMeta),
    };
  });
}

function migrarReceitas(raw: Record<string, unknown>[]): AppData['receitas'] {
  return raw.map(r => {
    const data = (r.data as string) || new Date().toISOString().slice(0, 10);
    const dataReceita = (r.dataReceita as string) || data;
    const mesReferencia = typeof r.mesReferencia === 'number'
      ? r.mesReferencia
      : Number(data.slice(5, 7));
    const anoReferencia = typeof r.anoReferencia === 'number'
      ? r.anoReferencia
      : Number(data.slice(0, 4));
    return {
      id: (r.id as string) || '',
      descricao: (r.descricao as string) || '',
      valor: typeof r.valor === 'number' ? r.valor : 0,
      data,
      dataReceita,
      mesReferencia,
      anoReferencia,
      categoria: (r.categoria as AppData['receitas'][number]['categoria']) || 'Outros',
      recorrente: Boolean(r.recorrente),
      recorrenciaId: (r.recorrenciaId as string | null | undefined) ?? null,
      recorrenciaTemTermino: Boolean(r.recorrenciaTemTermino),
      recorrenciaMesTermino: (r.recorrenciaMesTermino as number | null | undefined) ?? null,
      recorrenciaAnoTermino: (r.recorrenciaAnoTermino as number | null | undefined) ?? null,
      dataCriacao: (r.dataCriacao as string) || data,
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
    receitas: Array.isArray(raw.receitas)
      ? migrarReceitas(raw.receitas as Record<string, unknown>[])
      : migrarReceitas(base.receitas as unknown as Record<string, unknown>[]),
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
    leiturasDiarias: Array.isArray(raw.leiturasDiarias)
      ? (raw.leiturasDiarias as AppData['leiturasDiarias'])
      : [],
    fontesLeitura: Array.isArray(raw.fontesLeitura)
      ? (raw.fontesLeitura as AppData['fontesLeitura'])
      : [],
    faturas: Array.isArray(raw.faturas)
      ? (raw.faturas as AppData['faturas'])
      : [],
    sugestoes: Array.isArray(raw.sugestoes)
      ? (raw.sugestoes as SugestaoCalendario[])
      : [],
  };
}

function hasRealLocalData(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const raw = JSON.parse(stored) as Record<string, unknown>;
    const metas = Array.isArray(raw.metas) ? raw.metas : [];
    const tarefas = Array.isArray(raw.tarefas) ? raw.tarefas : [];
    const receitas = Array.isArray(raw.receitas) ? raw.receitas : [];
    return metas.length > 0 || tarefas.length > 0 || receitas.length > 0;
  } catch {
    return false;
  }
}

export type SyncStatus = 'idle' | 'loading' | 'needs-migration' | 'synced' | 'error';

interface AppContextType {
  data: AppData;
  setData: (data: AppData | ((prev: AppData) => AppData)) => void;
  resetToDemo: () => void;
  clearAll: () => void;
  exportData: () => void;
  importData: (jsonString: string) => boolean;
  tema: 'claro' | 'escuro';
  toggleTema: () => void;
  syncStatus: SyncStatus;
  migrateLocalToSupabase: () => Promise<boolean>;
  dismissMigrationPrompt: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, supabaseAtivo, loading: authLoading } = useAuth();

  const [data, setDataState] = useState<AppData>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const raw = JSON.parse(stored) as Record<string, unknown>;
        const migrado = migrarDados(raw);
        return { ...migrado, tarefas: processarRotinas(migrado.tarefas) };
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

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const supabaseLoadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tema === 'escuro') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [tema]);

  // Load from Supabase once auth is ready
  useEffect(() => {
    if (authLoading) return;
    if (!supabaseAtivo || !user) return;
    if (supabaseLoadedRef.current) return;

    supabaseLoadedRef.current = true;
    setSyncStatus('loading');

    loadAppData(user.id).then(remoteData => {
      if (remoteData) {
        // Supabase has data — it's the source of truth
        const migrado = migrarDados(remoteData as unknown as Record<string, unknown>);
        const comRotinas = { ...migrado, tarefas: processarRotinas(migrado.tarefas) };
        setDataState(comRotinas);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(comRotinas)); } catch { /* ignore */ }
        setSyncStatus('synced');
      } else {
        // No Supabase record yet
        if (hasRealLocalData()) {
          setSyncStatus('needs-migration');
        } else {
          setSyncStatus('synced');
        }
      }
    }).catch(() => {
      setSyncStatus('error');
    });
  }, [authLoading, supabaseAtivo, user]);

  // Debounce save to Supabase on data changes
  useEffect(() => {
    if (!supabaseAtivo || !user?.id) return;
    if (syncStatus === 'loading' || syncStatus === 'idle' || syncStatus === 'needs-migration') return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveAppData(user.id, data).catch(() => {
        /* silent — localStorage is still in sync */
      });
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [data, supabaseAtivo, user?.id, syncStatus]);

  const setData = useCallback((value: AppData | ((prev: AppData) => AppData)) => {
    setDataState(prev => {
      const next = value instanceof Function ? value(prev) : value;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
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
    if (supabaseAtivo && user?.id) {
      saveAppData(user.id, dadosDemonstracaoInicial).catch(() => { /* ignore */ });
    }
  }, [supabaseAtivo, user?.id]);

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
      leiturasDiarias: [],
      fontesLeitura: [],
      faturas: [],
      sugestoes: [],
    };
    setDataState(empty);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
    if (supabaseAtivo && user?.id) {
      saveAppData(user.id, empty).catch(() => { /* ignore */ });
    }
  }, [supabaseAtivo, user?.id]);

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
      if (supabaseAtivo && user?.id) {
        saveAppData(user.id, migrado).catch(() => { /* ignore */ });
      }
      return true;
    } catch {
      return false;
    }
  }, [supabaseAtivo, user?.id]);

  const migrateLocalToSupabase = useCallback(async (): Promise<boolean> => {
    if (!supabaseAtivo || !user?.id) return false;
    try {
      await saveAppData(user.id, data);
      setSyncStatus('synced');
      return true;
    } catch {
      return false;
    }
  }, [supabaseAtivo, user?.id, data]);

  const dismissMigrationPrompt = useCallback(() => {
    setSyncStatus('synced');
  }, []);

  return (
    <AppContext.Provider value={{
      data, setData, resetToDemo, clearAll, exportData, importData,
      tema, toggleTema,
      syncStatus, migrateLocalToSupabase, dismissMigrationPrompt,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
'
'@ | Set-Content -Encoding UTF8 "src\hooks\useApp.tsx"
Write-Host "Criado: src\hooks\useApp.tsx"

# --- src/layouts/Layout.tsx ---
New-Item -ItemType Directory -Force -Path "src\layouts" | Out-Null
@'
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Target, ListChecks, Clock,
  Wallet, Settings, Menu, X, Moon, Sun, BookOpen, LogOut,
  ChevronLeft, ChevronRight, Users,
} from 'lucide-react';

function AppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="16,4 24,8.5 24,17.5 16,22 8,17.5 8,8.5" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5"/>
      <path d="M18 10L14 16H17L14 22" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
import { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { useAuth } from '../contexts/AuthContext';
import { MigrationBanner } from '../components/MigrationBanner';

const SIDEBAR_KEY = 'adapta-sidebar-collapsed';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/plano', label: 'Plano de Ação', icon: ListChecks },
  { to: '/agenda', label: 'Agenda e Tempo', icon: Clock },
  { to: '/orcamento', label: 'Orçamento', icon: Wallet },
  { to: '/leitura', label: 'Leitura Diária', icon: BookOpen },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

const adminNavItems = [
  { to: '/usuarios', label: 'Usuários', icon: Users },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch { return false; }
  });
  const { data, tema, toggleTema } = useApp();
  const { user, signOut, supabaseAtivo, role } = useAuth();
  const location = useLocation();

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch { /* noop */ }
  }, [collapsed]);

  const currentPage = navItems.find(n =>
    n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)
  );

  return (
    <div className="flex h-screen bg-surface-50 dark:bg-surface-900 overflow-hidden">
      {/* === SIDEBAR DESKTOP === */}
      <aside
        className={`hidden lg:flex flex-col bg-white dark:bg-surface-800 border-r border-surface-200 dark:border-surface-700 flex-shrink-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}
      >
        {/* Logo */}
        <div className={`border-b border-surface-200 dark:border-surface-700 flex items-center ${collapsed ? 'justify-center p-3' : 'justify-between p-5'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30 flex-shrink-0">
              <AppIcon size={18} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-bold text-sm text-surface-900 dark:text-white leading-tight">SGP</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Gestão Pessoal</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 flex-shrink-0 transition-colors"
              title="Recolher menu"
            >
              <ChevronLeft size={15} />
            </button>
          )}
        </div>

        {/* Expand button when collapsed — fica bem visível no centro */}
        {collapsed && (
          <div className="flex justify-center py-2 border-b border-surface-200 dark:border-surface-700">
            <button
              onClick={() => setCollapsed(false)}
              className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 transition-colors"
              title="Expandir menu"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* User info */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700">
            <p className="text-xs text-surface-400 dark:text-surface-500">Bem-vindo,</p>
            <p className="font-semibold text-sm text-surface-900 dark:text-white">{data.configuracoes.nomeUsuario}</p>
            {supabaseAtivo && user && (
              <p className="text-[10px] text-surface-400 dark:text-surface-500 truncate">{user.email}</p>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-surface-900 dark:hover:text-white'
                }
              `}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
          {role === 'admin' && (
            <>
              {!collapsed && <p className="text-[10px] uppercase tracking-widest text-surface-400 dark:text-surface-600 px-3 pt-3 pb-1">Admin</p>}
              {adminNavItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-150
                    ${collapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-surface-900 dark:hover:text-white'
                    }
                  `}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-surface-200 dark:border-surface-700 space-y-0.5">
          <button
            onClick={toggleTema}
            title={collapsed ? (tema === 'escuro' ? 'Modo Claro' : 'Modo Escuro') : undefined}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && (tema === 'escuro' ? 'Modo Claro' : 'Modo Escuro')}
          </button>
          {supabaseAtivo && user && (
            <button
              onClick={signOut}
              title={collapsed ? 'Sair' : undefined}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-danger-500 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors ${collapsed ? 'justify-center' : ''}`}
            >
              <LogOut size={16} />
              {!collapsed && 'Sair'}
            </button>
          )}
        </div>
      </aside>

      {/* === SIDEBAR MOBILE (overlay) === */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 bg-white dark:bg-surface-800 h-full flex flex-col shadow-2xl animate-slide-up">
            <div className="p-5 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
                  <AppIcon size={18} />
                </div>
                <div>
                  <p className="font-bold text-sm text-surface-900 dark:text-white">SGP</p>
                  <p className="text-xs text-surface-400">Gestão Pessoal</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
                <X size={18} className="text-surface-500" />
              </button>
            </div>
            {supabaseAtivo && user && (
              <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700">
                <p className="text-xs text-surface-400">Logado como</p>
                <p className="text-sm font-medium text-surface-800 dark:text-white truncate">{user.email}</p>
              </div>
            )}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive ? 'bg-primary-600 text-white' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'}
                  `}
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
              {role === 'admin' && (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-surface-400 dark:text-surface-600 px-3 pt-3 pb-1">Admin</p>
                  {adminNavItems.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                        ${isActive ? 'bg-primary-600 text-white' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'}
                      `}
                    >
                      <Icon size={18} />
                      {label}
                    </NavLink>
                  ))}
                </>
              )}
            </nav>
            <div className="p-4 border-t border-surface-200 dark:border-surface-700 space-y-1">
              <button onClick={toggleTema} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
                {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
                {tema === 'escuro' ? 'Modo Claro' : 'Modo Escuro'}
              </button>
              {supabaseAtivo && user && (
                <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors">
                  <LogOut size={16} />
                  Sair
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* === MAIN CONTENT === */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
            <Menu size={20} className="text-surface-600 dark:text-surface-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <AppIcon size={14} />
            </div>
            <span className="font-bold text-sm text-surface-900 dark:text-white">SGP</span>
          </div>
          <button onClick={toggleTema} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
            {tema === 'escuro' ? <Sun size={18} className="text-surface-500" /> : <Moon size={18} className="text-surface-500" />}
          </button>
        </header>

        {/* Page title bar (desktop) */}
        <div className="hidden lg:flex items-center px-6 py-4 border-b border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 flex-shrink-0">
          <h1 className="font-semibold text-surface-900 dark:text-white">{currentPage?.label ?? 'Sistema de Gestão Pessoal'}</h1>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <MigrationBanner />
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>

        {/* Bottom nav mobile */}
        <nav className="lg:hidden flex bg-white dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 flex-shrink-0">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `
                flex-1 flex flex-col items-center py-2 gap-0.5
                ${isActive ? 'text-primary-600' : 'text-surface-400'}
              `}
            >
              <Icon size={18} />
              <span className="text-[9px] font-medium leading-tight text-center">{label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
'
'@ | Set-Content -Encoding UTF8 "src\layouts\Layout.tsx"
Write-Host "Criado: src\layouts\Layout.tsx"

Write-Host ""
Write-Host "Todos os arquivos criados. Agora rode:"
Write-Host "  git add ."
Write-Host "  git commit -m 'feat: persistencia multi-dispositivo via Supabase'"
Write-Host "  git push -u origin fix/supabase-persistencia-multidispositivo"