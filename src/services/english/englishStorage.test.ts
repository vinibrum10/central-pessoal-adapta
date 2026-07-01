import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnglishData, saveEnglishData, type VocabularyCard } from './englishStorage';

function makeCard(overrides: Partial<VocabularyCard> = {}): VocabularyCard {
  return {
    id: 'card-1',
    word: 'nevertheless',
    meaning: 'mesmo assim',
    example: 'Nevertheless, she kept going.',
    exampleTranslation: 'Mesmo assim, ela continuou.',
    source: 'ai',
    reviewStatus: 'new',
    difficulty: 'medium',
    createdAt: '2026-07-01T10:00:00.000Z',
    nextReviewAt: '2026-07-02',
    repetitions: 0,
    correctCount: 0,
    incorrectCount: 0,
    ...overrides,
  };
}

describe('englishStorage (persistência local do Inglês Diário)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('começa sem nenhum card quando o localStorage está vazio', () => {
    const data = loadEnglishData();
    expect(data.vocabularyCards).toEqual([]);
  });

  it('salva um card novo e ele reaparece após reload (serialize/deserialize via localStorage)', () => {
    const data = loadEnglishData();
    saveEnglishData({ ...data, vocabularyCards: [makeCard(), ...data.vocabularyCards] });

    // Simula um "reload" da página: nova leitura do zero via loadEnglishData.
    const reloaded = loadEnglishData();
    expect(reloaded.vocabularyCards).toHaveLength(1);
    expect(reloaded.vocabularyCards[0]).toMatchObject({
      id: 'card-1',
      word: 'nevertheless',
      meaning: 'mesmo assim',
      example: 'Nevertheless, she kept going.',
      exampleTranslation: 'Mesmo assim, ela continuou.',
      source: 'ai',
      reviewStatus: 'new',
    });
  });

  it('atualiza um card existente sem duplicar nem perder outros cards', () => {
    const initial = loadEnglishData();
    saveEnglishData({
      ...initial,
      vocabularyCards: [makeCard({ id: 'card-1', word: 'nevertheless' }), makeCard({ id: 'card-2', word: 'therefore', meaning: 'portanto' })],
    });

    const beforeUpdate = loadEnglishData();
    const updatedCards = beforeUpdate.vocabularyCards.map(card =>
      card.id === 'card-1' ? { ...card, reviewStatus: 'review' as const, nextReviewAt: '2026-07-05', correctCount: 1 } : card,
    );
    saveEnglishData({ ...beforeUpdate, vocabularyCards: updatedCards });

    const reloaded = loadEnglishData();
    expect(reloaded.vocabularyCards).toHaveLength(2);
    const updated = reloaded.vocabularyCards.find(c => c.id === 'card-1');
    const untouched = reloaded.vocabularyCards.find(c => c.id === 'card-2');
    expect(updated).toMatchObject({ reviewStatus: 'review', nextReviewAt: '2026-07-05', correctCount: 1 });
    expect(untouched).toMatchObject({ word: 'therefore', meaning: 'portanto' });
  });

  it('remove um card específico ao salvar a lista sem ele, preservando os demais', () => {
    const initial = loadEnglishData();
    saveEnglishData({
      ...initial,
      vocabularyCards: [makeCard({ id: 'card-1' }), makeCard({ id: 'card-2', word: 'therefore' })],
    });

    const current = loadEnglishData();
    saveEnglishData({ ...current, vocabularyCards: current.vocabularyCards.filter(c => c.id !== 'card-1') });

    const reloaded = loadEnglishData();
    expect(reloaded.vocabularyCards).toHaveLength(1);
    expect(reloaded.vocabularyCards[0].id).toBe('card-2');
  });

  it('NÃO apaga cards quando o dia, a semana ou o mês mudam — não existe reset por data', () => {
    const initial = loadEnglishData();
    saveEnglishData({ ...initial, vocabularyCards: [makeCard({ nextReviewAt: '2026-07-01' })] });

    vi.useFakeTimers();
    // Avança o relógio quase 3 meses (atravessa dia, semana e mês).
    vi.setSystemTime(new Date('2026-09-25T12:00:00.000Z'));

    const reloadedMuchLater = loadEnglishData();
    expect(reloadedMuchLater.vocabularyCards).toHaveLength(1);
    expect(reloadedMuchLater.vocabularyCards[0].word).toBe('nevertheless');
    // O card vencido continua com a data antiga — cabe à revisão espaçada
    // decidir o próximo intervalo, não a este storage apagar/resetar nada.
    expect(reloadedMuchLater.vocabularyCards[0].nextReviewAt).toBe('2026-07-01');
  });

  it('preserva cards antigos (sem os campos novos) ao migrar via normalização de leitura', () => {
    localStorage.setItem('sgp_english_v2', JSON.stringify({
      vocabularyCards: [
        { id: 'legacy-1', word: 'old', meaning: 'antigo', reviewStatus: 'new', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    }));

    const data = loadEnglishData();
    expect(data.vocabularyCards).toHaveLength(1);
    expect(data.vocabularyCards[0].word).toBe('old');
    expect(data.vocabularyCards[0].nextReviewAt).toBeTruthy();
  });
});
