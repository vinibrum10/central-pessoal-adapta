import { useState } from 'react';
import { BookOpen, RotateCcw, Volume2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import { Button } from '../Button';
import type { GlossaryReviewCard } from '../../types/englishInterview';
import { INTERVIEW_THEME_LABELS } from '../../types/englishInterview';

interface TechnicalGlossaryCardsProps {
  cards: GlossaryReviewCard[];
  onReview: (card: GlossaryReviewCard, result: 'acertou' | 'errou') => void;
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}

export function TechnicalGlossaryCards({ cards, onReview }: TechnicalGlossaryCardsProps) {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  return (
    <Card>
      <CardHeader
        title="Glossário técnico 200"
        subtitle="Frente em inglês, verso com tradução, definição e exemplo."
        icon={<BookOpen size={18} />}
      />
      <CardBody className="space-y-3">
        {cards.length === 0 ? (
          <p className="text-sm text-surface-500 dark:text-surface-400">Nenhum card disponível. Rode o seed do glossário.</p>
        ) : cards.map(card => {
          const isFlipped = Boolean(flipped[card.term.id]);
          return (
            <div
              key={card.term.id}
              className="rounded-lg border border-surface-200 bg-white/75 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-surface-950 dark:text-white">{card.term.term}</p>
                    <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">
                      Caixa {card.box}
                    </span>
                    <span className="rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-medium text-primary-700 dark:text-primary-200">
                      {INTERVIEW_THEME_LABELS[card.term.theme] ?? card.term.theme}
                    </span>
                  </div>
                  {isFlipped ? (
                    <div className="mt-3 space-y-2 text-sm leading-6">
                      <p className="text-surface-700 dark:text-surface-200"><span className="font-semibold">PT:</span> {card.term.translation_pt}</p>
                      <p className="text-surface-600 dark:text-surface-300"><span className="font-semibold">Definition:</span> {card.term.definition_en}</p>
                      <p className="text-surface-600 dark:text-surface-300"><span className="font-semibold">Example:</span> {card.term.example_en}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-surface-500 dark:text-surface-400">Tente lembrar a tradução e explique em voz alta antes de virar.</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => speak(card.term.term)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 transition-colors hover:bg-surface-50 dark:border-primary-300/15 dark:text-surface-300 dark:hover:bg-white/10"
                    title="Ouvir pronúncia"
                  >
                    <Volume2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipped(prev => ({ ...prev, [card.term.id]: !isFlipped }))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 transition-colors hover:bg-surface-50 dark:border-primary-300/15 dark:text-surface-300 dark:hover:bg-white/10"
                    title="Virar card"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => onReview(card, 'errou')}>
                  Errei
                </Button>
                <Button type="button" size="sm" variant="success" onClick={() => onReview(card, 'acertou')}>
                  Acertei
                </Button>
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
