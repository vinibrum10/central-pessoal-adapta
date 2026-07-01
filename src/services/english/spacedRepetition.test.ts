import { describe, expect, it } from 'vitest';
import { addDaysISO, getTodayISO } from './englishStorage';
import { MASTERED_INTERVAL_THRESHOLD_DAYS, applyCardReview, calculateNextCardReview, type ReviewGrade, type ReviewableCard } from './spacedRepetition';

const freshCard: ReviewableCard = { reviewCount: 0, errorCount: 0, easyStreak: 0, difficultCount: 0, status: 'learning' };
const today = getTodayISO();

describe('calculateNextCardReview', () => {
  it('só existem 3 avaliações possíveis — o botão "Bom" não existe mais', () => {
    const grades: ReviewGrade[] = ['again', 'hard', 'easy'];
    // Garantia em tempo de execução de que nenhuma 4ª nota é aceita silenciosamente:
    // se alguém reintroduzir "good", o switch em calculateNextCardReview passaria a
    // cair no branch "easy" (comportamento errado) — este teste documenta a lista fechada.
    expect(grades).toEqual(['again', 'hard', 'easy']);
    expect(grades).not.toContain('good');
  });

  it('Errei -> volta para hoje (fim da fila) e zera as sequências de acerto', () => {
    const advanced: ReviewableCard = { reviewCount: 5, errorCount: 1, easyStreak: 3, difficultCount: 2, status: 'reviewing' };
    const result = calculateNextCardReview(advanced, 'again', today);
    expect(result.nextReviewAt).toBe(today);
    expect(result.easyStreak).toBe(0);
    expect(result.difficultCount).toBe(0);
    expect(result.errorCount).toBe(2);
    expect(result.status).toBe('learning');
  });

  it('Difícil na primeira vez -> revisar amanhã (1 dia)', () => {
    const result = calculateNextCardReview(freshCard, 'hard', today);
    expect(result.intervalDays).toBe(1);
    expect(result.nextReviewAt).toBe(addDaysISO(today, 1));
    expect(result.difficultCount).toBe(1);
    expect(result.status).toBe('reviewing');
  });

  it('Difícil em revisões futuras -> segue a escada curta 2, 4, 7, 15 dias', () => {
    let card = freshCard;
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      const result = calculateNextCardReview(card, 'hard', today);
      intervals.push(result.intervalDays);
      card = { ...card, difficultCount: result.difficultCount };
    }
    expect(intervals).toEqual([1, 2, 4, 7, 15]);
  });

  it('Fácil na primeira vez -> revisar em 3 dias', () => {
    const result = calculateNextCardReview(freshCard, 'easy', today);
    expect(result.intervalDays).toBe(3);
    expect(result.nextReviewAt).toBe(addDaysISO(today, 3));
    expect(result.easyStreak).toBe(1);
    expect(result.status).toBe('reviewing');
  });

  it('Fácil progride pela escada 3, 7, 15, 30, 60, 120, 180, 365 dias', () => {
    let card = freshCard;
    const intervals: number[] = [];
    for (let i = 0; i < 8; i++) {
      const result = calculateNextCardReview(card, 'easy', today);
      intervals.push(result.intervalDays);
      card = { ...card, easyStreak: result.easyStreak };
    }
    expect(intervals).toEqual([3, 7, 15, 30, 60, 120, 180, 365]);
  });

  it('depois de ~1 ano (365 dias) em "Fácil", o card vira "mastered" e sai da revisão ativa', () => {
    const almostThere: ReviewableCard = { reviewCount: 7, errorCount: 0, easyStreak: 7, difficultCount: 0, status: 'reviewing' };
    const result = calculateNextCardReview(almostThere, 'easy', today);
    expect(result.intervalDays).toBe(MASTERED_INTERVAL_THRESHOLD_DAYS);
    expect(result.status).toBe('mastered');
    expect(result.masteredAt).toBeTruthy();
  });

  it('"Difícil" nunca marca o card como mastered, mesmo em revisões avançadas', () => {
    const advanced: ReviewableCard = { reviewCount: 20, errorCount: 0, easyStreak: 0, difficultCount: 10, status: 'reviewing' };
    const result = calculateNextCardReview(advanced, 'hard', today);
    expect(result.status).not.toBe('mastered');
  });

  it('reviewCount sempre soma 1 a cada avaliação, independente da nota', () => {
    const again = calculateNextCardReview(freshCard, 'again', today);
    const hard = calculateNextCardReview(freshCard, 'hard', today);
    const easy = calculateNextCardReview(freshCard, 'easy', today);
    expect(again.reviewCount).toBe(1);
    expect(hard.reviewCount).toBe(1);
    expect(easy.reviewCount).toBe(1);
  });
});

describe('applyCardReview', () => {
  it('preserva os demais campos do card (id, wordOrPhrase, translation etc.) ao aplicar uma avaliação', () => {
    const card = {
      id: 'card-1',
      wordOrPhrase: 'nevertheless',
      translation: 'mesmo assim',
      source: 'manual' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      nextReviewAt: today,
      reviewCount: 0,
      errorCount: 0,
      easyStreak: 0,
      difficultCount: 0,
      status: 'learning' as const,
    };
    const updated = applyCardReview(card, 'easy', today);
    expect(updated.id).toBe('card-1');
    expect(updated.wordOrPhrase).toBe('nevertheless');
    expect(updated.translation).toBe('mesmo assim');
    expect(updated.easyStreak).toBe(1);
    expect(updated.nextReviewAt).toBe(addDaysISO(today, 3));
  });
});
