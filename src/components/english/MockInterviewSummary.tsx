import { Award, Sparkles } from 'lucide-react';
import type { MockInterviewOverallFeedback } from '../../types/englishInterview';

const criteria: Array<[keyof MockInterviewOverallFeedback, string]> = [
  ['fluency_score', 'Fluência'],
  ['technical_clarity_score', 'Clareza técnica'],
  ['star_structure_score', 'Estrutura STAR'],
  ['grammar_score', 'Gramática'],
];

export function MockInterviewSummary({ feedback }: { feedback: MockInterviewOverallFeedback }) {
  return (
    <div className="space-y-4 rounded-lg border border-primary-300/20 bg-primary-500/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Award size={18} className="text-primary-600 dark:text-primary-200" />
        <span className="text-sm font-semibold text-surface-950 dark:text-white">Avaliação geral do mock</span>
        <span className="rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-primary-700 dark:bg-white/10 dark:text-primary-200">
          Nota geral: {feedback.overall_score}/10
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {criteria.map(([key, label]) => (
          <div key={key} className="rounded-lg bg-white/70 p-2 text-center dark:bg-white/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-surface-950 dark:text-white">{feedback[key] as number}/10</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <FeedbackList title="Pontos fortes" items={feedback.strengths} />
        <FeedbackList title="Pontos fracos" items={feedback.weaknesses} />
        <FeedbackList title="Próximos passos" items={feedback.recommended_next_steps} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-white/70 p-3 dark:bg-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-success-700 dark:text-success-300">Melhor resposta</p>
          <p className="mt-1 break-words text-sm leading-6 text-surface-700 dark:text-surface-200">{feedback.best_answer}</p>
        </div>
        <div className="rounded-lg bg-white/70 p-3 dark:bg-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-danger-700 dark:text-danger-300">Resposta mais fraca</p>
          <p className="mt-1 break-words text-sm leading-6 text-surface-700 dark:text-surface-200">{feedback.weakest_answer}</p>
        </div>
      </div>

      <div className="rounded-lg bg-white/70 p-3 dark:bg-white/10">
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
          <Sparkles size={12} /> Foco de treino sugerido
        </p>
        <p className="mt-1 break-words text-sm leading-6 text-surface-700 dark:text-surface-200">{feedback.suggested_training_focus}</p>
      </div>
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">Sem notas.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-xs leading-5 text-surface-700 dark:text-surface-200">
          {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}
