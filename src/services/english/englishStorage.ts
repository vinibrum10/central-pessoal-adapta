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
  source: 'youtube_api' | 'none';
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
}

export interface ShadowingSentence {
  id: string;
  text: string;
  translation: string;
  repetitionsTarget: number;
  repetitionsDone: number;
}

export interface ShadowingPractice {
  type: 'video' | 'playlist';
  youtubeVideoId?: string;
  playlistId?: string;
  title?: string;
  watchUrl: string;
  embedUrl: string;
  source: 'default_playlist' | 'manual_link';
  sentences: ShadowingSentence[];
}

export interface VocabularyCard {
  id: string;
  word: string;
  meaning: string;
  example?: string;
  source?: 'listening' | 'quiz' | 'shadowing' | 'manual';
  sourceYoutubeVideoId?: string;
  reviewStatus: 'new' | 'learning' | 'review' | 'known';
  createdAt: string;
  nextReviewAt?: string;
}

export interface EnglishDataV2 {
  selectedListeningLevel: 'basic' | 'intermediate' | 'advanced' | 'fluent';
  listeningVideo: ListeningVideo | null;
  videoQuiz: VideoQuiz | null;
  shadowingPractice: ShadowingPractice;
  vocabularyCards: VocabularyCard[];
}

const DEFAULT_SHADOWING_SENTENCES: ShadowingSentence[] = [
  { id: 's1', text: "I'm going to practice until it feels natural.", translation: 'Vou praticar até parecer natural.', repetitionsTarget: 5, repetitionsDone: 0 },
  { id: 's2', text: 'Could you say that one more time, please?', translation: 'Você poderia dizer isso mais uma vez, por favor?', repetitionsTarget: 5, repetitionsDone: 0 },
  { id: 's3', text: 'I want to improve my pronunciation and rhythm.', translation: 'Quero melhorar minha pronúncia e ritmo.', repetitionsTarget: 5, repetitionsDone: 0 },
  { id: 's4', text: 'Let me try to repeat the sentence naturally.', translation: 'Deixa eu tentar repetir a frase naturalmente.', repetitionsTarget: 5, repetitionsDone: 0 },
  { id: 's5', text: 'The more I practice, the more confident I become.', translation: 'Quanto mais pratico, mais confiante fico.', repetitionsTarget: 5, repetitionsDone: 0 },
];

export const DEFAULT_SHADOWING: ShadowingPractice = {
  type: 'playlist',
  playlistId: 'PLL8rrkKVLqeRdeFKmygYujTkwOefatZ6G',
  watchUrl: 'https://youtube.com/playlist?list=PLL8rrkKVLqeRdeFKmygYujTkwOefatZ6G',
  embedUrl: 'https://www.youtube.com/embed/videoseries?list=PLL8rrkKVLqeRdeFKmygYujTkwOefatZ6G',
  source: 'default_playlist',
  sentences: DEFAULT_SHADOWING_SENTENCES,
};

const DEFAULT_DATA: EnglishDataV2 = {
  selectedListeningLevel: 'advanced',
  listeningVideo: null,
  videoQuiz: null,
  shadowingPractice: DEFAULT_SHADOWING,
  vocabularyCards: [],
};

export function loadEnglishData(): EnglishDataV2 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DATA, shadowingPractice: { ...DEFAULT_SHADOWING, sentences: DEFAULT_SHADOWING_SENTENCES.map(s => ({ ...s })) } };
    const parsed = JSON.parse(raw) as Partial<EnglishDataV2>;
    return {
      selectedListeningLevel: parsed.selectedListeningLevel ?? 'advanced',
      listeningVideo: parsed.listeningVideo ?? null,
      videoQuiz: parsed.videoQuiz ?? null,
      shadowingPractice: parsed.shadowingPractice ?? { ...DEFAULT_SHADOWING, sentences: DEFAULT_SHADOWING_SENTENCES.map(s => ({ ...s })) },
      vocabularyCards: parsed.vocabularyCards ?? [],
    };
  } catch {
    return { ...DEFAULT_DATA, shadowingPractice: { ...DEFAULT_SHADOWING, sentences: DEFAULT_SHADOWING_SENTENCES.map(s => ({ ...s })) } };
  }
}

export function saveEnglishData(data: EnglishDataV2): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    console.warn('[EnglishV2] Failed to save to localStorage.');
  }
}
