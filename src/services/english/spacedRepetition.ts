// Repetição espaçada estilo Anki para os cards de vocabulário do Inglês Diário.
// Escada pedida:
//   Errei   -> revisar em 1 dia (zera progresso)
//   Difícil -> revisar em 2 dias (não avança a escada principal)
//   Bom     -> 4 -> 10 -> 25 -> 60 -> 150 -> 365 dias
//   Fácil   -> pula um degrau a mais na mesma escada: 7 -> 16 -> 40 -> 100 -> 250 -> 365 dias
// Ao atingir 365 dias (Bom/Fácil), o card vira "known" e sai da revisão ativa.

import type { VocabularyCard } from './englishStorage';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export const LEARNED_INTERVAL_THRESHOLD_DAYS = 365;

const GOOD_LADDER_DAYS = [4, 10, 25, 60, 150, 365];
const EASY_LADDER_DAYS = [7, 16, 40, 100, 250, 365];

const GRADE_DIFFICULTY: Record<ReviewGrade, VocabularyCard['difficulty']> = {
  again: 'hard',
  hard: 'hard',
  good: 'medium',
  easy: 'easy',
};

export interface CardReviewResult {
  intervalDays: number;
  repetitions: number;
  reviewStatus: VocabularyCard['reviewStatus'];
  difficulty: VocabularyCard['difficulty'];
  nextReviewAt: string;
  correctCount: number;
  incorrectCount: number;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateOnly(date);
}

/**
 * Calcula o próximo estado de revisão de um card ao estilo Anki.
 * Função pura — não lê/escreve storage, só recebe o estado atual e devolve o próximo.
 */
export function calculateNextCardReview(
  card: Pick<VocabularyCard, 'repetitions' | 'correctCount' | 'incorrectCount'>,
  grade: ReviewGrade,
): CardReviewResult {
  const repetitions = card.repetitions ?? 0;
  const correctCount = card.correctCount ?? 0;
  const incorrectCount = card.incorrectCount ?? 0;

  let intervalDays: number;
  let nextRepetitions = repetitions;
  let nextCorrect = correctCount;
  let nextIncorrect = incorrectCount;
  let reviewStatus: VocabularyCard['reviewStatus'];

  switch (grade) {
    case 'again':
      intervalDays = 1;
      nextRepetitions = 0;
      nextIncorrect += 1;
      reviewStatus = 'learning';
      break;
    case 'hard':
      intervalDays = 2;
      nextCorrect += 1;
      reviewStatus = 'learning';
      break;
    case 'good': {
      const idx = Math.min(repetitions, GOOD_LADDER_DAYS.length - 1);
      intervalDays = GOOD_LADDER_DAYS[idx];
      nextRepetitions += 1;
      nextCorrect += 1;
      reviewStatus = intervalDays >= LEARNED_INTERVAL_THRESHOLD_DAYS ? 'known' : 'review';
      break;
    }
    case 'easy': {
      const idx = Math.min(repetitions + 1, EASY_LADDER_DAYS.length - 1);
      intervalDays = EASY_LADDER_DAYS[idx];
      nextRepetitions += 1;
      nextCorrect += 1;
      reviewStatus = intervalDays >= LEARNED_INTERVAL_THRESHOLD_DAYS ? 'known' : 'review';
      break;
    }
  }

  return {
    intervalDays,
    repetitions: nextRepetitions,
    reviewStatus,
    difficulty: GRADE_DIFFICULTY[grade],
    nextReviewAt: addDaysToToday(intervalDays),
    correctCount: nextCorrect,
    incorrectCount: nextIncorrect,
  };
}
