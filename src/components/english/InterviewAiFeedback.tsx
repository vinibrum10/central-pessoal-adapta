import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import type { InterviewAnswerFeedback } from '../../types/englishInterview';

const starLabels = [
  ['situation', 'Situação'],
  ['task', 'Tarefa'],
  ['action', 'Ação'],
  ['result', 'Resultado'],
] as const;

export function InterviewAiFeedback({ feedback }: { feedback: InterviewAnswerFeedback }) {
  return (
    <div className="space-y-3 rounded-lg border border-primary-300/20 bg-primary-500/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles size={15} className="text-primary-600 dark:text-primary-200" />
        <span className="text-sm font-semibold text-surface-950 dark:text-white">Feedback Gemini</span>
        <span className="rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-primary-700 dark:bg-white/10 dark:text-primary-200">
          {feedback.score}/10
        </span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Transcript</p>
        <p className="mt-1 break-words text-sm leading-6 text-surface-700 dark:text-surface-200">{feedback.transcript}</p>
      </div>

      {feedback.star_structure && (
        <div className="flex flex-wrap gap-2">
          {starLabels.map(([key, label]) => {
            const ok = Boolean(feedback.star_structure?.[key]);
            return (
              <span key={key} className="inline-flex items-center gap-1 rounded-lg bg-white/70 px-2 py-1 text-xs font-medium text-surface-700 dark:bg-white/10 dark:text-surface-200">
                {ok ? <CheckCircle2 size={12} className="text-success-600" /> : <Circle size={12} className="text-surface-400" />}
                {label}
              </span>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <FeedbackList title="Pontos fortes" items={feedback.strengths} />
        <FeedbackList title="Melhorias" items={feedback.improvements} />
        <FeedbackList title="Gramática" items={feedback.grammar_notes ?? []} />
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
        <ul className="mt-1 space-y-1 break-words text-xs leading-5 text-surface-700 dark:text-surface-200">
          {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}
