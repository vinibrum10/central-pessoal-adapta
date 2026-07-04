import {
  FINAL_INTERVIEW_FOCUS_LABELS,
  FINAL_INTERVIEW_STATUS_LABELS,
  type FinalInterviewFocusArea,
  type FinalInterviewSimulation,
} from '../../types/englishInterview';

interface FinalInterviewHistoryProps {
  simulations: FinalInterviewSimulation[];
  onSelect: (simulationId: string) => void;
}

function focusLabel(focus: string | null): string {
  if (!focus) return 'Entrevista geral';
  return FINAL_INTERVIEW_FOCUS_LABELS[focus as FinalInterviewFocusArea] ?? focus;
}

function statusClasses(status: FinalInterviewSimulation['status']): string {
  if (status === 'evaluated') return 'bg-success-500/10 text-success-700 dark:text-success-300';
  if (status === 'in_progress') return 'bg-warning-500/10 text-warning-700 dark:text-warning-300';
  return 'bg-surface-100 text-surface-600 dark:bg-white/10 dark:text-surface-300';
}

export function FinalInterviewHistory({ simulations, onSelect }: FinalInterviewHistoryProps) {
  if (simulations.length === 0) {
    return (
      <p className="text-sm text-surface-500 dark:text-surface-400">
        Nenhum simulado criado ainda. Crie o primeiro simulado de 30 minutos para medir sua prontidão.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {simulations.map(simulation => (
        <button
          key={simulation.id}
          type="button"
          onClick={() => onSelect(simulation.id)}
          className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-200 bg-white/70 p-3 text-left transition-colors hover:bg-surface-50 dark:border-primary-300/15 dark:bg-white/[0.03] dark:hover:bg-white/10"
        >
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-surface-950 dark:text-white">{simulation.title}</p>
            <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
              {focusLabel(simulation.focus_area)} · {simulation.question_count} perguntas · {new Date(simulation.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {simulation.readiness_score !== null && (
              <span className="rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-semibold text-primary-700 dark:text-primary-200">
                Prontidão: {Math.round(Number(simulation.readiness_score))}/100
              </span>
            )}
            <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${statusClasses(simulation.status)}`}>
              {FINAL_INTERVIEW_STATUS_LABELS[simulation.status] ?? simulation.status}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
