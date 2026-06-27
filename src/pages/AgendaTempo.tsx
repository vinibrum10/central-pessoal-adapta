import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Clock, Plus, Trash2, Calendar, RefreshCw, Link2, Link2Off,
  Upload, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Zap, Info, ExternalLink, List, Grid, ChevronLeft, ChevronRight,
  LayoutGrid,
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { useCalendario } from '../hooks/useCalendario';
import type { EventoAgenda, Meta, SugestaoCalendario } from '../types';
import { getWeekDays, classifyWeek, getFreeWeekNights } from '../utils/nightAvailability';
import { selectTasksForFreeNights } from '../utils/taskSuggestionEngine';
import { criarEventoSugestao, removerEventoSugestao } from '../services/calendarSuggestionService';
import { PlanejamentoSemanal } from '../components/PlanejamentoSemanal';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input } from '../components/FormFields';
import { formatarMinutos, hojeISO, gerarId } from '../utils';
import {
  calcularDisponibilidadeDia, calcularDisponibilidadePeriodo, obterSemanaAtual,
  nomeDia, eventoOcorreNoFimDeSemana, eventoPodeVirarTarefaAvulsa,
  gerarTarefaAvulsaDeEvento, formatarIntervaloEvento, labelFonteAgenda,
  corCargaDia, icsParaEventosAgenda,
} from '../utils/calendarAvailability';
import {
  isGoogleConfigured, isGoogleConectado,
  getGoogleConnectionStatus,
  getMensagemNaoConfigurado as googleMsg,
  conectarGoogleCalendar, desconectarGoogleCalendar,
  sincronizarGoogleCalendar, deduplicarEventos,
} from '../services/googleCalendar';
import {
  isMicrosoftConfigured, isMicrosoftConectado,
  getMensagemNaoConfigurado as msMsg,
  conectarMicrosoftCalendar, desconectarMicrosoftCalendar, prepararMicrosoftCalendar,
  sincronizarMicrosoftCalendar,
} from '../services/microsoftCalendar';

// ============================================================
// HELPERS VISUAIS
// ============================================================

type Fonte = 'google' | 'microsoft' | 'ics' | 'manual' | string;

const corFonte = (fonte: Fonte): string => {
  switch (fonte) {
    case 'google':    return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50';
    case 'microsoft': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50';
    case 'ics':       return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700/50';
    default:          return 'bg-surface-50 dark:bg-surface-700/30 border-surface-200 dark:border-surface-700';
  }
};

const dotFonte = (fonte: Fonte): string => {
  switch (fonte) {
    case 'google':    return 'bg-red-400';
    case 'microsoft': return 'bg-blue-400';
    case 'ics':       return 'bg-purple-400';
    default:          return 'bg-surface-400';
  }
};

const iconFonte = (fonte: Fonte): React.ReactNode => {
  switch (fonte) {
    case 'google':    return <span className="text-red-500 font-black text-sm">G</span>;
    case 'microsoft': return <span className="text-blue-500 font-black text-sm">M</span>;
    case 'ics':       return <Upload size={13} className="text-purple-500" />;
    default:          return <Clock size={13} className="text-surface-500" />;
  }
};

// ============================================================
// EVENTO CARD — reutilizável, expandível
// ============================================================

