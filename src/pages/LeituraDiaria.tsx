import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BookOpen, Search, RefreshCw, CheckCircle, Archive,
  ExternalLink, Plus, AlertCircle, Briefcase, Cpu,
  FileText, Link, File, Star, Clock, Filter, Eye,
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import type { LeituraDiaria, TipoLeitura, StatusLeitura } from '../types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Select } from '../components/FormFields';
import { gerarId, hojeISO } from '../utils';
import {
  conectarGoogleDrive,
  getDriveConnectionStatus,
  getMensagemDriveNaoConfigurado,
  isDriveConfigurado,
  isDriveConectado,
  prepararGoogleDriveComSessao,
  reconectarGoogleDrive,
  sincronizarLeiturasDrive,
} from '../services/googleDrive';
import { leituraRepository } from '../repositories/leituraRepository';
import { useAuth } from '../contexts/AuthContext';
import { isLeituraDriveLegada } from '../services/leituraLegacy';

type FiltroLeitura = 'todos' | StatusLeitura | TipoLeitura | 'importante';
type FiltroContador = FiltroLeitura;

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

function normalizarTexto(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function camposBusca(item: LeituraDiaria): string {
  return [
    item.titulo,
    item.resumo,
    item.categoria,
    item.tipo,
    item.origem,
    item.mimeType,
    item.pastaOrigem,
    ...(item.tags ?? []),
  ].map(normalizarTexto).join(' ');
}

function leituraCorrespondeFiltro(item: LeituraDiaria, filtro: FiltroContador): boolean {
  const campos = camposBusca(item);
  const naoArquivado = item.status !== 'arquivado';

  switch (filtro) {
    case 'todos':
      return naoArquivado;
    case 'pendente':
      return item.status === 'pendente' && naoArquivado;
    case 'lido':
      return item.status === 'lido';
    case 'arquivado':
      return item.status === 'arquivado';
    case 'importante':
      return item.prioridade === 'importante' && naoArquivado;
    case 'tecnologia':
      return naoArquivado && /\b(tecnologia|tech|ia|ai|programacao|software|framework)\b/.test(campos);
    case 'documento':
      return naoArquivado && (
        item.tipo === 'documento'
        || campos.includes('application/vnd.google-apps.document')
        || campos.includes('application/pdf')
        || campos.includes('text/plain')
        || campos.includes('documento')
        || campos.includes('google-docs')
      );
    case 'link':
      return naoArquivado && (
        item.tipo === 'link'
        || Boolean(item.url && item.origem !== 'drive')
        || campos.includes('link')
      );
    case 'vaga':
      return naoArquivado && /\b(vaga|vagas|emprego|carreira|career|job|linkedin|recrutamento)\b/.test(campos);
    case 'artigo':
      return naoArquivado && (item.tipo === 'artigo' || /\b(artigo|artigos|article|paper|blog|pesquisa)\b/.test(campos));
    case 'geral':
      return naoArquivado && item.tipo === 'geral';
    default:
      return naoArquivado;
  }
}

function contarLeituras(leituras: LeituraDiaria[], filtro: FiltroContador): number {
  return leituras.filter(item => leituraCorrespondeFiltro(item, filtro)).length;
}

// ---- Card de leitura ----
function LeituraCard({
  item, onAbrir, onLido, onImportante, onArquivar, onTarefa,
}: {
  item: LeituraDiaria;
  onAbrir: () => void;
  onLido: () => void;
  onImportante: () => void;
  onArquivar: () => void;
  onTarefa: () => void;
}) {
  const Icon = tipoIcons[item.tipo];
  const lido = item.status === 'lido';
  const arquivado = item.status === 'arquivado';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAbrir();
        }
      }}
      className={`bg-white dark:bg-surface-800 rounded-xl border p-4 space-y-3 transition-all cursor-pointer hover:border-primary-300 hover:shadow-sm dark:hover:border-primary-700
      ${arquivado ? 'opacity-50' : lido ? 'border-success-200 dark:border-success-800' : 'border-surface-200 dark:border-surface-700'}
    `}
    >
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
            onClick={e => e.stopPropagation()}
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
      <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
        <button
          onClick={onAbrir}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-surface-50 dark:bg-surface-700 text-surface-600 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-600 border border-surface-200 dark:border-surface-600 transition-colors"
        >
          <Eye size={12} />
          Ler no SGP
        </button>
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
        {item.prioridade !== 'importante' && !arquivado && (
          <button
            onClick={onImportante}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800 transition-colors"
          >
            <Star size={12} />
            Importante
          </button>
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
  const { user, session, loading: authLoading } = useAuth();

  const [filtro, setFiltro] = useState<FiltroLeitura>('todos');
  const [busca, setBusca] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [msgSync, setMsgSync] = useState('');
  const [ultimaSinc, setUltimaSinc] = useState<string | null>(null);
  const [modalTarefaAberto, setModalTarefaAberto] = useState(false);
  const [leituraParaTarefa, setLeituraParaTarefa] = useState<LeituraDiaria | null>(null);
  const [leituraAbertaId, setLeituraAbertaId] = useState<string | null>(null);
  const [metaIdTarefa, setMetaIdTarefa] = useState<string>('');
  const [erroPadrao] = useState('');

  const leituras = data.leiturasDiarias ?? [];
  const leiturasLegadasDrive = useMemo(() => leituras.filter(isLeituraDriveLegada), [leituras]);
  const leituraAberta = useMemo(
    () => leituras.find(item => item.id === leituraAbertaId) ?? null,
    [leituras, leituraAbertaId],
  );

  const hoje = hojeISO();
  const kpis = useMemo(() => ({
    todos: contarLeituras(leituras, 'todos'),
    pendentes: contarLeituras(leituras, 'pendente'),
    lidos: contarLeituras(leituras, 'lido'),
    arquivados: contarLeituras(leituras, 'arquivado'),
    vagas: contarLeituras(leituras, 'vaga'),
    tecnologia: contarLeituras(leituras, 'tecnologia'),
    documentos: contarLeituras(leituras, 'documento'),
    links: contarLeituras(leituras, 'link'),
    artigos: contarLeituras(leituras, 'artigo'),
    importantes: contarLeituras(leituras, 'importante'),
  }), [leituras]);

  const listaFiltrada = useMemo(() => {
    const termoBusca = normalizarTexto(busca);
    return leituras.filter(item => {
      if (!leituraCorrespondeFiltro(item, filtro)) return false;
      if (!termoBusca) return true;
      return camposBusca(item).includes(termoBusca);
    });
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

  const marcarImportante = (id: string) => {
    setData(d => ({
      ...d,
      leiturasDiarias: (d.leiturasDiarias ?? []).map(l =>
        l.id === id ? { ...l, prioridade: 'importante' as const } : l
      ),
    }));
    if (user) leituraRepository.atualizar({ id, prioridade: 'importante' }).catch(() => {});
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

  const limparLeiturasDriveLegadas = useCallback(async (showFeedback = false) => {
    const removidas = leiturasLegadasDrive;
    setData(d => {
      const leiturasAtuais = d.leiturasDiarias ?? [];
      const filtradas = leiturasAtuais.filter(item => !isLeituraDriveLegada(item));
      if (filtradas.length === leiturasAtuais.length) return d;
      return { ...d, leiturasDiarias: filtradas };
    });
    if (user) {
      await Promise.allSettled([
        ...removidas.map(item => leituraRepository.excluir(item.id)),
        leituraRepository.excluirLegadosDrive(user.id),
      ]);
    }
    if (showFeedback) {
      setMsgSync(removidas.length > 0
        ? `${removidas.length} item${removidas.length > 1 ? 's legados removidos' : ' legado removido'} do Drive antigo.`
        : 'Nenhum item legado do Drive antigo encontrado.');
    }
  }, [leiturasLegadasDrive, setData, user]);

  const sincronizarDrive = useCallback(async (options: { interactive?: boolean; forceReconnect?: boolean } = {}) => {
    if (!isDriveConfigurado()) {
      setMsgSync(getMensagemDriveNaoConfigurado());
      return;
    }
    setSincronizando(true);
    setMsgSync('');
    try {
      if (options.forceReconnect) {
        await reconectarGoogleDrive();
      } else if (options.interactive && !isDriveConectado()) {
        await conectarGoogleDrive();
      }
      const novosItens = await sincronizarLeiturasDrive();
      let novos: LeituraDiaria[] = [];

      setData(d => {
        const leiturasAtuais = d.leiturasDiarias ?? [];
        const existentes = leiturasAtuais.filter(item => !isLeituraDriveLegada(item));
        const idsExistentes = new Set(existentes.map(l => l.driveFileId).filter(Boolean));
        novos = novosItens.filter(i => !i.driveFileId || !idsExistentes.has(i.driveFileId));
        const porDriveId = new Map(novosItens.filter(i => i.driveFileId).map(i => [i.driveFileId, i]));
        const atualizadas = existentes.map(item => {
          const atualizado = item.driveFileId ? porDriveId.get(item.driveFileId) : undefined;
          if (!atualizado) return item;
          return {
            ...item,
            mimeType: atualizado.mimeType ?? item.mimeType,
            contentText: atualizado.contentText ?? item.contentText,
            contentHtml: atualizado.contentHtml ?? item.contentHtml,
            tags: atualizado.tags ?? item.tags,
            pastaOrigem: atualizado.pastaOrigem ?? item.pastaOrigem,
            categoria: atualizado.categoria ?? item.categoria,
          };
        });
        const mudouExistentes = atualizadas.some((item, index) => item !== existentes[index]);
        if (novos.length === 0 && existentes.length === leiturasAtuais.length && !mudouExistentes) return d;
        return { ...d, leiturasDiarias: [...atualizadas, ...novos] };
      });

      if (novos.length > 0) {
        if (user) {
          await leituraRepository.sincronizarDrive(user.id, novos);
        }
        setMsgSync(`${novos.length} novo${novos.length > 1 ? 's itens importados' : ' item importado'} do Drive.`);
      } else {
        setMsgSync(novosItens.length === 0 ? 'Nenhuma leitura encontrada nas pastas oficiais da Leitura Diária.' : 'Nenhum item novo encontrado nas pastas oficiais do Drive.');
      }
      setUltimaSinc(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      // Itens já carregados permanecem visíveis; apenas exibe o erro
      setMsgSync(`Erro: ${(e as Error).message}`);
    }
    setSincronizando(false);
  }, [setData, user]);

  // Auto-sync ao abrir a página, se já estiver conectado e com token válido
  useEffect(() => {
    if (authLoading) return;
    let cancelado = false;
    async function autoSyncDrive() {
      if (!isDriveConfigurado()) return;
      void limparLeiturasDriveLegadas();
      const pronto = await prepararGoogleDriveComSessao(session).catch(() => false);
      if (cancelado) return;
      if (!pronto || !isDriveConectado()) {
        const status = getDriveConnectionStatus();
        setMsgSync(status === 'expirado'
          ? 'Sessão do Google Drive expirada. Clique em "Reconectar" para conceder permissão novamente.'
          : 'Permissão do Google Drive necessária. Clique em "Sincronizar Drive" para conceder acesso.');
        return;
      }
      await sincronizarDrive();
    }
    void autoSyncDrive();
    return () => { cancelado = true; };
  }, [authLoading, session?.access_token, sincronizarDrive, limparLeiturasDriveLegadas]);

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
    { id: 'todos', label: 'Todos', badge: kpis.todos },
    { id: 'pendente', label: 'Pendentes', badge: kpis.pendentes },
    { id: 'vaga', label: 'Vagas', badge: kpis.vagas },
    { id: 'tecnologia', label: 'Tecnologia', badge: kpis.tecnologia },
    { id: 'artigo', label: 'Artigos', badge: kpis.artigos },
    { id: 'documento', label: 'Documentos', badge: kpis.documentos },
    { id: 'link', label: 'Links', badge: kpis.links },
    { id: 'importante', label: 'Importantes', badge: kpis.importantes },
    { id: 'lido', label: 'Lidos', badge: kpis.lidos },
    { id: 'arquivado', label: 'Arquivados', badge: kpis.arquivados },
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
          {leiturasLegadasDrive.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => { void limparLeiturasDriveLegadas(true); }}>
              Limpar itens legados do Drive
            </Button>
          )}
          {isDriveConfigurado() ? (
            <Button icon={<RefreshCw size={15} className={sincronizando ? 'animate-spin' : ''} />} onClick={() => sincronizarDrive({ interactive: true })} loading={sincronizando} size="sm">
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
          { label: 'Lidos', value: kpis.lidos, color: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/10' },
          { label: 'Vagas', value: kpis.vagas, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/10' },
          { label: 'Tecnologia', value: kpis.tecnologia, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10' },
          { label: 'Documentos', value: kpis.documentos, color: 'text-violet-600 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-900/10' },
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

      {/* Status de sincronização */}
      {ultimaSinc && !msgSync && (
        <p className="text-[11px] text-surface-400 dark:text-surface-500">Sincronizado às {ultimaSinc}</p>
      )}
      {msgSync && (
        <div className={`text-xs px-3 py-2 rounded-lg flex items-start gap-2 ${msgSync.startsWith('Erro') || msgSync.includes('expirada') ? 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 border border-danger-200 dark:border-danger-800' : 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 border border-success-200 dark:border-success-800'}`}>
          <span className="flex-1">{msgSync}</span>
          {(msgSync.startsWith('Erro') || msgSync.includes('expirada')) && (
            <button
              onClick={() => { setMsgSync(''); void sincronizarDrive({ interactive: true, forceReconnect: true }); }}
              disabled={sincronizando}
              className="underline font-medium flex-shrink-0 hover:no-underline"
            >
              {sincronizando ? 'Reconectando...' : 'Reconectar'}
            </button>
          )}
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
              ? isDriveConfigurado()
                ? 'Nenhuma leitura encontrada nesta pasta.'
                : 'Nenhuma leitura ainda. Sincronize com o Google Drive ou adicione um link.'
              : 'Nenhum item encontrado para este filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listaFiltrada.map(item => (
            <LeituraCard
              key={item.id}
              item={item}
              onAbrir={() => setLeituraAbertaId(item.id)}
              onLido={() => marcarLido(item.id)}
              onImportante={() => marcarImportante(item.id)}
              onArquivar={() => arquivar(item.id)}
              onTarefa={() => abrirModalTarefa(item)}
            />
          ))}
        </div>
      )}

      {/* Modal leitor interno */}
      <Modal
        isOpen={Boolean(leituraAberta)}
        onClose={() => setLeituraAbertaId(null)}
        title="Leitor SGP"
        size="xl"
      >
        {leituraAberta && (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold leading-snug text-surface-950 dark:text-white">
                    {leituraAberta.titulo}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-surface-500 dark:text-surface-400">
                    <span className={`rounded-full px-2 py-1 font-medium ${tipoColors[leituraAberta.tipo]}`}>
                      {tipoLabels[leituraAberta.tipo]}
                    </span>
                    <span>{leituraAberta.categoria}</span>
                    <span>{leituraAberta.dataCriacao}</span>
                    <span>{leituraAberta.status}</span>
                    <span>{leituraAberta.prioridade}</span>
                    <span>{leituraAberta.origem === 'drive' ? 'Google Drive' : leituraAberta.origem}</span>
                    {leituraAberta.pastaOrigem && <span>{leituraAberta.pastaOrigem}</span>}
                  </div>
                </div>
                {leituraAberta.url && (
                  <a
                    href={leituraAberta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-xs font-semibold text-surface-600 transition-colors hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
                  >
                    <ExternalLink size={13} />
                    Abrir no Google Drive
                  </a>
                )}
              </div>

              {leituraAberta.tags && leituraAberta.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {leituraAberta.tags.map(tag => (
                    <span key={tag} className="rounded-full bg-surface-100 px-2 py-1 text-[10px] text-surface-500 dark:bg-surface-800 dark:text-surface-300">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-800/60">
              {leituraAberta.contentText ? (
                <article className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-surface-800 dark:prose-invert dark:text-surface-100">
                  {leituraAberta.contentText}
                </article>
              ) : leituraAberta.mimeType === 'application/pdf' && leituraAberta.url ? (
                <div className="space-y-3">
                  <iframe
                    title={leituraAberta.titulo}
                    src={leituraAberta.url}
                    className="h-[60vh] w-full rounded-lg border border-surface-200 bg-white dark:border-surface-700"
                  />
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    Se a pré-visualização não carregar, use o botão secundário para abrir no Google Drive.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-surface-600 dark:text-surface-300">
                  <p className="font-medium text-surface-800 dark:text-surface-100">
                    Pré-visualização não disponível dentro do SGP.
                  </p>
                  {leituraAberta.resumo && <p>{leituraAberta.resumo}</p>}
                  {leituraAberta.mimeType && (
                    <p className="text-xs text-surface-400 dark:text-surface-500">
                      Tipo do arquivo: {leituraAberta.mimeType}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {leituraAberta.status !== 'lido' && leituraAberta.status !== 'arquivado' && (
                <Button size="sm" variant="success" icon={<CheckCircle size={14} />} onClick={() => marcarLido(leituraAberta.id)}>
                  Marcar como lido
                </Button>
              )}
              {leituraAberta.prioridade !== 'importante' && leituraAberta.status !== 'arquivado' && (
                <Button size="sm" variant="secondary" icon={<Star size={14} />} onClick={() => marcarImportante(leituraAberta.id)}>
                  Importante
                </Button>
              )}
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => abrirModalTarefa(leituraAberta)}>
                Transformar em tarefa
              </Button>
              {leituraAberta.status !== 'arquivado' && (
                <Button size="sm" variant="secondary" icon={<Archive size={14} />} onClick={() => arquivar(leituraAberta.id)}>
                  Arquivar
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

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
