import { useState, useCallback } from 'react';
import {
  Target, Plus, Pencil, Trash2, CheckCircle, PauseCircle,
  XCircle, AlertTriangle, ChevronDown, ChevronUp, Search
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import type { Meta, Categoria, Prioridade, StatusMeta } from '../types';
import { Card, CardBody } from '../components/Card';
import { Badge } from '../components/Badge';
import { ProgressBar } from '../components/Badge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input, Textarea, Select } from '../components/FormFields';
import {
  corPrioridade, corCategoria, corStatus, formatarData,
  eMetaEmRisco, gerarId, hojeISO
} from '../utils';

const categorias: Categoria[] = ['Profissão', 'Estudos', 'Finanças', 'Projetos', 'Desenvolvimento Pessoal'];
const prioridades: Prioridade[] = ['baixa', 'média', 'alta', 'crítica'];
const statusList: StatusMeta[] = ['ativa', 'pausada', 'concluída', 'cancelada'];

const metaVazia = (): Omit<Meta, 'id' | 'dataCriacao' | 'dataUltimaAcao'> => ({
  nome: '', categoria: 'Projetos', descricao: '', prazoFinal: '',
  prioridade: 'média', status: 'ativa', progresso: 0,
  resultadoEsperado: '', motivo: '',
});

export function MetasPage() {
  const { data, setData } = useApp();
  const [modalAberto, setModalAberto] = useState(false);
  const [metaEditando, setMetaEditando] = useState<Meta | null>(null);
  const [form, setForm] = useState(metaVazia());
  const [expandidaId, setExpandidaId] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('Todas');
  const [filtroStatus, setFiltroStatus] = useState<string>('ativa');
  const [busca, setBusca] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});

  const abrirNova = () => {
    setForm(metaVazia());
    setMetaEditando(null);
    setErros({});
    setModalAberto(true);
  };

  const abrirEditar = (meta: Meta) => {
    setForm({
      nome: meta.nome, categoria: meta.categoria, descricao: meta.descricao,
      prazoFinal: meta.prazoFinal, prioridade: meta.prioridade, status: meta.status,
      progresso: meta.progresso, resultadoEsperado: meta.resultadoEsperado, motivo: meta.motivo,
    });
    setMetaEditando(meta);
    setErros({});
    setModalAberto(true);
  };

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = 'Nome é obrigatório';
    if (!form.prazoFinal) e.prazoFinal = 'Prazo é obrigatório';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = useCallback(() => {
    if (!validar()) return;
    setData(d => {
      if (metaEditando) {
        return {
          ...d,
          metas: d.metas.map(m =>
            m.id === metaEditando.id ? { ...m, ...form, dataUltimaAcao: hojeISO() } : m
          ),
        };
      }
      const nova: Meta = {
        id: gerarId(), ...form, dataCriacao: hojeISO(), dataUltimaAcao: null,
      };
      return { ...d, metas: [...d.metas, nova] };
    });
    setModalAberto(false);
  }, [form, metaEditando, setData]);

  const excluir = (id: string) => {
    if (!confirm('Excluir esta meta? As tarefas vinculadas ficarão sem meta.')) return;
    setData(d => ({ ...d, metas: d.metas.filter(m => m.id !== id) }));
  };

  const alterarStatus = (id: string, status: StatusMeta) => {
    setData(d => ({
      ...d,
      metas: d.metas.map(m =>
        m.id === id ? { ...m, status, dataUltimaAcao: hojeISO() } : m
      ),
    }));
  };

  const metasFiltradas = data.metas
    .filter(m => filtroCategoria === 'Todas' || m.categoria === filtroCategoria)
    .filter(m => filtroStatus === 'Todos' || m.status === filtroStatus)
    .filter(m => m.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">Minhas Metas</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {data.metas.filter(m => m.status === 'ativa').length} metas ativas
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={abrirNova}>Nova Meta</Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Buscar meta..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="Todos">Todos os status</option>
          {statusList.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="Todas">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Lista de metas */}
      {metasFiltradas.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-10">
              <Target size={40} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
              <p className="text-surface-500 dark:text-surface-400">Nenhuma meta encontrada</p>
              <Button className="mt-4" icon={<Plus size={16} />} onClick={abrirNova}>Criar primeira meta</Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {metasFiltradas.map(meta => {
            const emRisco = eMetaEmRisco(meta, data.tarefas);
            const tarefasDaMeta = data.tarefas.filter(t => t.metaId === meta.id);
            const expandida = expandidaId === meta.id;

            return (
              <Card key={meta.id} className="overflow-hidden">
                {/* Linha superior */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {emRisco && meta.status === 'ativa' && (
                          <Badge className="bg-warning-100 text-warning-700 dark:bg-warning-600/20 dark:text-warning-400">
                            ⚠ Em risco
                          </Badge>
                        )}
                        <Badge className={corCategoria(meta.categoria)}>{meta.categoria}</Badge>
                        <Badge className={corPrioridade(meta.prioridade)}>{meta.prioridade}</Badge>
                        <Badge className={corStatus(meta.status)}>{meta.status}</Badge>
                      </div>
                      <h3 className="font-semibold text-surface-900 dark:text-white">{meta.nome}</h3>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                        Prazo: {formatarData(meta.prazoFinal)}
                        {meta.dataUltimaAcao && ` · Última ação: ${formatarData(meta.dataUltimaAcao)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => abrirEditar(meta)} className="p-1.5 rounded-lg text-surface-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => excluir(meta.id)} className="p-1.5 rounded-lg text-surface-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors">
                        <Trash2 size={15} />
                      </button>
                      <button onClick={() => setExpandidaId(expandida ? null : meta.id)} className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
                        {expandida ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>
                  {/* Progresso */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-surface-500 dark:text-surface-400">Progresso</span>
                      <span className="text-xs font-semibold text-surface-700 dark:text-surface-300">{meta.progresso}%</span>
                    </div>
                    <ProgressBar value={meta.progresso} showLabel={false} height="md" />
                  </div>
                  {/* Tarefas resumo */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-surface-400 dark:text-surface-500">
                    <span>{tarefasDaMeta.length} tarefas vinculadas</span>
                    <span>{tarefasDaMeta.filter(t => t.status === 'concluída').length} concluídas</span>
                  </div>
                </div>

                {/* Expansão */}
                {expandida && (
                  <div className="border-t border-surface-200 dark:border-surface-700 px-4 py-4 bg-surface-50 dark:bg-surface-700/30 space-y-3 animate-fade-in">
                    {meta.descricao && (
                      <div>
                        <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">Descrição</p>
                        <p className="text-sm text-surface-700 dark:text-surface-300">{meta.descricao}</p>
                      </div>
                    )}
                    {meta.resultadoEsperado && (
                      <div>
                        <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">Resultado esperado</p>
                        <p className="text-sm text-surface-700 dark:text-surface-300">{meta.resultadoEsperado}</p>
                      </div>
                    )}
                    {meta.motivo && (
                      <div>
                        <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">Por que esta meta?</p>
                        <p className="text-sm text-surface-700 dark:text-surface-300">{meta.motivo}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {meta.status !== 'concluída' && (
                        <Button variant="success" size="sm" icon={<CheckCircle size={14} />} onClick={() => alterarStatus(meta.id, 'concluída')}>
                          Concluir meta
                        </Button>
                      )}
                      {meta.status === 'ativa' && (
                        <Button variant="secondary" size="sm" icon={<PauseCircle size={14} />} onClick={() => alterarStatus(meta.id, 'pausada')}>
                          Pausar
                        </Button>
                      )}
                      {meta.status === 'pausada' && (
                        <Button variant="primary" size="sm" onClick={() => alterarStatus(meta.id, 'ativa')}>
                          Reativar
                        </Button>
                      )}
                      {meta.status !== 'cancelada' && (
                        <Button variant="ghost" size="sm" icon={<XCircle size={14} />} onClick={() => alterarStatus(meta.id, 'cancelada')}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de criar/editar */}
      <Modal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title={metaEditando ? 'Editar Meta' : 'Nova Meta'}
        size="lg"
      >
        <div className="space-y-4">
          <Input id="meta-nome" label="Nome da meta" required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} error={erros.nome} placeholder="Ex: Conseguir emprego nos EUA" />
          <div className="grid grid-cols-2 gap-3">
            <Select id="meta-categoria" label="Categoria" required value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as Categoria }))}>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select id="meta-prioridade" label="Prioridade" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as Prioridade }))}>
              {prioridades.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="meta-prazo" label="Prazo final" required type="date" value={form.prazoFinal} onChange={e => setForm(f => ({ ...f, prazoFinal: e.target.value }))} error={erros.prazoFinal} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Progresso: {form.progresso}%</label>
              <input type="range" min={0} max={100} value={form.progresso} onChange={e => setForm(f => ({ ...f, progresso: Number(e.target.value) }))} className="w-full accent-primary-600" />
            </div>
          </div>
          <Select id="meta-status" label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusMeta }))}>
            {statusList.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </Select>
          <Textarea id="meta-desc" label="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva a meta em detalhes..." />
          <Textarea id="meta-resultado" label="Resultado esperado" value={form.resultadoEsperado} onChange={e => setForm(f => ({ ...f, resultadoEsperado: e.target.value }))} placeholder="Como você saberá que alcançou a meta?" />
          <Textarea id="meta-motivo" label="Por que esta meta é importante?" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Qual o motivo e impacto desta meta na sua vida?" />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvar}>{metaEditando ? 'Salvar alterações' : 'Criar meta'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
