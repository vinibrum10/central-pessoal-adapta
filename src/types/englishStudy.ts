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

export type WeeklyWordStatus = 'learning' | 'review' | 'learned' | 'archived';
export type WeeklyWordSource = 'manual' | 'video' | 'ai';

export interface WeeklyWord {
  id: string;
  /** Palavra ou expressão isolada (ex.: "give up"). */
  word: string;
  /** Tradução da palavra/expressão isolada. */
  translation: string;
  /** @deprecated frase em inglês — mantido por compatibilidade, use `sentence`. */
  example?: string;
  /** Frase completa em inglês usando a palavra/expressão (estilo Anki). */
  sentence?: string;
  /** Tradução da frase completa (`sentence`), não da palavra isolada. */
  sentenceTranslation?: string;
  /** Início (domingo) da semana em que a palavra foi adicionada — usado só para o contador/filtro visual "Palavras da Semana". */
  weekStart: string;
  addedAt: string;
  createdAt: string;
  updatedAt: string;
  status: WeeklyWordStatus;
  lastReviewedAt?: string;
  nextReviewAt: string;
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  lapses: number;
  totalReviews: number;
  correctReviews: number;
  source: WeeklyWordSource;
  /** @deprecated mantido só para migração de dados antigos. */
  reviewStage?: number;
  /** @deprecated mantido só para migração de dados antigos — use `status === 'learned'`. */
  mastered?: boolean;
}

// ============================================================
// BANCO CURADO DE VÍDEOS (Inglês Diário)
// ============================================================
// Ver src/data/curatedEnglishVideos.ts para o seed e documentação de como
// adicionar vídeos novos, e src/services/englishVideoLibrary.ts /
// englishVideoSelector (em dailyVideoSelector.ts) para como esse banco é
// consumido.

export type CuratedVideoSource = 'curated' | 'youtube_api' | 'manual';
export type CuratedVideoStatus = 'active' | 'needs_validation' | 'unavailable' | 'archived';
export type CuratedVideoLevelGroup = 'beginner' | 'intermediate' | 'advanced';
export type CuratedVideoDifficulty = 'easy' | 'medium' | 'hard';

export interface ShadowingSentenceSeed {
  text: string;
  translation?: string;
  /** Segundo aproximado em que a frase começa no vídeo, se conhecido. */
  startTimeSeconds?: number;
  difficulty?: CuratedVideoDifficulty;
}

export interface SuggestedVocabularyCardSeed {
  word: string;
  /** Frase completa usando a palavra (vira `WeeklyWord.sentence` se o usuário aceitar o card sugerido). */
  phrase?: string;
  translation: string;
  example?: string;
  difficulty?: CuratedVideoDifficulty;
}

/**
 * Entrada do banco curado de vídeos — a fonte PRINCIPAL da aula diária de
 * Inglês Diário. A API do YouTube só é usada para descobrir/validar novos
 * candidatos (ver discoverYouTubeCandidates em englishVideoLibrary.ts); a
 * aula em si nunca depende de uma busca ao vivo na API.
 *
 * `status`/`useCount`/`failureCount`/`lastUsedAt` aqui são os valores de
 * SEED (estado inicial). O estado real, por usuário, é sobreposto em
 * runtime a partir de `EnglishStudyData.curatedVideoStats` — assim um vídeo
 * que falha para um usuário não fica marcado como quebrado para todos.
 */
export interface CuratedEnglishVideo {
  id: string;
  youtubeVideoId: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
  cefrLevel: EnglishCefrLevel;
  levelGroup: CuratedVideoLevelGroup;
  themes: string[];
  skills: string[];
  source: CuratedVideoSource;
  status: CuratedVideoStatus;
  embeddable: boolean;
  /** ISO date/datetime da última validação manual ou automática (duração, embeddable, público). */
  validatedAt?: string;
  /** ISO date/datetime do último uso como vídeo do dia (valor de seed; sobreposto por usuário em runtime). */
  lastUsedAt?: string;
  useCount: number;
  failureCount: number;
  shadowingSentences?: ShadowingSentenceSeed[];
  suggestedVocabularyCards?: SuggestedVocabularyCardSeed[];
  /** Resumo em inglês usado para o questionário gerado por IA e como fallback de frases de shadowing. */
  summary?: string;
  transcript?: string;
  notes?: string;
}

