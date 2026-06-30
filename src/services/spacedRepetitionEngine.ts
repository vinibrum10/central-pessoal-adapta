import type { WeeklyWordStatus } from '../types/englishStudy';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export const INITIAL_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;
export const LEARNED_INTERVAL_THRESHOLD_DAYS = 365;

export interface ReviewableWord {
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  lapses: number;
  totalReviews: number;
  correctReviews: number;
}

export interface ReviewResult {
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  lapses: number;
  totalReviews: number;
  correctReviews: number;
  status: WeeklyWordStatus;
  nextReviewAt: string;
  lastReviewedAt: string;
}

/**
 * Calcula o próximo estado de revisão de uma palavra (estilo Anki/SM-2 simplificado).
 * Função pura e isolada da camada de persistência para poder ser testada sozinha.
 */
export function calculateNextReview(word: ReviewableWord, grade: ReviewGrade, todayISO: string, addDaysISO: (dateISO: string, days: number) => string): ReviewResult {
  let { intervalDays, repetitions, easeFactor, lapses, totalReviews, correctReviews } = word;
  totalReviews += 1;

  switch (grade) {
    case 'again':
      intervalDays = 1;
      repetitions = 0;
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
      lapses += 1;
      break;
    case 'hard':
      intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
      repetitions += 1;
      correctReviews += 1;
      break;
    case 'good':
      if (repetitions === 0) intervalDays = 1;
      else if (repetitions === 1) intervalDays = 3;
      else if (repetitions === 2) intervalDays = 7;
      else intervalDays = Math.round(intervalDays * easeFactor);
      repetitions += 1;
      correctReviews += 1;
      break;
    case 'easy':
      intervalDays = repetitions === 0 ? 4 : Math.round(intervalDays * easeFactor * 1.3);
      easeFactor = Math.min(3.0, easeFactor + 0.15);
      repetitions += 1;
      correctReviews += 1;
      break;
  }

  const status: WeeklyWordStatus = grade === 'again'
    ? 'learning'
    : (intervalDays >= LEARNED_INTERVAL_THRESHOLD_DAYS && lapses === 0
      ? 'learned'
      : (repetitions <= 1 ? 'learning' : 'review'));

  const nextReviewAt = addDaysISO(todayISO, intervalDays);

  return {
    intervalDays,
    repetitions,
    easeFactor,
    lapses,
    totalReviews,
    correctReviews,
    status,
    nextReviewAt,
    lastReviewedAt: new Date().toISOString(),
  };
}
