import { useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, RotateCcw, Shuffle, Volume2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import { Button } from '../Button';
import type { GlossaryReviewCard } from '../../types/englishInterview';
import { INTERVIEW_THEME_LABELS } from '../../types/englishInterview';
import { speakEnglish } from '../../utils/textToSpeech';

interface TechnicalGlossaryCardsProps {
  cards: GlossaryReviewCard[];
  onReview: (card: GlossaryReviewCard, result: 'acertou' | 'errou') => void;
}

export function TechnicalGlossaryCards({ cards, onReview }: TechnicalGlossaryCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const safeIndex = cards.length === 0 ? 0 : Math.min(currentIndex, cards.length - 1);
  const current = cards[safeIndex] ?? null;

  function goTo(index: number) {
    if (cards.length === 0) return;
    const next = (index + cards.length) % cards.length;
    setCurrentIndex(next);
    setFlipped(false);
  }

  function handleReview(result: 'acertou' | 'errou') {
    if (!current) return;
    onReview(current, result);
    goTo(safeIndex + 1);
  }

  function randomCard() {
    if (cards.length <= 1) return;
    let next = Math.floor(Math.random() * cards.length);
    if (next === safeIndex) next = (next + 1) % cards.length;
    goTo(next);
  }

  return (
    <Card>
      <CardHeader
        title="Glossário técnico 200"
        subtitle={cards.length > 0 ? `Card ${safeIndex + 1} de ${cards.length}` : 'Frente em inglês, verso com tradução, definição e exemplo.'}
        icon={<BookOpen size={18} />}
      />
      <CardBody className="space-y-3">
        {!current ? (
          <p className="text-sm text-surface-500 dark:text-surface-400">Nenhum card disponível. Rode o seed do glossário.</p>
        ) : (
            <div
              key={current.term.id}
              className="rounded-lg border border-surface-200 bg-white/75 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]"
            >
              <div className="flex flex-col gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xl font-semibold leading-7 text-surface-950 dark:text-white">{current.term.term}</p>
                    <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">
                      Caixa {current.box}
                    </span>
                    <span className="rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-medium text-primary-700 dark:text-primary-200">
                      {INTERVIEW_THEME_LABELS[current.term.theme] ?? current.term.theme}
                    </span>
                  </div>
                  {flipped ? (
                    <div className="mt-3 space-y-2 break-words text-sm leading-6">
                      <p className="text-surface-700 dark:text-surface-200"><span className="font-semibold">PT:</span> {current.term.translation_pt}</p>
                      <p className="text-surface-600 dark:text-surface-300"><span className="font-semibold">Definition:</span> {current.term.definition_en}</p>
                      <p className="text-surface-600 dark:text-surface-300"><span className="font-semibold">Example:</span> {current.term.example_en}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-surface-500 dark:text-surface-400">Tente lembrar a tradução e explique em voz alta antes de virar.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" icon={<ChevronLeft size={14} />} onClick={() => goTo(safeIndex - 1)}>
                    Anterior
                  </Button>
                  <Button type="button" size="sm" variant="secondary" icon={<ChevronRight size={14} />} onClick={() => goTo(safeIndex + 1)}>
                    Próximo
                  </Button>
                  <Button type="button" size="sm" variant="secondary" icon={<Shuffle size={14} />} onClick={randomCard}>
                    Aleatório
                  </Button>
                  <button
                    type="button"
                    onClick={() => speakEnglish(current.term.term)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 transition-colors hover:bg-surface-50 dark:border-primary-300/15 dark:text-surface-300 dark:hover:bg-white/10"
                    title="Ouvir pronúncia"
                    aria-label="Ouvir pronúncia"
                  >
                    <Volume2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipped(prev => !prev)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 transition-colors hover:bg-surface-50 dark:border-primary-300/15 dark:text-surface-300 dark:hover:bg-white/10"
                    title="Virar card"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => handleReview('errou')}>
                  Errei
                </Button>
                <Button type="button" size="sm" variant="success" onClick={() => handleReview('acertou')}>
                  Acertei
                </Button>
              </div>
            </div>
        )}
      </CardBody>
    </Card>
  );
}
