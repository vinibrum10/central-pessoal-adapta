import { CheckCircle2, XCircle, Calendar, Sparkles } from 'lucide-react';
import type { EventoAgenda, Tarefa, Meta, SugestaoCalendario } from '../types';
import { getWeekDays, classifyWeek, classifyNight } from '../utils/nightAvailability';
import { Button } from './Button';

interface PlanejamentoSemanalProps {
  eventos: EventoAgenda[];
  tarefas: Tarefa[];
  metas: Meta[];
  sugestoes: SugestaoCalendario[];
  onGerarSugestoes: () => void;
  onAceitar: (id: string) => void;
  onCancelar: (id: string) => void;
  onRecusar: (id: string) => void;
}

const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_LABEL: Record<SugestaoCalendario['status'], string> = {
  sugerida: 'Sugerida',
  aceita: 'Aceita',
  editada: 'Editada',
  cancelada: 'Cancelada',
  recusada: 'Recusada',
};

const STATUS_COLOR: Record<SugestaoCalendario['status'], string> = {
  sugerida: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  aceita: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  editada: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  cancelada: 'bg-surface-100 dark:bg-surface-700 text-surface-400',
  recusada: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

export function PlanejamentoSemanal({
  eventos,
  tarefas,
  metas,
  sugestoes,
  onGerarSugestoes,
  onAceitar,
  onCancelar,
  onRecusar,
}: PlanejamentoSemanalProps) {
  const hoje = new Date();
  const weekDays = getWeekDays(hoje);
  const weekClass = classifyWeek(eventos, hoje);
  const occupiedCount = weekDays.filter(d => classifyNight(d, eventos) === 'ocupada').length;
  const freeCount = 5 - occupiedCount;

  const weekBadge =
    weekClass === 'leve'
      ? { label: `Semana leve — ${freeCount} noites livres`, cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' }
      : weekClass === 'mediana'
      ? { label: `Semana mediana — ${occupiedCount} noites ocupadas`, cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' }
      : { label: `Semana pesada — ${occupiedCount}/5 noites ocupadas`, cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' };

  const sugestoesAtivas = sugestoes.filter(s => s.status === 'sugerida' || s.status === 'aceita' || s.status === 'editada');
  const sugestoesHistorico = sugestoes.filter(s => s.status === 'cancelada' || s.status === 'recusada');

  function getTarefaLabel(tarefaId: string): string {
    const t = tarefas.find(x => x.id === tarefaId);
    return t?.titulo ?? 'Tarefa removida';
  }

  function getMetaLabel(metaId?: string): string | null {
    if (!metaId) return null;
    const m = metas.find(x => x.id === metaId);
    return m ? m.nome : null;
  }

  return (
    <div className="space-y-5">
      {/* Análise da semana */}
      <div className="bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-primary-500 flex-shrink-0" />
          <h3 className="text-sm font-bold text-surface-900 dark:text-white">Análise da semana</h3>
        </div>

        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${weekBadge.cls}`}>
          {weekBadge.label}
        </span>

        {/* Grade de noites */}
        <div className="grid grid-cols-5 gap-2">
          {weekDays.map(day => {
            const isOccupied = classifyNight(day, eventos) === 'ocupada';
            const dayName = DIAS_PT[day.getDay()];
            const dateStr = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;
            return (
              <div
                key={day.toISOString()}
                className={`rounded-xl border p-3 text-center space-y-1.5 ${
                  isOccupied
                    ? 'border-red-200 dark:border-red-700/40 bg-red-50 dark:bg-red-900/10'
                    : 'border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/10'
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400">{dayName}</p>
                <p className="text-[10px] text-surface-400 dark:text-surface-500">{dateStr}</p>
                {isOccupied
                  ? <XCircle size={14} className="mx-auto text-red-500" />
                  : <CheckCircle2 size={14} className="mx-auto text-emerald-500" />
                }
                <p className={`text-[9px] font-semibold ${isOccupied ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {isOccupied ? 'Ocupada' : 'Livre'}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onGerarSugestoes}
            icon={<Sparkles size={14} />}
            size="sm"
          >
            Gerar sugestões no calendário
          </Button>
        </div>
      </div>

      {/* Sugestões ativas */}
      {sugestoesAtivas.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-surface-900 dark:text-white">Sugestões criadas</h3>
          {sugestoesAtivas.map(s => {
            const tarefaLabel = getTarefaLabel(s.tarefaId);
            const metaLabel = getMetaLabel(s.metaId);
            return (
              <div
                key={s.id}
                className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{tarefaLabel}</p>
                    {metaLabel && (
                      <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">{metaLabel}</p>
                    )}
                    <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                      {s.diaAgendado} · {s.horaInicio}–{s.horaFim}
                    </p>
                    {s.motivo && (
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 leading-relaxed">{s.motivo}</p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>

                {s.status === 'sugerida' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onAceitar(s.id)} icon={<CheckCircle2 size={12} />} className="flex-1">
                      Aceitar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => onRecusar(s.id)} icon={<XCircle size={12} />}>
                      Recusar
                    </Button>
                    <button
                      onClick={() => onCancelar(s.id)}
                      className="px-3 py-1.5 rounded-xl text-xs text-surface-400 hover:text-danger-500 border border-surface-200 dark:border-surface-600 hover:border-danger-300 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {s.status === 'aceita' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onCancelar(s.id)}
                      className="px-3 py-1.5 rounded-xl text-xs text-surface-400 hover:text-danger-500 border border-surface-200 dark:border-surface-600 hover:border-danger-300 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {s.externalEventId && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    Evento criado no Google Calendar
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Histórico */}
      {sugestoesHistorico.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wide">Histórico</h3>
          {sugestoesHistorico.map(s => (
            <div
              key={s.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-surface-100 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 opacity-60"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-surface-700 dark:text-surface-300 truncate">{getTarefaLabel(s.tarefaId)}</p>
                <p className="text-[10px] text-surface-400">{s.diaAgendado} · {s.horaInicio}–{s.horaFim}</p>
              </div>
              <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[s.status]}`}>
                {STATUS_LABEL[s.status]}
              </span>
            </div>
          ))}
        </div>
      )}

      {sugestoes.length === 0 && (
        <div className="text-center py-10 space-y-2">
          <Sparkles size={32} className="mx-auto text-surface-300 dark:text-surface-600" />
          <p className="text-sm font-medium text-surface-600 dark:text-surface-300">Nenhuma sugestão ainda</p>
          <p className="text-xs text-surface-400 dark:text-surface-500">
            Clique em "Gerar sugestões" para o sistema indicar tarefas para suas noites livres desta semana.
          </p>
        </div>
      )}
    </div>
  );
}
