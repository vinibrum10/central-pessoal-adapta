import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragStartEvent, type DragEndEvent
} from '@dnd-kit/core';
import {
  Plus, Pencil, Trash2, Calendar, Clock, Search,
  AlertCircle, GripVertical, ChevronDown, ChevronUp,
  Zap, AlertTriangle, RotateCcw, RefreshCw, Eye, EyeOff,
} from 'lucide-react';
import { calcularDisponibilidadeDia } from '../utils/calendarAvailability';
import { formatarMinutos as fmtMin, isoParaDataBR, calcularProximaOcorrencia, labelPeriodicidade } from '../utils';
import { useApp } from '../hooks/useApp';
import type { Tarefa, Categoria, FaixaTarefa, StatusTarefa, NivelEnergia, TipoAcao, PeriodicidadeAcao } from '../types';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input, Textarea, Select } from '../components/FormFields';
import { DateInputBR } from '../components/DateInputBR';
import {
  corFaixa, siglaFaixa, labelFaixa, corCategoria,
  formatarData, formatarMinutos, eAtrasada, eHoje,
  eSemanaAtual, gerarId, hojeISO, calcularFaixaAutomaticaTarefa,
} from '../utils';
import { addDays, format } from 'date-fns';
import { useLocation } from 'react-router-dom';

const categorias: Categoria[] = ['Profissão', 'Estudos', 'Finanças', 'Projetos', 'Desenvolvimento Pessoal'];
const faixaList: FaixaTarefa[] = ['urgente', 'alto impacto', 'médio impacto', 'baixo impacto'];
const energiaList: NivelEnergia[] = ['baixa', 'média', 'alta'];
const statusList: StatusTarefa[] = ['não iniciado', 'em andamento', 'concluído'];
const periodicidadeList: PeriodicidadeAcao[] = ['diária', 'semanal', 'quinzenal', 'mensal', 'personalizada'];

type FiltroAtivo = 'todos' | 'hoje' | 'semana' | 'atrasadas' | 'por-meta' | FaixaTarefa;

type FormTarefa = Omit<Tarefa, 'id' | 'dataCriacao' | 'dataConclusao'>;

const tarefaVazia = (): FormTarefa => ({
  titulo: '',
  metaId: null,
  categoria: 'Projetos',
  prazo: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  tempoEstimado: 30,
  faixa: 'médio impacto',
  faixaManual: false,
  status: 'não iniciado',
  energiaNecessaria: 'média',
  observacoes: '',
  tipoAcao: 'eventual',
  periodicidade: undefined,
  intervaloDias: undefined,
  tempoMinimoMinutos: undefined,
  dataProximaOcorrencia: null,
  ultimaReabertura: null,
});

