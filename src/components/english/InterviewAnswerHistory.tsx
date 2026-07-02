import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '../Button';
import type { InterviewAnswer } from '../../types/englishInterview';
import { formatDuration } from '../../services/english/interviewAudio';
import { InterviewAiFeedback } from './InterviewAiFeedback';

interface InterviewAnswerHistoryProps {
  answers: InterviewAnswer[];
  evaluatingAnswerId: string | null;
  onEvaluate: (answer: InterviewAnswer) => void;
}

export function InterviewAnswerHistory({ answers, evaluatingAnswerId, onEvaluate }: InterviewAnswerHistoryProps) {
  const [open, setOpen] = useState(false);
  const [expandedFeedback, setExpandedFeedback] = useState<Record<string, boolean>>({});

  if (answers.length === 0) {
    return <p className="text-sm text-surface-500 dark:text-surface-400">Nenhuma tentativa gravada para esta pergunta.</p>;
  }

  const latest = answers[0];
  const latestScore = latest.gemini_feedback?.score;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border border-surface-200 bg-white/70 p-3 dark:border-primary-300/15 dark:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-surface-950 dark:text-white">Histórico por pergunta — {answers.length} respostas</p>
          <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
            Última: {new Date(latest.created_at).toLocaleString('pt-BR')} · {formatDuration(latest.duration_sec)}
            {latestScore ? ` · nota ${latestScore}/10` : ''}
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(prev => !prev)}>
          {open ? 'Ocultar histórico' : 'Ver histórico'}
        </Button>
      </div>

      {!open && latest.gemini_feedback && (
        <div className="rounded-lg border border-surface-200 bg-surface-50/70 p-3 dark:border-primary-300/15 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setExpandedFeedback(prev => ({ ...prev, [latest.id]: !prev[latest.id] }))}
            className="text-xs font-semibold text-primary-700 hover:underline dark:text-primary-200"
          >
            {expandedFeedback[latest.id] ? 'Ocultar feedback da última resposta' : 'Expandir feedback da última resposta'}
          </button>
          {expandedFeedback[latest.id] && (
            <div className="mt-3">
              <InterviewAiFeedback feedback={latest.gemini_feedback} />
            </div>
          )}
        </div>
      )}

      {!open && !latest.gemini_feedback && (
        <div className="rounded-lg border border-surface-200 bg-surface-50/70 p-3 text-xs text-surface-500 dark:border-primary-300/15 dark:bg-white/[0.02] dark:text-surface-400">
          Última resposta ainda sem feedback de IA. Abra o histórico para avaliar.
        </div>
      )}

      {open && (
        <div className="space-y-3">
          {answers.map(answer => {
            const evaluating = evaluatingAnswerId === answer.id;
            return (
              <div key={answer.id} className="space-y-3 rounded-lg border border-surface-200 bg-white/70 p-3 dark:border-primary-300/15 dark:bg-white/[0.03]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">
                      {new Date(answer.created_at).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {formatDuration(answer.duration_sec)} · autoavaliação {answer.self_rating ?? '—'}/10
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={evaluating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    loading={evaluating}
                    onClick={() => onEvaluate(answer)}
                    disabled={!answer.audio_path || evaluating}
                  >
                    {answer.gemini_feedback ? 'Reavaliar com IA' : 'Avaliar com IA'}
                  </Button>
                </div>

                {answer.audioUrl ? (
                  <audio controls src={answer.audioUrl} className="w-full" />
                ) : (
                  <p className="text-xs text-warning-600 dark:text-warning-300">Áudio indisponível. Atualize a página para gerar novo link privado.</p>
                )}

                {answer.gemini_feedback && <InterviewAiFeedback feedback={answer.gemini_feedback} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
