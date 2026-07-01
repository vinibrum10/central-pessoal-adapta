import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import type { AppData, Tarefa, FaixaTarefa, StatusTarefa, Meta, FrequenciaRevisao, StatusMeta, EventoAgenda, ConfiguracaoAgenda, ClassificacaoPrazoMeta, SugestaoCalendario, AReceber, StatusAReceber } from '../types';
import { calcularClassificacaoPrazo, processarRotinas } from '../utils';
import { dadosDemonstracaoInicial } from '../data/dadosDemonstracao';
import { useAuth } from '../contexts/AuthContext';
import { loadAppData, saveAppData } from '../services/appDataRepository';
import { recalcularTodasAsFaturas } from '../utils/orcamento';

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

function parseNumeroSeguro(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value
      .trim()
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getString(raw: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function getIsoDate(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    const text = value.trim();
    const iso = text.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3] ?? '01'}`;
    const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  }
  return undefined;
}

function normalizarStatusAReceber(value: unknown): StatusAReceber {
  const status = String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['recebido', 'pago', 'concluido', 'quitado'].includes(status)) return 'recebido';
  if (['cancelado', 'cancelada'].includes(status)) return 'cancelado';
  return 'a_receber';
}

function chaveAReceber(item: Pick<AReceber, 'pessoa' | 'descricao' | 'valor' | 'mes' | 'ano' | 'status'>): string {
  return [
    item.pessoa.trim().toLowerCase(),
    item.descricao.trim().toLowerCase(),
    item.valor.toFixed(2),
    item.mes,
    item.ano,
    item.status,
  ].join('|');
}

function migrarAReceber(rawItens: Record<string, unknown>[]): AReceber[] {
  const hoje = new Date().toISOString().slice(0, 10);
  const dedupe = new Set<string>();
  const itens: AReceber[] = [];

  for (const raw of rawItens) {
    const dataPrevista = getIsoDate(raw, [
      'dataPrevista',
      'dataVencimento',
      'vencimento',
      'dueDate',
      'data',
      'dataRecebimento',
      'receivedDate',
      'createdAt',
      'dataCriacao',
    ]);
    const mes = parseNumeroSeguro(raw.mes ?? raw.mesReferencia ?? raw.month, dataPrevista ? Number(dataPrevista.slice(5, 7)) : 0);
    const ano = parseNumeroSeguro(raw.ano ?? raw.anoReferencia ?? raw.year, dataPrevista ? Number(dataPrevista.slice(0, 4)) : 0);
    const valor = parseNumeroSeguro(raw.valor ?? raw.value ?? raw.amount ?? raw.total, 0);
    const descricao = getString(raw, ['descricao', 'descrição', 'titulo', 'title', 'nome', 'name'], 'Valor a receber');

    if (!mes || !ano || valor <= 0) continue;

    const item: AReceber = {
      id: getString(raw, ['id'], ''),
      pessoa: getString(raw, ['pessoa', 'origem', 'cliente', 'pagador', 'source'], 'Não informado'),
      descricao,
      valor,
      mes,
      ano,
      tipoRecebimento: (raw.tipoRecebimento === 'parcelado' || raw.tipo === 'parcelado') ? 'parcelado' : 'unico',
      grupoRecebimentoId: getString(raw, ['grupoRecebimentoId', 'grupoId', 'installmentGroupId'], '') || undefined,
      parcelaAtual: parseNumeroSeguro(raw.parcelaAtual ?? raw.parcela ?? raw.installmentNumber, 0) || undefined,
      totalParcelas: parseNumeroSeguro(raw.totalParcelas ?? raw.parcelas ?? raw.installments, 0) || undefined,
      diaPrevisto: parseNumeroSeguro(raw.diaPrevisto ?? raw.diaVencimento ?? raw.dueDay, dataPrevista ? Number(dataPrevista.slice(8, 10)) : 0) || undefined,
      formaPrevista: getString(raw, ['formaPrevista', 'formaPagamento', 'paymentMethod'], '') || undefined,
      observacao: getString(raw, ['observacao', 'observação', 'notes', 'nota'], '') || undefined,
      status: normalizarStatusAReceber(raw.status ?? raw.situacao ?? raw.state),
      dataRecebimento: getIsoDate(raw, ['dataRecebimento', 'receivedDate']) ?? undefined,
      receitaVinculadaId: getString(raw, ['receitaVinculadaId', 'receitaId'], '') || undefined,
      dataCriacao: getIsoDate(raw, ['dataCriacao', 'createdAt', 'created_at']) ?? hoje,
      dataAtualizacao: getIsoDate(raw, ['dataAtualizacao', 'updatedAt', 'updated_at']) ?? hoje,
    };

    if (!item.id) item.id = `ar-${chaveAReceber(item).replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`;
    const dedupeKey = item.id || chaveAReceber(item);
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);
    itens.push(item);
  }

  return itens;
}

function coletarAReceberLegado(raw: Record<string, unknown>): Record<string, unknown>[] {
  const keys = [
    'aReceber',
    'valoresAReceber',
    'contasAReceber',
    'recebiveis',
    'recebíveis',
    'recebimentos',
    'incomeReceivable',
  ];
  const encontrados = keys.flatMap(key => Array.isArray(raw[key]) ? raw[key] as Record<string, unknown>[] : []);
  const receitas = Array.isArray(raw.receitas) ? raw.receitas as Record<string, unknown>[] : [];
  const receitasAReceber = receitas
    .filter(r => r.aReceberOrigemId || r.statusAReceber === 'a_receber')
    .map(r => ({
      id: r.aReceberOrigemId ?? r.id,
      pessoa: r.pessoa ?? r.origem ?? 'Receita',
      descricao: r.descricao,
      valor: r.valor,
      data: r.dataReceita ?? r.data,
      mes: r.mesReferencia,
      ano: r.anoReferencia,
      status: r.statusAReceber ?? 'a_receber',
      receitaVinculadaId: r.statusAReceber === 'recebido' ? r.id : undefined,
      parcelaAtual: r.parcelaAReceber,
      totalParcelas: r.totalParcelasAReceber,
      dataCriacao: r.dataCriacao,
    }));
  return [...encontrados, ...receitasAReceber];
}

function pareceChaveDeAReceber(key: string): boolean {
  return /a.?receber|receb[ií]ve|recebimento|contas.?a.?receber|valores.?a.?receber|income.?receivable/i.test(key);
}

function coletarAReceberEmObjeto(value: unknown, sourceKey = '', depth = 0): Record<string, unknown>[] {
  if (depth > 4 || !value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return pareceChaveDeAReceber(sourceKey)
      ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      : [];
  }

  const raw = value as Record<string, unknown>;
  const encontrados = [...coletarAReceberLegado(raw)];
  for (const [key, child] of Object.entries(raw)) {
    if (Array.isArray(child) && pareceChaveDeAReceber(key)) {
      encontrados.push(...child.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)));
      continue;
    }
    if (child && typeof child === 'object') {
      encontrados.push(...coletarAReceberEmObjeto(child, key, depth + 1));
    }
  }
  return encontrados;
}

function scanAReceberFromAllLocalStorage(): AReceber[] {
  const encontrados: Record<string, unknown>[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      const stored = localStorage.getItem(key);
      if (!stored) continue;
      try {
        const parsed = JSON.parse(stored) as unknown;
        encontrados.push(...coletarAReceberEmObjeto(parsed, key));
      } catch {
        continue;
      }
    }
  } catch {
    return [];
  }
  return migrarAReceber(encontrados);
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

  const dados: AppData = {
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
    statusPagamentos: Array.isArray(raw.statusPagamentos)
      ? (raw.statusPagamentos as AppData['statusPagamentos'])
      : [],
    aReceber: migrarAReceber(coletarAReceberLegado(raw)),
    sugestoes: Array.isArray(raw.sugestoes)
      ? (raw.sugestoes as SugestaoCalendario[])
      : [],
  };

  // Garante que nenhuma fatura antiga (de antes da correção do bug de exclusão de despesa)
  // fique com valorDetalhado/diferenca/valorEfetivo congelado — recalcula tudo a partir
  // das despesas atuais sempre que os dados são carregados/migrados.
  return recalcularTodasAsFaturas(dados);
}

function migrarStoredAppData(stored: string): AppData {
  const raw = JSON.parse(stored) as Record<string, unknown>;
  const migrado = migrarDados(raw);
  return { ...migrado, tarefas: processarRotinas(migrado.tarefas) };
}

function hasConteudoReal(data: AppData): boolean {
  return [
    data.metas,
    data.tarefas,
    data.receitas,
    data.despesas,
    data.cartoes,
    data.dividas,
    data.reservas,
    data.bens,
    data.aReceber,
  ].some(lista => Array.isArray(lista) && lista.length > 0);
}

function loadLocalDataFromKeys(keys: string[]): AppData | null {
  for (const key of keys) {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) continue;
      return migrarStoredAppData(stored);
    } catch {
      continue;
    }
  }
  return null;
}

function hasRealLocalData(keys: string[]): boolean {
  try {
    const localData = loadLocalDataFromKeys(keys);
    return Boolean(localData && hasConteudoReal(localData));
  } catch {
    return false;
  }
}

function mesclarAReceberPreservandoRemoto(remote: AppData, local: AppData | null): AppData {
  if (!local?.aReceber?.length) return remote;
  const existentes = new Set((remote.aReceber ?? []).map(item => item.id || chaveAReceber(item)));
  const recuperados = local.aReceber.filter(item => !existentes.has(item.id || chaveAReceber(item)));
  if (recuperados.length === 0) return remote;
  return { ...remote, aReceber: [...(remote.aReceber ?? []), ...recuperados] };
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
  recoverAReceberFromLocalStorage: () => number;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, supabaseAtivo, loading: authLoading } = useAuth();
  const storageKey = user?.id ? `${STORAGE_KEY}:${user.id}` : STORAGE_KEY;
  const candidateStorageKeys = useMemo(() => user?.id ? [storageKey, STORAGE_KEY] : [STORAGE_KEY], [storageKey, user?.id]);

  const [data, setDataState] = useState<AppData>(() => {
    return loadLocalDataFromKeys([STORAGE_KEY]) ?? dadosDemonstracaoInicial;
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
  const loadedUserRef = useRef<string | null>(null);
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
    if (loadedUserRef.current !== user.id) {
      supabaseLoadedRef.current = false;
      loadedUserRef.current = user.id;
    }
    if (supabaseLoadedRef.current) return;

    supabaseLoadedRef.current = true;
    setSyncStatus('loading');

    loadAppData(user.id).then(remoteData => {
      if (remoteData) {
        // Supabase has data — it's the source of truth
        const migrado = migrarDados(remoteData as unknown as Record<string, unknown>);
        const comRotinas = mesclarAReceberPreservandoRemoto(
          { ...migrado, tarefas: processarRotinas(migrado.tarefas) },
          loadLocalDataFromKeys(candidateStorageKeys),
        );
        setDataState(comRotinas);
        try { localStorage.setItem(storageKey, JSON.stringify(comRotinas)); } catch { /* ignore */ }
        setSyncStatus('synced');
      } else {
        // No Supabase record yet
        const localData = loadLocalDataFromKeys(candidateStorageKeys);
        if (localData) {
          setDataState(localData);
          try { localStorage.setItem(storageKey, JSON.stringify(localData)); } catch { /* ignore */ }
        }
        if (hasRealLocalData(candidateStorageKeys)) {
          setSyncStatus('needs-migration');
        } else {
          setSyncStatus('synced');
        }
      }
    }).catch(() => {
      setSyncStatus('error');
    });
  }, [authLoading, supabaseAtivo, user, storageKey, candidateStorageKeys]);

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
      const raw = value instanceof Function ? value(prev) : value;
      // Rede de segurança final: garante que toda gravação persista faturas já
      // recalculadas a partir das despesas atuais, mesmo que algum ponto de mutação
      // futuro esqueça de recalcular manualmente.
      const next = recalcularTodasAsFaturas(raw);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  const toggleTema = useCallback(() => {
    setTema(prev => {
      const next = prev === 'escuro' ? 'claro' : 'escuro';
      setData(d => ({ ...d, configuracoes: { ...d.configuracoes, tema: next } }));
      return next;
    });
  }, [setData]);

  const resetToDemo = useCallback(() => {
    setDataState(dadosDemonstracaoInicial);
    localStorage.setItem(storageKey, JSON.stringify(dadosDemonstracaoInicial));
    if (supabaseAtivo && user?.id) {
      saveAppData(user.id, dadosDemonstracaoInicial).catch(() => { /* ignore */ });
    }
  }, [supabaseAtivo, user?.id, storageKey]);

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
      statusPagamentos: [],
      aReceber: [],
      sugestoes: [],
    };
    setDataState(empty);
    localStorage.setItem(storageKey, JSON.stringify(empty));
    if (supabaseAtivo && user?.id) {
      saveAppData(user.id, empty).catch(() => { /* ignore */ });
    }
  }, [supabaseAtivo, user?.id, storageKey]);

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
      localStorage.setItem(storageKey, JSON.stringify(migrado));
      if (supabaseAtivo && user?.id) {
        saveAppData(user.id, migrado).catch(() => { /* ignore */ });
      }
      return true;
    } catch {
      return false;
    }
  }, [supabaseAtivo, user?.id, storageKey]);

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

  const recoverAReceberFromLocalStorage = useCallback((): number => {
    const encontrados = scanAReceberFromAllLocalStorage();
    if (encontrados.length === 0) return 0;
    const existentesAtuais = new Set((data.aReceber ?? []).map(item => item.id || chaveAReceber(item)));
    const novosAtuais = encontrados.filter(item => !existentesAtuais.has(item.id || chaveAReceber(item)));
    if (novosAtuais.length === 0) return 0;
    setDataState(prev => {
      const existentes = new Set((prev.aReceber ?? []).map(item => item.id || chaveAReceber(item)));
      const novos = encontrados.filter(item => !existentes.has(item.id || chaveAReceber(item)));
      if (novos.length === 0) return prev;
      const next = { ...prev, aReceber: [...(prev.aReceber ?? []), ...novos] };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      if (supabaseAtivo && user?.id) {
        saveAppData(user.id, next).catch(() => { /* local cache remains recovered */ });
      }
      return next;
    });
    return novosAtuais.length;
  }, [data.aReceber, storageKey, supabaseAtivo, user?.id]);

  return (
    <AppContext.Provider value={{
      data, setData, resetToDemo, clearAll, exportData, importData,
      tema, toggleTema,
      syncStatus, migrateLocalToSupabase, dismissMigrationPrompt, recoverAReceberFromLocalStorage,
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
