import type { FinalInterviewQuestionRow } from '../../types/englishInterview';

interface FinalInterviewProgressProps {
  questions: FinalInterviewQuestionRow[];
  currentIndex: number;
}

export function FinalInterviewProgress({ questions, currentIndex }: FinalInterviewProgressProps) {
  const total = questions.length;
  const answered = questions.filter(question => question.audio_path).length;
  const evaluated = questions.filter(question => question.individual_feedback).length;
  const progress = total === 0 ? 0 : Math.round((answered / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-surface-600 dark:text-surface-300">
        <span className="uppercase tracking-wide">Pergunta {Math.min(currentIndex + 1, total)} de {total}</span>
        <span>{answered} respondidas · {evaluated} avaliadas · {progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-white/10">
        <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex flex-wrap gap-1">
        {questions.map((question, index) => (
          <span
            key={question.id}
            title={`Pergunta ${index + 1}`}
            className={`h-1.5 flex-1 rounded-full ${
              index === currentIndex
                ? 'bg-primary-600'
                : question.individual_feedback
                  ? 'bg-success-500'
                  : question.audio_path
                    ? 'bg-warning-400'
                    : 'bg-surface-200 dark:bg-white/15'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
