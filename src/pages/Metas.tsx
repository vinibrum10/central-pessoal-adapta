import { useState, useCallback } from 'react';
import {
  Target, Plus, Pencil, Trash2, CheckCircle, PauseCircle,
  XCircle, ChevronDown, ChevronUp, RefreshCw, Lightbulb,
  AlertTriangle, ArrowRight, Calendar, Zap
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import type { Meta, Categoria, StatusMeta, FrequenciaRevisao } from '../types';
import { Card, CardBody } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input, Textarea, Select } from '../components/FormFields';
import {
  corCategoria, formatarData, gerarId, hojeISO,
  revisaoAtrasada, proximaRevisaoISO, labelFrequencia,
  calcularEficienciaFoco, mensagemEficiencia, corEficiencia, corBarraEficiencia,
} from '../utils';

const categorias: Categoria[] = ['Profissão', 'Estudos', 'Finanças', 'Projetos', 'Desenvolvimento Pessoal'];
const frequencias: FrequenciaRevisao[] = ['semanal', 'quinzenal', 'mensal', 'sob demanda'];

// ---- Formulário de meta ativa ----
type FormAtiva = {
  nome: string;
  grau: number | '';
  categoria: Categoria;
  prazoFinal: string;
  motivo: string;
  resultadoEsperado: string;
  frequenciaRevisao: FrequenciaRevisao;
  status: StatusMeta;
};

const formAtivaVazio = (): FormAtiva => ({
  nome: '',
  grau: '',
  categoria: 'Projetos',
  prazoFinal: '',
  motivo: '',
  resultadoEsperado: '',
  frequenciaRevisao: 'semanal',
  status: 'ativa',
});

// ---- Formulário de ideia futura ----
type FormFutura = {
  nome: string;
  categoria: Categoria;
  motivo: string;
  resultadoEsperado: string;
};

const formFuturaVazia = (): FormFutura => ({
  nome: '',
  categoria: 'Projetos',
  motivo: '',
  resultadoEsperado: '',
});

// ---- Componente badge de grau ----
function GrauBadge({ grau }: { grau: number }) {
  const cor =
    grau >= 9 ? 'bg-danger-600 text-white' :
    grau >= 7 ? 'bg-amber-500 text-white' :
    grau >= 5 ? 'bg-primary-600 text-white' :
    'bg-surface-400 text-white';
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0 shadow-sm ${cor}`}>
      {grau}
    </div>
  );
}

// ---- Indicador de eficiência ----
function EficienciaFoco({ qtd }: { qtd: number }) {
  const ef = calcularEficienciaFoco(qtd);
  const msg = mensagemEficiencia(ef);
  const corTexto = corEficiencia(ef);
  const corBarra = corBarraEficiencia(ef);

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-primary-500" />
          <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">Eficiência de Foco</span>
        </div>
        <span className={`text-2xl font-bold ${corTexto}`}>{ef}%</span>
      </div>
      <div className="w-full h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${corBarra}`}
          style={{ width: `${ef}%` }}
        />
      </div>
      <p className={`text-xs font-medium ${corTexto}`}>{msg}</p>
      <p className="text-xs text-surface-400 dark:text-surface-500">
        {qtd} meta{qtd !== 1 ? 's' : ''} ativa{qtd !== 1 ? 's' : ''} · limite ideal: 3
      </p>
    </div>
  );
}

