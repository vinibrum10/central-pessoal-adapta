import { useState, useMemo } from 'react';
import {
  BookOpen, Search, RefreshCw, CheckCircle, Archive,
  ExternalLink, Plus, AlertCircle, Briefcase, Cpu,
  FileText, Link, File, Star, Clock, Filter,
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import type { LeituraDiaria, TipoLeitura, StatusLeitura } from '../types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Select } from '../components/FormFields';
import { gerarId, hojeISO } from '../utils';
import { isDriveConfigurado, getMensagemDriveNaoConfigurado, sincronizarLeiturasDrive } from '../services/googleDrive';
import { leituraRepository } from '../repositories/leituraRepository';
import { useAuth } from '../contexts/AuthContext';

type FiltroLeitura = 'todos' | StatusLeitura | TipoLeitura | 'importante';

const tipoIcons: Record<TipoLeitura, typeof BookOpen> = {
  vaga: Briefcase,
  tecnologia: Cpu,
  artigo: FileText,
  documento: File,
  link: Link,
  geral: BookOpen,
};

const tipoLabels: Record<TipoLeitura, string> = {
  vaga: 'Vaga', tecnologia: 'Tecnologia', artigo: 'Artigo',
  documento: 'Documento', link: 'Link', geral: 'Geral',
};

const tipoColors: Record<TipoLeitura, string> = {
  vaga: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  tecnologia: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  artigo: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  documento: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  link: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300',
  geral: 'bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400',
};

// ---- Card de leitura ----
function LeituraCard({
  item, onLido, onArquivar, onTarefa,
}: {
  item: LeituraDiaria;
  onLido: () => void;
  onArquivar: () => void;
  onTarefa: () => void;
}) {
  const Icon = tipoIcons[item.tipo];
  const lido = item.status === 'lido';
  const arquivado = item.status === 'arquivado';

  return (
    <div className={`bg-white dark:bg-surface-800 rounded-xl border p-4 space-y-3 transition-all
      ${arquivado ? 'opacity-50' : lido ? 'border-success-200 dark:border-success-800' : 'border-surface-200 dark:border-surface-700'}
    `}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tipoColors[item.tipo]}`}>
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <p className={`text-sm font-semibold leading-snug ${lido ? 'line-through text-surface-400' : 'text-surface-900 dark:text-white'}`}>
              {item.titulo}
            </p>
            {item.prioridade === 'importante' && (
              <Star size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tipoColors[item.tipo]}`}>
              {tipoLabels[item.tipo]}
            </span>
            <span className="text-[10px] text-surface-400 dark:text-surface-500">{item.categoria}</span>
            <span className="text-[10px] text-surface-400 dark:text-surface-500 flex items-center gap-1">
              <Clock size={9} />
              {item.dataCriacao}
            </span>
            {item.origem === 'drive' && (
              <span className="text-[10px] text-surface-400 dark:text-surface-500">Drive</span>
            )}
          </div>
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-400 hover:text-primary-600 transition-colors flex-shrink-0"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {/* Resumo */}
      {item.resumo && (
        <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed line-clamp-2">
          {item.resumo}
        </p>
      )}

      {/* Ações */}
      <div className="flex items-center gap-2 flex-wrap">
        {!lido && !arquivado && (
          <button
            onClick={onLido}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 hover:bg-success-100 dark:hover:bg-success-900/30 border border-success-200 dark:border-success-800 transition-colors"
          >
            <CheckCircle size={12} />
            Marcar como lido
          </button>
        )}
        {lido && (
          <span className="flex items-center gap-1 text-xs text-success-600 dark:text-success-400">
            <CheckCircle size={12} /> Lido
          </span>
        )}
        <button
          onClick={onTarefa}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 border border-primary-200 dark:border-primary-800 transition-colors"
        >
          <Plus size={12} />
          Transformar em tarefa
        </button>
        {!arquivado && (
          <button
            onClick={onArquivar}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          >
            <Archive size={12} />
            Arquivar
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Página principal ----
export function LeituraDiariaPage() {
  const { data, setData } = useApp();
  const { user } = useAuth();

  const [filtro, setFiltro] = useState<FiltroLeitura>('todos');
  const [busca, setBusca] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [msgSync, setMsgSync] = useState('');
  const [modalTarefaAberto, setModalTarefaAberto] = useState(false);
  const [leituraParaTarefa, setLeituraParaTarefa] = useState<LeituraDiaria | null>(null);
  const [metaIdTarefa, setMetaIdTarefa] = useState<string>('');
  const [erroPadrao] = useState('');

  const leituras = data.leiturasDiarias ?? [];

  const hoje = hojeISO();
  const kpis = useMemo(() => ({
    pendentes: leituras.filter(l => l.status === 'pendente').length,
    lidosHoje: leituras.filter(l => l.status === 'lido' && l.dataLeitura === hoje).length,
    vagas: leituras.filter(l => l.tipo === 'vaga' && l.status !== 'arquivado').length,
    tecnologia: leituras.filter(l => l.tipo === 'tecnologia' && l.status !== 'arquivado').length,
    importantes: leituras.filter(l => l.prioridade === 'importante' && l.status !== 'arquivado').length,
  }), [leituras, hoje]);

  const listaFiltrada = useMemo(() => {
    let lista = leituras;
    if (busca) lista = lista.filter(l => l.titulo.toLowerCase().includes(busca.toLowerCase()));
    switch (filtro) {
      case 'pendente': return lista.filter(l => l.status === 'pendente');
      case 'lido': return lista.filter(l => l.status === 'lido');
      case 'arquivado': return lista.filter(l => l.status === 'arquivado');
      case 'importante': return lista.filter(l => l.prioridade === 'importante');
      case 'vaga': case 'tecnologia': case 'artigo': case 'documento': case 'link': case 'geral':
        return lista.filter(l => l.tipo === filtro && l.status !== 'arquivado');
      default: return lista.filter(l => l.status !== 'arquivado');
    }
  }, [leituras, busca, filtro]);

  const marcarLido = (id: string) => {
    setData(d => ({
      ...d,
      leiturasDiarias: (d.leiturasDiarias ?? []).map(l =>
        l.id === id ? { ...l, status: 'lido' as StatusLeitura, dataLeitura: hoje } : l
      ),
    }));
    if (user) leituraRepository.atualizar({ id, status: 'lido', dataLeitura: hoje }).catch(() => {});
  };

  const arquivar = (id: string) => {
    setData(d => ({
      ...d,
      leiturasDiarias: (d.leiturasDiarias ?? []).map(l =>
        l.id === id ? { ...l, status: 'arquivado' as StatusLeitura } : l
      ),
    }));
    if (user) leituraRepository.atualizar({ id, status: 'arquivado' }).catch(() => {});
  };

  const abrirModalTarefa = (l: LeituraDiaria) => {
    setLeituraParaTarefa(l);
    setMetaIdTarefa('');
    setModalTarefaAberto(true);
  };

  const criarTarefaDaLeitura = () => {
    if (!leituraParaTarefa) return;
    const novaTarefa = {
      id: gerarId(),
      titulo: `Ler: ${leituraParaTarefa.titulo}`,
      metaId: metaIdTarefa || null,
      categoria: 'Estudos' as const,
      prazo: hoje,
      tempoEstimado: 30,
      faixa: 'médio impacto' as const,
      faixaManual: false,
      status: 'não iniciado' as const,
      energiaNecessaria: 'média' as const,
      observacoes: leituraParaTarefa.url ? `Link: ${leituraParaTarefa.url}` : '',
      dataCriacao: hoje,
      dataConclusao: null,
      tipoAcao: 'eventual' as const,
      periodicidade: undefined,
      intervaloDias: undefined,
      tempoMinimoMinutos: undefined,
      dataProximaOcorrencia: null,
      ultimaReabertura: null,
    };
    setData(d => ({ ...d, tarefas: [...d.tarefas, novaTarefa] }));
    setModalTarefaAberto(false);
    setLeituraParaTarefa(null);
  };

  const sincronizarDrive = async () => {
    if (!isDriveConfigurado()) {
      setMsgSync(getMensagemDriveNaoConfigurado());
      return;
    }
    setSincronizando(true);
    setMsgSync('');
    try {
      const novosItens = await sincronizarLeiturasDrive();
      // Filtrar duplicados por driveFileId
      const idsExistentes = new Set(leituras.map(l => l.driveFileId).filter(Boolean));
      const novos = novosItens.filter(i => !i.driveFileId || !idsExistentes.has(i.driveFileId));

      if (novos.length > 0) {
        setData(d => ({ ...d, leiturasDiarias: [...(d.leiturasDiarias ?? []), ...novos] }));
        if (user) {
          await leituraRepository.sincronizarDrive(user.id, novos);
        }
        setMsgSync(`${novos.length} novo${novos.length > 1 ? 's itens importados' : ' item importado'} do Drive.`);
      } else {
        setMsgSync('Nenhum item novo encontrado na pasta do Drive.');
      }
    } catch (e) {
      setMsgSync(`Erro: ${(e as Error).message}`);
    }
    setSincronizando(false);
  };

  const adicionarManual = () => {
    const url = prompt('URL do link para adicionar:');
    if (!url) return;
    const titulo = prompt('Título (ou deixe vazio para usar a URL):') ?? url;
    const nova: LeituraDiaria = {
      id: gerarId(),
      origem: 'manual',
      titulo: titulo || url,
      tipo: 'link',
      url,
      categoria: 'Links',
      prioridade: 'normal',
      status: 'pendente',
      dataLeitura: null,
      dataCriacao: hoje,
    };
    setData(d => ({ ...d, leiturasDiarias: [...(d.leiturasDiarias ?? []), nova] }));
    if (user) leituraRepository.criar(user.id, nova).catch(() => {});
  };

  const filtrosBotoes: { id: FiltroLeitura; label: string; badge?: number }[] = [
    { id: 'todos', label: 'Todos', badge: leituras.filter(l => l.status !== 'arquivado').length },
    { id: 'pendente', label: 'Pendentes', badge: kpis.pendentes },
    { id: 'vaga', label: 'Vagas', badge: kpis.vagas },
    { id: 'tecnologia', label: 'Tecnologia', badge: kpis.tecnologia },
    { id: 'artigo', label: 'Artigos' },
    { id: 'documento', label: 'Documentos' },
    { id: 'link', label: 'Links' },
    { id: 'importante', label: 'Importantes', badge: kpis.importantes },
    { id: 'lido', label: 'Lidos' },
    { id: 'arquivado', label: 'Arquivados' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">Leitura Diária</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400">Conteúdos importantes para ler e revisar todos os dias.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Plus size={15} />} onClick={adicionarManual} size="sm">
            Adicionar
          </Button>
          {isDriveConfigurado() ? (
            <Button icon={<RefreshCw size={15} className={sincronizando ? 'animate-spin' : ''} />} onClick={sincronizarDrive} loading={sincronizando} size="sm">
              Sincronizar Drive
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => window.location.href = '/configuracoes'}>
              Configurar Drive
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Pendentes', value: kpis.pendentes, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10' },
          { label: 'Lidos hoje', value: kpis.lidosHoje, color: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/10' },
          { label: 'Vagas', value: kpis.vagas, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/10' },
          { label: 'Tecnologia', value: kpis.tecnologia, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10' },
          { label: 'Importantes', value: kpis.importantes, color: 'text-amber-500 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/10' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Aviso Drive não configurado */}
      {!isDriveConfigurado() && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/40 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
            <p className="font-semibold">Google Drive não configurado</p>
            <p>{getMensagemDriveNaoConfigurado()}</p>
            <p className="text-amber-600 dark:text-amber-400">
              Vá em <strong>Configurações → Google Drive</strong> e informe o ID da pasta.
              Você também pode adicionar leituras manualmente pelo botão "Adicionar" acima.
            </p>
          </div>
        </div>
      )}

      {/* Mensagem sync */}
      {msgSync && (
        <div className={`text-xs px-3 py-2 rounded-lg ${msgSync.startsWith('Erro') ? 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 border border-danger-200 dark:border-danger-800' : 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 border border-success-200 dark:border-success-800'}`}>
          {msgSync}
        </div>
      )}

      {erroPadrao && (
        <div className="text-xs px-3 py-2 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 border border-danger-200 dark:border-danger-800">
          {erroPadrao}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {filtrosBotoes.map(fb => (
          <button
            key={fb.id}
            onClick={() => setFiltro(fb.id)}
            className={`relative flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all
              ${filtro === fb.id
                ? 'bg-primary-600 text-white'
                : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
              }`}
          >
            <Filter size={10} />
            {fb.label}
            {fb.badge !== undefined && fb.badge > 0 && (
              <span className={`ml-0.5 text-[9px] rounded-full px-1.5 ${filtro === fb.id ? 'bg-white/20' : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'}`}>
                {fb.badge}
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
          placeholder="Buscar leituras..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Lista */}
      {listaFiltrada.length === 0 ? (
        <div className="text-center py-16 text-surface-400 dark:text-surface-500">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {leituras.length === 0
              ? 'Nenhuma leitura ainda. Sincronize com o Google Drive ou adicione um link.'
              : 'Nenhum item encontrado para este filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listaFiltrada.map(item => (
            <LeituraCard
              key={item.id}
              item={item}
              onLido={() => marcarLido(item.id)}
              onArquivar={() => arquivar(item.id)}
              onTarefa={() => abrirModalTarefa(item)}
            />
          ))}
        </div>
      )}

      {/* Modal criar tarefa da leitura */}
      <Modal isOpen={modalTarefaAberto} onClose={() => setModalTarefaAberto(false)} title="Transformar em Tarefa" size="md">
        <div className="space-y-4">
          {leituraParaTarefa && (
            <div className="bg-surface-50 dark:bg-surface-700 rounded-lg px-3 py-2 text-sm text-surface-700 dark:text-surface-200">
              <span className="font-medium">Ler:</span> {leituraParaTarefa.titulo}
            </div>
          )}
          <Select
            id="tarefa-meta-leitura"
            label="Meta vinculada (opcional)"
            value={metaIdTarefa}
            onChange={e => setMetaIdTarefa(e.target.value)}
          >
            <option value="">— Sem meta (tarefa avulsa) —</option>
            {data.metas.filter(m => m.status === 'ativa').map(m => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </Select>
          <p className="text-xs text-surface-400 dark:text-surface-500">
            A tarefa será criada como <strong>Eventual · Médio Impacto · Prazo: hoje</strong>.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setModalTarefaAberto(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={criarTarefaDaLeitura}>Criar tarefa</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
