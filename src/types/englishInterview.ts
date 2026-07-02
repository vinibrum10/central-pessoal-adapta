export type InterviewTheme =
  | 'substations'
  | 'protection'
  | 'outages'
  | 'interconnection'
  | 'safety'
  | 'data-ami'
  | 'transmission'
  | 'legacy';

export type EnglishInterviewLevel = 'basic' | 'intermediate' | 'advanced' | 'fluent';

export interface GlossaryTerm {
  id: string;
  term: string;
  theme: string;
  category?: string | null;
  translation_pt: string;
  definition_en: string;
  example_en: string;
  importance_level?: number | null;
  source: 'seed' | 'job_posting' | 'episode' | 'legacy' | string;
  created_at: string;
}

export interface GlossaryReview {
  id: string;
  user_id: string;
  term_id: string;
  box: number;
  next_review: string;
  last_result: 'acertou' | 'errou' | null;
  reviewed_at: string | null;
  glossary_terms?: GlossaryTerm;
}

export interface GlossaryReviewCard {
  review: GlossaryReview | null;
  term: GlossaryTerm;
  box: number;
  next_review: string;
}

export interface InterviewQuestion {
  id: string;
  category: 'comportamental' | 'tecnica' | 'perfil' | string;
  question_en: string;
  o_que_avaliam: string;
  como_responder: string;
  temas_relacionados: string[];
  timer_sugerido_min: number;
}

export interface ListeningSource {
  id: string;
  name: string;
  kind: 'podcast' | 'youtube_channel' | string;
  url: string;
}

export interface ListeningEpisode {
  id: string;
  source_id: string | null;
  title: string;
  url: string;
  duration_sec: number | null;
  themes: string[];
  transcript: string | null;
  vocab_extracted: boolean;
  level: EnglishInterviewLevel | string;
  created_at: string;
  listening_sources?: ListeningSource | null;
}

export interface DailySession {
  id: string;
  user_id: string;
  session_date: string;
  episode_id: string | null;
  question_id: string | null;
  step_listening_done: boolean;
  step_shadowing_done: boolean;
  step_cards_done: boolean;
  step_question_done: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MockSession {
  id: string;
  user_id: string;
  session_date: string;
  teacher: string | null;
  rating: number | null;
  notes: string | null;
  recording_path: string | null;
  created_at: string;
}

export interface InterviewAnswerFeedback {
  transcript: string;
  star_structure?: {
    situation?: boolean;
    task?: boolean;
    action?: boolean;
    result?: boolean;
  };
  strengths: string[];
  improvements: string[];
  grammar_notes?: string[];
  score: number;
}

export interface InterviewAnswer {
  id: string;
  user_id: string;
  question_id: string;
  audio_path: string | null;
  duration_sec: number | null;
  self_rating: number | null;
  gemini_feedback: InterviewAnswerFeedback | null;
  created_at: string;
  audioUrl?: string;
}

export type EmployabilityTermStatus = 'domino' | 'revisar' | 'nao_domino';
export type UserGlossaryTermStatusValue = 'mastered' | 'review' | 'not_mastered';

export interface UserGlossaryTermStatus {
  id: string;
  user_id: string;
  term_id: string;
  status: UserGlossaryTermStatusValue;
  updated_at: string;
}

export interface UsJobVocabularyTerm {
  term: GlossaryTerm;
  review: GlossaryReview | null;
  userStatus: UserGlossaryTermStatus | null;
  status: EmployabilityTermStatus;
}

export interface StarAnswer {
  id: string;
  user_id: string;
  question_id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  final_answer_en: string;
  notes_pt: string;
  created_at: string;
  updated_at: string;
  interview_questions?: InterviewQuestion | null;
}

export interface StarAnswerInput {
  question_id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  final_answer_en: string;
  notes_pt: string;
}

export interface InterviewMissionMetrics {
  masteredTerms: number;
  totalSeedTerms: number;
  shadowingThisWeek: number;
  lastMockRating: number | null;
}

export interface InterviewModeState {
  session: DailySession;
  episode: ListeningEpisode | null;
  question: InterviewQuestion | null;
  reviewCards: GlossaryReviewCard[];
  metrics: InterviewMissionMetrics;
}

export const INTERVIEW_THEME_LABELS: Record<string, string> = {
  substations: 'Substations',
  protection: 'Protection',
  outages: 'Outages',
  interconnection: 'Interconnection',
  safety: 'Safety',
  'data-ami': 'Data / AMI',
  transmission: 'Transmission',
  legacy: 'Legado',
};

export const INTERVIEW_LEVEL_LABELS: Record<EnglishInterviewLevel, string> = {
  basic: 'Básico',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
  fluent: 'Fluente',
};