function EventoCard({
  ev, onToggle, onExcluir, compact = false,
}: {
  ev: EventoAgenda;
  onToggle?: (id: string) => void;
  onExcluir?: (id: string) => void;
  compact?: boolean;
}) {
  const [expandido, setExpandido] = useState(false);
  const temExtra = Boolean(ev.descricao || ev.linkReuniao || ev.calendarNome || ev.local);
  const descLimpa = ev.descricao?.replace(/<[^>]+>/g, ' ').trim();

  return (
    <div className={`rounded-xl border ${corFonte(ev.fonte)} ${ev.ignorado ? 'opacity-40' : ''}`}>
      <div className={`flex items-center gap-3 ${compact ? 'p-2.5' : 'p-3'}`}>
        <div className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-lg bg-white dark:bg-surface-800 flex items-center justify-center flex-shrink-0 shadow-sm`}>
          {iconFonte(ev.fonte)}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-surface-900 dark:text-white truncate`}>{ev.titulo}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className="text-[10px] text-surface-400 dark:text-surface-500">{formatarIntervaloEvento(ev)}</span>
            {ev.calendarNome && (
              <span className="text-[10px] text-surface-400 dark:text-surface-500 truncate max-w-[130px]" title={ev.calendarNome}>
                · {ev.calendarNome}
              </span>
            )}
            {ev.linkReuniao && (
              <a href={ev.linkReuniao} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[10px] text-primary-600 dark:text-primary-400 flex items-center gap-0.5 hover:underline">
                <ExternalLink size={9} /> Entrar
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {temExtra && (
            <button onClick={() => setExpandido(v => !v)}
              className="p-1 rounded hover:bg-white dark:hover:bg-surface-800 text-surface-300 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
              title="Ver detalhes">
              {expandido ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
          {onToggle && (
            <button onClick={() => onToggle(ev.id)}
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${ev.bloqueiaTempo ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-surface-100 dark:bg-surface-700 text-surface-400'}`}>
              {ev.bloqueiaTempo ? 'Bloqueia' : 'Livre'}
            </button>
          )}
          {onExcluir && (
            <button onClick={() => onExcluir(ev.id)}
              className="p-1 rounded hover:bg-white dark:hover:bg-surface-800 text-surface-300 hover:text-danger-500 transition-colors">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
      {expandido && temExtra && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-black/5 dark:border-white/5 pt-2">
          {ev.calendarNome && <p className="text-[11px] text-surface-500 dark:text-surface-400"><span className="font-medium">Calendário:</span> {ev.calendarNome}</p>}
          {ev.local && <p className="text-[11px] text-surface-500 dark:text-surface-400"><span className="font-medium">Local:</span> {ev.local}</p>}
          {ev.linkReuniao && (
            <a href={ev.linkReuniao} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline">
              <ExternalLink size={10} /> Entrar na reunião
            </a>
          )}
          {descLimpa && <p className="text-[11px] text-surface-500 dark:text-surface-400 leading-relaxed line-clamp-4 whitespace-pre-line">{descLimpa}</p>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// EVENTS LISTA PAGINADA
// ============================================================

function EventosLista({ eventos, onExcluir, onToggle }: {
  eventos: EventoAgenda[];
  onExcluir: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const sorted = [...eventos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const visivel = expandido ? sorted : sorted.slice(0, 5);

  if (sorted.length === 0) return (
    <div className="text-center py-6 space-y-1">
      <Calendar size={24} className="mx-auto text-surface-300 dark:text-surface-600" />
      <p className="text-xs text-surface-400 dark:text-surface-500">Nenhum evento importado</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {visivel.map(ev => <EventoCard key={ev.id} ev={ev} compact onToggle={onToggle} onExcluir={onExcluir} />)}
      {sorted.length > 5 && (
        <button onClick={() => setExpandido(v => !v)}
          className="w-full py-2 text-xs text-surface-400 hover:text-primary-600 flex items-center justify-center gap-1 transition-colors">
          {expandido ? <><ChevronUp size={12} /> Mostrar menos</> : <><ChevronDown size={12} /> Ver todos ({sorted.length})</>}
        </button>
      )}
    </div>
  );
}

// ============================================================
// MODAL CLASSIFICAR FDS
// ============================================================

function ModalClassificar({ evento, metas, onVincular, onSemClassificacao, onIgnorar, onFechar }: {
  evento: EventoAgenda; metas: Meta[];
  onVincular: (metaId: string) => void;
  onSemClassificacao: () => void;
  onIgnorar: () => void;
  onFechar: () => void;
}) {
  const [metaSelecionada, setMetaSelecionada] = useState('');
  const metasAtivas = metas.filter(m => m.status === 'ativa').sort((a, b) => b.grau - a.grau);
  return (
    <Modal isOpen onClose={onFechar} title="Classificar compromisso" size="md">
      <div className="space-y-4">
        <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-4">
          <p className="text-sm font-semibold text-surface-900 dark:text-white">{evento.titulo}</p>
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
            {format(new Date(evento.inicio.split('T')[0] + 'T12:00:00'), "EEEE, dd/MM", { locale: ptBR })}
            {' · '}{formatarIntervaloEvento(evento)}{' · '}{labelFonteAgenda(evento.fonte)}
          </p>
        </div>
        <div className="space-y-3">
          <div className="border border-surface-200 dark:border-surface-600 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-surface-900 dark:text-white">Vincular a uma meta</p>
            <select value={metaSelecionada} onChange={e => setMetaSelecionada(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">— Selecione uma meta —</option>
              {metasAtivas.map(m => <option key={m.id} value={m.id}>[{m.grau}] {m.nome}</option>)}
            </select>
            <Button className="w-full" disabled={!metaSelecionada} onClick={() => onVincular(metaSelecionada)} icon={<CheckCircle2 size={14} />}>Vincular e criar ação</Button>
          </div>
          <button onClick={onSemClassificacao} className="w-full text-left border border-dashed border-surface-300 dark:border-surface-600 rounded-xl p-4 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-200">Manter sem classificação</p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">Cria tarefa avulsa sem vínculo</p>
          </button>
          <button onClick={onIgnorar} className="w-full text-left border border-dashed border-surface-200 dark:border-surface-700 rounded-xl p-3 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
            <p className="text-sm text-surface-500 dark:text-surface-400">Ignorar este compromisso</p>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// INTEGRAÇÃO CARD
// ============================================================

function IntegracaoCard({ nome, icone, configurado, conectado, sincronizadaEm, msgNaoConfigurado, onConectar, onDesconectar, onSincronizar, carregando, cor }: {
  nome: string; icone: React.ReactNode; configurado: boolean; conectado: boolean;
  sincronizadaEm?: string | null; msgNaoConfigurado: string;
  onConectar: () => void; onDesconectar: () => void; onSincronizar: () => void;
  carregando: boolean; cor: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${cor}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 shadow flex items-center justify-center flex-shrink-0">{icone}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-surface-900 dark:text-white">{nome}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {!configurado
              ? <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle size={10} /> Não configurado</span>
              : conectado
                ? <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 size={10} /> Conectado</span>
                : <span className="text-xs text-surface-400 dark:text-surface-500 flex items-center gap-1"><XCircle size={10} /> Desconectado</span>
            }
            {sincronizadaEm && <span className="text-xs text-surface-400 dark:text-surface-500">· Sincronizado {format(new Date(sincronizadaEm), 'dd/MM HH:mm')}</span>}
          </div>
        </div>
      </div>
      {!configurado
        ? <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed flex items-start gap-1.5"><Info size={11} className="mt-0.5 flex-shrink-0" />{msgNaoConfigurado}</p>
          </div>
        : <div className="flex gap-2">
            {conectado
              ? <>
                  <Button size="sm" variant="secondary" onClick={onSincronizar} icon={<RefreshCw size={12} className={carregando ? 'animate-spin' : ''} />} className="flex-1">{carregando ? 'Sincronizando…' : 'Sincronizar'}</Button>
                  <Button size="sm" variant="secondary" onClick={onDesconectar} icon={<Link2Off size={12} />}>Sair</Button>
                </>
              : <Button size="sm" onClick={onConectar} icon={carregando ? <RefreshCw size={12} className="animate-spin" /> : <Link2 size={12} />} className="flex-1">{carregando ? 'Conectando…' : 'Conectar'}</Button>
            }
          </div>
      }
    </div>
  );
}

// ============================================================
// PREPLY CARD
// ============================================================

const PREPLY_KEY = 'adapta-preply-ics-url';

function PreplyCard() {
  const [icsUrl, setIcsUrl] = useState<string>(() => localStorage.getItem(PREPLY_KEY) ?? '');
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(icsUrl);
  const [status, setStatus] = useState<'idle' | 'ok' | 'erro'>('idle');
  const { setData } = useApp();

  const salvar = () => { const u = draft.trim(); localStorage.setItem(PREPLY_KEY, u); setIcsUrl(u); setEditando(false); };

  const sincronizar = async () => {
    if (!icsUrl) return;
    try {
      const { importarICSDeUrl } = await import('../services/icsParser');
      const eventos = await importarICSDeUrl(icsUrl);
      setData(d => ({ ...d, eventosAgenda: [...d.eventosAgenda.filter(e => e.fonte !== 'ics' || !e.id.startsWith('ics-preply-')), ...eventos.map(e => ({ ...e, id: `ics-preply-${e.id}`, fonte: 'ics' as const }))] }));
      setStatus('ok'); setTimeout(() => setStatus('idle'), 3000);
    } catch { setStatus('erro'); }
  };

  return (
    <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-700/40 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 flex items-center justify-center shadow-sm flex-shrink-0"><span className="text-orange-500 font-black text-sm">P</span></div>
        <div className="flex-1">
          <p className="text-sm font-bold text-surface-900 dark:text-white">Preply</p>
          <p className="text-xs text-surface-400 dark:text-surface-500">{icsUrl ? 'Calendário ICS configurado' : 'Aguardando link ICS'}</p>
        </div>
        {icsUrl && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 font-medium">Configurado</span>}
      </div>
      {editando
        ? <div className="space-y-2">
            <input type="url" value={draft} onChange={e => setDraft(e.target.value)} placeholder="https://... (link ICS do Preply)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <div className="flex gap-2"><Button size="sm" onClick={salvar} className="flex-1">Salvar</Button><Button size="sm" variant="secondary" onClick={() => setEditando(false)}>Cancelar</Button></div>
          </div>
        : icsUrl
          ? <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={sincronizar} icon={<RefreshCw size={12} />} className="flex-1">{status === 'ok' ? 'Sincronizado!' : status === 'erro' ? 'Erro' : 'Sincronizar'}</Button>
              <Button size="sm" variant="secondary" onClick={() => { setDraft(icsUrl); setEditando(true); }}>Editar URL</Button>
            </div>
          : <div className="space-y-2">
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">Cole o link ICS da Preply (Configurações → Exportar calendário).</p>
              <Button size="sm" variant="secondary" onClick={() => { setDraft(''); setEditando(true); }} icon={<Link2 size={12} />}>Configurar link ICS</Button>
            </div>
      }
    </div>
  );
}

// ============================================================
// UNIASSELVI CARD
// ============================================================

function UniasselviCard({ onEventosImportados }: { onEventosImportados: (eventos: EventoAgenda[]) => void }) {
  const { config, atualizarConfig, sincronizarUniasselvi, sincronizando, erroSinc } = useCalendario();
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(config.uniasselviIcsUrl);
  const [statusLocal, setStatusLocal] = useState<'idle' | 'ok'>('idle');
  const salvar = () => { const u = draft.trim(); atualizarConfig({ uniasselviIcsUrl: u, uniasselviIcsAtivo: u.length > 0 }); setEditando(false); };
  const handleSincronizar = async () => {
    const eventos = await sincronizarUniasselvi();
    if (eventos.length > 0) { onEventosImportados(eventos); setStatusLocal('ok'); setTimeout(() => setStatusLocal('idle'), 3000); }
  };
  const icsUrl = config.uniasselviIcsUrl;
  return (
    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-700/40 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 flex items-center justify-center shadow-sm flex-shrink-0"><span className="text-green-600 font-black text-sm">U</span></div>
        <div className="flex-1">
          <p className="text-sm font-bold text-surface-900 dark:text-white">Uniasselvi</p>
          <p className="text-xs text-surface-400 dark:text-surface-500">{icsUrl ? 'Calendário ICS configurado' : 'Aguardando link ICS'}</p>
        </div>
        {icsUrl && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 font-medium">Configurado</span>}
      </div>
      {erroSinc && <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-700/50 rounded-xl p-3"><p className="text-xs text-danger-700 dark:text-danger-300 leading-relaxed">{erroSinc}</p></div>}
      {editando
        ? <div className="space-y-2">
            <input type="url" value={draft} onChange={e => setDraft(e.target.value)} placeholder="https://... (link ICS da Uniasselvi)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <div className="flex gap-2"><Button size="sm" onClick={salvar} className="flex-1">Salvar</Button><Button size="sm" variant="secondary" onClick={() => setEditando(false)}>Cancelar</Button></div>
          </div>
        : icsUrl
          ? <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={handleSincronizar} icon={<RefreshCw size={12} className={sincronizando ? 'animate-spin' : ''} />} className="flex-1">
                {sincronizando ? 'Sincronizando…' : statusLocal === 'ok' ? 'Sincronizado!' : 'Sincronizar'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setDraft(icsUrl); setEditando(true); }}>Editar URL</Button>
            </div>
          : <div className="space-y-2">
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">Cole o link ICS da Uniasselvi (Portal → Agenda → Exportar ICS).</p>
              <Button size="sm" variant="secondary" onClick={() => { setDraft(''); setEditando(true); }} icon={<Link2 size={12} />}>Configurar link ICS</Button>
            </div>
      }
    </div>
  );
}

// ============================================================
// VISTA MÊS — grid de calendário
// ============================================================

function VistaMes({
  eventos, filtroFonte, selectedDate, onSelectDate,
}: {
  eventos: EventoAgenda[];
  filtroFonte: string;
  selectedDate: string;
  onSelectDate: (data: string) => void;
}) {
  const [mesRef, setMesRef] = useState(() => new Date(selectedDate + 'T12:00:00'));

  useEffect(() => {
    setMesRef(new Date(selectedDate + 'T12:00:00'));
  }, [selectedDate]);

  const diasDoMes = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesRef), { weekStartsOn: 0 });
    const fim = endOfWeek(endOfMonth(mesRef), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: inicio, end: fim });
  }, [mesRef]);

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, EventoAgenda[]>();
    const evsFiltrados = filtroFonte === 'todos' ? eventos : eventos.filter(e => e.fonte === filtroFonte);
    for (const ev of evsFiltrados.filter(e => !e.ignorado)) {
      const dia = ev.inicio.slice(0, 10);
      if (!map.has(dia)) map.set(dia, []);
      map.get(dia)!.push(ev);
    }
    return map;
  }, [eventos, filtroFonte]);

  const hoje = hojeISO();
  const eventosSelecionados = eventosPorDia.get(selectedDate) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setMesRef(d => subMonths(d, 1))} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"><ChevronLeft size={16} /></button>
        <h3 className="text-sm font-bold text-surface-900 dark:text-white capitalize">
          {format(mesRef, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        <button onClick={() => setMesRef(d => addMonths(d, 1))} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"><ChevronRight size={16} /></button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-surface-200 dark:bg-surface-600 rounded-xl overflow-hidden">
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
          <div key={d} className="bg-surface-100 dark:bg-surface-800 py-1.5 text-center text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wide">{d}</div>
        ))}
        {diasDoMes.map(dia => {
          const iso = format(dia, 'yyyy-MM-dd');
          const evsDia = eventosPorDia.get(iso) ?? [];
          const isHoje = iso === hoje;
          const isSelecionado = iso === selectedDate;
          const isDoMes = isSameMonth(dia, mesRef);

          return (
            <div key={iso}
              onClick={() => onSelectDate(iso)}
              className={`bg-white dark:bg-surface-800 min-h-[64px] p-1.5 cursor-pointer transition-colors hover:bg-surface-50 dark:hover:bg-surface-700/50 ${!isDoMes ? 'opacity-30' : ''} ${isSelecionado ? 'ring-2 ring-primary-500 ring-inset' : ''}`}
            >
              <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isSelecionado ? 'bg-primary-700 text-white' : isHoje ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-surface-700 dark:text-surface-300'}`}>
                {format(dia, 'd')}
              </span>
              {evsDia.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {evsDia.slice(0, 2).map(ev => (
                    <div key={ev.id} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium truncate ${corFonte(ev.fonte)} text-surface-700 dark:text-surface-200`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotFonte(ev.fonte)}`} />
                      <span className="truncate">{ev.titulo}</span>
                    </div>
                  ))}
                  {evsDia.length > 2 && <p className="text-[9px] text-surface-400 pl-1">+{evsDia.length - 2} mais</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader title={`Programação — ${format(new Date(selectedDate + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`} icon={<Calendar size={16} />} />
        <CardBody>
          {eventosSelecionados.length === 0 ? (
            <p className="text-sm text-surface-400 dark:text-surface-500 text-center py-8">Nenhum compromisso nesta data.</p>
          ) : (
            <div className="space-y-2">
              {eventosSelecionados.map(ev => <EventoCard key={ev.id} ev={ev} />)}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ============================================================
// VISTA LISTA — todos eventos paginados com filtro
// ============================================================

function VistaLista({ eventos, filtroFonte }: { eventos: EventoAgenda[]; filtroFonte: string }) {
  const PAGE = 20;
  const [pagina, setPagina] = useState(0);

  const evsFiltrados = useMemo(() => {
    const f = filtroFonte === 'todos' ? eventos : eventos.filter(e => e.fonte === filtroFonte);
    return [...f].filter(e => !e.ignorado).sort((a, b) => a.inicio.localeCompare(b.inicio));
  }, [eventos, filtroFonte]);

  const paginas = Math.ceil(evsFiltrados.length / PAGE);
  const pagAtual = evsFiltrados.slice(pagina * PAGE, (pagina + 1) * PAGE);

  if (evsFiltrados.length === 0) return (
    <div className="text-center py-12 space-y-2">
      <Calendar size={32} className="mx-auto text-surface-300 dark:text-surface-600" />
      <p className="text-sm text-surface-400 dark:text-surface-500">Nenhum evento encontrado</p>
      <p className="text-xs text-surface-300 dark:text-surface-600">Conecte uma fonte de calendário na aba Conexões</p>
    </div>
  );

  // Agrupa por data
  const gruposPorDia: { data: string; evs: EventoAgenda[] }[] = [];
  for (const ev of pagAtual) {
    const dia = ev.inicio.slice(0, 10);
    const ultimo = gruposPorDia[gruposPorDia.length - 1];
    if (ultimo?.data === dia) { ultimo.evs.push(ev); } else { gruposPorDia.push({ data: dia, evs: [ev] }); }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-400 dark:text-surface-500">{evsFiltrados.length} evento{evsFiltrados.length !== 1 ? 's' : ''}</p>
      {gruposPorDia.map(g => (
        <div key={g.data} className="space-y-2">
          <p className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wide px-1">
            {format(new Date(g.data + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            {g.data === hojeISO() && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-[9px] normal-case">Hoje</span>}
          </p>
          {g.evs.map(ev => <EventoCard key={ev.id} ev={ev} />)}
        </div>
      ))}
      {paginas > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)} className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-30 transition-colors"><ChevronLeft size={14} /></button>
          <span className="text-xs text-surface-500">{pagina + 1} / {paginas}</span>
          <button disabled={pagina >= paginas - 1} onClick={() => setPagina(p => p + 1)} className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export function AgendaTempoPage() {
  const { data, setData } = useApp();

  const hoje = hojeISO();
  const [abaAtiva, setAbaAtiva] = useState<'agenda' | 'disponibilidade' | 'fds' | 'fontes' | 'planejamento'>('agenda');
  const [viewMode, setViewMode] = useState<'hoje' | 'semana' | 'mes' | 'lista'>('hoje');
  const [filtroFonte, setFiltroFonte] = useState<'todos' | 'google' | 'microsoft' | 'ics' | 'manual'>('todos');
  const [selectedDate, setSelectedDate] = useState(hoje);
  const [modalManual, setModalManual] = useState(false);
  const [formManual, setFormManual] = useState({ titulo: '', data: hoje, horaInicio: '09:00', horaFim: '10:00', diaInteiro: false, bloqueiaTempo: true });
  const [errosManual, setErrosManual] = useState<Record<string, string>>({});
  const [eventoClassificar, setEventoClassificar] = useState<EventoAgenda | null>(null);
  const [modalSincronizar, setModalSincronizar] = useState(false);
  const [carregandoGoogle, setCarregandoGoogle] = useState(false);
  const [carregandoMs, setCarregandoMs] = useState(false);
  const [erroConexao, setErroConexao] = useState<string | null>(null);
  const [sincGoogleEm, setSincGoogleEm] = useState<string | null>(null);
  const [sincMsEm, setSincMsEm] = useState<string | null>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);

  // ── Cálculos de disponibilidade ──
  const dispHoje = useMemo(() => calcularDisponibilidadeDia(hoje, data.eventosAgenda), [hoje, data.eventosAgenda]);
  const dispDiaSelecionado = useMemo(() => calcularDisponibilidadeDia(selectedDate, data.eventosAgenda), [selectedDate, data.eventosAgenda]);
  const semana = useMemo(() => obterSemanaAtual(), []);
  const dispSemana = useMemo(() => calcularDisponibilidadePeriodo(semana[0], semana[6], data.eventosAgenda), [semana, data.eventosAgenda]);

  const eventosFDS = useMemo(
    () => data.eventosAgenda.filter(e => eventoOcorreNoFimDeSemana(e) && eventoPodeVirarTarefaAvulsa(e)),
    [data.eventosAgenda]
  );

  // ── Eventos por filtro ──
  const eventosHoje = useMemo(() =>
    data.eventosAgenda.filter(e => !e.ignorado && e.inicio.startsWith(hoje)).sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [hoje, data.eventosAgenda]
  );

  const eventosDiaSelecionado = useMemo(() =>
    data.eventosAgenda.filter(e => !e.ignorado && e.inicio.startsWith(selectedDate)).sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [selectedDate, data.eventosAgenda]
  );

  const eventosSemana = useMemo(() =>
    data.eventosAgenda.filter(e => !e.ignorado && e.inicio >= semana[0] && e.inicio <= semana[6] + 'T23:59:59').sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [semana, data.eventosAgenda]
  );

  // ── KPIs ──
  const proximaReuniao = useMemo(() => {
    const agora = new Date().toISOString();
    return data.eventosAgenda
      .filter(e => !e.ignorado && e.inicio > agora && !e.diaInteiro)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))[0] ?? null;
  }, [data.eventosAgenda]);

  const horasOcupadasSemana = useMemo(() =>
    dispSemana.reduce((acc, d) => acc + d.minutosOcupados, 0),
    [dispSemana]
  );

  const eventosSemCategoria = useMemo(() =>
    data.eventosAgenda.filter(e => !e.ignorado && e.fonte !== 'manual' && !e.calendarNome),
    [data.eventosAgenda]
  );

  // ── Range 30 dias ──
  const range30 = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return { ini: hoje, fim: d.toISOString().slice(0, 10) };
  }, [hoje]);

  const adicionarEventos = useCallback((novos: EventoAgenda[]) => {
    setData(d => ({ ...d, eventosAgenda: [...d.eventosAgenda, ...deduplicarEventos(d.eventosAgenda, novos)] }));
  }, [setData]);

  // ── Auto-sync ao montar: revalida token e sincroniza fontes conectadas ──
  useEffect(() => {
    let cancelado = false;
    const autoSync = async () => {
      if (isGoogleConfigured() && getGoogleConnectionStatus() === 'conectado') {
        try {
          const eventos = await sincronizarGoogleCalendar(range30.ini, range30.fim);
          if (!cancelado) {
            setData(d => ({ ...d, eventosAgenda: [...d.eventosAgenda.filter(e => e.fonte !== 'google'), ...eventos] }));
            setSincGoogleEm(new Date().toISOString());
          }
        } catch (e) {
          if (!cancelado) {
            const msg = e instanceof Error ? e.message : String(e);
            setErroConexao(msg.includes('Sessão expirada') ? msg : 'Não foi possível sincronizar Google Calendar agora.');
          }
        }
      }
      const microsoftPronto = isMicrosoftConfigured()
        ? await prepararMicrosoftCalendar().catch(() => false)
        : false;
      if (microsoftPronto && isMicrosoftConectado()) {
        try {
          const eventos = await sincronizarMicrosoftCalendar(range30.ini, range30.fim);
          if (!cancelado) {
            setData(d => ({ ...d, eventosAgenda: [...d.eventosAgenda.filter(e => e.fonte !== 'microsoft'), ...eventos] }));
            setSincMsEm(new Date().toISOString());
          }
        } catch {
          if (!cancelado) desconectarMicrosoftCalendar();
        }
      }
    };
    autoSync();
    return () => { cancelado = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // roda só no mount

  // ── Google ──
  const handleConectarGoogle = async () => {
    setCarregandoGoogle(true); setErroConexao(null);
    try {
      await conectarGoogleCalendar();
      const eventos = await sincronizarGoogleCalendar(range30.ini, range30.fim);
      setData(d => ({ ...d, eventosAgenda: [...d.eventosAgenda.filter(e => e.fonte !== 'google'), ...eventos] }));
      setSincGoogleEm(new Date().toISOString());
    } catch (e) { setErroConexao(e instanceof Error ? e.message : String(e)); }
    finally { setCarregandoGoogle(false); }
  };

  const handleSincronizarGoogle = async () => {
    setCarregandoGoogle(true); setErroConexao(null);
    try {
      const eventos = await sincronizarGoogleCalendar(range30.ini, range30.fim);
      setData(d => ({ ...d, eventosAgenda: [...d.eventosAgenda.filter(e => e.fonte !== 'google'), ...eventos] }));
      setSincGoogleEm(new Date().toISOString());
    } catch (e) { setErroConexao(e instanceof Error ? e.message : String(e)); }
    finally { setCarregandoGoogle(false); }
  };

  const handleDesconectarGoogle = () => { desconectarGoogleCalendar(); setSincGoogleEm(null); };

  // ── Microsoft ──
  const msErroAmigavel = (e: unknown): string => {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'INSTITUTIONAL_CONSENT_REQUIRED')
      return 'A Uniasselvi pode exigir aprovação do administrador para permitir acesso ao calendário via Microsoft Graph.';
    if (msg === 'MICROSOFT_INTERACTION_IN_PROGRESS')
      return 'A autenticação Microsoft estava presa em andamento. Feche popups de login abertos e tente conectar novamente.';
    if (msg === 'MICROSOFT_RECONNECT_REQUIRED')
      return 'Sessão Microsoft precisa ser reconectada. Clique em Sair e conecte novamente.';
    if (msg === 'MICROSOFT_LOGIN_TIMEOUT')
      return 'O login Microsoft demorou demais para responder. Tente conectar novamente e conclua o login na página da Microsoft.';
    if (msg === 'MICROSOFT_ACCESS_DENIED')
      return 'A conexão Microsoft foi cancelada, negada ou bloqueada pelo servidor. A sessão local foi reiniciada; tente conectar novamente.';
    if (msg.includes('expirada')) return 'Sessão Microsoft expirada. Clique em Reconectar.';
    if (msg.includes('Popup bloqueado')) return 'Popup bloqueado pelo navegador. Clique no ícone de popup na barra de endereços e permita popups para este site.';
    return msg;
  };

  const handleConectarMs = async () => {
    setCarregandoMs(true); setErroConexao(null);
    try {
      const conectado = await conectarMicrosoftCalendar();
      if (!conectado) return;
      const eventos = await sincronizarMicrosoftCalendar(range30.ini, range30.fim);
      setData(d => ({ ...d, eventosAgenda: [...d.eventosAgenda.filter(e => e.fonte !== 'microsoft'), ...eventos] }));
      setSincMsEm(new Date().toISOString());
    } catch (e) { setErroConexao(msErroAmigavel(e)); }
    finally { setCarregandoMs(false); }
  };

  const handleSincronizarMs = async () => {
    setCarregandoMs(true); setErroConexao(null);
    try {
      const eventos = await sincronizarMicrosoftCalendar(range30.ini, range30.fim);
      setData(d => ({ ...d, eventosAgenda: [...d.eventosAgenda.filter(e => e.fonte !== 'microsoft'), ...eventos] }));
      setSincMsEm(new Date().toISOString());
    } catch (e) { setErroConexao(msErroAmigavel(e)); }
    finally { setCarregandoMs(false); }
  };

  const handleDesconectarMs = () => { desconectarMicrosoftCalendar(); setSincMsEm(null); };

  // ── ICS ──
  const handleIcsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { adicionarEventos(icsParaEventosAgenda(ev.target?.result as string)); }
      catch { setErroConexao('Erro ao processar arquivo ICS.'); }
    };
    reader.readAsText(file);
    if (icsInputRef.current) icsInputRef.current.value = '';
  };

  // ── Bloqueio manual ──
  const salvarManual = useCallback(() => {
    const e: Record<string, string> = {};
    if (!formManual.titulo.trim()) e.titulo = 'Título é obrigatório';
    if (!formManual.data) e.data = 'Data é obrigatória';
    setErrosManual(e);
    if (Object.keys(e).length > 0) return;
    const inicio = formManual.diaInteiro ? `${formManual.data}T00:00:00` : `${formManual.data}T${formManual.horaInicio}:00`;
    const fim = formManual.diaInteiro ? `${formManual.data}T23:59:59` : `${formManual.data}T${formManual.horaFim}:00`;
    const novo: EventoAgenda = { id: `manual-${gerarId()}`, fonte: 'manual', titulo: formManual.titulo, inicio, fim, diaInteiro: formManual.diaInteiro, bloqueiaTempo: formManual.bloqueiaTempo, importadoEm: new Date().toISOString(), tarefaGeradaId: null, ignorado: false };
    setData(d => ({ ...d, eventosAgenda: [...d.eventosAgenda, novo] }));
    setModalManual(false);
    setFormManual({ titulo: '', data: hoje, horaInicio: '09:00', horaFim: '10:00', diaInteiro: false, bloqueiaTempo: true });
  }, [formManual, setData, hoje]);

  const excluirEvento = (id: string) => setData(d => ({ ...d, eventosAgenda: d.eventosAgenda.filter(e => e.id !== id) }));
  const toggleBloqueiaTempo = (id: string) => setData(d => ({ ...d, eventosAgenda: d.eventosAgenda.map(e => e.id === id ? { ...e, bloqueiaTempo: !e.bloqueiaTempo } : e) }));

  // ── FDS ──
  const handleVincularMeta = useCallback((metaId: string) => {
    if (!eventoClassificar) return;
    const tarefa = gerarTarefaAvulsaDeEvento(eventoClassificar, metaId);
    setData(d => ({ ...d, tarefas: [...d.tarefas, tarefa], eventosAgenda: d.eventosAgenda.map(e => e.id === eventoClassificar.id ? { ...e, tarefaGeradaId: tarefa.id } : e) }));
    setEventoClassificar(null);
  }, [eventoClassificar, setData]);

  const handleSemClassificacao = useCallback(() => {
    if (!eventoClassificar) return;
    const tarefa = gerarTarefaAvulsaDeEvento(eventoClassificar, null);
    setData(d => ({ ...d, tarefas: [...d.tarefas, tarefa], eventosAgenda: d.eventosAgenda.map(e => e.id === eventoClassificar.id ? { ...e, tarefaGeradaId: tarefa.id } : e) }));
    setEventoClassificar(null);
  }, [eventoClassificar, setData]);

  const handleIgnorar = useCallback(() => {
    if (!eventoClassificar) return;
    setData(d => ({ ...d, eventosAgenda: d.eventosAgenda.map(e => e.id === eventoClassificar.id ? { ...e, ignorado: true } : e) }));
    setEventoClassificar(null);
  }, [eventoClassificar, setData]);

  // ── Planejamento ──
  const handleGerarSugestoes = useCallback(async () => {
    const agora = new Date();
    const freeNights = getFreeWeekNights(data.eventosAgenda, agora);
    const semanaInicio = getWeekDays(agora)[0].toISOString().slice(0, 10);
    const weekClass = classifyWeek(data.eventosAgenda, agora);
    const existingIds = (data.sugestoes ?? []).filter(s => s.semanaInicio === semanaInicio && (s.status === 'sugerida' || s.status === 'aceita')).map(s => s.tarefaId);
    const candidatos = selectTasksForFreeNights(freeNights, data.tarefas ?? [], data.metas ?? [], weekClass, existingIds);
    const novasSugestoes: SugestaoCalendario[] = [];
    for (let i = 0; i < Math.min(candidatos.length, freeNights.length); i++) {
      const noite = freeNights[i]; const cand = candidatos[i];
      const sugestao: SugestaoCalendario = { id: crypto.randomUUID(), semanaInicio, tarefaId: cand.tarefa.id, metaId: cand.meta?.id, diaAgendado: noite.toISOString().slice(0, 10), horaInicio: '19:00', horaFim: '20:00', status: 'sugerida', motivo: cand.reason, criadaEm: new Date().toISOString(), atualizadaEm: new Date().toISOString() };
      const extId = await criarEventoSugestao(sugestao, cand.tarefa, cand.meta);
      if (extId) { sugestao.externalEventId = extId; sugestao.calendarProvider = 'google'; }
      novasSugestoes.push(sugestao);
    }
    setData(d => ({ ...d, sugestoes: [...(d.sugestoes ?? []), ...novasSugestoes] }));
  }, [data, setData]);

  const handleAceitarSugestao = useCallback((id: string) => {
    setData(d => ({ ...d, sugestoes: (d.sugestoes ?? []).map(s => s.id === id ? { ...s, status: 'aceita' as const, atualizadaEm: new Date().toISOString() } : s) }));
  }, [setData]);

  const handleCancelarSugestao = useCallback(async (id: string) => {
    const sugestao = (data.sugestoes ?? []).find(s => s.id === id);
    if (sugestao?.externalEventId) await removerEventoSugestao(sugestao.externalEventId);
    setData(d => ({ ...d, sugestoes: (d.sugestoes ?? []).map(s => s.id === id ? { ...s, status: 'cancelada' as const, atualizadaEm: new Date().toISOString() } : s) }));
  }, [data.sugestoes, setData]);

  const handleRecusarSugestao = useCallback((id: string) => {
    setData(d => ({ ...d, sugestoes: (d.sugestoes ?? []).map(s => s.id === id ? { ...s, status: 'recusada' as const, atualizadaEm: new Date().toISOString() } : s) }));
  }, [setData]);

  // ── TABS ──
  const TABS = [
    { id: 'agenda' as const, label: 'Agenda' },
    { id: 'disponibilidade' as const, label: 'Disponibilidade' },
    { id: 'fds' as const, label: eventosFDS.length > 0 ? `FDS (${eventosFDS.length})` : 'FDS' },
    { id: 'fontes' as const, label: 'Conexões' },
    { id: 'planejamento' as const, label: 'Planejamento' },
  ];

  const VIEW_MODES = [
    { id: 'hoje' as const, label: 'Hoje', icon: <Clock size={12} /> },
    { id: 'semana' as const, label: 'Semana', icon: <Grid size={12} /> },
    { id: 'mes' as const, label: 'Mês', icon: <LayoutGrid size={12} /> },
    { id: 'lista' as const, label: 'Lista', icon: <List size={12} /> },
  ];

  const FONTES_FILTER = [
    { id: 'todos' as const, label: 'Todos' },
    { id: 'google' as const, label: 'Google' },
    { id: 'microsoft' as const, label: 'Microsoft' },
    { id: 'ics' as const, label: 'ICS' },
    { id: 'manual' as const, label: 'Manual' },
  ];

  const navegarDia = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
    setViewMode('hoje');
  };

  const selecionarDataCalendario = (dataIso: string) => {
    setSelectedDate(dataIso);
    setViewMode('mes');
  };

  // Google SVG
  const googleIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  const msIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
    </svg>
  );

  // ── RENDER ──
  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">Agenda e Tempo</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">Agenda unificada · Google · Microsoft · ICS</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button icon={<RefreshCw size={16} />} size="sm" onClick={() => setModalSincronizar(true)}>Sincronizar</Button>
          <Button icon={<Plus size={16} />} variant="secondary" size="sm" onClick={() => setModalManual(true)}>Bloqueio manual</Button>
        </div>
      </div>

      {/* Erro */}
      {erroConexao && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-700/50 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-danger-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-danger-700 dark:text-danger-300">Erro na integração</p>
            <p className="text-xs text-danger-600 dark:text-danger-400 mt-0.5">{erroConexao}</p>
          </div>
          <button onClick={() => setErroConexao(null)} className="text-danger-400 hover:text-danger-600"><XCircle size={14} /></button>
        </div>
      )}

      {/* Tabs principais */}
      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-xl overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setAbaAtiva(t.id)}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${abaAtiva === t.id ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm' : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ ABA AGENDA ═══ */}
      {abaAtiva === 'agenda' && (
        <div className="space-y-5 animate-fade-in">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-600 p-4 text-white shadow-lg">
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-2">Data selecionada</p>
              <p className="text-2xl font-extrabold">{eventosDiaSelecionado.length}</p>
              <p className="text-[10px] opacity-70 mt-0.5">compromisso{eventosDiaSelecionado.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-violet-700 to-violet-600 p-4 text-white shadow-lg">
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-1">Próxima reunião</p>
              {proximaReuniao
                ? <>
                    <p className="text-xs font-bold truncate">{proximaReuniao.titulo}</p>
                    <p className="text-[10px] opacity-70 mt-0.5">{format(new Date(proximaReuniao.inicio), 'dd/MM HH:mm')}</p>
                  </>
                : <p className="text-xs opacity-60 mt-1">Nenhuma</p>
              }
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-amber-600 to-amber-500 p-4 text-white shadow-lg">
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-2">Semana ocupada</p>
              <p className="text-2xl font-extrabold">{formatarMinutos(horasOcupadasSemana)}</p>
            </div>
            <div className={`rounded-2xl bg-gradient-to-br ${eventosSemCategoria.length > 0 ? 'from-rose-700 to-rose-600' : 'from-emerald-700 to-emerald-600'} p-4 text-white shadow-lg`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-2">Sem categoria</p>
              <p className="text-2xl font-extrabold">{eventosSemCategoria.length}</p>
              <p className="text-[10px] opacity-70 mt-0.5">evento{eventosSemCategoria.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Barra: filtro fonte + view mode */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Filtro por fonte */}
            <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-xl flex-1">
              {FONTES_FILTER.map(f => (
                <button key={f.id} onClick={() => setFiltroFonte(f.id)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${filtroFonte === f.id ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm' : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {/* View mode */}
            <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-xl">
              {VIEW_MODES.map(v => (
                <button key={v.id} onClick={() => setViewMode(v.id)}
                  title={v.label}
                  className={`flex items-center gap-1 py-1.5 px-3 rounded-lg text-[11px] font-semibold transition-all ${viewMode === v.id ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm' : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'}`}>
                  {v.icon}<span className="hidden sm:inline">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── VIEW HOJE ── */}
          {viewMode === 'hoje' && (() => {
            const evs = filtroFonte === 'todos' ? eventosDiaSelecionado : eventosDiaSelecionado.filter(e => e.fonte === filtroFonte);
            return (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => navegarDia(-1)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors" title="Dia anterior"><ChevronLeft size={16} /></button>
                    <div>
                      <p className="text-sm font-bold text-surface-900 dark:text-white capitalize">
                        {format(new Date(selectedDate + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                      {selectedDate === hoje && <p className="text-xs text-primary-600 dark:text-primary-400">Hoje</p>}
                    </div>
                    <button onClick={() => navegarDia(1)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors" title="Próximo dia"><ChevronRight size={16} /></button>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setSelectedDate(hoje)}>Hoje</Button>
                    <Button size="sm" variant="secondary" onClick={() => navegarDia(selectedDate === hoje ? 1 : Math.round((new Date(hoje + 'T12:00:00').getTime() + 86400000 - new Date(selectedDate + 'T12:00:00').getTime()) / 86400000))}>Amanhã</Button>
                  </div>
                </div>
              <Card>
                <CardHeader title="Programação do dia" icon={<Clock size={18} />} />
                <CardBody>
                  {/* Barra de tempo */}
                  <div className="mb-4 space-y-1.5">
                    <div className="flex justify-between text-xs text-surface-400 dark:text-surface-500">
                      <span>{dispDiaSelecionado.inicioJanela}</span><span>{dispDiaSelecionado.fimJanela}</span>
                    </div>
                    <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden relative">
                      {eventosDiaSelecionado.filter(e => e.bloqueiaTempo && !e.ignorado).map(e => {
                        const jIni = parseInt(dispDiaSelecionado.inicioJanela) * 60 + parseInt(dispDiaSelecionado.inicioJanela.split(':')[1] ?? '0');
                        const totalMin = dispDiaSelecionado.minutosJanela;
                        if (totalMin === 0) return null;
                        const mIni = e.diaInteiro ? jIni : (parseInt(e.inicio.slice(11, 13)) * 60 + parseInt(e.inicio.slice(14, 16)));
                        const mFim = e.diaInteiro ? jIni + totalMin : (parseInt(e.fim.slice(11, 13)) * 60 + parseInt(e.fim.slice(14, 16)));
                        const left = Math.max(0, (mIni - jIni) / totalMin * 100);
                        const width = Math.min(100 - left, (mFim - mIni) / totalMin * 100);
                        return <div key={e.id} title={e.titulo} className={`absolute top-0 h-full rounded opacity-80 ${dotFonte(e.fonte)}`} style={{ left: `${left}%`, width: `${Math.max(1, width)}%` }} />;
                      })}
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatarMinutos(dispDiaSelecionado.minutosDisponiveis)} livre</span>
                      <span className="text-red-500 font-semibold">{formatarMinutos(dispDiaSelecionado.minutosOcupados)} ocupado</span>
                    </div>
                  </div>

                  {evs.length === 0
                    ? <div className="text-center py-10 space-y-2">
                        <Calendar size={28} className="mx-auto text-surface-300 dark:text-surface-600" />
                        <p className="text-sm text-surface-400 dark:text-surface-500">Nenhum compromisso nesta data.</p>
                      </div>
                    : <div className="space-y-2">
                        {evs.map(ev => <EventoCard key={ev.id} ev={ev} onToggle={toggleBloqueiaTempo} onExcluir={excluirEvento} />)}
                      </div>
                  }
                </CardBody>
              </Card>
              </div>
            );
          })()}

          {/* ── VIEW SEMANA ── */}
          {viewMode === 'semana' && (() => {
            const evsFiltrados = filtroFonte === 'todos' ? eventosSemana : eventosSemana.filter(e => e.fonte === filtroFonte);
            // Agrupar por dia
            const diasSemana = semana.slice(0, 7);
            return (
              <div className="space-y-3">
                {diasSemana.map(dia => {
                  const evsDia = evsFiltrados.filter(e => e.inicio.startsWith(dia));
                  const isHojeFlag = dia === hoje;
                  return (
                    <div key={dia} className={`rounded-2xl border p-4 space-y-3 ${isHojeFlag ? 'border-primary-400 dark:border-primary-500 bg-primary-50/50 dark:bg-primary-900/10' : 'border-surface-200 dark:border-surface-700'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-surface-700 dark:text-surface-200 capitalize">{format(new Date(dia + 'T12:00:00'), "EEEE, dd/MM", { locale: ptBR })}</p>
                          {isHojeFlag && <span className="text-[9px] bg-primary-600 text-white rounded-full px-2 py-0.5 font-bold">HOJE</span>}
                        </div>
                        <span className="text-xs text-surface-400">{evsDia.length} evento{evsDia.length !== 1 ? 's' : ''}</span>
                      </div>
                      {evsDia.length === 0
                        ? <p className="text-xs text-surface-300 dark:text-surface-600 italic">Sem eventos{filtroFonte !== 'todos' ? ` (${filtroFonte})` : ''}</p>
                        : <div className="space-y-1.5">{evsDia.map(ev => <EventoCard key={ev.id} ev={ev} compact onToggle={toggleBloqueiaTempo} onExcluir={excluirEvento} />)}</div>
                      }
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── VIEW MÊS ── */}
          {viewMode === 'mes' && <VistaMes eventos={data.eventosAgenda} filtroFonte={filtroFonte} selectedDate={selectedDate} onSelectDate={selecionarDataCalendario} />}

          {/* ── VIEW LISTA ── */}
          {viewMode === 'lista' && <VistaLista eventos={data.eventosAgenda} filtroFonte={filtroFonte} />}
        </div>
      )}

      {/* ═══ ABA DISPONIBILIDADE ═══ */}
      {abaAtiva === 'disponibilidade' && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Disponível hoje', value: formatarMinutos(dispHoje.minutosDisponiveis), cor: 'from-emerald-700 to-emerald-600', icon: <Clock size={20} /> },
              { label: 'Ocupado hoje', value: formatarMinutos(dispHoje.minutosOcupados), cor: dispHoje.minutosOcupados > 0 ? 'from-amber-600 to-amber-500' : 'from-slate-700 to-slate-600', icon: <Calendar size={20} /> },
              { label: 'Eventos hoje', value: String(eventosHoje.length), cor: 'from-blue-700 to-blue-600', icon: <Calendar size={20} /> },
              { label: 'Pendentes FDS', value: String(eventosFDS.length), cor: eventosFDS.length > 0 ? 'from-violet-700 to-violet-600' : 'from-slate-700 to-slate-600', icon: <Zap size={20} /> },
            ].map(k => (
              <div key={k.label} className={`rounded-2xl bg-gradient-to-br ${k.cor} p-4 text-white shadow-lg`}>
                <div className="flex items-center justify-between mb-2 opacity-70">
                  <p className="text-xs font-semibold uppercase tracking-wide">{k.label}</p>
                  <div className="opacity-50">{k.icon}</div>
                </div>
                <p className="text-3xl font-extrabold leading-none">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader title="Janela de hoje" subtitle={`${dispHoje.inicioJanela} – ${dispHoje.fimJanela}`} icon={<Clock size={18} />} />
              <CardBody>
                <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-4 space-y-2.5">
                  {[
                    { label: 'Janela total', value: formatarMinutos(dispHoje.minutosJanela), color: 'text-surface-800 dark:text-surface-200' },
                    { label: 'Ocupado', value: formatarMinutos(dispHoje.minutosOcupados), color: 'text-red-600 dark:text-red-400' },
                    { label: 'Disponível', value: formatarMinutos(dispHoje.minutosDisponiveis), color: 'text-emerald-600 dark:text-emerald-400', bold: true },
                  ].map(row => (
                    <div key={row.label} className={`flex justify-between text-sm ${row.bold ? 'border-t border-surface-200 dark:border-surface-600 pt-2.5 font-bold' : ''}`}>
                      <span className={row.bold ? 'text-surface-700 dark:text-surface-200' : 'text-surface-500 dark:text-surface-400'}>{row.label}</span>
                      <span className={`font-semibold ${row.color}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-3">
                  <p className="text-xs text-primary-700 dark:text-primary-300 leading-relaxed">
                    <strong>Janela útil</strong><br />Seg–Sex: 07:30 às 22:00 · Sáb–Dom: 08:00 às 20:00
                  </p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Disponibilidade da semana" icon={<Calendar size={18} />} />
              <CardBody>
                <div className="grid grid-cols-7 gap-1">
                  {dispSemana.map(dia => {
                    const isH = dia.data === hoje;
                    const pct = dia.minutosJanela > 0 ? dia.minutosOcupados / dia.minutosJanela : 0;
                    const fds = [0, 6].includes(new Date(dia.data + 'T12:00:00').getDay());
                    return (
                      <div key={dia.data} className={`rounded-xl p-2 space-y-1.5 text-center ${isH ? 'border border-primary-400 bg-primary-50 dark:bg-primary-900/20' : fds ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'bg-surface-50 dark:bg-surface-800'}`}>
                        <p className={`text-[9px] font-bold uppercase ${isH ? 'text-primary-600 dark:text-primary-400' : 'text-surface-500'}`}>{nomeDia(dia.data).slice(0, 3)}</p>
                        <p className="text-[10px] text-surface-400">{format(new Date(dia.data + 'T12:00:00'), 'dd/MM')}</p>
                        <div className="h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden"><div className={`h-full rounded-full ${corCargaDia(dia.minutosOcupados, dia.minutosJanela)}`} style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }} /></div>
                        <p className={`text-[9px] font-bold ${dia.minutosDisponiveis > 120 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{formatarMinutos(dia.minutosDisponiveis)}</p>
                        {isH && <div className="text-[8px] bg-primary-600 text-white rounded-full px-1 font-bold">HOJE</div>}
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ ABA FDS ═══ */}
      {abaAtiva === 'fds' && (
        <Card>
          <CardHeader title="Eventos de fim de semana" subtitle="Classifique como tarefas ou ignore" icon={<Zap size={18} />} />
          <CardBody>
            {eventosFDS.length === 0
              ? <div className="text-center py-10 space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-300">Nenhum evento de FDS pendente</p>
                </div>
              : <div className="space-y-3">
                  {eventosFDS.map(ev => (
                    <div key={ev.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border ${corFonte(ev.fonte)}`}>
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 flex items-center justify-center shadow-sm flex-shrink-0">{iconFonte(ev.fonte)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-surface-900 dark:text-white">{ev.titulo}</p>
                        <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                          {format(new Date(ev.inicio.split('T')[0] + 'T12:00:00'), "EEEE, dd/MM", { locale: ptBR })}
                          {' · '}{formatarIntervaloEvento(ev)}{' · '}{labelFonteAgenda(ev.fonte)}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="sm" onClick={() => setEventoClassificar(ev)}>Classificar</Button>
                        <button onClick={() => setData(d => ({ ...d, eventosAgenda: d.eventosAgenda.map(e => e.id === ev.id ? { ...e, ignorado: true } : e) }))} className="p-2 rounded-lg border border-surface-200 dark:border-surface-600 hover:bg-white dark:hover:bg-surface-800 text-surface-400 hover:text-danger-500 transition-colors" title="Ignorar"><XCircle size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </CardBody>
        </Card>
      )}

      {/* ═══ ABA CONEXÕES ═══ */}
      {abaAtiva === 'fontes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <IntegracaoCard nome="Google Calendar" icone={googleIcon}
              configurado={isGoogleConfigured()} conectado={isGoogleConectado()}
              sincronizadaEm={sincGoogleEm} msgNaoConfigurado={googleMsg()}
              onConectar={handleConectarGoogle} onDesconectar={handleDesconectarGoogle} onSincronizar={handleSincronizarGoogle}
              carregando={carregandoGoogle}
              cor="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700/40"
            />
            <IntegracaoCard nome="Microsoft Outlook" icone={msIcon}
              configurado={isMicrosoftConfigured()} conectado={isMicrosoftConectado()}
              sincronizadaEm={sincMsEm} msgNaoConfigurado={msMsg()}
              onConectar={handleConectarMs} onDesconectar={handleDesconectarMs} onSincronizar={handleSincronizarMs}
              carregando={carregandoMs}
              cor="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700/40"
            />
          </div>

          <PreplyCard />
          <UniasselviCard onEventosImportados={(novos) => {
            setData(d => {
              const semUni = d.eventosAgenda.filter(e => !e.id.startsWith('ics-uniasselvi-'));
              return { ...d, eventosAgenda: [...semUni, ...deduplicarEventos(semUni, novos)] };
            });
          }} />

          <div className="bg-surface-50 dark:bg-surface-700/20 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 flex items-center justify-center flex-shrink-0 shadow-sm"><span className="text-blue-400 font-black text-sm">OD</span></div>
            <div>
              <p className="text-sm font-bold text-surface-900 dark:text-white">OneDrive</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">Sincronização com Microsoft OneDrive — em breve</p>
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-surface-200 dark:bg-surface-600 text-surface-500 dark:text-surface-400 font-medium">Em breve</span>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-700/40 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 flex items-center justify-center shadow-sm"><Upload size={18} className="text-purple-600 dark:text-purple-400" /></div>
              <div>
                <p className="text-sm font-bold text-surface-900 dark:text-white">Importar arquivo .ics</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Apple Calendar, Outlook, Thunderbird, Google…</p>
              </div>
            </div>
            <input ref={icsInputRef} type="file" accept=".ics,.ical" onChange={handleIcsFile} className="hidden" />
            <Button size="sm" variant="secondary" onClick={() => icsInputRef.current?.click()} icon={<Upload size={14} />}>Selecionar arquivo .ics</Button>
          </div>

          {data.eventosAgenda.length > 0 && (
            <Card>
              <CardHeader title={`Eventos importados (${data.eventosAgenda.length})`} subtitle="Todos os eventos de todas as fontes" icon={<Calendar size={18} />} />
              <CardBody>
                <EventosLista eventos={data.eventosAgenda} onExcluir={excluirEvento} onToggle={toggleBloqueiaTempo} />
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* ═══ ABA PLANEJAMENTO ═══ */}
      {abaAtiva === 'planejamento' && (
        <div className="space-y-5 animate-fade-in">
          <PlanejamentoSemanal
            eventos={data.eventosAgenda} tarefas={data.tarefas} metas={data.metas}
            sugestoes={data.sugestoes ?? []}
            onGerarSugestoes={handleGerarSugestoes} onAceitar={handleAceitarSugestao}
            onCancelar={handleCancelarSugestao} onRecusar={handleRecusarSugestao}
          />
        </div>
      )}

      {/* ═══ MODAL SINCRONIZAR ═══ */}
      <Modal isOpen={modalSincronizar} onClose={() => setModalSincronizar(false)} title="Sincronizar calendário" size="md">
        <div className="space-y-4">
          <p className="text-sm text-surface-500 dark:text-surface-400">Escolha a fonte para conectar ou atualizar. Os eventos dos próximos 30 dias serão importados.</p>
          {erroConexao && (
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-700/50 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-danger-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-danger-700 dark:text-danger-300">{erroConexao}</p>
            </div>
          )}

          {/* Google */}
          <div className="border border-red-200 dark:border-red-700/40 bg-red-50 dark:bg-red-900/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-surface-800 shadow flex items-center justify-center flex-shrink-0">{googleIcon}</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-surface-900 dark:text-white">Google Calendar</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">
                  {!isGoogleConfigured() ? 'Não configurado' : isGoogleConectado() ? '✓ Conectado · todos os calendários' : 'Desconectado'}
                </p>
              </div>
            </div>
            {isGoogleConfigured()
              ? <div className="flex gap-2">
                  {isGoogleConectado()
                    ? <>
                        <Button size="sm" onClick={async () => { await handleSincronizarGoogle(); setModalSincronizar(false); }} icon={<RefreshCw size={12} className={carregandoGoogle ? 'animate-spin' : ''} />} className="flex-1">{carregandoGoogle ? 'Sincronizando…' : 'Sincronizar'}</Button>
                        <Button size="sm" variant="secondary" onClick={() => { handleDesconectarGoogle(); }} icon={<Link2Off size={12} />}>Sair</Button>
                      </>
                    : <Button size="sm" onClick={async () => { await handleConectarGoogle(); setModalSincronizar(false); }} icon={<Link2 size={12} />} className="flex-1">{carregandoGoogle ? 'Conectando…' : 'Conectar com Google'}</Button>
                  }
                </div>
              : <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><Info size={11} /> {googleMsg()}</p>
            }
          </div>

          {/* Microsoft */}
          <div className="border border-blue-200 dark:border-blue-700/40 bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-surface-800 shadow flex items-center justify-center flex-shrink-0">{msIcon}</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-surface-900 dark:text-white">Microsoft Outlook</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">
                  {!isMicrosoftConfigured() ? 'Não configurado' : isMicrosoftConectado() ? '✓ Conectado · todos os calendários' : 'Desconectado'}
                </p>
              </div>
            </div>
            {isMicrosoftConfigured()
              ? <div className="flex gap-2">
                  {isMicrosoftConectado()
                    ? <>
                        <Button size="sm" onClick={async () => { await handleSincronizarMs(); setModalSincronizar(false); }} icon={<RefreshCw size={12} className={carregandoMs ? 'animate-spin' : ''} />} className="flex-1">{carregandoMs ? 'Sincronizando…' : 'Sincronizar'}</Button>
                        <Button size="sm" variant="secondary" onClick={() => { handleDesconectarMs(); }} icon={<Link2Off size={12} />}>Sair</Button>
                      </>
                    : <Button size="sm" onClick={async () => { await handleConectarMs(); setModalSincronizar(false); }} icon={<Link2 size={12} />} className="flex-1">{carregandoMs ? 'Conectando…' : 'Conectar com Microsoft'}</Button>
                  }
                </div>
              : <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><Info size={11} /> {msMsg()}</p>
            }
          </div>

          {/* ICS */}
          <div className="border border-purple-200 dark:border-purple-700/40 bg-purple-50 dark:bg-purple-900/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-surface-800 shadow flex items-center justify-center flex-shrink-0"><Upload size={16} className="text-purple-600" /></div>
              <div className="flex-1">
                <p className="text-sm font-bold text-surface-900 dark:text-white">Arquivo .ics</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Apple Calendar, Outlook, Thunderbird…</p>
              </div>
            </div>
            <input ref={icsInputRef} type="file" accept=".ics,.ical" onChange={(e) => { handleIcsFile(e); setModalSincronizar(false); }} className="hidden" />
            <Button size="sm" variant="secondary" onClick={() => icsInputRef.current?.click()} icon={<Upload size={14} />} className="w-full">Selecionar arquivo .ics</Button>
          </div>
        </div>
      </Modal>

      {/* ═══ MODAL BLOQUEIO MANUAL ═══ */}
      <Modal isOpen={modalManual} onClose={() => setModalManual(false)} title="Adicionar bloqueio manual" size="md">
        <div className="space-y-4">
          <Input id="man-titulo" label="Título" required value={formManual.titulo} onChange={e => setFormManual(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Consulta médica" error={errosManual.titulo} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="man-data" label="Data" type="date" required value={formManual.data} onChange={e => setFormManual(f => ({ ...f, data: e.target.value }))} error={errosManual.data} />
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="man-dia-inteiro" checked={formManual.diaInteiro} onChange={e => setFormManual(f => ({ ...f, diaInteiro: e.target.checked }))} className="rounded" />
              <label htmlFor="man-dia-inteiro" className="text-sm text-surface-600 dark:text-surface-300">Dia inteiro</label>
            </div>
          </div>
          {!formManual.diaInteiro && (
            <div className="grid grid-cols-2 gap-3">
              <Input id="man-ini" label="Início" type="time" value={formManual.horaInicio} onChange={e => setFormManual(f => ({ ...f, horaInicio: e.target.value }))} />
              <Input id="man-fim" label="Fim" type="time" value={formManual.horaFim} onChange={e => setFormManual(f => ({ ...f, horaFim: e.target.value }))} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="man-bloqueia" checked={formManual.bloqueiaTempo} onChange={e => setFormManual(f => ({ ...f, bloqueiaTempo: e.target.checked }))} className="rounded" />
            <label htmlFor="man-bloqueia" className="text-sm text-surface-600 dark:text-surface-300">Bloqueia tempo disponível</label>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalManual(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarManual}>Salvar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal classificar FDS */}
      {eventoClassificar && (
        <ModalClassificar evento={eventoClassificar} metas={data.metas}
          onVincular={handleVincularMeta} onSemClassificacao={handleSemClassificacao}
          onIgnorar={handleIgnorar} onFechar={() => setEventoClassificar(null)} />
      )}
    </div>
  );
}
