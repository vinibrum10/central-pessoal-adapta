import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAIMock() {
    return { models: { generateContent: generateContentMock } };
  }),
}));

import handler from '../../../api/english/generate-quiz';

interface FakeResponse {
  statusCode: number;
  body: unknown;
  status: (code: number) => FakeResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

function makeRes(): FakeResponse {
  const res: FakeResponse = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
    },
    setHeader() {},
  };
  return res;
}

const basePayload = {
  videoId: 'abc12345678',
  title: 'Daily routines in American English',
  channel: 'VOA Learning English',
  level: 'A2',
  theme: 'Daily routines in American English',
  durationSeconds: 180,
  questionCount: 5,
};

function validGeminiQuizJson() {
  return JSON.stringify({
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        question: 'What is this video about?',
        options: ['Daily routines', 'Cooking', 'Sports', 'Weather'],
        correctAnswer: 'Daily routines',
        explanation: 'O vídeo fala sobre rotinas diárias.',
        level: 'A2',
        skill: 'comprehension',
      },
    ],
  });
}

describe('POST /api/english/generate-quiz', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    generateContentMock.mockReset();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
    delete process.env.GEMINI_MODEL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejeita métodos diferentes de POST', async () => {
    const res = makeRes();
    await handler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(405);
  });

  it('retorna erro amigável (503) quando falta GEMINI_API_KEY, sem chamar o Gemini', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = makeRes();
    await handler({ method: 'POST', body: basePayload }, res);
    expect(res.statusCode).toBe(503);
    expect((res.body as { success: boolean }).success).toBe(false);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('usa gemini-2.5-flash por padrão quando GEMINI_MODEL não está definida', async () => {
    generateContentMock.mockResolvedValue({ text: validGeminiQuizJson() });
    const res = makeRes();
    await handler({ method: 'POST', body: basePayload }, res);

    expect(res.statusCode).toBe(200);
    expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-2.5-flash' }));
  });

  it('sem transcrição/resumo, gera o quiz a partir de metadados e sinaliza isso em `warning`', async () => {
    generateContentMock.mockResolvedValue({ text: validGeminiQuizJson() });
    const res = makeRes();
    await handler({ method: 'POST', body: basePayload }, res);

    const body = res.body as { source: string; warning?: string };
    expect(body.source).toBe('metadata');
    expect(body.warning).toMatch(/transcri|metadados/i);
  });

  it('usa a transcrição como fonte quando ela é fornecida, sem o aviso de metadados', async () => {
    generateContentMock.mockResolvedValue({ text: validGeminiQuizJson() });
    const res = makeRes();
    await handler({ method: 'POST', body: { ...basePayload, transcript: 'Full transcript text of the video goes here.' } }, res);

    const body = res.body as { source: string; warning?: string };
    expect(body.source).toBe('transcript');
    expect(body.warning).toBeUndefined();
  });

  it('não quebra quando o Gemini responde texto fora do JSON — trata como erro amigável (502)', async () => {
    generateContentMock.mockResolvedValue({ text: 'Aqui vão as perguntas: 1) ... (sem JSON nenhum)' });
    const res = makeRes();
    await handler({ method: 'POST', body: basePayload }, res);

    expect(res.statusCode).toBe(502);
    expect((res.body as { success: boolean }).success).toBe(false);
  });

  it('retorna 502 amigável quando o JSON não bate com o schema esperado (ex.: sem "questions")', async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ foo: 'bar' }) });
    const res = makeRes();
    await handler({ method: 'POST', body: basePayload }, res);

    expect(res.statusCode).toBe(502);
  });

  it('retorna 400 quando faltam dados obrigatórios do vídeo', async () => {
    const res = makeRes();
    await handler({ method: 'POST', body: { videoId: 'abc12345678' } }, res);
    expect(res.statusCode).toBe(400);
    expect(generateContentMock).not.toHaveBeenCalled();
  });
});
