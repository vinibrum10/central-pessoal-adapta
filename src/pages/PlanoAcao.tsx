import { useState, useCallback, useEffect } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragStartEvent, type DragEndEvent
} from '@dnd-kit/core';
import {
  Plus, Pencil, Trash2, Calendar, Clock, Search,
  AlertCircle, GripVertical, ChevronDown, ChevronUp
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import type { Tarefa, Categoria, FaixaTarefa, StatusTarefa, NivelEnergia } from '../types';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input, Textarea, Select } from '../components/FormFields';
import {
  corFaixa, siglaFaixa, labelFaixa, corCategoria,
  formatarData, formatarMinutos, eAtrasada, eHoje,
  eSemanaAtual, gerarId, hojeISO
} from '../utils';
import { addDays, format } from 'date-fns';
import { useLocation } from 'react-router-dom';

const categorias: Categoria[] = ['Profissão', 'Estudos', 'Finanças', 'Projetos', 'Desenvolvimento Pessoal'];
const faixaList: FaixaTarefa[] = ['urgente', 'alto impacto', 'médio impacto', 'baixo impacto'];
const energiaList: NivelEnergia[] = ['baixa', 'média', 'alta'];
const statusList: StatusTarefa[] = ['não iniciado', 'em andamento', 'concluído'];

type FiltroAtivo = 'todos' | 'hoje' | 'semana' | 'atrasadas' | 'por-meta' | FaixaTarefa;

const tarefaVazia = (): Omit<Tarefa, 'id' | 'dataCriacao' | 'dataConclusao'> => ({
  titulo: '',
  metaId: null,
  categoria: 'Projetos',
  prazo: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  tempoEstimado: 30,
  faixa: 'médio impacto',
  status: 'não iniciado',
  energiaNecessaria: 'média',
  observacoes: '',
});

// ---- Card da tarefa (draggable) ----
function TarefaCard({
  tarefa, meta, onEdit, onDelete, onMover, isDragging = false
}: {
  tarefa: Tarefa;
  meta?: { nome: string } | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onMover: (novoStatus: StatusTarefa) => void;
  isDragging?: boolean;
}) {
  const [showMover, setShowMover] = useState(false);
  const atrasada = eAtrasada(tarefa.prazo);

  return (
    <div
      className={`
        bg-white dark:bg-surface-800 rounded-xl border p-3 space-y-2 shadow-sm
        ${isDragging ? 'opacity-50 shadow-lg rotate-1' : ''}
        ${atrasada ? 'border-danger-300 dark:border-danger-600' : 'border-surface-200 dark:border-surface-700'}
        transition-all
      `}
    >
      {/* Faixa + drag handle */}
      <div className="flex items-center gap-2">
        <GripVertical size={14} className="text-surface-300 dark:text-surface-600 flex-shrink-0 cursor-grab active:cursor-grabbing" />
        <Badge className={`text-[10px] px-1.5 py-0.5 ${corFaixa(tarefa.faixa)}`}>
          {siglaFaixa(tarefa.faixa)}
        </Badge>
        {atrasada && (
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

      {/* Botões mover (mobile) */}
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
  status, label, tarefas, metas, count, onEdit, onDelete, onMover
}: {
  status: StatusTarefa;
  label: string;
  tarefas: Tarefa[];
  metas: { id: string; nome: string }[];
  count: number;
  onEdit: (t: Tarefa) => void;
  onDelete: (id: string) => void;
  onMover: (id: string, status: StatusTarefa) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

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
          />
        ))}
      </div>
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
  const [form, setForm] = useState(tarefaVazia());
  const [erros, setErros] = useState<Record<string, string>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Ler parâmetros da URL (de Início.tsx)
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
      status: tarefa.status,
      energiaNecessaria: tarefa.energiaNecessaria,
      observacoes: tarefa.observacoes,
    });
    setTarefaEditando(tarefa);
    setErros({});
    setModalAberto(true);
  };

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.titulo.trim()) e.titulo = 'Título é obrigatório';
    if (!form.prazo) e.prazo = 'Prazo é obrigatório';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = useCallback(() => {
    if (!validar()) return;
    setData(d => {
      if (tarefaEditando) {
        const novoStatus = form.status;
        const antiga = d.tarefas.find(t => t.id === tarefaEditando.id);
        const dataConclusao =
          novoStatus === 'concluído'
            ? (antiga?.dataConclusao ?? hojeISO())
            : null;
        return {
          ...d,
          tarefas: d.tarefas.map(t =>
            t.id === tarefaEditando.id ? { ...t, ...form, dataConclusao } : t
          ),
          metas: novoStatus === 'concluído'
            ? d.metas.map(m => form.metaId === m.id ? { ...m, dataUltimaAcao: hojeISO() } : m)
            : d.metas,
        };
      }
      const nova: Tarefa = {
        id: gerarId(),
        ...form,
        dataCriacao: hojeISO(),
        dataConclusao: form.status === 'concluído' ? hojeISO() : null,
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
    setData(d => ({
      ...d,
      tarefas: d.tarefas.map(t => {
        if (t.id !== id) return t;
        const dataConclusao = novoStatus === 'concluído' ? hojeISO() : null;
        return { ...t, status: novoStatus, dataConclusao };
      }),
      metas: novoStatus === 'concluído'
        ? d.metas.map(m => {
          const t = d.tarefas.find(t => t.id === id);
          return t?.metaId === m.id ? { ...m, dataUltimaAcao: hojeISO() } : m;
        })
        : d.metas,
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

  // Filtrar tarefas para o Kanban
  const tarefasFiltradas = (() => {
    let ts = data.tarefas;
    if (busca) ts = ts.filter(t => t.titulo.toLowerCase().includes(busca.toLowerCase()));
    switch (filtro) {
      case 'hoje': return ts.filter(t => eHoje(t.prazo));
      case 'semana': return ts.filter(t => eSemanaAtual(t.prazo));
      case 'atrasadas': return ts.filter(t => eAtrasada(t.prazo) && t.status !== 'concluído');
      case 'por-meta': return ts;
      case 'urgente':
      case 'alto impacto':
      case 'médio impacto':
      case 'baixo impacto':
        return ts.filter(t => t.faixa === filtro);
      default: return ts;
    }
  })();

  const porStatus = (s: StatusTarefa) => tarefasFiltradas.filter(t => t.status === s);

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
              metas={data.metas}
              count={porStatus(col.status).length}
              onEdit={abrirEditar}
              onDelete={excluir}
              onMover={moverTarefa}
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

          <div className="grid grid-cols-2 gap-3">
            <Select
              id="tarefa-categoria"
              label="Categoria"
              value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value as Categoria }))}
            >
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>

            <Select
              id="tarefa-faixa"
              label="Faixa de impacto"
              value={form.faixa}
              onChange={e => setForm(f => ({ ...f, faixa: e.target.value as FaixaTarefa }))}
            >
              {faixaList.map(f => (
                <option key={f} value={f}>{labelFaixa(f)}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              id="tarefa-prazo"
              label="Prazo"
              required
              type="date"
              value={form.prazo}
              onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
              error={erros.prazo}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Tempo estimado: {formatarMinutos(form.tempoEstimado)}
              </label>
              <input
                type="range"
                min={5}
                max={240}
                step={5}
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
