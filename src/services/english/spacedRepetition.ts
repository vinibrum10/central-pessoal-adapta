// Repetição espaçada estilo Anki para os cards de vocabulário do Inglês Diário.
//
// Apenas 3 avaliações (sem "Bom"):
//   Errei   -> volta para a fila de HOJE (fim da fila), zera as sequências.
//   Difícil -> 1ª vez: amanhã. Depois: 2, 4, 7, 15 dias.
//   Fácil   -> 1ª vez: 3 dias. Depois: 7, 15, 30, 60, 120, 180, 365 dias.
// Ao atingir ~365 dias por "Fácil", o card vira "mastered" e sai da revisão
// ativa (mas nunca é apagado — continua em "Dominadas"/"Histórico").

import { addDaysISO, getTodayISO, type VocabularyCard, type VocabularyCardStatus } from './englishStorage';

export type ReviewGrade = 'again' | 'hard' | 'easy';

export const MASTERED_INTERVAL_THRESHOLD_DAYS = 365;

const HARD_LADDER_DAYS = [1, 2, 4, 7, 15];
const EASY_LADDER_DAYS = [3, 7, 15, 30, 60, 120, 180, 365];

export interface ReviewableCard {
  reviewCount: number;
  errorCount: number;
  easyStreak: number;
  difficultCount: number;
  status: VocabularyCardStatus;
}

export interface CardReviewResult {
  intervalDays: number;
  reviewCount: number;
  errorCount: number;
  easyStreak: number;
  difficultCount: number;
  status: VocabularyCardStatus;
  nextReviewAt: string;
  lastReviewedAt: string;
  masteredAt?: string;
}

/**
 * Calcula o próximo estado de revisão de um card ao estilo Anki, com apenas
 * 3 avaliações (Errei/Difícil/Fácil). Função pura — não lê/escreve storage,
 * só recebe o estado atual e devolve o próximo.
 */
export function calculateNextCardReview(
  card: ReviewableCard,
  grade: ReviewGrade,
  todayISO: string = getTodayISO(),
): CardReviewResult {
  const nowISO = new Date().toISOString();
  const reviewCount = card.reviewCount + 1;

  if (grade === 'again') {
    return {
      intervalDays: 0,
      reviewCount,
      errorCount: card.errorCount + 1,
      // Zera as duas sequências: o card volta a precisar provar que já sabe.
      easyStreak: 0,
      difficultCount: 0,
      status: 'learning',
      // Continua "vencido hoje" — reaparece no fim da fila da sessão atual
      // (a UI ordena a fila colocando cards com lastReviewedAt de hoje por último).
      nextReviewAt: todayISO,
      lastReviewedAt: nowISO,
    };
  }

  if (grade === 'hard') {
    const idx = Math.min(card.difficultCount, HARD_LADDER_DAYS.length - 1);
    const intervalDays = HARD_LADDER_DAYS[idx];
    return {
      intervalDays,
      reviewCount,
      errorCount: card.errorCount,
      easyStreak: card.easyStreak,
      difficultCount: card.difficultCount + 1,
      status: card.status === 'mastered' ? 'reviewing' : (card.status === 'learning' ? 'reviewing' : card.status),
      nextReviewAt: addDaysISO(todayISO, intervalDays),
      lastReviewedAt: nowISO,
    };
  }

  // easy
  const idx = Math.min(card.easyStreak, EASY_LADDER_DAYS.length - 1);
  const intervalDays = EASY_LADDER_DAYS[idx];
  const mastered = intervalDays >= MASTERED_INTERVAL_THRESHOLD_DAYS;
  return {
    intervalDays,
    reviewCount,
    errorCount: card.errorCount,
    easyStreak: card.easyStreak + 1,
    difficultCount: card.difficultCount,
    status: mastered ? 'mastered' : 'reviewing',
    nextReviewAt: addDaysISO(todayISO, intervalDays),
    lastReviewedAt: nowISO,
    masteredAt: mastered ? nowISO : undefined,
  };
}

/** Aplica o resultado de `calculateNextCardReview` a um card completo, preservando os demais campos. */
export function applyCardReview(card: VocabularyCard, grade: ReviewGrade, todayISO: string = getTodayISO()): VocabularyCard {
  const result = calculateNextCardReview(card, grade, todayISO);
  return {
    ...card,
    reviewCount: result.reviewCount,
    errorCount: result.errorCount,
    easyStreak: result.easyStreak,
    difficultCount: result.difficultCount,
    status: result.status,
    nextReviewAt: result.nextReviewAt,
    lastReviewedAt: result.lastReviewedAt,
    masteredAt: result.masteredAt ?? card.masteredAt,
  };
}
