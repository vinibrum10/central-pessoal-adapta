import { CheckCircle2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../Card';
import { Button } from '../../Button';
import { YoutubeEmbedPlayer } from './YoutubeEmbedPlayer';
import type { DailyVideoItem } from '../../../types/dailyVideoEnglish';

export type StudyStep = 'listening' | 'quiz' | 'shadowing' | 'review';

export const STUDY_STEP_ORDER: StudyStep[] = ['listening', 'quiz', 'shadowing', 'review'];

const STEP_LABELS: Record<StudyStep, string> = {
  listening: 'Listening',
  quiz: 'Questionário',
  shadowing: 'Shadowing',
  review: 'Revisão',
};

interface DailyStudyFlowProps {
  video: DailyVideoItem;
  step: StudyStep;
  onCompleteListening: () => void;
  onGoToStep: (step: StudyStep) => void;
}

export function DailyStudyFlow({ video, step, onCompleteListening, onGoToStep }: DailyStudyFlowProps) {
  const currentIndex = STUDY_STEP_ORDER.indexOf(step);

  return (
    <Card>
      <CardHeader title="Estudo de hoje" subtitle={video.title} />
      <CardBody className="space-y-4">
        <ol className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {STUDY_STEP_ORDER.map((key, index) => {
            const isCurrent = key === step;
            const isDone = index < currentIndex;
            return (
              <li
                key={key}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
                  isCurrent
                    ? 'bg-primary-600 text-white'
                    : isDone
                      ? 'bg-success-100 text-success-700 dark:bg-success-500/10 dark:text-success-300'
                      : 'bg-surface-100 text-surface-500 dark:bg-white/5 dark:text-surface-400'
                }`}
              >
                {isDone ? <CheckCircle2 size={12} /> : <span>{index + 1}.</span>}
                {STEP_LABELS[key]}
              </li>
            );
          })}
        </ol>

        {step === 'listening' && (
          <div className="space-y-3">
            <YoutubeEmbedPlayer videoId={video.videoId} title={video.title} />
            <Button type="button" variant="primary" onClick={onCompleteListening}>
              Concluir Listening e continuar
            </Button>
          </div>
        )}

        {step === 'quiz' && (
          <div className="space-y-3">
            <p className="text-sm text-surface-600 dark:text-surface-300">
              Questionário sobre o vídeo de hoje — em construção.
            </p>
            <Button type="button" variant="primary" onClick={() => onGoToStep('shadowing')}>
              Continuar para Shadowing
            </Button>
          </div>
        )}

        {step === 'shadowing' && (
          <div className="space-y-3">
            <p className="text-sm text-surface-600 dark:text-surface-300">
              Prática de shadowing — em construção.
            </p>
            <Button type="button" variant="primary" onClick={() => onGoToStep('review')}>
              Continuar para Revisão
            </Button>
          </div>
        )}

        {step === 'review' && (
          <p className="text-sm text-surface-600 dark:text-surface-300">
            Revisão do estudo de hoje — em construção.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
