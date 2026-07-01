import { describe, expect, it } from 'vitest';
import { LEARNED_INTERVAL_THRESHOLD_DAYS, addDaysToToday, calculateNextCardReview } from './spacedRepetition';

const freshCard = { repetitions: 0, correctCount: 0, incorrectCount: 0 };

describe('calculateNextCardReview', () => {
  it('Errei ("again") -> revisar em 1 dia e zera o progresso da escada', () => {
    const result = calculateNextCardReview(freshCard, 'again');
    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.reviewStatus).toBe('learning');
    expect(result.nextReviewAt).toBe(addDaysToToday(1));
  });

  it('Difícil ("hard") -> revisar em 2 dias, sem avançar a escada principal', () => {
    const result = calculateNextCardReview(freshCard, 'hard');
    expect(result.intervalDays).toBe(2);
    expect(result.reviewStatus).toBe('learning');
    expect(result.nextReviewAt).toBe(addDaysToToday(2));
  });

  it('Bom ("good") -> revisar em 4 dias na primeira vez', () => {
    const result = calculateNextCardReview(freshCard, 'good');
    expect(result.intervalDays).toBe(4);
    expect(result.repetitions).toBe(1);
    expect(result.reviewStatus).toBe('review');
    expect(result.nextReviewAt).toBe(addDaysToToday(4));
  });

  it('Fácil ("easy") -> revisar em 7 dias na primeira vez', () => {
    const result = calculateNextCardReview(freshCard, 'easy');
    expect(result.intervalDays).toBe(7);
    expect(result.repetitions).toBe(1);
    expect(result.reviewStatus).toBe('review');
    expect(result.nextReviewAt).toBe(addDaysToToday(7));
  });

  it('progride a escada de "Bom" até ~365 dias e marca o card como "known" (aprendido)', () => {
    let card = { ...freshCard };
    const intervals: number[] = [];
    let lastResult;
    for (let i = 0; i < 6; i++) {
      lastResult = calculateNextCardReview(card, 'good');
      intervals.push(lastResult.intervalDays);
      card = { repetitions: lastResult.repetitions, correctCount: lastResult.correctCount, incorrectCount: lastResult.incorrectCount };
    }
    expect(intervals).toEqual([4, 10, 25, 60, 150, 365]);
    expect(lastResult?.reviewStatus).toBe('known');
  });

  it('progride a escada de "Fácil" mais rápido que "Bom", chegando também a ~365 dias', () => {
    let card = { ...freshCard };
    const intervals: number[] = [];
    let lastResult;
    for (let i = 0; i < 6; i++) {
      lastResult = calculateNextCardReview(card, 'easy');
      intervals.push(lastResult.intervalDays);
      card = { repetitions: lastResult.repetitions, correctCount: lastResult.correctCount, incorrectCount: lastResult.incorrectCount };
    }
    expect(intervals).toEqual([7, 16, 40, 100, 250, 365]);
    expect(lastResult?.reviewStatus).toBe('known');
  });

  it('uma vez que o intervalo atinge o limiar de longo prazo, o card sai da revisão ativa (status "known")', () => {
    const nearLongTerm = { repetitions: 5, correctCount: 10, incorrectCount: 0 };
    const result = calculateNextCardReview(nearLongTerm, 'good');
    expect(result.intervalDays).toBe(LEARNED_INTERVAL_THRESHOLD_DAYS);
    expect(result.reviewStatus).toBe('known');
  });

  it('"Errei" depois de progresso avançado reseta a escada de volta para 1 dia', () => {
    const advancedCard = { repetitions: 4, correctCount: 4, incorrectCount: 0 };
    const result = calculateNextCardReview(advancedCard, 'again');
    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.reviewStatus).toBe('learning');
    expect(result.incorrectCount).toBe(1);
  });

  it('acumula corretamente acertos e erros ao longo de múltiplas revisões', () => {
    let card = { ...freshCard };
    card = { ...card, ...calculateNextCardReview(card, 'good') };
    card = { ...card, ...calculateNextCardReview(card, 'again') };
    card = { ...card, ...calculateNextCardReview(card, 'hard') };
    expect(card.correctCount).toBe(2);
    expect(card.incorrectCount).toBe(1);
  });
});
