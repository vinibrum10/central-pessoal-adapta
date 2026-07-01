// Persistência do módulo Inglês Diário v2.
// Usa chave dedicada "sgp_english_v2" — não reutiliza storage antigo.

const STORAGE_KEY = 'sgp_english_v2';

// ============================================================
// DATA/HORA — sempre no fuso local do dispositivo, nunca UTC cru.
// ============================================================
// `new Date().toISOString()` usa UTC. Para quem mora no Brasil (UTC-3), uma
// palavra salva às 22h-23h59 local já cai no dia seguinte em UTC — o que
// fazia cards "sumirem"/aparecerem no dia errado perto da meia-noite. Estas
// funções usam sempre o fuso local do navegador para decidir "qual é o dia
// de hoje", evitando esse desvio.
export function getTodayISO(referenceDate = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referenceDate);
}

export function addDaysISO(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  // meio-dia evita qualquer problema de horário de verão ao somar dias
  const date = new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return getTodayISO(date);
}

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
  /** Descrição do vídeo (quando disponível pela YouTube API) — usada como base para shadowing. */
  description?: string;
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

// ============================================================
// SHADOWING — frases vêm do vídeo (transcript/descrição), de IA ou manuais.
// ============================================================
export type ShadowingPhraseSource =
  | 'videoTranscript'
  | 'videoMetadata'
  | 'aiGenerated'
  /** Geradas pelo botão "Gerar frases com IA" usando o vídeo atualmente carregado. */
  | 'aiGeneratedFromVideo'
  /** Geradas pelo botão "Gerar frases com IA" usando um tema digitado manualmente. */
  | 'aiGeneratedFromTheme'
  | 'manual'
  | 'fallback';

