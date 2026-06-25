type QuizSource = 'transcript' | 'summary' | 'metadata';
type Difficulty = 'easy' | 'medium' | 'hard';

declare const process: {
  env: Record<string, string | undefined>;
};

type GenerateQuizRequest = {
  videoId?: string;
  title?: string;
  channel?: string;
  level?: string;
  theme?: string;
  durationSeconds?: number;
  transcript?: string;
  summary?: string;
  questionCount?: number;
};

type QuizQuestion = {
  id: string;
  type: 'multiple_choice';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  skill: string;
  difficulty: Difficulty;
};

type GeneratedQuiz = {
  videoId: string;
  title: string;
  level: string;
  questionCount: number;
  generatedAt: string;
  source: QuizSource;
  warning?: string;
  questions: QuizQuestion[];
};

type ServerRequest = {
  method?: string;
  body?: unknown;
};

type ServerResponse = {
  status: (code: number) => ServerResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const DEFAULT_MODEL = 'gpt-5.5';
const MAX_TRANSCRIPT_LENGTH = 12000;
const MAX_SUMMARY_LENGTH = 3000;

const quizSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['videoId', 'title', 'level', 'questionCount', 'warning', 'questions'],
  properties: {
    videoId: { type: 'string' },
    title: { type: 'string' },
    level: { type: 'string' },
    questionCount: { type: 'number' },
    warning: { type: ['string', 'null'] },
    questions: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'type', 'question', 'options', 'correctIndex', 'explanation', 'skill', 'difficulty'],
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['multiple_choice'] },
          question: { type: 'string' },
          options: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: { type: 'string' },
          },
          correctIndex: { type: 'number', minimum: 0, maximum: 3 },
          explanation: { type: 'string' },
          skill: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
      },
    },
  },
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function parseBody(body: unknown): GenerateQuizRequest {
  if (typeof body === 'string') return JSON.parse(body) as GenerateQuizRequest;
  return (body ?? {}) as GenerateQuizRequest;
}

function clampQuestionCount(value: unknown) {
  const count = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 5;
  return Math.min(5, Math.max(3, count));
}

function trimString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function resolveSource(body: GenerateQuizRequest): { source: QuizSource; content: string; warning?: string } {
  const transcript = trimString(body.transcript, MAX_TRANSCRIPT_LENGTH);
  if (transcript) return { source: 'transcript', content: transcript };

  const summary = trimString(body.summary, MAX_SUMMARY_LENGTH);
  if (summary) return { source: 'summary', content: summary };

  return {
    source: 'metadata',
    content: [
      `Title: ${body.title}`,
      `Channel: ${body.channel}`,
      `Theme: ${body.theme}`,
      `Level: ${body.level}`,
      `Duration: ${body.durationSeconds} seconds`,
    ].join('\n'),
    warning: 'Questionário gerado com base em metadados do vídeo, pois não havia transcrição ou resumo disponível.',
  };
}

function buildPrompt(body: Required<Pick<GenerateQuizRequest, 'videoId' | 'title' | 'channel' | 'level' | 'theme' | 'durationSeconds'>>, questionCount: number, source: QuizSource, content: string, warning?: string) {
  return [
    'Você é um tutor de inglês para um aluno brasileiro.',
    'Gere um questionário curto baseado no conteúdo do vídeo informado.',
    'O objetivo é testar compreensão auditiva, vocabulário e frases úteis.',
    'Use inglês simples nas perguntas e alternativas.',
    'Use português apenas nas explicações.',
    'Não invente detalhes que não estejam no conteúdo.',
    'Retorne somente JSON no schema solicitado.',
    '',
    `Video ID: ${body.videoId}`,
    `Title: ${body.title}`,
    `Channel: ${body.channel}`,
    `Level: ${body.level}`,
    `Theme: ${body.theme}`,
    `Duration seconds: ${body.durationSeconds}`,
    `Question count: ${questionCount}`,
    `Source: ${source}`,
    warning ? `Warning to include: ${warning}` : 'Warning to include: null',
    '',
    'Reliable content:',
    content,
  ].filter(Boolean).join('\n');
}

function extractOutputText(data: { output_text?: unknown; output?: unknown }): string {
  if (typeof data.output_text === 'string') return data.output_text;
  if (!Array.isArray(data.output)) return '';

  return data.output.flatMap(item => {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) return [];
    return content.map(part => {
      const text = (part as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    });
  }).join('');
}

