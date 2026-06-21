import { useState, useCallback, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Clock, Plus, Trash2, Calendar, RefreshCw, Link2, Link2Off,
  Upload, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Zap, Info,
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { useCalendario } from '../hooks/useCalendario';
import type { EventoAgenda, Meta } from '../types';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input } from '../components/FormFields';
import {
  formatarMinutos, hojeISO, gerarId,
} from '../utils';
import {
  calcularDisponibilidadeDia,
  calcularDisponibilidadePeriodo,
  obterSemanaAtual,
  nomeDia,
  eventoOcorreNoFimDeSemana,
  eventoPodeVirarTarefaAvulsa,
  gerarTarefaAvulsaDeEvento,
  formatarIntervaloEvento,
  labelFonteAgenda,
  corCargaDia,
  icsParaEventosAgenda,
} from '../utils/calendarAvailability';
import {
  isGoogleConfigured,
  isGoogleConectado,
  getMensagemNaoConfigurado as googleMsg,
  conectarGoogleCalendar,
  desconectarGoogleCalendar,
  sincronizarGoogleCalendar,
  deduplicarEventos,
} from '../services/googleCalendar';
import {
  isMicrosoftConfigured,
  isMicrosoftConectado,
  getMensagemNaoConfigurado as msMsg,
  conectarMicrosoftCalendar,
  desconectarMicrosoftCalendar,
  sincronizarMicrosoftCalendar,
} from '../services/microsoftCalendar';

// ============================================================
// HELPERS VISUAIS
// ============================================================

const corFonte = (fonte: string): string => {
  switch (fonte) {
    case 'google': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50';
    case 'microsoft': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50';
    case 'ics': return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700/50';
    default: return 'bg-surface-50 dark:bg-surface-700/30 border-surface-200 dark:border-surface-700';
  }
};

const iconFonte = (fonte: string): React.ReactNode => {
  switch (fonte) {
    case 'google': return <span className="text-red-500 font-black text-sm">G</span>;
    case 'microsoft': return <span className="text-blue-500 font-black text-sm">M</span>;
    case 'ics': return <Upload size={13} className="text-purple-500" />;
    default: return <Clock size={13} className="text-surface-500" />;
  }
};

// ============================================================
// MODAL CLASSIFICAR EVENTO DO FIM DE SEMANA
// ============================================================

interface ModalClassificarProps {
  evento: EventoAgenda;
  metas: Meta[];
  onVincular: (metaId: string) => void;
  onSemClassificacao: () => void;
  onIgnorar: () => void;
  onFechar: () => void;
}