export interface ShadowingPhrase {
  id: string;
  text: string;
  translation: string;
  source: ShadowingPhraseSource;
  videoId?: string;
  videoTitle?: string;
  repetitionsDone: number;
  repetitionsTarget: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShadowingPractice {
  type: 'video' | 'playlist';
  youtubeVideoId?: string;
  playlistId?: string;
  title?: string;
  /** Descrição real do vídeo (via YouTube Data API), quando disponível — usada como contexto para gerar frases com IA. */
  description?: string;
  watchUrl: string;
  embedUrl: string;
  source: 'default_playlist' | 'manual_link' | 'youtube_api';
  sentences: ShadowingPhrase[];
}

export interface ShadowingPhraseSet {
  sourceTitle: string;
  sourceUrl: string;
  phrases: ShadowingPhrase[];
}

export interface EnglishUiState {
  /**
   * "Revisar hoje", "Cards futuros" e "Dominadas" ficam SEMPRE visíveis —
   * essa era a causa raiz de cards parecerem ter sumido (ficavam atrás de um
   * toggle escondido por padrão). Só o Histórico (redundante com os outros
   * três grupos somados) é opcionalmente recolhido.
   */
  showHistory: boolean;
}

// ============================================================
// CARDS DE VOCABULÁRIO (flashcards estilo Anki)
// ============================================================
export type VocabularyCardSource = 'manual' | 'gemini' | 'shadowing' | 'video';
export type VocabularyCardStatus = 'learning' | 'reviewing' | 'mastered';

export interface VocabularyCard {
  id: string;
  wordOrPhrase: string;
  translation: string;
  example?: string;
  exampleTranslation?: string;
  source: VocabularyCardSource;
  videoId?: string;
  videoTitle?: string;
  createdAt: string;
  lastReviewedAt?: string;
  nextReviewAt: string;
  reviewCount: number;
  errorCount: number;
  easyStreak: number;
  difficultCount: number;
  status: VocabularyCardStatus;
  masteredAt?: string;
  archivedAt?: string;
}

export interface EnglishDataV2 {
  selectedListeningLevel: 'basic' | 'intermediate' | 'advanced' | 'fluent';
  selectedShadowingLevel: 'basic' | 'intermediate' | 'advanced' | 'fluent';
  listeningVideo: ListeningVideo | null;
  videoQuiz: VideoQuiz | null;
  shadowingPractice: ShadowingPractice;
  shadowingSentenceSets: Record<string, ShadowingPhrase[]>;
  shadowingPhraseSets: Record<string, ShadowingPhraseSet>;
  vocabularyCards: VocabularyCard[];
  ui: EnglishUiState;
}

const DEFAULT_SHADOWING_SENTENCES: ShadowingPhrase[] = [
  { id: 's1', text: 'Could you say that one more time, please?', translation: 'Você poderia dizer isso mais uma vez, por favor?', source: 'fallback', repetitionsDone: 0, repetitionsTarget: 5, completed: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 's2', text: "I'm trying to sound more natural when I speak.", translation: 'Estou tentando soar mais natural quando falo.', source: 'fallback', repetitionsDone: 0, repetitionsTarget: 5, completed: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 's3', text: 'Let me repeat that slowly and then faster.', translation: 'Deixe-me repetir isso devagar e depois mais rápido.', source: 'fallback', repetitionsDone: 0, repetitionsTarget: 5, completed: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 's4', text: 'I want to improve my rhythm, stress, and intonation.', translation: 'Quero melhorar meu ritmo, ênfase e entonação.', source: 'fallback', repetitionsDone: 0, repetitionsTarget: 5, completed: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 's5', text: 'The more I practice, the more confident I become.', translation: 'Quanto mais eu pratico, mais confiante eu fico.', source: 'fallback', repetitionsDone: 0, repetitionsTarget: 5, completed: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
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
    showHistory: false,
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

export function getDefaultShadowingPhrases(): ShadowingPhrase[] {
  return DEFAULT_SHADOWING_SENTENCES.map(s => ({ ...s, updatedAt: new Date().toISOString() }));
}

/** +1 repetição, sem nunca passar do alvo (repetitionsTarget) — marca `completed` ao chegar lá. */
export function incrementPhraseRepetition(phrase: ShadowingPhrase): ShadowingPhrase {
  const repetitionsDone = Math.min(phrase.repetitionsDone + 1, phrase.repetitionsTarget);
  return { ...phrase, repetitionsDone, completed: repetitionsDone >= phrase.repetitionsTarget, updatedAt: new Date().toISOString() };
}

export function resetPhraseRepetition(phrase: ShadowingPhrase): ShadowingPhrase {
  return { ...phrase, repetitionsDone: 0, completed: false, updatedAt: new Date().toISOString() };
}

/** Marca a frase como finalizada manualmente (ex.: usuário já praticou offline). */
export function markPhraseCompleted(phrase: ShadowingPhrase): ShadowingPhrase {
  return { ...phrase, repetitionsDone: phrase.repetitionsTarget, completed: true, updatedAt: new Date().toISOString() };
}

/** Transforma uma frase de shadowing em um card de vocabulário novo — origem sempre 'shadowing'. */
export function createCardFromShadowingPhrase(phrase: ShadowingPhrase, id: string): VocabularyCard {
  return {
    id,
    wordOrPhrase: phrase.text,
    translation: phrase.translation,
    example: phrase.text,
    exampleTranslation: phrase.translation,
    source: 'shadowing',
    videoId: phrase.videoId,
    videoTitle: phrase.videoTitle,
    createdAt: new Date().toISOString(),
    nextReviewAt: getTodayISO(),
    reviewCount: 0,
    errorCount: 0,
    easyStreak: 0,
    difficultCount: 0,
    status: 'learning',
  };
}

function normalizePhraseText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Anexa `incoming` a `existing` sem apagar nada e sem duplicar frases
 * idênticas (mesmo texto, ignorando maiúsculas/espaços). Em caso de
 * duplicata, a frase já existente é mantida — a nova é descartada.
 */
export function mergeShadowingPhrasesWithoutDuplicates(existing: ShadowingPhrase[], incoming: ShadowingPhrase[]): ShadowingPhrase[] {
  const existingTexts = new Set(existing.map(p => normalizePhraseText(p.text)));
  const deduped: ShadowingPhrase[] = [];
  for (const phrase of incoming) {
    const normalized = normalizePhraseText(phrase.text);
    if (existingTexts.has(normalized)) continue;
    existingTexts.add(normalized);
    deduped.push(phrase);
  }
  return [...existing, ...deduped];
}

/** Migra frases de shadowing de formatos antigos (repetitions/targetRepetitions, sem `source`/`completed`) sem perder nada. */
function normalizeSentence(
  raw: Partial<ShadowingPhrase> & { repetitions?: number; targetRepetitions?: number },
  now: string,
): ShadowingPhrase {
  const repetitionsTarget = raw.repetitionsTarget ?? raw.targetRepetitions ?? 5;
  const repetitionsDone = Math.min(raw.repetitionsDone ?? raw.repetitions ?? 0, repetitionsTarget);
  return {
    id: raw.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    text: raw.text ?? '',
    translation: raw.translation ?? '',
    source: raw.source ?? 'manual',
    videoId: raw.videoId,
    videoTitle: raw.videoTitle,
    repetitionsDone,
    repetitionsTarget,
    completed: raw.completed ?? repetitionsDone >= repetitionsTarget,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  };
}

function buildPhraseSet(sourceTitle: string, sourceUrl: string, phrases: ShadowingPhrase[]): ShadowingPhraseSet {
  return { sourceTitle, sourceUrl, phrases };
}

// ============================================================
// MIGRAÇÃO DE CARDS — formato antigo (word/meaning/reviewStatus/...) para o
// novo formato (wordOrPhrase/translation/status/...). Nenhum card é perdido:
// todo campo ausente recebe um default seguro, nunca um valor que apague
// progresso real do usuário.
// ============================================================
type LegacyVocabularyCard = {
  id: string;
  word?: string;
  meaning?: string;
  wordOrPhrase?: string;
  translation?: string;
  example?: string;
  exampleTranslation?: string;
  source?: string;
  sourceYoutubeVideoId?: string;
  videoId?: string;
  videoTitle?: string;
  reviewStatus?: 'new' | 'learning' | 'review' | 'known';
  status?: VocabularyCardStatus;
  createdAt?: string;
  updatedAt?: string;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  repetitions?: number;
  correctCount?: number;
  incorrectCount?: number;
  reviewCount?: number;
  errorCount?: number;
  easyStreak?: number;
  difficultCount?: number;
  masteredAt?: string;
  archivedAt?: string;
};

const LEGACY_SOURCE_MAP: Record<string, VocabularyCardSource> = {
  manual: 'manual',
  ai: 'gemini',
  gemini: 'gemini',
  shadowing: 'shadowing',
  listening: 'video',
  quiz: 'video',
  video: 'video',
};

function migrateCardSource(raw?: string): VocabularyCardSource {
  if (raw && raw in LEGACY_SOURCE_MAP) return LEGACY_SOURCE_MAP[raw];
  return 'manual';
}

function migrateCardStatus(raw: LegacyVocabularyCard): VocabularyCardStatus {
  if (raw.status === 'learning' || raw.status === 'reviewing' || raw.status === 'mastered') return raw.status;
  if (raw.reviewStatus === 'known') return 'mastered';
  if (raw.reviewStatus === 'review') return 'reviewing';
  return 'learning';
}

export function normalizeVocabularyCard(raw: LegacyVocabularyCard, todayISO: string): VocabularyCard {
  const createdAt = raw.createdAt ?? new Date().toISOString();
  const status = migrateCardStatus(raw);
  return {
    id: raw.id,
    wordOrPhrase: raw.wordOrPhrase ?? raw.word ?? '',
    translation: raw.translation ?? raw.meaning ?? '',
    example: raw.example,
    exampleTranslation: raw.exampleTranslation,
    source: migrateCardSource(raw.source),
    videoId: raw.videoId ?? raw.sourceYoutubeVideoId,
    videoTitle: raw.videoTitle,
    createdAt,
    lastReviewedAt: raw.lastReviewedAt,
    nextReviewAt: raw.nextReviewAt ?? todayISO,
    reviewCount: raw.reviewCount ?? raw.repetitions ?? (raw.correctCount ?? 0) + (raw.incorrectCount ?? 0),
    errorCount: raw.errorCount ?? raw.incorrectCount ?? 0,
    easyStreak: raw.easyStreak ?? 0,
    difficultCount: raw.difficultCount ?? 0,
    status,
    masteredAt: raw.masteredAt ?? (status === 'mastered' ? raw.updatedAt ?? createdAt : undefined),
    archivedAt: raw.archivedAt,
  };
}

// ----------------------------------------------------------------
// Grupos de cards — sempre calculados a partir da lista completa. A troca de
// dia NUNCA remove um card da lista; ela só muda em qual destes grupos ele
// aparece.
// ----------------------------------------------------------------
export function getDueTodayCards(cards: VocabularyCard[], todayISO: string): VocabularyCard[] {
  return cards.filter(c => !c.archivedAt && c.status !== 'mastered' && c.nextReviewAt <= todayISO);
}

export function getFutureCards(cards: VocabularyCard[], todayISO: string): VocabularyCard[] {
  return cards.filter(c => !c.archivedAt && c.status !== 'mastered' && c.nextReviewAt > todayISO);
}

export function getMasteredCards(cards: VocabularyCard[]): VocabularyCard[] {
  return cards.filter(c => !c.archivedAt && c.status === 'mastered');
}

/** Histórico = todos os cards já criados, inclusive arquivados — nada some daqui. */
export function getCardHistory(cards: VocabularyCard[]): VocabularyCard[] {
  return cards;
}

export function loadEnglishData(): EnglishDataV2 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DATA, shadowingPractice: cloneDefaultShadowing() };
    const parsed = JSON.parse(raw) as Partial<EnglishDataV2> & { vocabularyCards?: LegacyVocabularyCard[] };
    const today = getTodayISO();
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
      ...Object.fromEntries(Object.entries(parsedPhraseSets).map(([key, set]) => [
        key,
        buildPhraseSet(set.sourceTitle, set.sourceUrl, set.phrases.map(sentence => normalizeSentence(sentence, now))),
      ])),
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
      // Migração: cards salvos com o formato antigo (word/meaning/reviewStatus)
      // são convertidos para o novo formato sem perder nenhum registro.
      vocabularyCards: (parsed.vocabularyCards ?? []).map(card => normalizeVocabularyCard(card, today)),
      ui: {
        showHistory: parsed.ui?.showHistory ?? false,
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
