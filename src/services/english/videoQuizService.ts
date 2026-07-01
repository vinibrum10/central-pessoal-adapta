// Serviço de questionário do vídeo de listening.
// A geração principal usa Gemini (via /api/english/generate-quiz, chave só no backend).
// generateFallbackQuiz continua disponível como opção manual/offline caso a IA falhe
// ou a chave não esteja configurada — nunca é usada para mascarar um erro da IA.

import type { ListeningVideo, QuizQuestion, VideoQuiz } from './englishStorage';
import type { ListeningLevel } from './youtubeListeningService';

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const LEVEL_TO_CEFR: Record<ListeningLevel, string> = {
  basic: 'A1',
  intermediate: 'A2',
  advanced: 'B1',
  fluent: 'B2',
};

interface GeminiQuizQuestion {
  id: string;
  type: 'multiple_choice';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  skill: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface GeminiQuizResponse {
  videoId: string;
  title: string;
  level: string;
  questionCount: number;
  generatedAt: string;
  source: 'transcript' | 'summary' | 'metadata';
  warning?: string;
  questions: GeminiQuizQuestion[];
}

interface ErrorResponse {
  success?: false;
  error?: string;
}

function isGeminiQuizResponse(value: unknown): value is GeminiQuizResponse {
  const quiz = value as Partial<GeminiQuizResponse> | null;
  return Boolean(
    quiz
    && Array.isArray(quiz.questions)
    && quiz.questions.length >= 1
    && quiz.questions.every(q =>
      q
      && typeof q.question === 'string'
      && Array.isArray(q.options) && q.options.length === 4
      && Number.isInteger(q.correctIndex),
    ),
  );
}

const GENERIC_QUIZ_ERROR = 'Não foi possível gerar o questionário com a IA agora. Tente novamente ou use as perguntas genéricas.';

/**
 * Gera um questionário com Gemini baseado no vídeo selecionado. Sem transcrição
 * disponível, o backend gera perguntas gerais a partir do título/canal/tema e
 * devolve um aviso (`warning`) deixando isso claro para o usuário — nunca inventa
 * detalhes específicos do vídeo que não existem.
 */
export async function generateAiQuiz(video: ListeningVideo, questionCount = 10): Promise<VideoQuiz> {
  let response: Response;
  try {
    response = await fetch('/api/english/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: video.youtubeVideoId,
        title: video.title,
        channel: video.channelTitle,
        level: LEVEL_TO_CEFR[video.level],
        theme: video.title,
        durationSeconds: video.durationSeconds || 1,
        questionCount,
      }),
    });
  } catch (networkError) {
    console.error('[AI Quiz] Network error calling /api/english/generate-quiz', networkError);
    throw new Error('Sem conexão com o servidor de IA. Verifique sua internet e tente novamente.');
  }

  const data = await response.json().catch(() => ({})) as GeminiQuizResponse | ErrorResponse;
  if (!response.ok || !isGeminiQuizResponse(data)) {
    const error = 'error' in data && typeof data.error === 'string' ? data.error : GENERIC_QUIZ_ERROR;
    console.error('[AI Quiz] Gemini quiz request failed', { status: response.status, error });
    throw new Error(error);
  }

  return {
    youtubeVideoId: video.youtubeVideoId,
    questions: data.questions.map(q => ({
      id: q.id || genId(),
      question: q.question,
      options: q.options,
      correctAnswerIndex: q.correctIndex,
      explanation: q.explanation,
    })),
    answers: {},
    source: data.source,
    warning: data.warning,
  };
}

const FALLBACK_QUESTIONS: QuizQuestion[] = [
  {
    id: genId(),
    question: 'What is the main topic discussed in the video?',
    options: ['Daily routines and habits', 'Business negotiations', 'Travel experiences', 'Science and technology'],
    correctAnswerIndex: 0,
    explanation: 'Listening for the main topic is a key comprehension skill.',
  },
  {
    id: genId(),
    question: 'Which of the following best describes the speaker\'s tone?',
    options: ['Casual and friendly', 'Formal and serious', 'Confused and uncertain', 'Angry and frustrated'],
    correctAnswerIndex: 0,
    explanation: 'Identifying tone helps understand the speaker\'s attitude.',
  },
  {
    id: genId(),
    question: 'What does the speaker suggest the listener should do?',
    options: ['Practice daily', 'Read more books', 'Watch more movies', 'Travel abroad'],
    correctAnswerIndex: 0,
    explanation: 'Extracting suggestions from spoken English is a practical skill.',
  },
  {
    id: genId(),
    question: 'Which phrase did the speaker most likely use to introduce a new point?',
    options: ['Now, let\'s talk about...', 'I disagree with that...', 'On the other hand...', 'To summarize...'],
    correctAnswerIndex: 0,
    explanation: 'Transition phrases signal topic shifts in spoken English.',
  },
  {
    id: genId(),
    question: 'What is a key strategy to improve English listening comprehension?',
    options: ['Listen repeatedly and actively', 'Only read subtitles', 'Translate every word', 'Skip difficult parts'],
    correctAnswerIndex: 0,
    explanation: 'Active, repeated listening builds familiarity with natural speech.',
  },
  {
    id: genId(),
    question: 'Which type of English did the video feature?',
    options: ['American English', 'British English', 'Australian English', 'Indian English'],
    correctAnswerIndex: 0,
    explanation: 'This section focuses on American English pronunciation and vocabulary.',
  },
  {
    id: genId(),
    question: 'What skill does shadowing primarily help develop?',
    options: ['Pronunciation and rhythm', 'Reading speed', 'Grammar accuracy', 'Vocabulary spelling'],
    correctAnswerIndex: 0,
    explanation: 'Shadowing improves pronunciation by imitating natural speech patterns.',
  },
  {
    id: genId(),
    question: 'Why is it useful to watch a video without subtitles first?',
    options: ['To test raw listening comprehension', 'To memorize dialogue', 'To improve reading speed', 'To practice grammar'],
    correctAnswerIndex: 0,
    explanation: 'Watching without subtitles first reveals your actual listening level.',
  },
  {
    id: genId(),
    question: 'What is the benefit of learning vocabulary in context (full sentences)?',
    options: ['It is easier to remember and use correctly', 'It is faster than using a dictionary', 'It avoids the need for translation', 'It replaces grammar study'],
    correctAnswerIndex: 0,
    explanation: 'Context reinforces meaning and correct usage of new words.',
  },
  {
    id: genId(),
    question: 'Which action best follows watching a listening video?',
    options: ['Review new vocabulary and repeat difficult phrases', 'Immediately watch another video', 'Write a full essay about the topic', 'Translate the entire transcript'],
    correctAnswerIndex: 0,
    explanation: 'Active review of vocabulary and phrases consolidates what you learned.',
  },
];

export function generateFallbackQuiz(youtubeVideoId: string): VideoQuiz {
  // Shuffle a fresh copy each time so order varies between generations
  const shuffled = [...FALLBACK_QUESTIONS]
    .sort(() => Math.random() - 0.5)
    .map(q => ({ ...q, id: genId() }))
    .slice(0, 10);

  return {
    youtubeVideoId,
    questions: shuffled,
    answers: {},
    source: 'fallback',
    warning: 'Perguntas genéricas de listening (offline) — não são específicas deste vídeo.',
  };
}