function ModalClassificar({ evento, metas, onVincular, onSemClassificacao, onIgnorar, onFechar }: ModalClassificarProps) {
  const [metaSelecionada, setMetaSelecionada] = useState('');
  const metasAtivas = metas.filter(m => m.status === 'ativa').sort((a, b) => b.grau - a.grau);

  return (
    <Modal isOpen onClose={onFechar} title="Classificar compromisso" size="md">
      <div className="space-y-4">
        <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-4">
          <p className="text-sm font-semibold text-surface-900 dark:text-white">{evento.titulo}</p>
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
            {format(new Date(evento.inicio.split('T')[0] + 'T12:00:00'), "EEEE, dd/MM", { locale: ptBR })}
            {' · '}{formatarIntervaloEvento(evento)}
            {' · '}{labelFonteAgenda(evento.fonte)}
          </p>
        </div>

        <p className="text-sm text-surface-600 dark:text-surface-300">
          Este compromisso do fim de semana pode ser vinculado a uma meta ou criado como tarefa avulsa.
        </p>

        <div className="space-y-3">
          {/* Opção 1 — vincular a meta */}
          <div className="border border-surface-200 dark:border-surface-600 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-surface-900 dark:text-white">Vincular a uma meta</p>
            <select
              value={metaSelecionada}
              onChange={e => setMetaSelecionada(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">— Selecione uma meta —</option>
              {metasAtivas.map(m => (
                <option key={m.id} value={m.id}>[{m.grau}] {m.nome}</option>
              ))}
            </select>
            <Button
              className="w-full"
              disabled={!metaSelecionada}
              onClick={() => onVincular(metaSelecionada)}
              icon={<CheckCircle2 size={14} />}
            >
              Vincular e criar ação
            </Button>
          </div>

          {/* Opção 2 — sem classificação */}
          <button
            onClick={onSemClassificacao}
            className="w-full text-left border border-dashed border-surface-300 dark:border-surface-600 rounded-xl p-4 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors"
          >
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-200">Manter sem classificação</p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">Cria tarefa avulsa sem vínculo com nenhuma meta</p>
          </button>

          {/* Opção 3 — ignorar */}
          <button
            onClick={onIgnorar}
            className="w-full text-left border border-dashed border-surface-200 dark:border-surface-700 rounded-xl p-3 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors"
          >
            <p className="text-sm text-surface-500 dark:text-surface-400">Ignorar este compromisso</p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">Não criar tarefa e não perguntar novamente</p>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// CARD DE INTEGRAÇÃO
// ============================================================

interface IntegracaoCardProps {
  nome: string;
  icone: React.ReactNode;
  configurado: boolean;
  conectado: boolean;
  sincronizadaEm?: string | null;
  msgNaoConfigurado: string;
  onConectar: () => void;
  onDesconectar: () => void;
  onSincronizar: () => void;
  carregando: boolean;
  cor: string;
}

function IntegracaoCard({
  nome, icone, configurado, conectado, sincronizadaEm,
  msgNaoConfigurado, onConectar, onDesconectar, onSincronizar,
  carregando, cor,
}: IntegracaoCardProps) {
  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${cor}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 shadow flex items-center justify-center flex-shrink-0">
          {icone}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-surface-900 dark:text-white">{nome}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {!configurado ? (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle size={10} /> Não configurado
              </span>
            ) : conectado ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={10} /> Conectado
              </span>
            ) : (
              <span className="text-xs text-surface-400 dark:text-surface-500 flex items-center gap-1">
                <XCircle size={10} /> Desconectado
              </span>
            )}
            {sincronizadaEm && (
              <span className="text-xs text-surface-400 dark:text-surface-500">
                · Sincronizado {format(new Date(sincronizadaEm), 'dd/MM HH:mm')}
              </span>
            )}
          </div>
        </div>
      </div>

      {!configurado ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3">
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed flex items-start gap-1.5">
            <Info size={11} className="mt-0.5 flex-shrink-0" />
            {msgNaoConfigurado}
          </p>
        </div>
      ) : (
        <div className="flex gap-2">
          {conectado ? (
            <>
              <Button size="sm" variant="secondary" onClick={onSincronizar} icon={<RefreshCw size={12} className={carregando ? 'animate-spin' : ''} />} className="flex-1">
                {carregando ? 'Sincronizando…' : 'Sincronizar'}
              </Button>
              <Button size="sm" variant="secondary" onClick={onDesconectar} icon={<Link2Off size={12} />}>
                Sair
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onConectar} icon={carregando ? <RefreshCw size={12} className="animate-spin" /> : <Link2 size={12} />} className="flex-1">
              {carregando ? 'Conectando…' : 'Conectar'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// LISTA DE EVENTOS (paginada)
// ============================================================

function EventosLista({
  eventos, onExcluir, onToggle,
}: {
  eventos: EventoAgenda[];
  onExcluir: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const sorted = [...eventos].sort((a, b) => b.importadoEm.localeCompare(a.importadoEm));
  const visivel = expandido ? sorted : sorted.slice(0, 5);

  return (
    <div className="space-y-2">
      {visivel.map(ev => (
        <div key={ev.id} className={`flex items-center gap-3 p-3 rounded-xl border ${corFonte(ev.fonte)} ${ev.ignorado ? 'opacity-40' : ''}`}>
          <div className="w-6 h-6 rounded-lg bg-white dark:bg-surface-800 flex items-center justify-center flex-shrink-0 shadow-sm">
            {iconFonte(ev.fonte)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-surface-900 dark:text-white truncate">{ev.titulo}</p>
            <p className="text-[10px] text-surface-400 dark:text-surface-500">
              {ev.inicio.split('T')[0]} · {formatarIntervaloEvento(ev)} · {labelFonteAgenda(ev.fonte)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => onToggle(ev.id)}
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${
                ev.bloqueiaTempo
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'bg-surface-100 dark:bg-surface-700 text-surface-400'
              }`}
            >
              {ev.bloqueiaTempo ? 'Bloqueia' : 'Livre'}
            </button>
            <button onClick={() => onExcluir(ev.id)} className="p-1 rounded hover:bg-white dark:hover:bg-surface-800 text-surface-300 hover:text-danger-500 transition-colors">
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      ))}
      {sorted.length > 5 && (
        <button
          onClick={() => setExpandido(v => !v)}
          className="w-full py-2 text-xs text-surface-400 hover:text-primary-600 flex items-center justify-center gap-1 transition-colors"
        >
          {expandido
            ? <><ChevronUp size={12} /> Mostrar menos</>
            : <><ChevronDown size={12} /> Ver todos ({sorted.length})</>
          }
        </button>
      )}
    </div>
  );
}

// ============================================================
// PÁGINA PRINCIPAL
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

  const salvar = () => {
    const url = draft.trim();
    localStorage.setItem(PREPLY_KEY, url);
    setIcsUrl(url);
    setEditando(false);
  };

  const sincronizar = async () => {
    if (!icsUrl) return;
    try {
      const { importarICSDeUrl } = await import('../services/icsParser');
      const eventos = await importarICSDeUrl(icsUrl);
      setData(d => ({
        ...d,
        eventosAgenda: [
          ...d.eventosAgenda.filter(e => e.fonte !== 'ics' || !e.id.startsWith('ics-preply-')),
          ...eventos.map(e => ({ ...e, id: `ics-preply-${e.id}`, fonte: 'ics' as const })),
        ],
      }));
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('erro');
    }
  };

  return (
    <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-700/40 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 flex items-center justify-center shadow-sm flex-shrink-0">
          <span className="text-orange-500 font-black text-sm">P</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-surface-900 dark:text-white">Preply</p>
          <p className="text-xs text-surface-400 dark:text-surface-500">
            {icsUrl ? 'Calendário ICS configurado' : 'Aguardando link de calendário ICS'}
          </p>
        </div>
        {icsUrl && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 font-medium">Configurado</span>
        )}
      </div>

      {editando ? (
        <div className="space-y-2">
          <input
            type="url"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="https://... (link ICS do Preply)"
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={salvar} className="flex-1">Salvar</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditando(false)}>Cancelar</Button>
          </div>
        </div>
      ) : icsUrl ? (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={sincronizar} icon={<RefreshCw size={12} />} className="flex-1">
            {status === 'ok' ? 'Sincronizado!' : status === 'erro' ? 'Erro — tente novamente' : 'Sincronizar'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setDraft(icsUrl); setEditando(true); }}>
            Editar URL
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
            Cole aqui o link de calendário ICS da Preply, se disponível. Você pode encontrá-lo nas configurações do perfil na Preply → "Exportar calendário".
          </p>
          <Button size="sm" variant="secondary" onClick={() => { setDraft(''); setEditando(true); }} icon={<Link2 size={12} />}>
            Configurar link ICS
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// UNIASSELVI ICS CARD
// ============================================================

function UniasselviCard({ onEventosImportados }: { onEventosImportados: (eventos: EventoAgenda[]) => void }) {
  const { config, atualizarConfig, sincronizarUniasselvi, sincronizando, erroSinc } = useCalendario();
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(config.uniasselviIcsUrl);
  const [statusLocal, setStatusLocal] = useState<'idle' | 'ok'>('idle');

  const salvar = () => {
    const url = draft.trim();
    atualizarConfig({ uniasselviIcsUrl: url, uniasselviIcsAtivo: url.length > 0 });
    setEditando(false);
  };

  const handleSincronizar = async () => {
    const eventos = await sincronizarUniasselvi();
    if (eventos.length > 0) {
      onEventosImportados(eventos);
      setStatusLocal('ok');
      setTimeout(() => setStatusLocal('idle'), 3000);
    }
  };

  const icsUrl = config.uniasselviIcsUrl;

  return (
    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-700/40 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 flex items-center justify-center shadow-sm flex-shrink-0">
          <span className="text-green-600 font-black text-sm">U</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-surface-900 dark:text-white">Uniasselvi</p>
          <p className="text-xs text-surface-400 dark:text-surface-500">
            {icsUrl ? 'Calendário ICS configurado' : 'Aguardando link de calendário ICS'}
          </p>
        </div>
        {icsUrl && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 font-medium">Configurado</span>
        )}
      </div>

      {erroSinc && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-700/50 rounded-xl p-3">
          <p className="text-xs text-danger-700 dark:text-danger-300 leading-relaxed">{erroSinc}</p>
        </div>
      )}

      {editando ? (
        <div className="space-y-2">
          <input
            type="url"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="https://... (link ICS da Uniasselvi)"
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-surface-400 dark:text-surface-500 leading-relaxed">
            Acesse o portal da Uniasselvi → Agenda → Exportar calendário ICS. A URL precisa ser pública para funcionar.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={salvar} className="flex-1">Salvar</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditando(false)}>Cancelar</Button>
          </div>
        </div>
      ) : icsUrl ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleSincronizar}
            icon={<RefreshCw size={12} className={sincronizando ? 'animate-spin' : ''} />}
            className="flex-1"
          >
            {sincronizando ? 'Sincronizando…' : statusLocal === 'ok' ? 'Sincronizado!' : 'Sincronizar'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setDraft(icsUrl); setEditando(true); }}>
            Editar URL
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
            Cole aqui o link de calendário ICS da Uniasselvi para importar automaticamente suas aulas e eventos acadêmicos.
          </p>
          <Button size="sm" variant="secondary" onClick={() => { setDraft(''); setEditando(true); }} icon={<Link2 size={12} />}>
            Configurar link ICS
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================

export function AgendaTempoPage() {
  const { data, setData } = useApp();

  const hoje = hojeISO();
  const [abaAtiva, setAbaAtiva] = useState<'hoje' | 'semana' | 'fds' | 'fontes'>('hoje');
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

  // Disponibilidade calculada
  const dispHoje = useMemo(
    () => calcularDisponibilidadeDia(hoje, data.eventosAgenda),
    [hoje, data.eventosAgenda]
  );
  const semana = useMemo(() => obterSemanaAtual(), []);
  const dispSemana = useMemo(
    () => calcularDisponibilidadePeriodo(semana[0], semana[6], data.eventosAgenda),
    [semana, data.eventosAgenda]
  );

  const eventosFDS = useMemo(
    () => data.eventosAgenda.filter(e => eventoOcorreNoFimDeSemana(e) && eventoPodeVirarTarefaAvulsa(e)),
    [data.eventosAgenda]
  );

  const eventosHoje = useMemo(
    () => data.eventosAgenda
      .filter(e => e.inicio.startsWith(hoje))
      .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [hoje, data.eventosAgenda]
  );

  const adicionarEventos = useCallback((novos: EventoAgenda[]) => {
    setData(d => {
      const dedup = deduplicarEventos(d.eventosAgenda, novos);
      return { ...d, eventosAgenda: [...d.eventosAgenda, ...dedup] };
    });
  }, [setData]);

  // ── Google ──
  const handleConectarGoogle = async () => {
    setCarregandoGoogle(true); setErroConexao(null);
    try {
      await conectarGoogleCalendar();
      const eventos = await sincronizarGoogleCalendar(semana[0], semana[6]);
      adicionarEventos(eventos);
      setSincGoogleEm(new Date().toISOString());
    } catch (e) {
      setErroConexao(e instanceof Error ? e.message : String(e));
    } finally { setCarregandoGoogle(false); }
  };

  const handleSincronizarGoogle = async () => {
    setCarregandoGoogle(true); setErroConexao(null);
    try {
      const eventos = await sincronizarGoogleCalendar(semana[0], semana[6]);
      adicionarEventos(eventos);
      setSincGoogleEm(new Date().toISOString());
    } catch (e) {
      setErroConexao(e instanceof Error ? e.message : String(e));
    } finally { setCarregandoGoogle(false); }
  };

  const handleDesconectarGoogle = () => { desconectarGoogleCalendar(); setSincGoogleEm(null); };

  // ── Microsoft ──
  const handleConectarMs = async () => {
    setCarregandoMs(true); setErroConexao(null);
    try {
      await conectarMicrosoftCalendar();
      const eventos = await sincronizarMicrosoftCalendar(semana[0], semana[6]);
      adicionarEventos(eventos);
      setSincMsEm(new Date().toISOString());
    } catch (e) {
      setErroConexao(e instanceof Error ? e.message : String(e));
    } finally { setCarregandoMs(false); }
  };

  const handleSincronizarMs = async () => {
    setCarregandoMs(true); setErroConexao(null);
    try {
      const eventos = await sincronizarMicrosoftCalendar(semana[0], semana[6]);
      adicionarEventos(eventos);
      setSincMsEm(new Date().toISOString());
    } catch (e) {
      setErroConexao(e instanceof Error ? e.message : String(e));
    } finally { setCarregandoMs(false); }
  };

  const handleDesconectarMs = () => { desconectarMicrosoftCalendar(); setSincMsEm(null); };

  // ── ICS ──
  const handleIcsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const eventos = icsParaEventosAgenda(ev.target?.result as string);
        adicionarEventos(eventos);
      } catch {
        setErroConexao('Erro ao processar arquivo ICS. Verifique se é um arquivo de calendário válido.');
      }
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
    const fim    = formManual.diaInteiro ? `${formManual.data}T23:59:59` : `${formManual.data}T${formManual.horaFim}:00`;

    const novo: EventoAgenda = {
      id: `manual-${gerarId()}`,
      fonte: 'manual',
      titulo: formManual.titulo,
      inicio, fim,
      diaInteiro: formManual.diaInteiro,
      bloqueiaTempo: formManual.bloqueiaTempo,
      importadoEm: new Date().toISOString(),
      tarefaGeradaId: null,
      ignorado: false,
    };

    setData(d => ({ ...d, eventosAgenda: [...d.eventosAgenda, novo] }));
    setModalManual(false);
    setFormManual({ titulo: '', data: hoje, horaInicio: '09:00', horaFim: '10:00', diaInteiro: false, bloqueiaTempo: true });
  }, [formManual, setData, hoje]);

  const excluirEvento = (id: string) =>
    setData(d => ({ ...d, eventosAgenda: d.eventosAgenda.filter(e => e.id !== id) }));

  const toggleBloqueiaTempo = (id: string) =>
    setData(d => ({ ...d, eventosAgenda: d.eventosAgenda.map(e => e.id === id ? { ...e, bloqueiaTempo: !e.bloqueiaTempo } : e) }));

  // ── Classificação FDS ──
  const handleVincularMeta = useCallback((metaId: string) => {
    if (!eventoClassificar) return;
    const tarefa = gerarTarefaAvulsaDeEvento(eventoClassificar, metaId);
    setData(d => ({
      ...d,
      tarefas: [...d.tarefas, tarefa],
      eventosAgenda: d.eventosAgenda.map(e => e.id === eventoClassificar.id ? { ...e, tarefaGeradaId: tarefa.id } : e),
    }));
    setEventoClassificar(null);
  }, [eventoClassificar, setData]);

  const handleSemClassificacao = useCallback(() => {
    if (!eventoClassificar) return;
    const tarefa = gerarTarefaAvulsaDeEvento(eventoClassificar, null);
    setData(d => ({
      ...d,
      tarefas: [...d.tarefas, tarefa],
      eventosAgenda: d.eventosAgenda.map(e => e.id === eventoClassificar.id ? { ...e, tarefaGeradaId: tarefa.id } : e),
    }));
    setEventoClassificar(null);
  }, [eventoClassificar, setData]);

  const handleIgnorar = useCallback(() => {
    if (!eventoClassificar) return;
    setData(d => ({ ...d, eventosAgenda: d.eventosAgenda.map(e => e.id === eventoClassificar.id ? { ...e, ignorado: true } : e) }));
    setEventoClassificar(null);
  }, [eventoClassificar, setData]);

  const abas = [
    { id: 'hoje' as const, label: 'Hoje' },
    { id: 'semana' as const, label: 'Semana' },
    { id: 'fds' as const, label: `Fim de semana${eventosFDS.length > 0 ? ` (${eventosFDS.length})` : ''}` },
    { id: 'fontes' as const, label: 'Conexões' },
  ];

  // ── RENDER ──
  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">Agenda e Tempo</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            Tempo disponível calculado a partir das suas agendas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={<RefreshCw size={16} />} size="sm" onClick={() => setModalSincronizar(true)}>
            Sincronizar calendário
          </Button>
          <Button icon={<Plus size={16} />} variant="secondary" size="sm" onClick={() => setModalManual(true)}>
            Adicionar bloqueio manual
          </Button>
        </div>
      </div>

      {/* KPIs */}
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

      {/* Abas */}
      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-xl">
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAbaAtiva(a.id)}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              abaAtiva === a.id
                ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* ── ABA HOJE ── */}
      {abaAtiva === 'hoje' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader title="Visão do dia" subtitle={`Janela ${dispHoje.inicioJanela} – ${dispHoje.fimJanela}`} icon={<Clock size={18} />} />
            <CardBody>
              {/* Mini-barra temporal */}
              <div className="mb-4 space-y-1.5">
                <div className="flex justify-between text-xs text-surface-400 dark:text-surface-500">
                  <span>{dispHoje.inicioJanela}</span>
                  <span>{dispHoje.fimJanela}</span>
                </div>
                <div className="h-4 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden relative">
                  {eventosHoje.filter(e => e.bloqueiaTempo && !e.ignorado).map(e => {
                    const jIni = parseInt(dispHoje.inicioJanela) * 60 + parseInt(dispHoje.inicioJanela.split(':')[1] ?? '0');
                    const totalMin = dispHoje.minutosJanela;
                    if (totalMin === 0) return null;
                    const mIni = e.diaInteiro ? jIni
                      : (parseInt(e.inicio.slice(11, 13)) * 60 + parseInt(e.inicio.slice(14, 16)));
                    const mFim = e.diaInteiro ? jIni + totalMin
                      : (parseInt(e.fim.slice(11, 13)) * 60 + parseInt(e.fim.slice(14, 16)));
                    const left = Math.max(0, (mIni - jIni) / totalMin * 100);
                    const width = Math.min(100 - left, (mFim - mIni) / totalMin * 100);
                    return (
                      <div
                        key={e.id}
                        title={e.titulo}
                        className="absolute top-0 h-full bg-red-400 dark:bg-red-500 opacity-80 rounded"
                        style={{ left: `${left}%`, width: `${Math.max(1, width)}%` }}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatarMinutos(dispHoje.minutosDisponiveis)} livre</span>
                  <span className="text-red-500 font-semibold">{formatarMinutos(dispHoje.minutosOcupados)} ocupado</span>
                </div>
              </div>

              {/* Eventos */}
              {eventosHoje.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Calendar size={28} className="mx-auto text-surface-300 dark:text-surface-600" />
                  <p className="text-sm text-surface-400 dark:text-surface-500">Nenhum evento hoje</p>
                  <p className="text-xs text-surface-300 dark:text-surface-600">Conecte sua agenda ou adicione bloqueios manuais</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {eventosHoje.map(ev => (
                    <div key={ev.id} className={`flex items-center gap-3 p-3 rounded-xl border ${corFonte(ev.fonte)}`}>
                      <div className="w-7 h-7 rounded-lg bg-white dark:bg-surface-800 flex items-center justify-center flex-shrink-0 shadow-sm">
                        {iconFonte(ev.fonte)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{ev.titulo}</p>
                        <p className="text-xs text-surface-400 dark:text-surface-500">{formatarIntervaloEvento(ev)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleBloqueiaTempo(ev.id)}
                          title={ev.bloqueiaTempo ? 'Bloqueia tempo' : 'Não bloqueia'}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${ev.bloqueiaTempo ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-surface-100 dark:bg-surface-700 text-surface-400'}`}
                        >
                          {ev.bloqueiaTempo ? 'Bloqueia' : 'Livre'}
                        </button>
                        <button onClick={() => excluirEvento(ev.id)} className="p-1 rounded hover:bg-white dark:hover:bg-surface-800 text-surface-300 hover:text-danger-500 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Janela útil de hoje" icon={<Info size={18} />} />
            <CardBody>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Início', value: dispHoje.inicioJanela },
                    { label: 'Fim', value: dispHoje.fimJanela },
                  ].map(item => (
                    <div key={item.label} className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-3 text-center">
                      <p className="text-xs text-surface-400 dark:text-surface-500">{item.label}</p>
                      <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-4 space-y-2.5">
                  {[
                    { label: 'Janela total', value: formatarMinutos(dispHoje.minutosJanela), color: 'text-surface-800 dark:text-surface-200' },
                    { label: 'Ocupado (compromissos)', value: formatarMinutos(dispHoje.minutosOcupados), color: 'text-red-600 dark:text-red-400' },
                    { label: 'Disponível', value: formatarMinutos(dispHoje.minutosDisponiveis), color: 'text-emerald-600 dark:text-emerald-400', bold: true },
                  ].map(row => (
                    <div key={row.label} className={`flex justify-between text-sm ${row.bold ? 'border-t border-surface-200 dark:border-surface-600 pt-2.5 font-bold' : ''}`}>
                      <span className={row.bold ? 'text-surface-700 dark:text-surface-200' : 'text-surface-500 dark:text-surface-400'}>{row.label}</span>
                      <span className={`font-semibold ${row.color}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-3">
                  <p className="text-xs text-primary-700 dark:text-primary-300 leading-relaxed">
                    <strong>Regra de janela útil</strong><br />
                    Seg–Sex: 07:30 às 22:00<br />
                    Sáb–Dom: 08:00 às 20:00<br />
                    Eventos fora da janela não reduzem disponibilidade.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ── ABA SEMANA ── */}
      {abaAtiva === 'semana' && (
        <Card>
          <CardHeader title="Disponibilidade da semana" icon={<Calendar size={18} />} />
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
              {dispSemana.map(dia => {
                const isHoje = dia.data === hoje;
                const pctOcup = dia.minutosJanela > 0 ? dia.minutosOcupados / dia.minutosJanela : 0;
                const diaNum = new Date(dia.data + 'T12:00:00').getDay();
                const fimDeSemana = diaNum === 0 || diaNum === 6;

                return (
                  <div
                    key={dia.data}
                    className={`rounded-2xl border p-3 space-y-2.5 transition-all ${
                      isHoje
                        ? 'border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : fimDeSemana
                        ? 'border-amber-200 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-900/10'
                        : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800'
                    }`}
                  >
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${isHoje ? 'text-primary-600 dark:text-primary-400' : 'text-surface-500 dark:text-surface-400'}`}>
                        {nomeDia(dia.data)}
                      </p>
                      <p className="text-xs text-surface-400 dark:text-surface-500">{format(new Date(dia.data + 'T12:00:00'), 'dd/MM')}</p>
                    </div>
                    <div className="h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${corCargaDia(dia.minutosOcupados, dia.minutosJanela)}`}
                        style={{ width: `${Math.min(100, Math.round(pctOcup * 100))}%` }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-surface-400">Livre</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatarMinutos(dia.minutosDisponiveis)}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-surface-400">Eventos</span>
                        <span className="font-bold text-surface-700 dark:text-surface-300">{dia.eventos.length}</span>
                      </div>
                    </div>
                    {isHoje && <div className="text-[9px] bg-primary-600 text-white rounded-full px-2 py-0.5 text-center font-bold">HOJE</div>}
                    {fimDeSemana && !isHoje && <div className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full px-2 py-0.5 text-center">FDS</div>}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── ABA FIM DE SEMANA ── */}
      {abaAtiva === 'fds' && (
        <Card>
          <CardHeader title="Eventos de fim de semana" subtitle="Classifique como tarefas ou ignore" icon={<Zap size={18} />} />
          <CardBody>
            {eventosFDS.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
                <p className="text-sm font-medium text-surface-600 dark:text-surface-300">Nenhum evento de FDS pendente</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Quando houver eventos de sábado/domingo não classificados, eles aparecerão aqui.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {eventosFDS.map(ev => (
                  <div key={ev.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border ${corFonte(ev.fonte)}`}>
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 flex items-center justify-center shadow-sm flex-shrink-0">
                      {iconFonte(ev.fonte)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-surface-900 dark:text-white">{ev.titulo}</p>
                      <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                        {format(new Date(ev.inicio.split('T')[0] + 'T12:00:00'), "EEEE, dd/MM", { locale: ptBR })}
                        {' · '}{formatarIntervaloEvento(ev)}
                        {' · '}{labelFonteAgenda(ev.fonte)}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" onClick={() => setEventoClassificar(ev)}>Classificar</Button>
                      <button
                        onClick={() => setData(d => ({ ...d, eventosAgenda: d.eventosAgenda.map(e => e.id === ev.id ? { ...e, ignorado: true } : e) }))}
                        className="p-2 rounded-lg border border-surface-200 dark:border-surface-600 hover:bg-white dark:hover:bg-surface-800 text-surface-400 hover:text-danger-500 transition-colors"
                        title="Ignorar"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* ── ABA CONEXÕES ── */}
      {abaAtiva === 'fontes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <IntegracaoCard
              nome="Google Calendar"
              icone={
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              }
              configurado={isGoogleConfigured()}
              conectado={isGoogleConectado()}
              sincronizadaEm={sincGoogleEm}
              msgNaoConfigurado={googleMsg()}
              onConectar={handleConectarGoogle}
              onDesconectar={handleDesconectarGoogle}
              onSincronizar={handleSincronizarGoogle}
              carregando={carregandoGoogle}
              cor="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700/40"
            />
            <IntegracaoCard
              nome="Microsoft Outlook"
              icone={
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                  <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
                  <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
                  <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
                </svg>
              }
              configurado={isMicrosoftConfigured()}
              conectado={isMicrosoftConectado()}
              sincronizadaEm={sincMsEm}
              msgNaoConfigurado={msMsg()}
              onConectar={handleConectarMs}
              onDesconectar={handleDesconectarMs}
              onSincronizar={handleSincronizarMs}
              carregando={carregandoMs}
              cor="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700/40"
            />
          </div>

          {/* Preply + Uniasselvi + OneDrive */}
          <PreplyCard />
          <UniasselviCard
            onEventosImportados={(novos) => {
              setData(d => {
                const semUniasselvi = d.eventosAgenda.filter(e => !e.id.startsWith('ics-uniasselvi-'));
                return { ...d, eventosAgenda: [...semUniasselvi, ...deduplicarEventos(semUniasselvi, novos)] };
              });
            }}
          />
          <div className="bg-surface-50 dark:bg-surface-700/20 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-blue-400 font-black text-sm">OD</span>
            </div>
            <div>
              <p className="text-sm font-bold text-surface-900 dark:text-white">OneDrive</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">Sincronização com Microsoft OneDrive — em breve</p>
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-surface-200 dark:bg-surface-600 text-surface-500 dark:text-surface-400 font-medium">Em breve</span>
            </div>
          </div>

          {/* ICS */}
          <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-700/40 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 flex items-center justify-center shadow-sm">
                <Upload size={18} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-surface-900 dark:text-white">Importar arquivo .ics</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Arquivo de calendário iCalendar — compatível com qualquer app</p>
              </div>
            </div>
            <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
              Exporte o arquivo .ics do seu calendário (Apple Calendar, Outlook, Thunderbird, Google Calendar, etc.)
              e importe aqui. Os eventos serão adicionados automaticamente.
            </p>
            <input ref={icsInputRef} type="file" accept=".ics,.ical" onChange={handleIcsFile} className="hidden" />
            <Button size="sm" variant="secondary" onClick={() => icsInputRef.current?.click()} icon={<Upload size={14} />}>
              Selecionar arquivo .ics
            </Button>
          </div>

          {/* Lista de eventos importados */}
          {data.eventosAgenda.length > 0 && (
            <Card>
              <CardHeader title={`Eventos importados (${data.eventosAgenda.length})`} subtitle="Clique em 'Bloqueia' para alterar se o evento ocupa seu tempo" icon={<Calendar size={18} />} />
              <CardBody>
                <EventosLista eventos={data.eventosAgenda} onExcluir={excluirEvento} onToggle={toggleBloqueiaTempo} />
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Modal sincronizar calendário */}
      <Modal isOpen={modalSincronizar} onClose={() => setModalSincronizar(false)} title="Sincronizar calendário" size="md">
        <div className="space-y-4">
          <p className="text-sm text-surface-500 dark:text-surface-400">Escolha a fonte de calendário para conectar ou sincronizar.</p>

          {erroConexao && (
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-700/50 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-danger-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-danger-700 dark:text-danger-300">{erroConexao}</p>
            </div>
          )}

          {/* Google Calendar */}
          <div className="border border-red-200 dark:border-red-700/40 bg-red-50 dark:bg-red-900/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-surface-800 shadow flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-surface-900 dark:text-white">Google Calendar</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">
                  {!isGoogleConfigured() ? 'Não configurado (requer variável de ambiente)' : isGoogleConectado() ? '✓ Conectado' : 'Desconectado'}
                </p>
              </div>
            </div>
            {isGoogleConfigured() ? (
              <div className="flex gap-2">
                {isGoogleConectado() ? (
                  <>
                    <Button size="sm" onClick={async () => { await handleSincronizarGoogle(); setModalSincronizar(false); }} icon={<RefreshCw size={12} className={carregandoGoogle ? 'animate-spin' : ''} />} className="flex-1">
                      {carregandoGoogle ? 'Sincronizando…' : 'Sincronizar agora'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { handleDesconectarGoogle(); }} icon={<Link2Off size={12} />}>Sair</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={async () => { await handleConectarGoogle(); }} icon={<Link2 size={12} />} className="flex-1">
                    {carregandoGoogle ? 'Conectando…' : 'Conectar com Google'}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><Info size={11} /> {googleMsg()}</p>
            )}
          </div>

          {/* Microsoft Outlook */}
          <div className="border border-blue-200 dark:border-blue-700/40 bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-surface-800 shadow flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                  <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
                  <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
                  <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-surface-900 dark:text-white">Microsoft Outlook</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">
                  {!isMicrosoftConfigured() ? 'Não configurado (requer variável de ambiente)' : isMicrosoftConectado() ? '✓ Conectado' : 'Desconectado'}
                </p>
              </div>
            </div>
            {isMicrosoftConfigured() ? (
              <div className="flex gap-2">
                {isMicrosoftConectado() ? (
                  <>
                    <Button size="sm" onClick={async () => { await handleSincronizarMs(); setModalSincronizar(false); }} icon={<RefreshCw size={12} className={carregandoMs ? 'animate-spin' : ''} />} className="flex-1">
                      {carregandoMs ? 'Sincronizando…' : 'Sincronizar agora'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { handleDesconectarMs(); }} icon={<Link2Off size={12} />}>Sair</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={async () => { await handleConectarMs(); }} icon={<Link2 size={12} />} className="flex-1">
                    {carregandoMs ? 'Conectando…' : 'Conectar com Microsoft'}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><Info size={11} /> {msMsg()}</p>
            )}
          </div>

          {/* ICS */}
          <div className="border border-purple-200 dark:border-purple-700/40 bg-purple-50 dark:bg-purple-900/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-surface-800 shadow flex items-center justify-center flex-shrink-0">
                <Upload size={16} className="text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-surface-900 dark:text-white">Importar arquivo .ics</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Apple Calendar, Outlook, Thunderbird, Google Calendar…</p>
              </div>
            </div>
            <input ref={icsInputRef} type="file" accept=".ics,.ical" onChange={(e) => { handleIcsFile(e); setModalSincronizar(false); }} className="hidden" />
            <Button size="sm" variant="secondary" onClick={() => icsInputRef.current?.click()} icon={<Upload size={14} />} className="w-full">
              Selecionar arquivo .ics
            </Button>
          </div>

          <p className="text-xs text-center text-surface-400 dark:text-surface-500">
            Mais opções (Uniasselvi, Preply, OneDrive) disponíveis na aba <strong>Conexões</strong>.
          </p>
        </div>
      </Modal>

      {/* Modal bloqueio manual */}
      <Modal isOpen={modalManual} onClose={() => setModalManual(false)} title="Adicionar bloqueio manual" size="md">
        <div className="space-y-4">
          <Input id="m-titulo" label="Título" required value={formManual.titulo} onChange={e => setFormManual(f => ({ ...f, titulo: e.target.value }))} error={errosManual.titulo} placeholder="Ex: Reunião, Consulta médica…" />
          <div>
            <label htmlFor="m-data" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Data <span className="text-danger-500">*</span></label>
            <input
              id="m-data"
              type="date"
              value={formManual.data}
              onChange={e => setFormManual(f => ({ ...f, data: e.target.value }))}
              lang="pt-BR"
              style={{ colorScheme: 'dark' }}
              className="w-full px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 [&::-webkit-datetime-edit-month-field]:order-2 [&::-webkit-datetime-edit-day-field]:order-1 [&::-webkit-datetime-edit-year-field]:order-3"
            />
            {errosManual.data && <p className="mt-1 text-xs text-danger-600 dark:text-danger-400">{errosManual.data}</p>}
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={formManual.diaInteiro} onChange={e => setFormManual(f => ({ ...f, diaInteiro: e.target.checked }))} className="accent-primary-600 w-4 h-4" />
            <span className="text-sm text-surface-700 dark:text-surface-300">Dia inteiro</span>
          </label>
          {!formManual.diaInteiro && (
            <div className="grid grid-cols-2 gap-3">
              <Input id="m-ini" label="Início" required type="time" value={formManual.horaInicio} onChange={e => setFormManual(f => ({ ...f, horaInicio: e.target.value }))} error={errosManual.horaInicio} />
              <Input id="m-fim" label="Fim" required type="time" value={formManual.horaFim} onChange={e => setFormManual(f => ({ ...f, horaFim: e.target.value }))} error={errosManual.horaFim} />
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={formManual.bloqueiaTempo} onChange={e => setFormManual(f => ({ ...f, bloqueiaTempo: e.target.checked }))} className="accent-primary-600 w-4 h-4" />
            <span className="text-sm text-surface-700 dark:text-surface-300">Bloqueia tempo disponível</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalManual(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarManual}>Salvar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal classificar FDS */}
      {eventoClassificar && (
        <ModalClassificar
          evento={eventoClassificar}
          metas={data.metas}
          onVincular={handleVincularMeta}
          onSemClassificacao={handleSemClassificacao}
          onIgnorar={handleIgnorar}
          onFechar={() => setEventoClassificar(null)}
        />
      )}
    </div>
  );
}
