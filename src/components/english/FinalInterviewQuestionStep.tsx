import { ChevronLeft, ChevronRight, Lightbulb, Loader2, Sparkles, Timer } from 'lucide-react';
import { Button } from '../Button';
import { InterviewAiFeedback } from './InterviewAiFeedback';
import { InterviewAnswerRecorder } from './InterviewAnswerRecorder';
import {
  FINAL_INTERVIEW_CATEGORY_LABELS,
  type FinalInterviewQuestionCategory,
  type FinalInterviewQuestionRow,
  type InterviewQuestion,
} from '../../types/englishInterview';
import { formatDuration } from '../../services/english/interviewAudio';

interface FinalInterviewQuestionStepProps {
  question: FinalInterviewQuestionRow;
  index: number;
  total: number;
  saving: boolean;
  evaluating: boolean;
  onSaveAnswer: (params: { audio: Blob; mimeType: string; durationSec: number; selfRating: number }) => Promise<void>;
  onEvaluate: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

function categoryLabel(category: string | null): string {
  if (!category) return 'Geral';
  return FINAL_INTERVIEW_CATEGORY_LABELS[category as FinalInterviewQuestionCategory] ?? category;
}

// O gravador existente espera um InterviewQuestion do banco; monta um equivalente
// a partir da pergunta do simulado para reaproveitar a mesma lógica de gravação.
function toRecorderQuestion(row: FinalInterviewQuestionRow): InterviewQuestion {
  return {
    id: row.id,
    category: row.question_category ?? 'final',
    question_en: row.question_text,
    o_que_avaliam: '',
    como_responder: row.guidance ?? '',
    temas_relacionados: [],
    timer_sugerido_min: Math.max(1, Math.round((row.suggested_duration_sec || 180) / 60)),
  };
}

export function FinalInterviewQuestionStep({
  question,
  index,
  total,
  saving,
  evaluating,
  onSaveAnswer,
  onEvaluate,
  onPrevious,
  onNext,
}: FinalInterviewQuestionStepProps) {
  return (
    <div className="space-y-4 rounded-xl border border-surface-200 bg-white/75 p-4 dark:border-primary-300/15 dark:bg-white/[0.03] sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-semibold text-primary-700 dark:text-primary-200">
          {categoryLabel(question.question_category)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">
          <Timer size={12} />
          ~{formatDuration(question.suggested_duration_sec)}
        </span>
        <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">
          {index + 1}/{total}
        </span>
      </div>

      <p className="break-words text-lg font-semibold leading-7 text-surface-950 dark:text-white">
        {question.question_text}
      </p>

      {question.guidance && (
        <p className="flex items-start gap-2 rounded-lg bg-primary-500/5 px-3 py-2 text-sm leading-6 text-surface-600 dark:text-surface-300">
          <Lightbulb size={15} className="mt-1 shrink-0 text-primary-600 dark:text-primary-300" />
          <span className="break-words">{question.guidance}</span>
        </p>
      )}

      <InterviewAnswerRecorder
        question={toRecorderQuestion(question)}
        saving={saving}
        onSave={onSaveAnswer}
      />

      {question.audioUrl && (
        <div className="space-y-3 rounded-lg border border-primary-300/20 bg-primary-500/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
            Resposta salva · {formatDuration(question.duration_sec ?? 0)}
          </p>
          <audio controls src={question.audioUrl} className="w-full" />
          {!question.individual_feedback && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={evaluating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              loading={evaluating}
              disabled={evaluating}
              onClick={onEvaluate}
            >
              Avaliar resposta com IA
            </Button>
          )}
        </div>
      )}

      {question.individual_feedback && <InterviewAiFeedback feedback={question.individual_feedback} />}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" icon={<ChevronLeft size={14} />} onClick={onPrevious} disabled={index === 0}>
          Anterior
        </Button>
        <Button type="button" size="sm" variant="secondary" icon={<ChevronRight size={14} />} onClick={onNext} disabled={index >= total - 1}>
          Próxima
        </Button>
      </div>
    </div>
  );
}
