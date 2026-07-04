import { Award, Compass, Sparkles } from 'lucide-react';
import type { FinalInterviewOverallFeedback } from '../../types/englishInterview';

interface FinalInterviewResultProps {
  feedback: FinalInterviewOverallFeedback;
}

const criteria: Array<[keyof FinalInterviewOverallFeedback, string]> = [
  ['fluency_score', 'Fluência'],
  ['technical_clarity_score', 'Clareza técnica'],
  ['star_structure_score', 'Estrutura STAR'],
  ['confidence_score', 'Confiança'],
  ['grammar_score', 'Gramática'],
  ['vocabulary_score', 'Vocabulário'],
];

function readinessColor(score: number): string {
  if (score >= 75) return 'text-success-600 dark:text-success-300';
  if (score >= 50) return 'text-warning-600 dark:text-warning-300';
  return 'text-danger-600 dark:text-danger-300';
}

function FeedbackList({ title, items, tone }: { title: string; items: string[]; tone?: 'success' | 'danger' | 'neutral' }) {
  if (items.length === 0) return null;
  const titleClass = tone === 'success'
    ? 'text-success-700 dark:text-success-300'
    : tone === 'danger'
      ? 'text-danger-700 dark:text-danger-300'
      : 'text-surface-500 dark:text-surface-400';
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide ${titleClass}`}>{title}</p>
      <ul className="mt-1 space-y-1 break-words text-sm leading-6 text-surface-700 dark:text-surface-200">
        {items.map((item, index) => <li key={`${title}-${index}`}>• {item}</li>)}
      </ul>
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-lg bg-white/70 p-3 dark:bg-white/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{title}</p>
      <p className="mt-1 break-words text-sm leading-6 text-surface-700 dark:text-surface-200">{text}</p>
    </div>
  );
}

export function FinalInterviewResult({ feedback }: FinalInterviewResultProps) {
  return (
    <div className="space-y-4 rounded-xl border border-primary-300/20 bg-primary-500/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Award size={18} className="text-primary-600 dark:text-primary-200" />
        <span className="text-sm font-semibold text-surface-950 dark:text-white">Resultado do simulado final</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="rounded-xl bg-white/70 px-6 py-4 text-center dark:bg-white/10">
          <p className={`text-4xl font-extrabold ${readinessColor(feedback.readiness_score)}`}>
            {feedback.readiness_score}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">de 100</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Prontidão para entrevista de 30 min</p>
          <p className="mt-1 break-words text-lg font-bold text-surface-950 dark:text-white">{feedback.overall_level}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {criteria.map(([key, label]) => (
          <div key={key} className="rounded-lg bg-white/70 p-2 text-center dark:bg-white/10">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-surface-950 dark:text-white">{feedback[key] as number}/10</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FeedbackList title="Pontos fortes" items={feedback.strengths} tone="success" />
        <FeedbackList title="Pontos fracos" items={feedback.weaknesses} tone="danger" />
        <FeedbackList title="Erros recorrentes" items={feedback.repeated_mistakes} />
        <FeedbackList title="Vocabulário que faltou" items={feedback.missing_vocabulary} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TextBlock title="Melhor resposta" text={feedback.best_answer_summary} />
        <TextBlock title="Resposta mais fraca" text={feedback.weakest_answer_summary} />
      </div>

      <div className="rounded-lg bg-white/70 p-3 dark:bg-white/10">
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
          <Compass size={12} /> Foco recomendado para a próxima semana
        </p>
        <ul className="mt-1 space-y-1 break-words text-sm leading-6 text-surface-700 dark:text-surface-200">
          {feedback.recommended_next_week_focus.map((item, index) => <li key={`focus-${index}`}>• {item}</li>)}
        </ul>
      </div>

      <TextBlock title="Estratégia para a próxima entrevista" text={feedback.suggested_interview_strategy} />

      <div className="rounded-lg border border-primary-300/25 bg-white/80 p-3 dark:bg-white/[0.08]">
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-200">
          <Sparkles size={12} /> Feedback final
        </p>
        <p className="mt-1 break-words text-sm leading-6 text-surface-800 dark:text-surface-100">{feedback.final_feedback_pt}</p>
      </div>
    </div>
  );
}
