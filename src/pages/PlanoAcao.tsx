import { useState, useCallback } from 'react';
import {
  ListChecks, Plus, Pencil, Trash2, Check, Calendar,
  AlertCircle, Clock, Search, Filter
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import type { Tarefa, Categoria, Prioridade, StatusTarefa, TipoTarefa, NivelEnergia } from '../types';
import { Card, CardBody } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input, Textarea, Select } from '../components/FormFields';
import {
  corPrioridade, corCategoria, corStatus, formatarData,
  formatarMinutos, eAtrasada, eHoje, eSemanaAtual,
  gerarId, hojeISO
} from '../utils';
import { addDays, format } from 'date-fns';

const categorias: Categoria[] = ['Profissão', 'Estudos', 'Finanças', 'Projetos', 'Desenvolvimento Pessoal'];
const prioridades: Prioridade[] = ['baixa', 'média', 'alta', 'crítica'];
const tiposList: TipoTarefa[] = ['diária', 'semanal', 'mensal', 'avulsa'];
const energiaList: NivelEnergia[] = ['baixa', 'média', 'alta'];
const statusList: StatusTarefa[] = ['pendente', 'em andamento', 'concluída', 'reagendada', 'cancelada'];

type Visualizacao = 'hoje' | 'semana' | 'mes' | 'atrasadas' | 'por-meta' | 'por-prioridade';

const tarefaVazia = (): Omit<Tarefa, 'id' | 'dataCriacao' | 'dataConclusao'> => ({
  titulo: '', metaId: null, categoria: 'Projetos', tipo: 'avulsa',
  prazo: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  tempoEstimado: 30, prioridade: 'média', status: 'pendente',
  energiaNecessaria: 'média', observacoes: '',
});