// ---- Card da tarefa ----
function TarefaCard({
  tarefa, meta, onEdit, onDelete, onMover, onReabrir, isDragging = false
}: {
  tarefa: Tarefa;
  meta?: { nome: string } | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onMover: (novoStatus: StatusTarefa) => void;
  onReabrir?: () => void;
  isDragging?: boolean;
}) {
  const [showMover, setShowMover] = useState(false);
  const atrasada = eAtrasada(tarefa.prazo);
  const isConcluida = tarefa.status === 'concluído';

  return (
    <div
      className={`
        bg-white dark:bg-surface-800 rounded-xl border p-3 space-y-2 shadow-sm
        ${isDragging ? 'opacity-50 shadow-lg rotate-1' : ''}
        ${isConcluida ? 'opacity-70' : atrasada ? 'border-danger-300 dark:border-danger-600' : 'border-surface-200 dark:border-surface-700'}
        transition-all
      `}
    >
      {/* Faixa + drag handle */}
      <div className="flex items-center gap-2 flex-wrap">
        <GripVertical size={14} className="text-surface-300 dark:text-surface-600 flex-shrink-0 cursor-grab active:cursor-grabbing" />
        <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${corFaixa(tarefa.faixa)}`}>
          <span className="font-bold">{siglaFaixa(tarefa.faixa)}</span>
          <span className="opacity-60 font-normal text-[9px]">· {tarefa.faixaManual ? 'manual' : 'auto'}</span>
        </span>
        {/* Tipo da ação */}
        {tarefa.tipoAcao === 'rotineira' ? (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            <RefreshCw size={8} />
            Rotineira
          </span>
        ) : (
          <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400">
            Eventual
          </span>
        )}
        {atrasada && !isConcluida && (
          <Badge className="text-[10px] px-1.5 py-0.5 bg-danger-100 text-danger-700 dark:bg-danger-600/20 dark:text-danger-400">
            Atrasada
          </Badge>
        )}
        <div className="ml-auto flex gap-0.5">
          <button onClick={onEdit} className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-400 hover:text-primary-600 transition-colors">
            <Pencil size={11} />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-400 hover:text-danger-600 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Título */}
      <p className="text-sm font-medium text-surface-900 dark:text-white leading-tight">{tarefa.titulo}</p>

      {/* Meta */}
      {meta && (
        <p className="text-[11px] text-primary-600 dark:text-primary-400 truncate">{meta.nome}</p>
      )}

      {/* Categoria */}
      <Badge className={`text-[10px] px-1.5 py-0.5 ${corCategoria(tarefa.categoria)}`}>
        {tarefa.categoria}
      </Badge>

      {/* Prazo + tempo */}
      <div className="flex items-center gap-3 text-[11px] text-surface-400 dark:text-surface-500">
        <span className="flex items-center gap-1">
          <Calendar size={10} />
          {formatarData(tarefa.prazo)}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {formatarMinutos(tarefa.tempoEstimado)}
        </span>
        <span className="capitalize">{tarefa.energiaNecessaria} ⚡</span>
      </div>

      {/* Próxima ocorrência (rotineiras concluídas) */}
      {tarefa.tipoAcao === 'rotineira' && tarefa.dataProximaOcorrencia && (
        <p className="text-[10px] text-violet-600 dark:text-violet-400 flex items-center gap-1">
          <RefreshCw size={9} />
          Reabre em {isoParaDataBR(tarefa.dataProximaOcorrencia)}
        </p>
      )}

      {/* Botão reabrir (para concluídas) */}
      {isConcluida && onReabrir && (
        <button
          onClick={onReabrir}
          className="w-full flex items-center justify-center gap-1 text-[11px] text-success-600 dark:text-success-400 hover:text-success-700 border border-success-200 dark:border-success-800 rounded-lg py-1 hover:bg-success-50 dark:hover:bg-success-900/20 transition-colors"
        >
          <RotateCcw size={10} />
          Reabrir
        </button>
      )}

      {/* Botões mover (mobile) */}
      {!isConcluida && (
        <div className="sm:hidden">
          <button
            onClick={() => setShowMover(v => !v)}
            className="w-full flex items-center justify-center gap-1 text-[11px] text-surface-400 hover:text-primary-600 py-1"
          >
            Mover {showMover ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {showMover && (
            <div className="flex gap-1 mt-1">
              {statusList.filter(s => s !== tarefa.status).map(s => (
                <button
                  key={s}
                  onClick={() => { onMover(s); setShowMover(false); }}
                  className="flex-1 text-[10px] py-1 rounded bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 transition-colors"
                >
                  {s === 'não iniciado' ? 'Não iniciado' : s === 'em andamento' ? 'Em andamento' : 'Concluído'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Wrapper draggable ----
function DraggableTarefa({ tarefa, ...props }: { tarefa: Tarefa } & Omit<Parameters<typeof TarefaCard>[0], 'tarefa' | 'isDragging'>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: tarefa.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}>
      <TarefaCard tarefa={tarefa} isDragging={isDragging} {...props} />
    </div>
  );
}

// ---- Coluna Kanban (droppable) ----
function KanbanColuna({
  status, label, tarefas, concluidas, metas, count, onEdit, onDelete, onMover, onReabrir
}: {
  status: StatusTarefa;
  label: string;
  tarefas: Tarefa[];       // ativas (não concluídas) nesta coluna
  concluidas: Tarefa[];    // concluídas (só usadas na coluna 'concluído')
  metas: { id: string; nome: string }[];
  count: number;
  onEdit: (t: Tarefa) => void;
  onDelete: (id: string) => void;
  onMover: (id: string, status: StatusTarefa) => void;
  onReabrir: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);

  const colorMap: Record<StatusTarefa, string> = {
    'não iniciado': 'border-t-surface-400 bg-surface-50 dark:bg-surface-900/50',
    'em andamento': 'border-t-primary-500 bg-primary-50/30 dark:bg-primary-900/10',
    'concluído': 'border-t-success-500 bg-success-50/30 dark:bg-success-900/10',
  };

  const headerColor: Record<StatusTarefa, string> = {
    'não iniciado': 'text-surface-600 dark:text-surface-400',
    'em andamento': 'text-primary-600 dark:text-primary-400',
    'concluído': 'text-success-600 dark:text-success-400',
  };

  const listaAtual = status === 'concluído' ? [] : tarefas;
  const listaConcluidas = status === 'concluído' ? concluidas : [];
  const totalVisivel = listaAtual.length + (mostrarConcluidas ? listaConcluidas.length : 0);

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col rounded-2xl border-t-4 border border-surface-200 dark:border-surface-700
        ${colorMap[status]}
        ${isOver ? 'ring-2 ring-primary-400 ring-offset-1' : ''}
        transition-all min-h-[200px]
      `}
    >
      {/* Header coluna */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-surface-200 dark:border-surface-700">
        <h3 className={`text-sm font-bold uppercase tracking-wide ${headerColor[status]}`}>{label}</h3>
        <span className="text-xs font-semibold bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300 rounded-full px-2 py-0.5">
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {/* Coluna "não iniciado" e "em andamento": mostra normais */}
        {status !== 'concluído' && (
          <>
            {tarefas.length === 0 && (
              <div className="text-center py-8 text-surface-300 dark:text-surface-600 text-xs">
                Arraste tarefas aqui
              </div>
            )}
            {tarefas.map(t => (
              <DraggableTarefa
                key={t.id}
                tarefa={t}
                meta={metas.find(m => m.id === t.metaId)}
                onEdit={() => onEdit(t)}
                onDelete={() => onDelete(t.id)}
                onMover={ns => onMover(t.id, ns)}
                onReabrir={() => onReabrir(t.id)}
              />
            ))}
          </>
        )}

        {/* Coluna "concluído": mostra toggle + lista */}
        {status === 'concluído' && (
          <>
            {listaConcluidas.length === 0 && (
              <div className="text-center py-8 text-surface-300 dark:text-surface-600 text-xs">
                Nenhuma tarefa concluída
              </div>
            )}
            {listaConcluidas.length > 0 && (
              <button
                onClick={() => setMostrarConcluidas(v => !v)}
                className="w-full flex items-center justify-center gap-2 text-xs text-surface-500 dark:text-surface-400 hover:text-success-600 dark:hover:text-success-400 py-2 rounded-lg hover:bg-success-50 dark:hover:bg-success-900/20 transition-colors"
              >
                {mostrarConcluidas ? <EyeOff size={12} /> : <Eye size={12} />}
                {mostrarConcluidas ? 'Ocultar' : `Ver concluídas (${listaConcluidas.length})`}
              </button>
            )}
            {mostrarConcluidas && listaConcluidas.map(t => (
              <DraggableTarefa
                key={t.id}
                tarefa={t}
                meta={metas.find(m => m.id === t.metaId)}
                onEdit={() => onEdit(t)}
                onDelete={() => onDelete(t.id)}
                onMover={ns => onMover(t.id, ns)}
                onReabrir={() => onReabrir(t.id)}
              />
            ))}
          </>
        )}
      </div>

      {/* Drop zone visual para concluído */}
      {status !== 'concluído' && totalVisivel === 0 && (
        <div className="px-3 pb-3">
          <div className="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-xl h-16 flex items-center justify-center">
            <span className="text-[11px] text-surface-300 dark:text-surface-600">Solte aqui</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Página principal ----
export function PlanoAcaoPage() {
  const { data, setData } = useApp();
  const location = useLocation();

  const [filtro, setFiltro] = useState<FiltroAtivo>('todos');
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null);
  const [form, setForm] = useState<FormTarefa>(tarefaVazia());
  const [erros, setErros] = useState<Record<string, string>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Ler parâmetros da URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const f = params.get('filtro');
    const faixa = params.get('faixa');
    if (f === 'atrasadas') setFiltro('atrasadas');
    else if (faixa && faixaList.includes(faixa as FaixaTarefa)) setFiltro(faixa as FaixaTarefa);
  }, [location.search]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const abrirNova = () => {
    setForm(tarefaVazia());
    setTarefaEditando(null);
    setErros({});
    setModalAberto(true);
  };

  const abrirEditar = (tarefa: Tarefa) => {
    setForm({
      titulo: tarefa.titulo,
      metaId: tarefa.metaId,
      categoria: tarefa.categoria,
      prazo: tarefa.prazo,
      tempoEstimado: tarefa.tempoEstimado,
      faixa: tarefa.faixa,
      faixaManual: tarefa.faixaManual ?? false,
      status: tarefa.status,
      energiaNecessaria: tarefa.energiaNecessaria,
      observacoes: tarefa.observacoes,
      tipoAcao: tarefa.tipoAcao ?? 'eventual',
      periodicidade: tarefa.periodicidade,
      intervaloDias: tarefa.intervaloDias,
      tempoMinimoMinutos: tarefa.tempoMinimoMinutos,
      dataProximaOcorrencia: tarefa.dataProximaOcorrencia ?? null,
      ultimaReabertura: tarefa.ultimaReabertura ?? null,
    });
    setTarefaEditando(tarefa);
    setErros({});
    setModalAberto(true);
  };

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.titulo.trim()) e.titulo = 'Título é obrigatório';
    if (!form.prazo) e.prazo = 'Prazo é obrigatório';
    if (form.tipoAcao === 'rotineira' && !form.periodicidade) e.periodicidade = 'Periodicidade é obrigatória';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = useCallback(() => {
    if (!validar()) return;
    setData(d => {
      const metaVinc = d.metas.find(m => m.id === form.metaId) ?? null;
      const faixaFinal: FaixaTarefa = form.faixaManual
        ? form.faixa
        : calcularFaixaAutomaticaTarefa(form as Tarefa, metaVinc);

      // Calcular próxima ocorrência se rotineira + prazo informado
      const proxOcorrencia = form.tipoAcao === 'rotineira' && form.periodicidade && form.prazo
        ? (form.dataProximaOcorrencia ?? calcularProximaOcorrencia(form.prazo, form.periodicidade, form.intervaloDias ?? 1))
        : null;

      if (tarefaEditando) {
        const novoStatus = form.status;
        const antiga = d.tarefas.find(t => t.id === tarefaEditando.id);
        const dataConclusao = novoStatus === 'concluído' ? (antiga?.dataConclusao ?? hojeISO()) : null;
        return {
          ...d,
          tarefas: d.tarefas.map(t =>
            t.id === tarefaEditando.id ? {
              ...t, ...form, faixa: faixaFinal, dataConclusao,
              dataProximaOcorrencia: proxOcorrencia,
            } : t
          ),
          metas: novoStatus === 'concluído'
            ? d.metas.map(m => form.metaId === m.id ? { ...m, dataUltimaAcao: hojeISO() } : m)
            : d.metas,
        };
      }
      const nova: Tarefa = {
        id: gerarId(),
        ...form,
        faixa: faixaFinal,
        dataCriacao: hojeISO(),
        dataConclusao: form.status === 'concluído' ? hojeISO() : null,
        dataProximaOcorrencia: proxOcorrencia,
      };
      return { ...d, tarefas: [...d.tarefas, nova] };
    });
    setModalAberto(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, tarefaEditando, setData]);

  const excluir = (id: string) => {
    if (!confirm('Excluir esta tarefa?')) return;
    setData(d => ({ ...d, tarefas: d.tarefas.filter(t => t.id !== id) }));
  };

  const moverTarefa = useCallback((id: string, novoStatus: StatusTarefa) => {
    setData(d => {
      const tarefa = d.tarefas.find(t => t.id === id);
      if (!tarefa) return d;
      // Se rotineira sendo concluída, calcular próxima ocorrência
      const proxOcorrencia = novoStatus === 'concluído' && tarefa.tipoAcao === 'rotineira' && tarefa.periodicidade
        ? calcularProximaOcorrencia(hojeISO(), tarefa.periodicidade, tarefa.intervaloDias ?? 1)
        : tarefa.dataProximaOcorrencia ?? null;
      return {
        ...d,
        tarefas: d.tarefas.map(t => {
          if (t.id !== id) return t;
          const dataConclusao = novoStatus === 'concluído' ? hojeISO() : null;
          return { ...t, status: novoStatus, dataConclusao, dataProximaOcorrencia: proxOcorrencia };
        }),
        metas: novoStatus === 'concluído'
          ? d.metas.map(m => {
            const t = d.tarefas.find(t => t.id === id);
            return t?.metaId === m.id ? { ...m, dataUltimaAcao: hojeISO() } : m;
          })
          : d.metas,
      };
    });
  }, [setData]);

  const reabrirTarefa = useCallback((id: string) => {
    setData(d => ({
      ...d,
      tarefas: d.tarefas.map(t => {
        if (t.id !== id) return t;
        const proxOcorrencia = t.tipoAcao === 'rotineira' && t.periodicidade
          ? calcularProximaOcorrencia(hojeISO(), t.periodicidade, t.intervaloDias ?? 1)
          : null;
        return {
          ...t,
          status: 'não iniciado' as const,
          dataConclusao: null,
          ultimaReabertura: hojeISO(),
          dataProximaOcorrencia: proxOcorrencia,
        };
      }),
    }));
  }, [setData]);

  const onDragStart = (e: DragStartEvent) => setActiveDragId(e.active.id as string);

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over) return;
    const novoStatus = over.id as StatusTarefa;
    if (!statusList.includes(novoStatus)) return;
    const tarefa = data.tarefas.find(t => t.id === active.id);
    if (!tarefa || tarefa.status === novoStatus) return;
    moverTarefa(tarefa.id, novoStatus);
  };

  // Filtrar tarefas
  const tarefasFiltradas = (() => {
    let ts = data.tarefas;
    if (busca) ts = ts.filter(t => t.titulo.toLowerCase().includes(busca.toLowerCase()));
    switch (filtro) {
      case 'hoje': return ts.filter(t => eHoje(t.prazo));
      case 'semana': return ts.filter(t => eSemanaAtual(t.prazo));
      case 'atrasadas': return ts.filter(t => eAtrasada(t.prazo) && t.status !== 'concluído');
      case 'urgente':
      case 'alto impacto':
      case 'médio impacto':
      case 'baixo impacto':
        return ts.filter(t => t.faixa === filtro);
      default: return ts;
    }
  })();

  // Separar ativas de concluídas para o kanban
  const porStatus = (s: StatusTarefa) => tarefasFiltradas.filter(t => t.status === s && s !== 'concluído');
  const todasConcluidas = tarefasFiltradas.filter(t => t.status === 'concluído');

  const filtroBotoes: { id: FiltroAtivo; label: string; badge?: number }[] = [
    { id: 'todos', label: 'Todas' },
    { id: 'hoje', label: 'Hoje', badge: data.tarefas.filter(t => eHoje(t.prazo) && t.status !== 'concluído').length },
    { id: 'semana', label: 'Semana' },
    { id: 'atrasadas', label: 'Atrasadas', badge: data.tarefas.filter(t => eAtrasada(t.prazo) && t.status !== 'concluído').length },
    { id: 'urgente', label: 'UG' },
    { id: 'alto impacto', label: 'AI' },
    { id: 'médio impacto', label: 'MI' },
    { id: 'baixo impacto', label: 'BI' },
  ];

  const activeDragTarefa = activeDragId ? data.tarefas.find(t => t.id === activeDragId) : null;

  const colunas: { status: StatusTarefa; label: string }[] = [
    { status: 'não iniciado', label: 'Não Iniciado' },
    { status: 'em andamento', label: 'Em Andamento' },
    { status: 'concluído', label: 'Concluído' },
  ];

  const pendentes = data.tarefas.filter(t => t.status !== 'concluído').length;

  const dispHoje = useMemo(
    () => calcularDisponibilidadeDia(hojeISO(), data.eventosAgenda),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.eventosAgenda]
  );

  const tarefasHoje = data.tarefas.filter(t => t.status !== 'concluído' && t.prazo === hojeISO());
  const minutosPlanejadasHoje = tarefasHoje.reduce((acc, t) => acc + t.tempoEstimado, 0);
  const saldo = dispHoje.minutosDisponiveis - minutosPlanejadasHoje;
  const temAgenda = data.eventosAgenda.length > 0;

  // Resumo rotinas
  const totalRotineiras = data.tarefas.filter(t => t.tipoAcao === 'rotineira').length;
  const rotineirasAtivas = data.tarefas.filter(t => t.tipoAcao === 'rotineira' && t.status !== 'concluído').length;
  const rotineirasConcluidas = data.tarefas.filter(t => t.tipoAcao === 'rotineira' && t.status === 'concluído').length;

  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">Plano de Ação</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400">{pendentes} tarefa{pendentes !== 1 ? 's' : ''} em aberto</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={abrirNova}>Nova Tarefa</Button>
      </div>

      {/* Painel de disponibilidade */}
      <div className={`rounded-2xl border p-4 flex flex-wrap items-center gap-4 ${
        !temAgenda
          ? 'bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700'
          : saldo < 0
          ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-700/50'
          : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-700/50'
      }`}>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${temAgenda ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-surface-100 dark:bg-surface-700'}`}>
            <Clock size={18} className={temAgenda ? 'text-emerald-600 dark:text-emerald-400' : 'text-surface-400'} />
          </div>
          <div>
            <p className="text-xs text-surface-400 dark:text-surface-500">Disponível hoje</p>
            <p className="text-lg font-extrabold text-surface-900 dark:text-white">{fmtMin(dispHoje.minutosDisponiveis)}</p>
          </div>
        </div>
        <div className="hidden sm:block w-px h-10 bg-surface-200 dark:bg-surface-700" />
        <div className="flex-shrink-0">
          <p className="text-xs text-surface-400 dark:text-surface-500">Ocupado</p>
          <p className="text-sm font-bold text-red-600 dark:text-red-400">{fmtMin(dispHoje.minutosOcupados)}</p>
        </div>
        <div className="flex-shrink-0">
          <p className="text-xs text-surface-400 dark:text-surface-500">Janela útil</p>
          <p className="text-sm font-bold text-surface-700 dark:text-surface-200">{dispHoje.inicioJanela} – {dispHoje.fimJanela}</p>
        </div>
        <div className="flex-shrink-0">
          <p className="text-xs text-surface-400 dark:text-surface-500">Eventos</p>
          <p className="text-sm font-bold text-surface-700 dark:text-surface-200">{dispHoje.eventos.length}</p>
        </div>
        <div className="flex-shrink-0">
          <p className="text-xs text-surface-400 dark:text-surface-500">Tarefas para hoje</p>
          <p className="text-sm font-bold text-surface-700 dark:text-surface-200">{fmtMin(minutosPlanejadasHoje)}</p>
        </div>
        <div className="flex-shrink-0">
          <p className="text-xs text-surface-400 dark:text-surface-500">Saldo</p>
          <p className={`text-sm font-extrabold ${saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {saldo >= 0 ? '+' : ''}{fmtMin(Math.abs(saldo))}
          </p>
        </div>
        <div className="flex-1 min-w-[200px]">
          {!temAgenda ? (
            <div className="flex items-center gap-1.5 text-xs text-surface-400 dark:text-surface-500">
              <Zap size={12} />
              <span>Conecte sua agenda em <strong>Agenda e Tempo</strong> para calcular disponibilidade real.</span>
            </div>
          ) : saldo < 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle size={12} className="flex-shrink-0" />
              <span>Você planejou mais tarefas do que cabe no seu dia. Revise as prioridades.</span>
            </div>
          ) : dispHoje.minutosDisponiveis > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              <Zap size={12} className="flex-shrink-0" />
              <span>Há {fmtMin(saldo)} disponíveis para novas ações hoje.</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Resumo de rotinas */}
      {totalRotineiras > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-xl px-4 py-2.5">
          <RefreshCw size={14} className="text-violet-600 dark:text-violet-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">Rotinas:</span>
          <span className="text-xs text-violet-600 dark:text-violet-400">
            {rotineirasAtivas} ativa{rotineirasAtivas !== 1 ? 's' : ''} · {rotineirasConcluidas} concluída{rotineirasConcluidas !== 1 ? 's' : ''} · {totalRotineiras} total
          </span>
        </div>
      )}

      {/* Resumo de faixas + alerta UG */}
      {(() => {
        const pendentesAll = data.tarefas.filter(t => t.status !== 'concluído');
        const contagemFaixa = (f: FaixaTarefa) => pendentesAll.filter(t => {
          const meta = data.metas.find(m => m.id === t.metaId) ?? null;
          const faixaEfetiva = t.faixaManual ? t.faixa : calcularFaixaAutomaticaTarefa(t, meta);
          return faixaEfetiva === f;
        }).length;
        const ug = contagemFaixa('urgente');
        const ai = contagemFaixa('alto impacto');
        const mi = contagemFaixa('médio impacto');
        const bi = contagemFaixa('baixo impacto');
        const ugAtrasadas = pendentesAll.filter(t => {
          const meta = data.metas.find(m => m.id === t.metaId) ?? null;
          const faixaEfetiva = t.faixaManual ? t.faixa : calcularFaixaAutomaticaTarefa(t, meta);
          return faixaEfetiva === 'urgente' && t.prazo && eAtrasada(t.prazo);
        }).length;
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {[
                { sigla: 'UG', label: 'Urgente', count: ug, cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-bold' },
                { sigla: 'AI', label: 'Alto Impacto', count: ai, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-semibold' },
                { sigla: 'MI', label: 'Médio Impacto', count: mi, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
                { sigla: 'BI', label: 'Baixo Impacto', count: bi, cls: 'bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400' },
              ].map(({ sigla, label, count, cls }) => (
                <div key={sigla} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs ${cls}`}>
                  <span className="font-bold">{sigla}</span>
                  <span className="opacity-70">{label}</span>
                  <span className="ml-1 font-bold text-sm">{count}</span>
                </div>
              ))}
            </div>
            {ugAtrasadas > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                <AlertTriangle size={13} className="flex-shrink-0" />
                <span className="font-semibold">Existem {ugAtrasadas} tarefa{ugAtrasadas > 1 ? 's' : ''} urgente{ugAtrasadas > 1 ? 's' : ''} atrasada{ugAtrasadas > 1 ? 's' : ''}.</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        {filtroBotoes.map(fb => (
          <button
            key={fb.id}
            onClick={() => setFiltro(fb.id)}
            className={`relative px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${filtro === fb.id
                ? 'bg-primary-600 text-white'
                : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
              }`}
          >
            {fb.label}
            {fb.badge !== undefined && fb.badge > 0 && (
              <span className="ml-1 bg-danger-600 text-white text-[10px] rounded-full px-1.5 py-0.5">{fb.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          type="text"
          placeholder="Buscar tarefa..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Kanban */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {colunas.map(col => (
            <KanbanColuna
              key={col.status}
              status={col.status}
              label={col.label}
              tarefas={porStatus(col.status)}
              concluidas={todasConcluidas}
              metas={data.metas}
              count={col.status === 'concluído' ? todasConcluidas.length : porStatus(col.status).length}
              onEdit={abrirEditar}
              onDelete={excluir}
              onMover={moverTarefa}
              onReabrir={reabrirTarefa}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDragTarefa && (
            <TarefaCard
              tarefa={activeDragTarefa}
              meta={data.metas.find(m => m.id === activeDragTarefa.metaId)}
              onEdit={() => {}}
              onDelete={() => {}}
              onMover={() => {}}
              isDragging
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Modal nova/editar tarefa */}
      <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} title={tarefaEditando ? 'Editar Tarefa' : 'Nova Tarefa'} size="lg">
        <div className="space-y-4">
          {!form.metaId && (
            <div className="flex items-center gap-2 bg-warning-50 dark:bg-warning-600/10 border border-warning-200 dark:border-warning-600/30 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="text-warning-600 dark:text-warning-400" />
              <p className="text-xs text-warning-700 dark:text-warning-300">Esta tarefa não está conectada a nenhuma meta.</p>
            </div>
          )}

          <Input
            id="tarefa-titulo"
            label="Título da tarefa"
            required
            value={form.titulo}
            onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
            error={erros.titulo}
            placeholder="Ex: Estudar inglês por 30 min"
          />

          <Select
            id="tarefa-meta"
            label="Meta vinculada"
            value={form.metaId ?? ''}
            onChange={e => setForm(f => ({ ...f, metaId: e.target.value || null }))}
          >
            <option value="">— Sem meta —</option>
            {data.metas.filter(m => m.status === 'ativa').map(m => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </Select>

          <Select
            id="tarefa-categoria"
            label="Categoria"
            value={form.categoria}
            onChange={e => setForm(f => ({ ...f, categoria: e.target.value as Categoria }))}
          >
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>

          {/* Tipo da ação */}
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Tipo da ação</span>
              <div className="flex gap-2">
                {(['eventual', 'rotineira'] as TipoAcao[]).map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipoAcao: tipo, periodicidade: tipo === 'eventual' ? undefined : f.periodicidade }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      form.tipoAcao === tipo
                        ? tipo === 'rotineira'
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-primary-600 text-white border-primary-600'
                        : 'border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700'
                    }`}
                  >
                    {tipo === 'rotineira' ? <RefreshCw size={13} /> : <Zap size={13} />}
                    {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Campos de rotina */}
            {form.tipoAcao === 'rotineira' && (
              <div className="space-y-3 p-3 bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-xl">
                <Select
                  id="tarefa-periodicidade"
                  label="Periodicidade"
                  required
                  value={form.periodicidade ?? ''}
                  onChange={e => setForm(f => ({ ...f, periodicidade: e.target.value as PeriodicidadeAcao || undefined }))}
                  error={erros.periodicidade}
                >
                  <option value="">— Selecionar —</option>
                  {periodicidadeList.map(p => (
                    <option key={p} value={p}>{labelPeriodicidade(p)}</option>
                  ))}
                </Select>

                {form.periodicidade === 'personalizada' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                      Intervalo (dias): {form.intervaloDias ?? 1}
                    </label>
                    <input
                      type="range" min={1} max={90} step={1}
                      value={form.intervaloDias ?? 1}
                      onChange={e => setForm(f => ({ ...f, intervaloDias: Number(e.target.value) }))}
                      className="w-full accent-violet-600"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Tempo mínimo (min): {form.tempoMinimoMinutos ?? 0} min
                  </label>
                  <input
                    type="range" min={0} max={120} step={5}
                    value={form.tempoMinimoMinutos ?? 0}
                    onChange={e => setForm(f => ({ ...f, tempoMinimoMinutos: Number(e.target.value) || undefined }))}
                    className="w-full accent-violet-600"
                  />
                </div>

                {form.periodicidade && (
                  <DateInputBR
                    id="tarefa-proxima"
                    label="Próxima ocorrência"
                    value={form.dataProximaOcorrencia ?? ''}
                    onChange={iso => setForm(f => ({ ...f, dataProximaOcorrencia: iso || null }))}
                    hint="Deixe vazio para calcular automaticamente"
                  />
                )}
              </div>
            )}
          </div>

          {/* Faixa */}
          <div className="space-y-2">
            {(() => {
              const metaVinc = data.metas.find(m => m.id === form.metaId) ?? null;
              const faixaAuto = calcularFaixaAutomaticaTarefa(form as Tarefa, metaVinc);
              return (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-surface-600 dark:text-surface-300">Faixa de impacto</span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-surface-500 dark:text-surface-400 select-none">
                      <input
                        type="checkbox"
                        checked={!!form.faixaManual}
                        onChange={e => setForm(f => ({ ...f, faixaManual: e.target.checked }))}
                        className="rounded"
                      />
                      Definir manualmente
                    </label>
                  </div>
                  {form.faixaManual ? (
                    <Select
                      id="tarefa-faixa"
                      label=""
                      value={form.faixa}
                      onChange={e => setForm(f => ({ ...f, faixa: e.target.value as FaixaTarefa }))}
                    >
                      {faixaList.map(f => (
                        <option key={f} value={f}>{labelFaixa(f)}</option>
                      ))}
                    </Select>
                  ) : (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs ${corFaixa(faixaAuto)}`}>
                      <span className="font-bold">{siglaFaixa(faixaAuto)}</span>
                      <span>{labelFaixa(faixaAuto)}</span>
                      <span className="opacity-50 ml-1">· automático</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DateInputBR
              id="tarefa-prazo"
              label="Prazo"
              required
              value={form.prazo}
              onChange={iso => setForm(f => ({ ...f, prazo: iso }))}
              error={erros.prazo}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Tempo estimado: {formatarMinutos(form.tempoEstimado)}
              </label>
              <input
                type="range" min={5} max={240} step={5}
                value={form.tempoEstimado}
                onChange={e => setForm(f => ({ ...f, tempoEstimado: Number(e.target.value) }))}
                className="w-full accent-primary-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              id="tarefa-status"
              label="Status"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusTarefa }))}
            >
              {statusList.map(s => (
                <option key={s} value={s}>
                  {s === 'não iniciado' ? 'Não Iniciado' : s === 'em andamento' ? 'Em Andamento' : 'Concluído'}
                </option>
              ))}
            </Select>

            <Select
              id="tarefa-energia"
              label="Energia necessária"
              value={form.energiaNecessaria}
              onChange={e => setForm(f => ({ ...f, energiaNecessaria: e.target.value as NivelEnergia }))}
            >
              {energiaList.map(e => (
                <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
              ))}
            </Select>
          </div>

          <Textarea
            id="tarefa-obs"
            label="Observações"
            value={form.observacoes}
            onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            placeholder="Detalhes, links, referências..."
          />

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvar}>{tarefaEditando ? 'Salvar' : 'Criar tarefa'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
