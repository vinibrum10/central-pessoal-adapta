// Persistência do módulo Inglês Diário v2.
// Usa chave dedicada "sgp_english_v2" — não reutiliza storage antigo.

const STORAGE_KEY = 'sgp_english_v2';

export interface ListeningVideo {
  youtubeVideoId: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
  level: 'basic' | 'intermediate' | 'advanced' | 'fluent';
  watchUrl: string;
  embedUrl: string;
  source: 'youtube_api' | 'manual_link' | 'none';
  qualityScore?: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
}

export interface VideoQuiz {
  youtubeVideoId: string;
  questions: QuizQuestion[];
  answers: Record<string, number>;
  score?: number;
  completedAt?: string;
  /** 'transcript' | 'summary' | 'metadata' | 'fallback' — de onde vieram as perguntas. */
  source?: 'transcript' | 'summary' | 'metadata' | 'fallback';
  /** Aviso a mostrar ao usuário (ex.: quiz gerado só com metadados, sem transcrição). */
  warning?: string;
}

export interface ShadowingSentence {
  id: string;
  text: string;
  translation: string;
  targetRepetitions: number;
  repetitions: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShadowingPractice {
  type: 'video' | 'playlist';
  youtubeVideoId?: string;
  playlistId?: string;
  title?: string;
  watchUrl: string;
  embedUrl: string;
  source: 'default_playlist' | 'manual_link' | 'youtube_api';
  sentences: ShadowingSentence[];
}

export interface ShadowingPhraseSet {
  sourceTitle: string;
  sourceUrl: string;
  phrases: ShadowingSentence[];
}

export interface EnglishUiState {
  showFutureCards: boolean;
  showKnownCards: boolean;
}

export interface VocabularyCard {
  id: string;
  word: string;
  meaning: string;
  example?: string;
  /** Tradução em português do exemplo em inglês (`example`). */
  exampleTranslation?: string;
  source?: 'listening' | 'quiz' | 'shadowing' | 'manual' | 'ai';
  sourceYoutubeVideoId?: string;
  reviewStatus: 'new' | 'learning' | 'review' | 'known';
  difficulty?: 'easy' | 'medium' | 'hard';
  createdAt: string;
  nextReviewAt: string;
  /** Quantas vezes o card avançou a escada de revisão (Bom/Fácil/Difícil). */
  repetitions?: number;
  correctCount?: number;
  incorrectCount?: number;
}

export interface EnglishDataV2 {
  selectedListeningLevel: 'basic' | 'intermediate' | 'advanced' | 'fluent';
  selectedShadowingLevel: 'basic' | 'intermediate' | 'advanced' | 'fluent';
  listeningVideo: ListeningVideo | null;
  videoQuiz: VideoQuiz | null;
  shadowingPractice: ShadowingPractice;
  shadowingSentenceSets: Record<string, ShadowingSentence[]>;
  shadowingPhraseSets: Record<string, ShadowingPhraseSet>;
  vocabularyCards: VocabularyCard[];
  ui: EnglishUiState;
}

const DEFAULT_SHADOWING_SENTENCES: ShadowingSentence[] = [
  { id: 's1', text: 'Could you say that one more time, please?', translation: 'Você poderia dizer isso mais uma vez, por favor?', targetRepetitions: 5, repetitions: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 's2', text: "I'm trying to sound more natural when I speak.", translation: 'Estou tentando soar mais natural quando falo.', targetRepetitions: 5, repetitions: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 's3', text: 'Let me repeat that slowly and then faster.', translation: 'Deixe-me repetir isso devagar e depois mais rápido.', targetRepetitions: 5, repetitions: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 's4', text: 'I want to improve my rhythm, stress, and intonation.', translation: 'Quero melhorar meu ritmo, ênfase e entonação.', targetRepetitions: 5, repetitions: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 's5', text: 'The more I practice, the more confident I become.', translation: 'Quanto mais eu pratico, mais confiante eu fico.', targetRepetitions: 5, repetitions: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
];

export const DEFAULT_SHADOWING: ShadowingPractice = {
  type: 'playlist',
  playlistId: 'PLL8rrkKVLqeRdeFKmygYujTkwOefatZ6G',
  watchUrl: 'https://youtube.com/playlist?list=PLL8rrkKVLqeRdeFKmygYujTkwOefatZ6G',
  embedUrl: 'https://www.youtube.com/embed/videoseries?list=PLL8rrkKVLqeRdeFKmygYujTkwOefatZ6G',
  source: 'default_playlist',
  sentences: DEFAULT_SHADOWING_SENTENCES,
};

export const DEFAULT_SHADOWING_KEY = 'default';

const DEFAULT_DATA: EnglishDataV2 = {
  selectedListeningLevel: 'advanced',
  selectedShadowingLevel: 'advanced',
  listeningVideo: null,
  videoQuiz: null,
  shadowingPractice: DEFAULT_SHADOWING,
  shadowingSentenceSets: {
    [DEFAULT_SHADOWING_KEY]: DEFAULT_SHADOWING_SENTENCES.map(s => ({ ...s })),
  },
  shadowingPhraseSets: {
    [DEFAULT_SHADOWING_KEY]: {
      sourceTitle: 'Playlist padrão',
      sourceUrl: DEFAULT_SHADOWING.watchUrl,
      phrases: DEFAULT_SHADOWING_SENTENCES.map(s => ({ ...s })),
    },
  },
  vocabularyCards: [],
  ui: {
    showFutureCards: false,
    showKnownCards: false,
  },
};

function cloneDefaultShadowing(): ShadowingPractice {
  return { ...DEFAULT_SHADOWING, sentences: DEFAULT_SHADOWING_SENTENCES.map(s => ({ ...s })) };
}

export function getShadowingSourceKey(practice: Pick<ShadowingPractice, 'type' | 'playlistId' | 'youtubeVideoId' | 'source'>): string {
  if (practice.source === 'default_playlist') return DEFAULT_SHADOWING_KEY;
  if (practice.type === 'playlist' && practice.playlistId) return `playlist:${practice.playlistId}`;
  if (practice.type === 'video' && practice.youtubeVideoId) return `video:${practice.youtubeVideoId}`;
  return DEFAULT_SHADOWING_KEY;
}

export function getDefaultShadowingPhrases(): ShadowingSentence[] {
  return DEFAULT_SHADOWING_SENTENCES.map(s => ({ ...s, updatedAt: new Date().toISOString() }));
}

function normalizeSentence(raw: Partial<ShadowingSentence> & { repetitionsDone?: number; repetitionsTarget?: number }, now: string): ShadowingSentence {
  return {
    id: raw.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    text: raw.text ?? '',
    translation: raw.translation ?? '',
    repetitions: raw.repetitions ?? raw.repetitionsDone ?? 0,
    targetRepetitions: raw.targetRepetitions ?? raw.repetitionsTarget ?? 5,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  };
}

function buildPhraseSet(sourceTitle: string, sourceUrl: string, phrases: ShadowingSentence[]): ShadowingPhraseSet {
  return { sourceTitle, sourceUrl, phrases };
}

export function loadEnglishData(): EnglishDataV2 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DATA, shadowingPractice: cloneDefaultShadowing() };
    const parsed = JSON.parse(raw) as Partial<EnglishDataV2>;
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    const parsedPractice = parsed.shadowingPractice ?? cloneDefaultShadowing();
    const shadowingKey = getShadowingSourceKey(parsedPractice);
    const legacySentenceSets = parsed.shadowingSentenceSets ?? {};
    const parsedPhraseSets = parsed.shadowingPhraseSets ?? {};
    const defaultPhrases = DEFAULT_SHADOWING_SENTENCES.map(s => normalizeSentence(s, now));
    const currentLegacyPhrases = (parsedPractice.sentences ?? []).map(sentence => normalizeSentence(sentence, now));
    const shadowingPhraseSets: Record<string, ShadowingPhraseSet> = {
      [DEFAULT_SHADOWING_KEY]: buildPhraseSet('Playlist padrão', DEFAULT_SHADOWING.watchUrl, defaultPhrases),
      ...Object.fromEntries(Object.entries(legacySentenceSets).map(([key, phrases]) => [
        key,
        buildPhraseSet(key, parsedPractice.watchUrl ?? DEFAULT_SHADOWING.watchUrl, phrases.map(sentence => normalizeSentence(sentence, now))),
      ])),
      ...parsedPhraseSets,
    };
    if (!shadowingPhraseSets[shadowingKey]) {
      shadowingPhraseSets[shadowingKey] = buildPhraseSet(
        parsedPractice.title ?? (shadowingKey === DEFAULT_SHADOWING_KEY ? 'Playlist padrão' : shadowingKey),
        parsedPractice.watchUrl ?? DEFAULT_SHADOWING.watchUrl,
        currentLegacyPhrases.length > 0 ? currentLegacyPhrases : defaultPhrases,
      );
    }
    const shadowingSentences = shadowingPhraseSets[shadowingKey].phrases.map(sentence => normalizeSentence(sentence, now));
    const shadowingPractice = {
      ...parsedPractice,
      sentences: shadowingSentences,
    };

