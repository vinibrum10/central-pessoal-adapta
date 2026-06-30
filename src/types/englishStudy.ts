export type EnglishLevel = 'iniciante' | 'intermediário' | 'avançado';
export type ReviewStatus = 'novo' | 'revisar' | 'dominado';
export type StudySource = 'youtube' | 'drive' | 'speaking' | 'manual';

export interface DailyPlanItem {
  id: string;
  title: string;
  done: boolean;
  date: string;
}

export interface StudySession {
  id: string;
  date: string;
  source: StudySource;
  title: string;
  url?: string;
  minutes: number;
  level: EnglishLevel;
  understoodPercent: number;
  newWords: string[];
  usefulPhrases: string[];
  notes?: string;
}

export interface VocabularyItem {
  id: string;
  word: string;
  translation: string;
  example?: string;
  category: string;
  difficulty: EnglishLevel;
  status: ReviewStatus;
  nextReviewAt: string;
  createdAt: string;
  updatedAt: string;
  reviewCount: number;
}

export interface PhraseItem {
  id: string;
  phrase: string;
  meaning: string;
  context: string;
  usageExample?: string;
  status: ReviewStatus;
  nextReviewAt: string;
  createdAt: string;
  updatedAt: string;
  reviewCount: number;
}

export interface SpeakingPractice {
  id: string;
  date: string;
  prompt: string;
  transcript: string;
  notes?: string;
  minutes: number;
}

export interface SavedEnglishVideo {
  id: string;
  youtubeId: string;
  title: string;
  channelTitle: string;
  url: string;
  thumbnailUrl?: string;
  savedAt: string;
}

export type EnglishCefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type EnglishQuizDifficulty = 'easy' | 'medium' | 'hard';

export interface EnglishQuizQuestion {
  id: string;
  type: 'multiple_choice';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  skill: string;
  difficulty: EnglishQuizDifficulty;
}

export interface GeneratedEnglishQuiz {
  videoId: string;
  title: string;
  level: string;
  questionCount: number;
  generatedAt: string;
  source: 'transcript' | 'summary' | 'metadata';
  warning?: string;
  questions: EnglishQuizQuestion[];
}

export interface EnglishQuizAttempt {
  date: string;
  videoId: string;
  answers: number[];
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  passed: boolean;
  completedAt?: string;
}

export type EnglishDailyQuizStatus = 'locked' | 'available' | 'generating' | 'answered' | 'completed';

export interface EnglishDailyStudy {
  date: string;
  videoId: string;
  title: string;
  durationSeconds: number;
  watchedSeconds: number[];
  progressPercent: number;
  quizStatus: EnglishDailyQuizStatus;
  quizGenerated: boolean;
  quizCompleted: boolean;
  quizScore?: number;
  quizTotal?: number;
  quizScorePercent?: number;
  completed: boolean;
  completedAt?: string;
}

export interface ShadowingSession {
  id: string;
  date: string;
  videoId: string;
  title: string;
  durationSeconds: number;
  repeatCount: number;
  notes?: string;
  createdAt: string;
  /** 0-100 bucket midpoint captured before captions (step 2). */
  entendimentoPrimeiraPassada?: number;
  /** 0-100 bucket midpoint captured after the shadowing pass (step 4). */
  entendimentoTerceiraPassada?: number;
  /** Words/phrases the user logged as new during step 3, also pushed to weeklyWords. */
  expressoesAdicionadas?: string[];
  status: 'completa' | 'parcial';
  atualizadoEm: string;
}

export interface PreplyAula {
  id: string;
  date: string;
  teacher: string;
  minutes: number;
  topic: string;
  notes?: string;
  createdAt: string;
  /** 'brasileira' | 'nativo' — kept optional for backward compatibility with earlier records. */
  professor?: 'brasileira' | 'nativo';
  /** Free text with new expressions from the lesson, also feeds Palavras da Semana. */
  expressoesNovas?: string;
  /** Difficulty points observed during the lesson. */
  pontosDeDificuldade?: string;
}

export interface DuolingoStreak {
  currentStreak: number;
  longestStreak: number;
  lastUpdatedDate: string;
  history: { date: string; xp: number }[];
}

export interface WeeklyWord {
  id: string;
  word: string;
  translation: string;
  example?: string;
  weekStart: string;
  addedAt: string;
  nextReviewAt: string;
  reviewStage: number;
  lastReviewedAt?: string;
  mastered: boolean;
}

/** Histórico permanente de vídeos do "Inglês Diário" já assistidos pelo usuário — usado para nunca repetir um vídeo na seleção do vídeo do dia / "Trocar vídeo". */
export interface WatchedVideoEntry {
  videoId: string;
  title: string;
  channel: string;
  durationSeconds: number;
  /** Data (America/Sao_Paulo, yyyy-mm-dd) em que o vídeo foi assistido pela primeira vez. */
  watchedAt: string;
  /** 'watched' = assistiu o suficiente para liberar o questionário; 'completed' = também passou no questionário. */
  status: 'watched' | 'completed';
}

export interface EnglishStudyData {
  dailyPlan: DailyPlanItem[];
  sessions: StudySession[];
  vocabulary: VocabularyItem[];
  phrases: PhraseItem[];
  speakingPractices: SpeakingPractice[];
  savedVideos: SavedEnglishVideo[];
  dailyStudies: EnglishDailyStudy[];
  generatedQuizzes: GeneratedEnglishQuiz[];
  quizAttempts: EnglishQuizAttempt[];
  shadowingSessions: ShadowingSession[];
  preplyAulas: PreplyAula[];
  duolingoStreak: DuolingoStreak;
  weeklyWords: WeeklyWord[];
  watchedVideos: WatchedVideoEntry[];
}

export interface YouTubeEnglishVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl?: string;
  url: string;
  publishedAt?: string;
}

export interface EnglishDriveMaterial {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
}
