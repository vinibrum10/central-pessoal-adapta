import { BookOpenCheck, CheckCircle2, Circle, HelpCircle, Mic, PlayCircle } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import { Button } from '../Button';
import type { DailySession, InterviewQuestion, ListeningEpisode } from '../../types/englishInterview';

type StepKey = 'step_listening_done' | 'step_shadowing_done' | 'step_cards_done' | 'step_question_done';

interface DailyInterviewSessionProps {
  session: DailySession;
  episode: ListeningEpisode | null;
  question: InterviewQuestion | null;
  onToggleStep: (step: StepKey) => void;
  onStart: () => void;
}

const steps: Array<{
  key: StepKey;
  title: string;
  icon: typeof PlayCircle;
  subtitle: (episode: ListeningEpisode | null, question: InterviewQuestion | null) => string;
}> = [
  {
    key: 'step_listening_done',
    title: 'Listening setorial',
    icon: PlayCircle,
    subtitle: episode => episode?.title ?? 'Escolha um episódio ou cole um link manual em Listening setorial.',
  },
  {
    key: 'step_shadowing_done',
    title: 'Shadowing do mesmo trecho',
    icon: Mic,
    subtitle: episode => episode ? 'Repita em voz alta frases do mesmo conteúdo técnico.' : 'Use o listening escolhido como base.',
  },
  {
    key: 'step_cards_done',
    title: '5 cards do glossário',
    icon: BookOpenCheck,
    subtitle: () => 'Revise termos de Power Systems com Leitner.',
  },
  {
    key: 'step_question_done',
    title: '1 pergunta de entrevista',
    icon: HelpCircle,
    subtitle: (_episode, question) => question?.question_en ?? 'Pergunta sorteada do banco de entrevista.',
  },
];

export function DailyInterviewSession({ session, episode, question, onToggleStep, onStart }: DailyInterviewSessionProps) {
  const doneCount = steps.filter(step => session[step.key]).length;

  return (
    <Card>
      <CardHeader
        title="Sessão de hoje"
        subtitle={`${doneCount}/4 passos concluídos`}
        icon={<PlayCircle size={18} />}
        action={<Button size="sm" onClick={onStart}>Começar sessão</Button>}
      />
      <CardBody className="space-y-3">
        {steps.map((step, index) => {
          const done = Boolean(session[step.key]);
          const Icon = step.icon;
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onToggleStep(step.key)}
              className="flex w-full items-start gap-3 rounded-lg border border-surface-200 bg-white/70 p-3 text-left transition-colors hover:border-primary-300 dark:border-primary-300/15 dark:bg-white/[0.03] dark:hover:border-primary-300/35"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-100 text-surface-600 dark:bg-white/10 dark:text-surface-200">
                {done ? <CheckCircle2 size={18} className="text-success-600 dark:text-success-300" /> : <Circle size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-primary-600 dark:text-primary-300">{index + 1}</span>
                  <Icon size={15} className="text-surface-400" />
                  <span className="text-sm font-semibold text-surface-950 dark:text-white">{step.title}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-surface-500 dark:text-surface-400">
                  {step.subtitle(episode, question)}
                </p>
              </div>
            </button>
          );
        })}
      </CardBody>
    </Card>
  );
}