    return {
      selectedListeningLevel: parsed.selectedListeningLevel ?? 'advanced',
      selectedShadowingLevel: parsed.selectedShadowingLevel ?? parsed.selectedListeningLevel ?? 'advanced',
      listeningVideo: parsed.listeningVideo ?? null,
      videoQuiz: parsed.videoQuiz ?? null,
      shadowingPractice,
      shadowingSentenceSets: Object.fromEntries(Object.entries(shadowingPhraseSets).map(([key, set]) => [key, set.phrases])),
      shadowingPhraseSets: {
        ...shadowingPhraseSets,
        [shadowingKey]: {
          ...shadowingPhraseSets[shadowingKey],
          phrases: shadowingSentences,
        },
      },
      vocabularyCards: (parsed.vocabularyCards ?? []).map(card => ({
        ...card,
        nextReviewAt: card.nextReviewAt ?? today,
      })),
      ui: {
        showFutureCards: parsed.ui?.showFutureCards ?? false,
        showKnownCards: parsed.ui?.showKnownCards ?? false,
      },
    };
  } catch {
    return { ...DEFAULT_DATA, shadowingPractice: cloneDefaultShadowing() };
  }
}

export function saveEnglishData(data: EnglishDataV2): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    console.warn('[EnglishV2] Failed to save to localStorage.');
  }
}