// ============================================================
export function MetasPage() {
  const { data, setData } = useApp();
  const [aba, setAba] = useState<'ativas' | 'futuro'>('ativas');

  // Modal meta ativa
  const [modalAtivo, setModalAtivo] = useState(false);
  const [metaEditando, setMetaEditando] = useState<Meta | null>(null);
  const [formAtiva, setFormAtiva] = useState<FormAtiva>(formAtivaVazio());
  const [errosAtiva, setErrosAtiva] = useState<Record<string, string>>({});

  // Modal ideia futura
  const [modalFuturo, setModalFuturo] = useState(false);
  const [futuraEditando, setFuturaEditando] = useState<Meta | null>(null);
  const [formFutura, setFormFutura] = useState<FormFuturaVazia>(formFuturaVazia());

  // Modal transformar em ativa
  const [modalTransformar, setModalTransformar] = useState(false);
  const [transformandoMeta, setTransformandoMeta] = useState<Meta | null>(null);
  const [formTransformar, setFormTransformar] = useState<FormAtiva>(formAtivaVazio());
  const [errosTransformar, setErrosTransformar] = useState<Record<string, string>>({});

  // Expansão
  const [expandidaId, setExpandidaId] = useState<string | null>(null);

  const metasAtivas = data.metas.filter(m => m.status === 'ativa').sort((a, b) => b.grau - a.grau);
  const metasFuturo = data.metas.filter(m => m.status === 'planejar futuro');

  // ---- CRUD META ATIVA ----
  const abrirNovaAtiva = () => {
    setFormAtiva(formAtivaVazio());
    setMetaEditando(null);
    setErrosAtiva({});
    setModalAtivo(true);
  };

  const abrirEditarAtiva = (meta: Meta) => {
    setFormAtiva({
      nome: meta.nome,
      grau: meta.grau,
      categoria: meta.categoria,
      prazoFinal: meta.prazoFinal,
      motivo: meta.motivo,
      resultadoEsperado: meta.resultadoEsperado,
      frequenciaRevisao: meta.frequenciaRevisao,
      status: meta.status,
    });
    setMetaEditando(meta);
    setErrosAtiva({});
    setModalAtivo(true);
  };

  const validarAtiva = (form: FormAtiva, ignorarId?: string) => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = 'Título é obrigatório';
    if (form.grau === '' || form.grau === 0) e.grau = 'Grau é obrigatório';
    if (!form.prazoFinal) e.prazoFinal = 'Prazo é obrigatório';
    // Verificar duplicidade de grau apenas entre metas ativas
    if (form.grau !== '' && form.status === 'ativa') {
      const duplicada = data.metas.find(
        m => m.status === 'ativa' && m.grau === Number(form.grau) && m.id !== ignorarId
      );
      if (duplicada) {
        e.grau = `Já existe uma meta ativa com Grau ${form.grau}: "${duplicada.nome}". Escolha outro grau.`;
      }
    }
    return e;
  };

  const salvarAtiva = useCallback(() => {
    const e = validarAtiva(formAtiva, metaEditando?.id);
    if (Object.keys(e).length > 0) { setErrosAtiva(e); return; }
    setData(d => {
      if (metaEditando) {
        return {
          ...d,
          metas: d.metas.map(m =>
            m.id === metaEditando.id
              ? { ...m, ...formAtiva, grau: Number(formAtiva.grau), dataUltimaAcao: hojeISO() }
              : m
          ),
        };
      }
      const nova: Meta = {
        id: gerarId(),
        nome: formAtiva.nome,
        categoria: formAtiva.categoria,
        grau: Number(formAtiva.grau),
        status: formAtiva.status,
        motivo: formAtiva.motivo,
        resultadoEsperado: formAtiva.resultadoEsperado,
        prazoFinal: formAtiva.prazoFinal,
        frequenciaRevisao: formAtiva.frequenciaRevisao,
        dataCriacao: hojeISO(),
        dataUltimaRevisao: null,
        dataUltimaAcao: null,
      };
      return { ...d, metas: [...d.metas, nova] };
    });
    setModalAtivo(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formAtiva, metaEditando, setData, data.metas]);

  // ---- CRUD IDEIA FUTURA ----
  const abrirNovaFutura = () => {
    setFormFutura(formFuturaVazia());
    setFuturaEditando(null);
    setModalFuturo(true);
  };

  const abrirEditarFutura = (meta: Meta) => {
    setFormFutura({
      nome: meta.nome,
      categoria: meta.categoria,
      motivo: meta.motivo,
      resultadoEsperado: meta.resultadoEsperado,
    });
    setFuturaEditando(meta);
    setModalFuturo(true);
  };

  const salvarFutura = useCallback(() => {
    if (!formFutura.nome.trim()) return;
    setData(d => {
      if (futuraEditando) {
        return {
          ...d,
          metas: d.metas.map(m =>
            m.id === futuraEditando.id ? { ...m, ...formFutura } : m
          ),
        };
      }
      const nova: Meta = {
        id: gerarId(),
        nome: formFutura.nome,
        categoria: formFutura.categoria,
        grau: 0,
        status: 'planejar futuro',
        motivo: formFutura.motivo,
        resultadoEsperado: formFutura.resultadoEsperado,
        prazoFinal: '',
        frequenciaRevisao: 'sob demanda',
        dataCriacao: hojeISO(),
        dataUltimaRevisao: null,
        dataUltimaAcao: null,
      };
      return { ...d, metas: [...d.metas, nova] };
    });
    setModalFuturo(false);
  }, [formFutura, futuraEditando, setData]);

  // ---- TRANSFORMAR FUTURA EM ATIVA ----
  const abrirTransformar = (meta: Meta) => {
    setTransformandoMeta(meta);
    setFormTransformar({
      nome: meta.nome,
      grau: '',
      categoria: meta.categoria,
      prazoFinal: '',
      motivo: meta.motivo,
      resultadoEsperado: meta.resultadoEsperado,
      frequenciaRevisao: 'semanal',
      status: 'ativa',
    });
    setErrosTransformar({});
    setModalTransformar(true);
  };

  const confirmarTransformar = useCallback(() => {
    const e = validarAtiva(formTransformar);
    if (Object.keys(e).length > 0) { setErrosTransformar(e); return; }
    setData(d => ({
      ...d,
      metas: d.metas.map(m =>
        m.id === transformandoMeta?.id
          ? {
              ...m,
              nome: formTransformar.nome,
              categoria: formTransformar.categoria,
              grau: Number(formTransformar.grau),
              prazoFinal: formTransformar.prazoFinal,
              motivo: formTransformar.motivo,
              resultadoEsperado: formTransformar.resultadoEsperado,
              frequenciaRevisao: formTransformar.frequenciaRevisao,
              status: 'ativa' as StatusMeta,
              dataUltimaAcao: hojeISO(),
            }
          : m
      ),
    }));
    setModalTransformar(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formTransformar, transformandoMeta, setData, data.metas]);

  // ---- AÇÕES ----
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

  const revisarMeta = (id: string) => {
    setData(d => ({
      ...d,
      metas: d.metas.map(m =>
        m.id === id
          ? { ...m, dataUltimaRevisao: hojeISO(), dataUltimaAcao: hojeISO() }
          : m
      ),
    }));
  };

  // ---- RENDER CARD META ATIVA ----
  const renderMetaAtiva = (meta: Meta) => {
    const atrasada = revisaoAtrasada(meta);
    const tarefasDaMeta = data.tarefas.filter(t => t.metaId === meta.id);
    const concluidas = tarefasDaMeta.filter(t => t.status === 'concluído').length;
    const proxRevISO = proximaRevisaoISO(meta);
    const expandida = expandidaId === meta.id;

    return (
      <div
        key={meta.id}
        className={`bg-white dark:bg-surface-800 rounded-2xl border transition-all overflow-hidden
          ${atrasada ? 'border-warning-300 dark:border-warning-600/50' : 'border-surface-200 dark:border-surface-700'}`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <GrauBadge grau={meta.grau} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {atrasada && (
                  <Badge className="bg-warning-100 text-warning-700 dark:bg-warning-600/20 dark:text-warning-400 text-[10px]">
                    ⚠ Revisão atrasada
                  </Badge>
                )}
                <Badge className={`text-[10px] ${corCategoria(meta.categoria)}`}>{meta.categoria}</Badge>
              </div>
              <h3 className="font-semibold text-surface-900 dark:text-white leading-tight">{meta.nome}</h3>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-surface-400 dark:text-surface-500">
                <span className="flex items-center gap-1">
                  <Calendar size={10} />
                  Prazo: {meta.prazoFinal ? formatarData(meta.prazoFinal) : '—'}
                </span>
                <span>Revisão: {labelFrequencia(meta.frequenciaRevisao)}</span>
                {proxRevISO && (
                  <span className={atrasada ? 'text-warning-600 dark:text-warning-400 font-medium' : ''}>
                    Próxima: {formatarData(proxRevISO)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-surface-400 dark:text-surface-500">
                <span>{tarefasDaMeta.length} tarefa{tarefasDaMeta.length !== 1 ? 's' : ''}</span>
                <span>{concluidas} concluída{concluidas !== 1 ? 's' : ''}</span>
                {meta.dataUltimaRevisao && (
                  <span>Última revisão: {formatarData(meta.dataUltimaRevisao)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => revisarMeta(meta.id)}
                title="Marcar revisão como feita hoje"
                className="p-1.5 rounded-lg text-surface-400 hover:text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20 transition-colors"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => abrirEditarAtiva(meta)}
                className="p-1.5 rounded-lg text-surface-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => excluir(meta.id)}
                className="p-1.5 rounded-lg text-surface-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => setExpandidaId(expandida ? null : meta.id)}
                className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                {expandida ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
        </div>

        {expandida && (
          <div className="border-t border-surface-200 dark:border-surface-700 px-4 py-4 bg-surface-50 dark:bg-surface-700/30 space-y-3">
            {meta.motivo && (
              <div>
                <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 mb-1">Por que esta meta?</p>
                <p className="text-sm text-surface-700 dark:text-surface-300">{meta.motivo}</p>
              </div>
            )}
            {meta.resultadoEsperado && (
              <div>
                <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 mb-1">Resultado esperado</p>
                <p className="text-sm text-surface-700 dark:text-surface-300">{meta.resultadoEsperado}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="success" size="sm" icon={<RefreshCw size={13} />}
                onClick={() => revisarMeta(meta.id)}
              >
                Revisar hoje
              </Button>
              {meta.status === 'ativa' && (
                <Button variant="secondary" size="sm" icon={<PauseCircle size={13} />} onClick={() => alterarStatus(meta.id, 'pausada')}>
                  Pausar
                </Button>
              )}
              {meta.status !== 'concluída' && (
                <Button variant="ghost" size="sm" icon={<CheckCircle size={13} />} onClick={() => alterarStatus(meta.id, 'concluída')}>
                  Concluir
                </Button>
              )}
              <Button variant="ghost" size="sm" icon={<XCircle size={13} />} onClick={() => alterarStatus(meta.id, 'cancelada')}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---- RENDER CARD FUTURA ----
  const renderMetaFutura = (meta: Meta) => (
    <div key={meta.id} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center flex-shrink-0">
          <Lightbulb size={15} className="text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <Badge className={`text-[10px] mb-1 ${corCategoria(meta.categoria)}`}>{meta.categoria}</Badge>
          <h3 className="font-semibold text-surface-900 dark:text-white text-sm leading-tight">{meta.nome}</h3>
          {meta.motivo && (
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1 line-clamp-2">{meta.motivo}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => abrirTransformar(meta)}
            title="Transformar em meta ativa"
            className="p-1.5 rounded-lg text-surface-400 hover:text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20 transition-colors"
          >
            <ArrowRight size={14} />
          </button>
          <button
            onClick={() => abrirEditarFutura(meta)}
            className="p-1.5 rounded-lg text-surface-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => excluir(meta.id)}
            className="p-1.5 rounded-lg text-surface-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  // ---- RENDER FORMULÁRIO META ATIVA (reutilizado em modal criar e transformar) ----
  const renderFormAtiva = (
    form: FormAtiva,
    setForm: (f: FormAtiva) => void,
    erros: Record<string, string>
  ) => (
    <div className="space-y-4">
      <Input
        id="meta-nome"
        label="Título da meta"
        required
        value={form.nome}
        onChange={e => setForm({ ...form, nome: e.target.value })}
        error={erros.nome}
        placeholder="Ex: Conseguir emprego nos EUA"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Grau <span className="text-danger-500">*</span>
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={form.grau}
            onChange={e => setForm({ ...form, grau: e.target.value === '' ? '' : Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ex: 10"
          />
          {erros.grau ? (
            <p className="text-xs text-danger-600 dark:text-danger-400">{erros.grau}</p>
          ) : (
            <p className="text-xs text-surface-400 dark:text-surface-500">Quanto maior, mais atenção esta meta recebe.</p>
          )}
        </div>
        <Select
          id="meta-categoria"
          label="Categoria"
          value={form.categoria}
          onChange={e => setForm({ ...form, categoria: e.target.value as Categoria })}
        >
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          id="meta-prazo"
          label="Prazo final"
          required
          type="date"
          value={form.prazoFinal}
          onChange={e => setForm({ ...form, prazoFinal: e.target.value })}
          error={erros.prazoFinal}
        />
        <Select
          id="meta-freq"
          label="Frequência de revisão"
          value={form.frequenciaRevisao}
          onChange={e => setForm({ ...form, frequenciaRevisao: e.target.value as FrequenciaRevisao })}
        >
          {frequencias.map(f => <option key={f} value={f}>{labelFrequencia(f)}</option>)}
        </Select>
      </div>

      <Textarea
        id="meta-motivo"
        label="Por que esta meta é importante?"
        value={form.motivo}
        onChange={e => setForm({ ...form, motivo: e.target.value })}
        placeholder="Qual o impacto desta meta na sua vida?"
      />

      <Textarea
        id="meta-resultado"
        label="Resultado esperado"
        value={form.resultadoEsperado}
        onChange={e => setForm({ ...form, resultadoEsperado: e.target.value })}
        placeholder="Como você saberá que alcançou a meta?"
      />

      <Select
        id="meta-status"
        label="Status"
        value={form.status}
        onChange={e => setForm({ ...form, status: e.target.value as StatusMeta })}
      >
        <option value="ativa">Ativa</option>
        <option value="pausada">Pausada</option>
        <option value="concluída">Concluída</option>
        <option value="cancelada">Cancelada</option>
      </Select>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">Metas</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {metasAtivas.length} ativas · {metasFuturo.length} no futuro
          </p>
        </div>
        <Button
          icon={<Plus size={16} />}
          onClick={aba === 'ativas' ? abrirNovaAtiva : abrirNovaFutura}
        >
          {aba === 'ativas' ? 'Nova Meta' : 'Nova Ideia'}
        </Button>
      </div>

      {/* Eficiência de Foco */}
      {aba === 'ativas' && <EficienciaFoco qtd={metasAtivas.length} />}

      {/* Abas */}
      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-xl w-fit">
        <button
          onClick={() => setAba('ativas')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === 'ativas'
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
              : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
          }`}
        >
          Metas Ativas
          <span className="ml-2 text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full px-1.5 py-0.5">
            {metasAtivas.length}
          </span>
        </button>
        <button
          onClick={() => setAba('futuro')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === 'futuro'
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
              : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
          }`}
        >
          Planejar para o Futuro
          <span className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full px-1.5 py-0.5">
            {metasFuturo.length}
          </span>
        </button>
      </div>

      {/* ---- ABA METAS ATIVAS ---- */}
      {aba === 'ativas' && (
        <div className="space-y-3">
          {metasAtivas.length === 0 ? (
            <Card>
              <CardBody>
                <div className="text-center py-10">
                  <Target size={40} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                  <p className="text-surface-500 dark:text-surface-400 mb-4">Nenhuma meta ativa</p>
                  <Button icon={<Plus size={16} />} onClick={abrirNovaAtiva}>Criar primeira meta</Button>
                </div>
              </CardBody>
            </Card>
          ) : (
            <>
              {/* Alerta revisões atrasadas */}
              {metasAtivas.some(m => revisaoAtrasada(m)) && (
                <div className="flex items-center gap-3 bg-warning-50 dark:bg-warning-600/10 border border-warning-200 dark:border-warning-600/30 rounded-xl px-4 py-3">
                  <AlertTriangle size={16} className="text-warning-600 dark:text-warning-400 flex-shrink-0" />
                  <p className="text-sm text-warning-700 dark:text-warning-300 font-medium">
                    {metasAtivas.filter(m => revisaoAtrasada(m)).length} meta(s) com revisão atrasada — clique em <RefreshCw size={12} className="inline" /> para registrar a revisão de hoje.
                  </p>
                </div>
              )}
              {metasAtivas.map(renderMetaAtiva)}
            </>
          )}
        </div>
      )}

      {/* ---- ABA PLANEJAR PARA O FUTURO ---- */}
      {aba === 'futuro' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>Planejar para o Futuro</strong> — Ideias e objetivos que ainda não devem consumir sua atenção semanal.
              Elas não entram no cálculo de Eficiência de Foco. Quando o momento chegar, transforme em meta ativa.
            </p>
          </div>

          {metasFuturo.length === 0 ? (
            <Card>
              <CardBody>
                <div className="text-center py-10">
                  <Lightbulb size={40} className="mx-auto text-amber-400 mb-3" />
                  <p className="text-surface-500 dark:text-surface-400 mb-4">Nenhuma ideia futura ainda</p>
                  <Button icon={<Plus size={16} />} onClick={abrirNovaFutura}>Adicionar ideia</Button>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {metasFuturo.map(renderMetaFutura)}
            </div>
          )}
        </div>
      )}

      {/* ============ MODAIS ============ */}

      {/* Modal — criar/editar meta ativa */}
      <Modal
        isOpen={modalAtivo}
        onClose={() => setModalAtivo(false)}
        title={metaEditando ? 'Editar Meta' : 'Nova Meta Ativa'}
        size="lg"
      >
        <div className="space-y-4">
          {renderFormAtiva(formAtiva, setFormAtiva, errosAtiva)}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalAtivo(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarAtiva}>
              {metaEditando ? 'Salvar alterações' : 'Criar meta'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal — criar/editar ideia futura */}
      <Modal
        isOpen={modalFuturo}
        onClose={() => setModalFuturo(false)}
        title={futuraEditando ? 'Editar Ideia' : 'Nova Ideia Futura'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            id="futura-nome"
            label="Título da ideia"
            required
            value={formFutura.nome}
            onChange={e => setFormFutura({ ...formFutura, nome: e.target.value })}
            placeholder="Ex: Aprender espanhol com intensidade"
          />
          <Select
            id="futura-cat"
            label="Categoria"
            value={formFutura.categoria}
            onChange={e => setFormFutura({ ...formFutura, categoria: e.target.value as Categoria })}
          >
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Textarea
            id="futura-motivo"
            label="Por que isso importa?"
            value={formFutura.motivo}
            onChange={e => setFormFutura({ ...formFutura, motivo: e.target.value })}
            placeholder="Por que você quer isso no futuro?"
          />
          <Textarea
            id="futura-result"
            label="Resultado esperado"
            value={formFutura.resultadoEsperado}
            onChange={e => setFormFutura({ ...formFutura, resultadoEsperado: e.target.value })}
            placeholder="Como você saberá que chegou lá?"
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalFuturo(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarFutura}>
              {futuraEditando ? 'Salvar' : 'Adicionar ideia'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal — transformar futura em ativa */}
      <Modal
        isOpen={modalTransformar}
        onClose={() => setModalTransformar(false)}
        title="Transformar em Meta Ativa"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl px-3 py-2">
            <p className="text-xs text-primary-700 dark:text-primary-300">
              Defina o Grau, prazo e frequência de revisão para ativar esta meta.
            </p>
          </div>
          {renderFormAtiva(formTransformar, setFormTransformar, errosTransformar)}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalTransformar(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={confirmarTransformar}>Ativar meta</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Tipo auxiliar usado internamente
type FormFuturaVazia = FormFutura;
