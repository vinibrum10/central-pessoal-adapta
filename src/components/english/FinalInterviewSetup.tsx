import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '../Button';
import {
  FINAL_INTERVIEW_FOCUS_LABELS,
  type FinalInterviewFocusArea,
  type JobTarget,
} from '../../types/englishInterview';
import {
  FINAL_INTERVIEW_DEFAULT_QUESTIONS,
  FINAL_INTERVIEW_MAX_QUESTIONS,
  FINAL_INTERVIEW_MIN_QUESTIONS,
} from '../../services/english/finalInterviewPlanner';

interface FinalInterviewSetupProps {
  jobTargets: JobTarget[];
  creating: boolean;
  onCreate: (params: {
    title: string;
    focus: FinalInterviewFocusArea;
    jobTargetId: string | null;
    questionCount: number;
  }) => Promise<void>;
  onCancel: () => void;
}

const FOCUS_OPTIONS = Object.entries(FINAL_INTERVIEW_FOCUS_LABELS) as Array<[FinalInterviewFocusArea, string]>;

const inputClass = 'min-h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900 outline-none placeholder:text-surface-400 focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-white';

export function FinalInterviewSetup({ jobTargets, creating, onCreate, onCancel }: FinalInterviewSetupProps) {
  const [title, setTitle] = useState('');
  const [focus, setFocus] = useState<FinalInterviewFocusArea>('general');
  const [jobTargetId, setJobTargetId] = useState('');
  const [questionCount, setQuestionCount] = useState(FINAL_INTERVIEW_DEFAULT_QUESTIONS);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onCreate({
      title,
      focus,
      jobTargetId: jobTargetId || null,
      questionCount,
    });
  }

  return (
    <form className="space-y-4 rounded-lg border border-primary-300/20 bg-primary-500/5 p-4" onSubmit={handleSubmit}>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Título (opcional)</span>
        <input
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="Ex.: Simulado final — foco em subestações"
          className={inputClass}
        />
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Foco do simulado</p>
        <div className="flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFocus(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                focus === value
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-white/10 dark:text-surface-300 dark:hover:bg-white/15'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Vaga-alvo (opcional)</span>
          <select value={jobTargetId} onChange={event => setJobTargetId(event.target.value)} className={inputClass}>
            <option value="">Sem vaga-alvo</option>
            {jobTargets.map(target => (
              <option key={target.id} value={target.id}>
                {target.title}{target.company ? ` — ${target.company}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
            Quantidade de perguntas ({FINAL_INTERVIEW_MIN_QUESTIONS}–{FINAL_INTERVIEW_MAX_QUESTIONS})
          </span>
          <input
            type="number"
            min={FINAL_INTERVIEW_MIN_QUESTIONS}
            max={FINAL_INTERVIEW_MAX_QUESTIONS}
            value={questionCount}
            onChange={event => setQuestionCount(Number(event.target.value) || FINAL_INTERVIEW_DEFAULT_QUESTIONS)}
            className={inputClass}
          />
        </label>
      </div>

      <p className="text-xs text-surface-500 dark:text-surface-400">
        Duração estimada: ~30 minutos. As perguntas misturam apresentação, STAR, técnica, vaga-alvo/experiência, adaptação aos EUA e encerramento.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={creating} icon={<Sparkles size={16} />}>
          Criar simulado de 30 minutos
        </Button>
        <Button type="button" variant="secondary" disabled={creating} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