export function PlanoAcaoPage() {
  const { data, setData } = useApp();
  const [visualizacao, setVisualizacao] = useState<Visualizacao>('hoje');
  const [modalAberto, setModalAberto] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null);
  const [form, setForm] = useState(tarefaVazia());
  const [busca, setBusca] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});

  const abrirNova = () => {
    setForm(tarefaVazia());
    setTarefaEditando(null);
    setErros({});
    setModalAberto(true);
  };

  const abrirEditar = (tarefa: Tarefa) => {
    setForm({
      titulo: tarefa.titulo, metaId: tarefa.metaId, categoria: tarefa.categoria,
      tipo: tarefa.tipo, prazo: tarefa.prazo, tempoEstimado: tarefa.tempoEstimado,
      prioridade: tarefa.prioridade, status: tarefa.status,
      energiaNecessaria: tarefa.energiaNecessaria, observacoes: tarefa.observacoes,
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
        return {
          ...d,
          tarefas: d.tarefas.map(t =>
            t.id === tarefaEditando.id ? { ...t, ...form } : t
          ),
        };
      }
      const nova: Tarefa = {
        id: gerarId(), ...form, dataCriacao: hojeISO(), dataConclusao: null,
      };
      return { ...d, tarefas: [...d.tarefas, nova] };
    });
    setModalAberto(false);
  }, [form, tarefaEditando, setData]);

  const excluir = (id: string) => {
    if (!confirm('Excluir esta tarefa?')) return;
    setData(d => ({ ...d, tarefas: d.tarefas.filter(t => t.id !== id) }));
  };

  const concluir = (id: string) => {
    setData(d => ({
      ...d,
      tarefas: d.tarefas.map(t =>
        t.id === id ? { ...t, status: 'concluída', dataConclusao: hojeISO() } : t
      ),
      metas: d.metas.map(m => {
        const tarefa = d.tarefas.find(t => t.id === id);
        if (tarefa?.metaId === m.id) return { ...m, dataUltimaAcao: hojeISO() };
        return m;
      }),
    }));
  };

  const reagendar = (id: string) => {
    const dias = prompt('Reagendar em quantos dias?', '1');
    if (!dias) return;
    const n = parseInt(dias);
    if (isNaN(n) || n < 1) return;
    setData(d => ({
      ...d,
      tarefas: d.tarefas.map(t =>
        t.id === id ? {
          ...t,
          status: 'reagendada',
          prazo: format(addDays(new Date(), n), 'yyyy-MM-dd'),
        } : t
      ),
    }));
  };

  const dividirEmDiarias = (tarefa: Tarefa) => {
    const novaTarefas: Tarefa[] = Array.from({ length: 5 }, (_, i) => ({
      id: gerarId(),
      titulo: `${tarefa.titulo} — Dia ${i + 1}`,
      metaId: tarefa.metaId,
      categoria: tarefa.categoria,
      tipo: 'diária' as TipoTarefa,
      prazo: format(addDays(new Date(), i), 'yyyy-MM-dd'),
      tempoEstimado: Math.ceil(tarefa.tempoEstimado / 5),
      prioridade: tarefa.prioridade,
      status: 'pendente' as StatusTarefa,
      energiaNecessaria: tarefa.energiaNecessaria,
      observacoes: `Dividida de: ${tarefa.titulo}`,
      dataCriacao: hojeISO(),
      dataConclusao: null,
    }));
    if (!confirm(`Dividir "${tarefa.titulo}" em 5 tarefas diárias?`)) return;
    setData(d => ({
      ...d,
      tarefas: [...d.tarefas, ...novaTarefas],
    }));
  };

  const getTarefasFiltradas = () => {
    let tarefas = data.tarefas;
    if (busca) tarefas = tarefas.filter(t => t.titulo.toLowerCase().includes(busca.toLowerCase()));

    switch (visualizacao) {
      case 'hoje': return tarefas.filter(t => eHoje(t.prazo) && t.status !== 'concluída' && t.status !== 'cancelada');
      case 'semana': return tarefas.filter(t => eSemanaAtual(t.prazo) && t.status !== 'concluída' && t.status !== 'cancelada');
      case 'mes': {
        const m = new Date().getMonth(); const a = new Date().getFullYear();
        return tarefas.filter(t => {
          const d = new Date(t.prazo);
          return d.getMonth() === m && d.getFullYear() === a && t.status !== 'concluída' && t.status !== 'cancelada';
        });
      }
      case 'atrasadas': return tarefas.filter(t => eAtrasada(t.prazo) && t.status !== 'concluída' && t.status !== 'cancelada');
      case 'por-prioridade': return [...tarefas]
        .filter(t => t.status !== 'concluída' && t.status !== 'cancelada')
        .sort((a, b) => ['crítica', 'alta', 'média', 'baixa'].indexOf(a.prioridade) - ['crítica', 'alta', 'média', 'baixa'].indexOf(b.prioridade));
      case 'por-meta': return tarefas.filter(t => t.status !== 'concluída' && t.status !== 'cancelada');
      default: return tarefas;
    }
  };

  const tarefasFiltradas = getTarefasFiltradas();

  const metasAgrupadas = visualizacao === 'por-meta'
    ? [...new Set(tarefasFiltradas.map(t => t.metaId ?? 'sem-meta'))]
    : null;

  const renderTarefa = (tarefa: Tarefa) => {
    const meta = data.metas.find(m => m.id === tarefa.metaId);
    const atrasada = eAtrasada(tarefa.prazo);

    return (
      <div
        key={tarefa.id}
        className={`flex items-start gap-3 p-4 rounded-xl border transition-all
          ${atrasada ? 'border-danger-200 dark:border-danger-700 bg-danger-50 dark:bg-danger-900/10' : 'border-surface-200 dark:border-surface-700 hover:border-primary-200 dark:hover:border-primary-700'}
        `}
      >
        <button
          onClick={() => concluir(tarefa.id)}
          className="mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all
            border-surface-300 dark:border-surface-600 hover:border-success-500 hover:bg-success-50 dark:hover:bg-success-900/20"
          title="Concluir tarefa"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {!tarefa.metaId && (
              <Badge className="bg-warning-100 text-warning-700 dark:bg-warning-600/20 dark:text-warning-400">
                ⚠ Sem meta
              </Badge>
            )}
            {atrasada && <Badge className="bg-danger-100 text-danger-700 dark:bg-danger-600/20 dark:text-danger-400">Atrasada</Badge>}
            <Badge className={corCategoria(tarefa.categoria)}>{tarefa.categoria}</Badge>
            <Badge className={corPrioridade(tarefa.prioridade)}>{tarefa.prioridade}</Badge>
            <Badge className={corStatus(tarefa.status)}>{tarefa.status}</Badge>
          </div>
          <p className="font-medium text-surface-900 dark:text-white text-sm">{tarefa.titulo}</p>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-surface-400 dark:text-surface-500">
            {meta && <span className="truncate">{meta.nome}</span>}
            <span className="flex items-center gap-1"><Clock size={11} />{formatarMinutos(tarefa.tempoEstimado)}</span>
            <span className="flex items-center gap-1"><Calendar size={11} />{formatarData(tarefa.prazo)}</span>
          </div>
          {tarefa.observacoes && <p className="text-xs text-surface-400 dark:text-surface-500 mt-1 italic">{tarefa.observacoes}</p>}
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={() => abrirEditar(tarefa)} className="p-1.5 rounded text-surface-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><Pencil size={13} /></button>
          <button onClick={() => reagendar(tarefa.id)} className="p-1.5 rounded text-surface-400 hover:text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-900/20 transition-colors"><Calendar size={13} /></button>
          {tarefa.tipo === 'semanal' && (
            <button onClick={() => dividirEmDiarias(tarefa)} title="Dividir em tarefas diárias" className="p-1.5 rounded text-surface-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"><Filter size={13} /></button>
          )}
          <button onClick={() => excluir(tarefa.id)} className="p-1.5 rounded text-surface-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
    );
  };

  const tabs: { id: Visualizacao; label: string }[] = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'semana', label: 'Semana' },
    { id: 'mes', label: 'Mês' },
    { id: 'atrasadas', label: 'Atrasadas' },
    { id: 'por-meta', label: 'Por Meta' },
    { id: 'por-prioridade', label: 'Por Prioridade' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">Plano de Ação</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {data.tarefas.filter(t => t.status === 'pendente' || t.status === 'em andamento').length} tarefas pendentes
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={abrirNova}>Nova Tarefa</Button>
      </div>

      {/* Tabs de visualização */}
      <div className="flex overflow-x-auto gap-1 pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setVisualizacao(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${visualizacao === tab.id
                ? 'bg-primary-600 text-white'
                : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
              }`}
          >
            {tab.label}
            {tab.id === 'atrasadas' && data.tarefas.filter(t => eAtrasada(t.prazo) && t.status !== 'concluída' && t.status !== 'cancelada').length > 0 && (
              <span className="ml-1 bg-danger-600 text-white text-xs rounded-full px-1.5 py-0.5">
                {data.tarefas.filter(t => eAtrasada(t.prazo) && t.status !== 'concluída' && t.status !== 'cancelada').length}
              </span>
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

      {/* Lista de tarefas */}
      <Card>
        <CardBody className="!px-4 !pb-4">
          {tarefasFiltradas.length === 0 ? (
            <div className="text-center py-10">
              <ListChecks size={40} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
              <p className="text-surface-500 dark:text-surface-400 text-sm">Nenhuma tarefa encontrada</p>
              <Button className="mt-4" size="sm" icon={<Plus size={14} />} onClick={abrirNova}>Criar tarefa</Button>
            </div>
          ) : visualizacao === 'por-meta' && metasAgrupadas ? (
            <div className="space-y-6">
              {metasAgrupadas.map(metaId => {
                const meta = data.metas.find(m => m.id === metaId);
                const tarefasDaVis = tarefasFiltradas.filter(t => (t.metaId ?? 'sem-meta') === metaId);
                return (
                  <div key={metaId}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-primary-600" />
                      <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                        {meta?.nome ?? '⚠ Sem meta vinculada'}
                      </h3>
                      <span className="text-xs text-surface-400">({tarefasDaVis.length})</span>
                    </div>
                    <div className="space-y-2 pl-4">
                      {tarefasDaVis.map(renderTarefa)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {tarefasFiltradas.map(renderTarefa)}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal nova/editar tarefa */}
      <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} title={tarefaEditando ? 'Editar Tarefa' : 'Nova Tarefa'} size="lg">
        <div className="space-y-4">
          {!form.metaId && (
            <div className="flex items-center gap-2 bg-warning-50 dark:bg-warning-600/10 border border-warning-200 dark:border-warning-600/30 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="text-warning-600 dark:text-warning-400" />
              <p className="text-xs text-warning-700 dark:text-warning-300">Esta tarefa não está conectada a nenhuma meta.</p>
            </div>
          )}
          <Input id="tarefa-titulo" label="Título da tarefa" required value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} error={erros.titulo} placeholder="Ex: Estudar inglês por 30 min" />
          <Select id="tarefa-meta" label="Meta vinculada" value={form.metaId ?? ''} onChange={e => setForm(f => ({ ...f, metaId: e.target.value || null }))}>
            <option value="">— Sem meta —</option>
            {data.metas.filter(m => m.status === 'ativa').map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select id="tarefa-categoria" label="Categoria" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as Categoria }))}>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select id="tarefa-tipo" label="Tipo" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoTarefa }))}>
              {tiposList.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="tarefa-prazo" label="Prazo" required type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} error={erros.prazo} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Tempo estimado: {formatarMinutos(form.tempoEstimado)}</label>
              <input type="range" min={5} max={240} step={5} value={form.tempoEstimado} onChange={e => setForm(f => ({ ...f, tempoEstimado: Number(e.target.value) }))} className="w-full accent-primary-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select id="tarefa-prioridade" label="Prioridade" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as Prioridade }))}>
              {prioridades.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </Select>
            <Select id="tarefa-energia" label="Energia necessária" value={form.energiaNecessaria} onChange={e => setForm(f => ({ ...f, energiaNecessaria: e.target.value as NivelEnergia }))}>
              {energiaList.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
            </Select>
          </div>
          <Select id="tarefa-status" label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusTarefa }))}>
            {statusList.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </Select>
          <Textarea id="tarefa-obs" label="Observações" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Detalhes, links, referências..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvar}>{tarefaEditando ? 'Salvar' : 'Criar tarefa'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
