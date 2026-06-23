type ClaudeMode = 'speaking_feedback' | 'phrase_suggestion' | 'listening_review';

type ClaudeRequest = {
  mode?: ClaudeMode;
  input?: string;
  context?: {
    level?: string;
    goal?: string;
  };
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

const MAX_INPUT_LENGTH = 4000;
const DEFAULT_MODEL = 'claude-sonnet-4-5';

function json(res: ServerResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function parseBody(body: unknown): ClaudeRequest {
  if (typeof body === 'string') return JSON.parse(body) as ClaudeRequest;
  return (body ?? {}) as ClaudeRequest;
}

function buildPrompt(mode: ClaudeMode, input: string, context: ClaudeRequest['context']) {
  const level = context?.level || 'intermediario';
  const goal = context?.goal || 'fluencia e trabalho nos EUA';
  const base = [
    'Voce e um tutor de ingles para um estudante brasileiro.',
    'Responda sempre em JSON valido, sem markdown.',
    'Use explicacoes curtas em portugues do Brasil e exemplos naturais em ingles.',
    `Nivel do aluno: ${level}. Objetivo: ${goal}.`,
  ].join('\n');

  const instructions: Record<ClaudeMode, string> = {
    speaking_feedback: [
      'Analise a resposta falada/digitada do aluno.',
      'Retorne correcao em ingles, explicacao em portugues, versao mais natural e tres alternativas naturais.',
    ].join('\n'),
    phrase_suggestion: [
      'Transforme a frase enviada em uma frase util de ingles.',
      'Retorne traducao natural, contexto de uso, exemplo, formalidade e tres alternativas.',
    ].join('\n'),
    listening_review: [
      'Analise o resumo de listening do aluno.',
      'Corrija o resumo, extraia vocabulario, sugira frases uteis e uma revisao curta.',
    ].join('\n'),
  };

  return `${base}\n\n${instructions[mode]}\n\nTexto do aluno:\n${input}\n\nFormato JSON:
{
  "correction": "...",
  "naturalVersion": "...",
  "explanationPt": "...",
  "alternatives": ["...", "...", "..."],
  "vocabulary": ["..."],
  "phrases": ["..."]
}`;
}

function safeParseClaudeText(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        // fall through
      }
    }
  }
  return {
    correction: '',
    naturalVersion: '',
    explanationPt: trimmed || 'Claude retornou uma resposta vazia.',
    alternatives: [],
    vocabulary: [],
    phrases: [],
  };
}

export default async function handler(req: ServerRequest, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    json(res, 405, { success: false, error: 'Metodo nao permitido.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    json(res, 503, {
      success: false,
      error: 'Claude não configurado. Configure ANTHROPIC_API_KEY nas variáveis de ambiente da Vercel.',
    });
    return;
  }

  let body: ClaudeRequest;
  try {
    body = parseBody(req.body);
  } catch {
    json(res, 400, { success: false, error: 'JSON inválido.' });
    return;
  }

  const mode = body.mode;
  const input = typeof body.input === 'string' ? body.input.trim() : '';
  if (!mode || !['speaking_feedback', 'phrase_suggestion', 'listening_review'].includes(mode)) {
    json(res, 400, { success: false, error: 'Modo Claude inválido.' });
    return;
  }
  if (!input) {
    json(res, 400, { success: false, error: 'Informe um texto para analisar.' });
    return;
  }
  if (input.length > MAX_INPUT_LENGTH) {
    json(res, 413, { success: false, error: 'Texto muito longo. Limite de 4000 caracteres.' });
    return;
  }

  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 900,
        temperature: 0.2,
        messages: [{ role: 'user', content: buildPrompt(mode, input, body.context) }],
      }),
    });

    const data = await anthropicResponse.json() as {
      content?: Array<{ type?: string; text?: string }>;
      error?: { message?: string; type?: string };
    };

    if (!anthropicResponse.ok) {
      const status = anthropicResponse.status;
      if (status === 401 || status === 403) throw new Error('Chave Claude inválida ou sem permissão.');
      if (status === 429) throw new Error('Limite de uso do Claude atingido. Tente novamente mais tarde.');
      if (status === 402) throw new Error('Billing do Claude indisponível. Verifique sua conta Anthropic.');
      throw new Error(data.error?.message ?? 'Claude indisponível no momento.');
    }

    const text = data.content?.find(part => part.type === 'text')?.text ?? '';
    json(res, 200, { success: true, result: safeParseClaudeText(text) });
  } catch (error) {
    json(res, 502, {
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao chamar Claude.',
    });
  }
}
