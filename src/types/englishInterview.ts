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
  translation_pt: string;
  definition_en: string;
  example_en: string;
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
