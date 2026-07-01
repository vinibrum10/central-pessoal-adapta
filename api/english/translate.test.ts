import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAIMock() {
    return { models: { generateContent: generateContentMock } };
  }),
}));

import handler from './translate';

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

const validGeminiJson = JSON.stringify({
  original: 'hello',
  translation: 'olá',
  simpleExplanationPtBr: 'Saudação simples usada para cumprimentar alguém.',
  examples: [
    { english: 'Hello!', portuguese: 'Olá!' },
    { english: 'Hello there.', portuguese: 'Olá aí.' },
  ],
  pronunciationTipPtBr: 'O "h" inicial é mudo em inglês.',
  vocabulary: [],
});

describe('POST /api/english/translate', () => {
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
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('retorna erro amigável (503) e nunca chama o Gemini quando falta GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = makeRes();
    await handler({ method: 'POST', body: { text: 'hello' } }, res);
    expect(res.statusCode).toBe(503);
    expect((res.body as { success: boolean }).success).toBe(false);
    expect(typeof (res.body as { error: string }).error).toBe('string');
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('retorna 400 quando não há texto para traduzir', async () => {
    const res = makeRes();
    await handler({ method: 'POST', body: { text: '   ' } }, res);
    expect(res.statusCode).toBe(400);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('usa gemini-2.5-flash como modelo padrão quando GEMINI_MODEL não está definida', async () => {
    generateContentMock.mockResolvedValue({ text: validGeminiJson });
    const res = makeRes();
    await handler({ method: 'POST', body: { text: 'hello', context: 'vocabulary' } }, res);

    expect(res.statusCode).toBe(200);
    expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-2.5-flash' }));
  });

  it('usa o valor de GEMINI_MODEL quando ele está configurado', async () => {
    process.env.GEMINI_MODEL = 'gemini-custom-model';
    generateContentMock.mockResolvedValue({ text: validGeminiJson });
    const res = makeRes();
    await handler({ method: 'POST', body: { text: 'hello' } }, res);

    expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-custom-model' }));
  });

  it('retorna a tradução estruturada quando o Gemini responde corretamente', async () => {
    generateContentMock.mockResolvedValue({ text: validGeminiJson });
    const res = makeRes();
    await handler({ method: 'POST', body: { text: 'hello', context: 'vocabulary' } }, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as { translation: string; examples: unknown[] };
    expect(body.translation).toBe('olá');
    expect(body.examples).toHaveLength(2);
  });

  it('não quebra quando o Gemini responde com texto fora do JSON — trata como erro amigável (502)', async () => {
    generateContentMock.mockResolvedValue({ text: 'Aqui está a tradução: olá (sem JSON nenhum).' });
    const res = makeRes();
    await handler({ method: 'POST', body: { text: 'hello' } }, res);

    expect(res.statusCode).toBe(502);
    expect((res.body as { success: boolean }).success).toBe(false);
    expect(typeof (res.body as { error: string }).error).toBe('string');
  });

  it('retorna 502 amigável quando o JSON não bate com o schema esperado', async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ translation: 'olá' }) });
    const res = makeRes();
    await handler({ method: 'POST', body: { text: 'hello' } }, res);

    expect(res.statusCode).toBe(502);
  });

  it('retorna 502 amigável sem propagar exceção quando a chamada ao Gemini falha', async () => {
    generateContentMock.mockRejectedValue(new Error('Gemini indisponível'));
    const res = makeRes();
    await expect(handler({ method: 'POST', body: { text: 'hello' } }, res)).resolves.not.toThrow();
    expect(res.statusCode).toBe(502);
  });
});
