import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCardFromShadowingPhrase,
  getCardHistory,
  getDueTodayCards,
  getFutureCards,
  getMasteredCards,
  getShadowingSourceKey,
  getTodayISO,
  incrementPhraseRepetition,
  loadEnglishData,
  markPhraseCompleted,
  mergeShadowingPhrasesWithoutDuplicates,
  resetPhraseRepetition,
  saveEnglishData,
  type ShadowingPhrase,
  type VocabularyCard,
} from './englishStorage';

function makePhrase(overrides: Partial<ShadowingPhrase> = {}): ShadowingPhrase {
  return {
    id: 'phrase-1',
    text: 'Could you say that one more time, please?',
    translation: 'Você poderia dizer isso mais uma vez, por favor?',
    source: 'manual',
    repetitionsDone: 0,
    repetitionsTarget: 5,
    completed: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCard(overrides: Partial<VocabularyCard> = {}): VocabularyCard {
  return {
    id: 'card-1',
    wordOrPhrase: 'nevertheless',
    translation: 'mesmo assim',
    example: 'Nevertheless, she kept going.',
    exampleTranslation: 'Mesmo assim, ela continuou.',
    source: 'gemini',
    createdAt: '2026-07-01T10:00:00.000Z',
    nextReviewAt: '2026-07-02',
    reviewCount: 0,
    errorCount: 0,
    easyStreak: 0,
    difficultCount: 0,
    status: 'learning',
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

    const reloaded = loadEnglishData();
    expect(reloaded.vocabularyCards).toHaveLength(1);
    expect(reloaded.vocabularyCards[0]).toMatchObject({
      id: 'card-1',
      wordOrPhrase: 'nevertheless',
      translation: 'mesmo assim',
      example: 'Nevertheless, she kept going.',
      exampleTranslation: 'Mesmo assim, ela continuou.',
      source: 'gemini',
      status: 'learning',
    });
  });

  it('atualiza um card existente sem duplicar nem perder outros cards', () => {
    const initial = loadEnglishData();
    saveEnglishData({
      ...initial,
      vocabularyCards: [makeCard({ id: 'card-1' }), makeCard({ id: 'card-2', wordOrPhrase: 'therefore', translation: 'portanto' })],
    });

    const beforeUpdate = loadEnglishData();
    const updatedCards = beforeUpdate.vocabularyCards.map(card =>
      card.id === 'card-1' ? { ...card, status: 'reviewing' as const, nextReviewAt: '2026-07-05', reviewCount: 1 } : card,
    );
    saveEnglishData({ ...beforeUpdate, vocabularyCards: updatedCards });

    const reloaded = loadEnglishData();
    expect(reloaded.vocabularyCards).toHaveLength(2);
    const updated = reloaded.vocabularyCards.find(c => c.id === 'card-1');
    const untouched = reloaded.vocabularyCards.find(c => c.id === 'card-2');
    expect(updated).toMatchObject({ status: 'reviewing', nextReviewAt: '2026-07-05', reviewCount: 1 });
    expect(untouched).toMatchObject({ wordOrPhrase: 'therefore', translation: 'portanto' });
  });

  it('remove um card específico ao salvar a lista sem ele, preservando os demais', () => {
    const initial = loadEnglishData();
    saveEnglishData({
      ...initial,
      vocabularyCards: [makeCard({ id: 'card-1' }), makeCard({ id: 'card-2', wordOrPhrase: 'therefore' })],
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
    expect(reloadedMuchLater.vocabularyCards[0].wordOrPhrase).toBe('nevertheless');
    // O card vencido continua com a data antiga — cabe à revisão espaçada
    // decidir o próximo intervalo, não a este storage apagar/resetar nada.
    expect(reloadedMuchLater.vocabularyCards[0].nextReviewAt).toBe('2026-07-01');
  });

  it('preserva cards do formato antigo (word/meaning/reviewStatus) ao migrar — nenhum dado é perdido', () => {
    localStorage.setItem('sgp_english_v2', JSON.stringify({
      vocabularyCards: [
        {
          id: 'legacy-1',
          word: 'floral arrangement',
          meaning: 'arranjo floral',
          example: 'She ordered a floral arrangement.',
          reviewStatus: 'review',
          source: 'ai',
          createdAt: '2026-01-01T00:00:00.000Z',
          nextReviewAt: '2026-06-15',
          correctCount: 3,
          incorrectCount: 1,
        },
      ],
    }));

    const data = loadEnglishData();
    expect(data.vocabularyCards).toHaveLength(1);
    const migrated = data.vocabularyCards[0];
    expect(migrated.wordOrPhrase).toBe('floral arrangement');
    expect(migrated.translation).toBe('arranjo floral');
    expect(migrated.status).toBe('reviewing');
    expect(migrated.source).toBe('gemini');
    expect(migrated.nextReviewAt).toBe('2026-06-15');
    expect(migrated.reviewCount).toBeGreaterThan(0);
  });

  it('card antigo com reviewStatus "known" migra para status "mastered"', () => {
    localStorage.setItem('sgp_english_v2', JSON.stringify({
      vocabularyCards: [
        { id: 'legacy-2', word: 'ubiquitous', meaning: 'onipresente', reviewStatus: 'known', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    }));

    const data = loadEnglishData();
    expect(data.vocabularyCards[0].status).toBe('mastered');
  });
});

describe('grupos de cards (hoje / futuros / dominadas / histórico)', () => {
  const today = getTodayISO();

  it('um card recém-criado (nextReviewAt = hoje) aparece em "revisar hoje"', () => {
    const cards = [makeCard({ nextReviewAt: today, status: 'learning' })];
    expect(getDueTodayCards(cards, today)).toHaveLength(1);
    expect(getFutureCards(cards, today)).toHaveLength(0);
  });

  it('um card com nextReviewAt no futuro aparece em "cards futuros", não em "revisar hoje"', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureISO = future.toISOString().slice(0, 10);
    const cards = [makeCard({ nextReviewAt: futureISO, status: 'reviewing' })];
    expect(getDueTodayCards(cards, today)).toHaveLength(0);
    expect(getFutureCards(cards, today)).toHaveLength(1);
  });

  it('um card mastered aparece em "Dominadas" e nunca em "revisar hoje" ou "futuros"', () => {
    const cards = [makeCard({ status: 'mastered', nextReviewAt: today, masteredAt: new Date().toISOString() })];
    expect(getMasteredCards(cards)).toHaveLength(1);
    expect(getDueTodayCards(cards, today)).toHaveLength(0);
    expect(getFutureCards(cards, today)).toHaveLength(0);
  });

  it('o histórico sempre contém todos os cards, independente do status', () => {
    const cards = [
      makeCard({ id: '1', status: 'learning' }),
      makeCard({ id: '2', status: 'reviewing' }),
      makeCard({ id: '3', status: 'mastered' }),
    ];
    expect(getCardHistory(cards)).toHaveLength(3);
  });
});

describe('frases de shadowing — contador de repetições (0/5 até 5/5)', () => {
  it('uma frase nova começa em 0/5 e não concluída', () => {
    const phrase = makePhrase();
    expect(phrase.repetitionsDone).toBe(0);
    expect(phrase.repetitionsTarget).toBe(5);
    expect(phrase.completed).toBe(false);
  });

  it('+1 repetição aumenta o contador em 1', () => {
    const phrase = incrementPhraseRepetition(makePhrase({ repetitionsDone: 2 }));
    expect(phrase.repetitionsDone).toBe(3);
    expect(phrase.completed).toBe(false);
  });

  it('ao chegar em 5/5, marca completed = true', () => {
    const phrase = incrementPhraseRepetition(makePhrase({ repetitionsDone: 4 }));
    expect(phrase.repetitionsDone).toBe(5);
    expect(phrase.completed).toBe(true);
  });

  it('nunca passa de 5/5, mesmo incrementando repetidamente', () => {
    let phrase = makePhrase({ repetitionsDone: 5, completed: true });
    phrase = incrementPhraseRepetition(phrase);
    phrase = incrementPhraseRepetition(phrase);
    expect(phrase.repetitionsDone).toBe(5);
    expect(phrase.completed).toBe(true);
  });

  it('resetar volta para 0/5 e completed = false', () => {
    const phrase = resetPhraseRepetition(makePhrase({ repetitionsDone: 5, completed: true }));
    expect(phrase.repetitionsDone).toBe(0);
    expect(phrase.completed).toBe(false);
  });

  it('"Finalizar" marca completed = true e pula direto para o alvo, sem precisar clicar +1 várias vezes', () => {
    const phrase = markPhraseCompleted(makePhrase({ repetitionsDone: 1 }));
    expect(phrase.repetitionsDone).toBe(5);
    expect(phrase.completed).toBe(true);
  });
});

describe('origem das frases de shadowing salvas como card', () => {
  it('frase gerada por IA mantém source "aiGenerated" na frase original', () => {
    const phrase = makePhrase({ source: 'aiGenerated' });
    expect(phrase.source).toBe('aiGenerated');
  });

  it('frase manual mantém source "manual"', () => {
    const phrase = makePhrase({ source: 'manual' });
    expect(phrase.source).toBe('manual');
  });

  it('frase extraída do vídeo mantém source "videoTranscript" ou "videoMetadata"', () => {
    const transcriptPhrase = makePhrase({ source: 'videoTranscript' });
    const metadataPhrase = makePhrase({ source: 'videoMetadata' });
    expect(transcriptPhrase.source).toBe('videoTranscript');
    expect(metadataPhrase.source).toBe('videoMetadata');
  });

  it('salvar qualquer frase de shadowing como card sempre gera um card com source "shadowing"', () => {
    const aiPhrase = makePhrase({ source: 'aiGenerated', videoId: 'abc123', videoTitle: 'Daily routines' });
    const card = createCardFromShadowingPhrase(aiPhrase, 'new-card-id');
    expect(card.source).toBe('shadowing');
    expect(card.wordOrPhrase).toBe(aiPhrase.text);
    expect(card.translation).toBe(aiPhrase.translation);
    expect(card.videoId).toBe('abc123');
    expect(card.status).toBe('learning');
  });
});

describe('mergeShadowingPhrasesWithoutDuplicates (frases geradas com IA não apagam nem duplicam as existentes)', () => {
  it('anexa frases novas ao final, preservando as existentes', () => {
    const existing = [makePhrase({ id: 'p1', text: 'Could you say that again?' })];
    const incoming = [makePhrase({ id: 'p2', text: 'I really appreciate your help.' })];
    const merged = mergeShadowingPhrasesWithoutDuplicates(existing, incoming);
    expect(merged.map(p => p.id)).toEqual(['p1', 'p2']);
  });

  it('ignora frases com texto idêntico (case/espaços insensível) e mantém a existente', () => {
    const existing = [makePhrase({ id: 'p1', text: 'Could you say that again?' })];
    const incoming = [
      makePhrase({ id: 'p2', text: '  could YOU say that again?  ' }), // duplicata do p1
      makePhrase({ id: 'p3', text: 'A brand new phrase.' }),
    ];
    const merged = mergeShadowingPhrasesWithoutDuplicates(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.map(p => p.id)).toEqual(['p1', 'p3']);
  });

  it('gerar frases duas vezes com o mesmo conteúdo não duplica nada na segunda vez', () => {
    const firstBatch = [makePhrase({ id: 'p1', text: 'Could you say that again?' })];
    const secondBatch = [makePhrase({ id: 'p2', text: 'Could you say that again?' })];
    let phrases = mergeShadowingPhrasesWithoutDuplicates([], firstBatch);
    phrases = mergeShadowingPhrasesWithoutDuplicates(phrases, secondBatch);
    expect(phrases).toHaveLength(1);
    expect(phrases[0].id).toBe('p1');
  });
});

describe('persistência das frases de shadowing geradas com IA', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('frases geradas com IA sobrevivem a um reload (localStorage)', () => {
    const initial = loadEnglishData();
    const generated = makePhrase({
      id: 'ai-1',
      text: 'Could you say that again?',
      translation: 'Você pode repetir isso?',
      source: 'aiGeneratedFromVideo',
      videoId: 'abc12345678',
      videoTitle: 'Daily routines',
    });

    const sourceKey = getShadowingSourceKey(initial.shadowingPractice);
    const nextSentences = mergeShadowingPhrasesWithoutDuplicates(initial.shadowingPractice.sentences, [generated]);
    saveEnglishData({
      ...initial,
      shadowingPractice: { ...initial.shadowingPractice, sentences: nextSentences },
      shadowingSentenceSets: { ...initial.shadowingSentenceSets, [sourceKey]: nextSentences },
      shadowingPhraseSets: {
        ...initial.shadowingPhraseSets,
        [sourceKey]: { ...initial.shadowingPhraseSets[sourceKey], phrases: nextSentences },
      },
    });

    const reloaded = loadEnglishData();
    const found = reloaded.shadowingPractice.sentences.find(p => p.id === 'ai-1');
    expect(found).toBeTruthy();
    expect(found?.source).toBe('aiGeneratedFromVideo');
    expect(found?.videoId).toBe('abc12345678');
    expect(found?.repetitionsDone).toBe(0);
    expect(found?.repetitionsTarget).toBe(5);
  });
});