function isQuestion(value: unknown): value is QuizQuestion {
  const question = value as Partial<QuizQuestion> | null;
  const correctIndex = question?.correctIndex;
  return Boolean(
    question
    && typeof question.id === 'string'
    && question.type === 'multiple_choice'
    && typeof question.question === 'string'
    && Array.isArray(question.options)
    && question.options.length === 4
    && question.options.every(option => typeof option === 'string' && option.trim().length > 0)
    && typeof correctIndex === 'number'
    && Number.isInteger(correctIndex)
    && correctIndex >= 0
    && correctIndex <= 3
    && typeof question.explanation === 'string'
    && typeof question.skill === 'string'
    && ['easy', 'medium', 'hard'].includes(question.difficulty ?? ''),
  );
}

function validateQuiz(value: unknown, fallback: {
  videoId: string;
  title: string;
  level: string;
  source: QuizSource;
  warning?: string;
}): GeneratedQuiz | null {
  const quiz = value as Partial<GeneratedQuiz> | null;
  if (!quiz || !Array.isArray(quiz.questions)) return null;
  const questions = quiz.questions.filter(isQuestion);
  if (questions.length < 3 || questions.length > 5) return null;

  return {
    videoId: typeof quiz.videoId === 'string' ? quiz.videoId : fallback.videoId,
    title: typeof quiz.title === 'string' ? quiz.title : fallback.title,
    level: typeof quiz.level === 'string' ? quiz.level : fallback.level,
    questionCount: questions.length,
    generatedAt: new Date().toISOString(),
    source: fallback.source,
    warning: typeof quiz.warning === 'string' ? quiz.warning : fallback.warning,
    questions,
  };
}

export default async function handler(req: ServerRequest, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    json(res, 405, { success: false, error: 'Método não permitido.' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    json(res, 503, {
      success: false,
      error: 'OpenAI não configurada. Configure OPENAI_API_KEY nas variáveis de ambiente do backend.',
    });
    return;
  }

  let body: GenerateQuizRequest;
  try {
    body = parseBody(req.body);
  } catch {
    json(res, 400, { success: false, error: 'JSON inválido.' });
    return;
  }

  const videoId = trimString(body.videoId, 120);
  const title = trimString(body.title, 240);
  const channel = trimString(body.channel, 160);
  const level = trimString(body.level, 20);
  const theme = trimString(body.theme, 160);
  const durationSeconds = typeof body.durationSeconds === 'number' && Number.isFinite(body.durationSeconds)
    ? Math.max(1, Math.round(body.durationSeconds))
    : 1;
  const questionCount = clampQuestionCount(body.questionCount);

  if (!videoId || !title || !channel || !level || !theme) {
    json(res, 400, { success: false, error: 'Dados do vídeo incompletos para gerar o questionário.' });
    return;
  }

  const { source, content, warning } = resolveSource(body);

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input: buildPrompt({ videoId, title, channel, level, theme, durationSeconds }, questionCount, source, content, warning),
        text: {
          format: {
            type: 'json_schema',
            name: 'english_daily_quiz',
            strict: true,
            schema: quizSchema,
          },
          verbosity: 'low',
        },
        reasoning: { effort: 'low' },
        max_output_tokens: 1800,
        store: false,
      }),
    });

    const data = await openaiResponse.json() as {
      output_text?: unknown;
      output?: unknown;
      error?: { message?: string; type?: string };
    };

    if (!openaiResponse.ok) {
      const status = openaiResponse.status;
      console.error('OpenAI quiz generation failed', { status, type: data.error?.type });
      if (status === 401 || status === 403) throw new Error('Chave OpenAI inválida ou sem permissão.');
      if (status === 429) throw new Error('Limite de uso da OpenAI atingido. Tente novamente mais tarde.');
      throw new Error('Erro na chamada da OpenAI. Tente novamente em instantes.');
    }

    const outputText = extractOutputText(data);
    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      json(res, 502, { success: false, error: 'Retorno inválido da IA. Tente gerar novamente.' });
      return;
    }

    const quiz = validateQuiz(parsed, { videoId, title, level, source, warning });
    if (!quiz) {
      json(res, 502, { success: false, error: 'Retorno inválido da IA. Tente gerar novamente.' });
      return;
    }

    json(res, 200, quiz);
  } catch (error) {
    console.error('English quiz endpoint error', { message: error instanceof Error ? error.message : 'unknown' });
    json(res, 502, {
      success: false,
      error: error instanceof Error ? error.message : 'Quiz não pôde ser gerado.',
    });
  }
}
