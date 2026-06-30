import type { WeeklyWordStatus } from '../types/englishStudy';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export const INITIAL_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;
export const LEARNED_INTERVAL_THRESHOLD_DAYS = 365;

// Escada de intervalos pedida pelo usuário (em dias):
//  - Não lembrei (again): 1 dia, zera o progresso.
//  - Difícil (hard): 2 ou 3 dias, não avança a escada principal.
//  - Lembrei (good): 7 → 30 → 90 → 180 → 365.
//  - Fácil (easy): pula um degrau a mais na mesma escada (15/30 → 90 → 180 → 365).
// Ao chegar em 365 dias por "Lembrei"/"Fácil", o card vira "learned".
const GOOD_LADDER_DAYS = [7, 30, 90, 180, 365];
const EASY_LADDER_DAYS = [15, 30, 90, 180, 365];

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
 * Calcula o próximo estado de revisão de um card (palavra/frase) ao estilo
 * Anki, seguindo a escada de intervalos definida pelo usuário (ver
 * GOOD_LADDER_DAYS/EASY_LADDER_DAYS acima). Função pura e isolada da camada
 * de persistência para poder ser testada sozinha.
 */
export function calculateNextReview(word: ReviewableWord, grade: ReviewGrade, todayISO: string, addDaysISO: (dateISO: string, days: number) => string): ReviewResult {
  let { intervalDays, repetitions, easeFactor, lapses, totalReviews, correctReviews } = word;
  totalReviews += 1;

  switch (grade) {
    case 'again':
      // Não lembrei: revisar amanhã, progresso zerado.
      intervalDays = 1;
      repetitions = 0;
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
      lapses += 1;
      break;
    case 'hard':
      // Difícil: revisar em 2 ou 3 dias, sem avançar a escada principal.
      intervalDays = repetitions === 0 ? 2 : 3;
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
      correctReviews += 1;
      break;
    case 'good': {
      // Lembrei: 7 → 30 → 90 → 180 → 365.
      const idx = Math.min(repetitions, GOOD_LADDER_DAYS.length - 1);
      intervalDays = GOOD_LADDER_DAYS[idx];
      repetitions += 1;
      correctReviews += 1;
      break;
    }
    case 'easy': {
      // Fácil: pula um degrau a mais — 15/30 → 90 → 180 → 365.
      const idx = Math.min(repetitions + 1, EASY_LADDER_DAYS.length - 1);
      intervalDays = EASY_LADDER_DAYS[idx];
      easeFactor = Math.min(3.0, easeFactor + 0.15);
      repetitions += 1;
      correctReviews += 1;
      break;
    }
  }

  const status: WeeklyWordStatus = grade === 'again'
    ? 'learning'
    : (intervalDays >= LEARNED_INTERVAL_THRESHOLD_DAYS ? 'learned' : 'review');

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