/** Estado de runtime por vídeo curado, persistido por usuário (não é seed — é o que de fato aconteceu na conta dele). */
export interface CuratedVideoStats {
  useCount: number;
  failureCount: number;
  lastUsedAt?: string;
  /** Quando presente, sobrepõe o `status` de seed (ex.: vídeo falhou de verdade para este usuário). */
  statusOverride?: CuratedVideoStatus;
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

// ============================================================
// FILTRO DE NÍVEL (UI) — 4 OPÇÕES (Básico/Intermediário/Avançado/Fluente)
// ============================================================
// DECISÃO DE ARQUITETURA: `CuratedVideoLevelGroup` ('beginner'|'intermediate'|
// 'advanced') é mantido como está — é o agrupamento de DADOS (3 grupos,
// mapeados 1:1 a partir do `cefrLevel` de cada vídeo, ver levelGroupFor() em
// curatedEnglishVideos.ts) e não deveria mudar para não invalidar o seed
// existente nem forçar migração de dados já salvos. "Fluente" é modelado como
// um FILTRO DE UI sobre esse mesmo dado: ele também aponta para
// levelGroup === 'advanced', mas restringe ainda mais por `cefrLevel` (exige
// C2, nunca C1). Isso é mais simples do que adicionar um 4º levelGroup
// porque: (1) não exige migração de vídeos já cadastrados, (2) não exige
// mudar a lógica de fallback existente em dailyVideoSelector.ts (que já
// trabalha em cima de 3 grupos), (3) deixa "Fluente" puramente como um filtro
// adicional de cefrLevel, fácil de entender e testar. Ver
// LEVEL_FILTER_TO_LEVEL_GROUP / LEVEL_FILTER_TO_CEFR em
// src/services/dailyVideoSelector.ts para o mapeamento completo.
export type EnglishLevelFilter = 'basic' | 'intermediate' | 'advanced' | 'fluent';

export type WeeklyVideoStatus = 'available' | 'in_progress' | 'completed' | 'swapped';

/**
 * Um item do histórico semanal de vídeos do Inglês Diário — todo vídeo
 * disponibilizado (vídeo do dia inicial ou via "Trocar vídeo") na semana
 * atual entra aqui, mesmo que o usuário não o conclua. Particionado por
 * `weekKey` (ISO week, ver src/utils/weekKey.ts) para nunca repetir um
 * `youtubeVideoId` já disponibilizado na mesma semana.
 */
export interface WeeklyVideoHistoryEntry {
  id: string;
  youtubeVideoId: string;
  title: string;
  channelTitle: string;
  levelFilter: EnglishLevelFilter;
  cefrLevel: EnglishCefrLevel;
  durationSeconds: number;
  /** Qualidade mínima calculada pelo app (0-100) — NÃO é avaliação do YouTube. Ver calculateVideoQualityScore em englishVideoLibrary.ts. */
  qualityScore: number;
  source: 'curated' | 'youtube_api';
  status: WeeklyVideoStatus;
  selectedAt: string;
  weekKey: string;
  watchUrl: string;
  embedUrl: string;
  progressPercent?: number;
}

export interface EnglishStudyData {
  /**
   * IDs de vídeo confirmados como quebrados (erro real do player do YouTube
   * ou falha de validação remota — privado, removido, sem permissão de
   * incorporação etc.). Lista pequena e persistida para que um vídeo
   * indisponível nunca seja restaurado/sugerido de novo após recarregar a
   * página. Não confundir com `watchedVideos`, que é só preferência.
   */
  unavailableVideoIds: string[];
  /** Estado de runtime por vídeo curado (useCount/failureCount/lastUsedAt/statusOverride), chave = youtubeVideoId. Ver CuratedVideoStats. */
  curatedVideoStats: Record<string, CuratedVideoStats>;
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
  /** Histórico semanal completo de vídeos disponibilizados (ver WeeklyVideoHistoryEntry) — particionado por weekKey, nunca apagado entre semanas. */
  weeklyVideoHistory: WeeklyVideoHistoryEntry[];
  /** Última escolha do usuário no filtro de nível da seção "Assistir vídeo do dia" — persistida para reabrir já com o filtro certo. */
  lastLevelFilter?: EnglishLevelFilter;
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
