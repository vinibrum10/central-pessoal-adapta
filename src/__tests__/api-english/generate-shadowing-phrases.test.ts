import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAIMock() {
    return { models: { generateContent: generateContentMock } };
  }),
}));

import handler from '../../../api/english/generate-shadowing-phrases';

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

function validPhrasesJson() {
  return JSON.stringify({
    phrases: [
      { text: 'Could you say that again?', translation: 'Você pode repetir isso?' },
      { text: 'I really appreciate your help.', translation: 'Eu realmente agradeço sua ajuda.' },
    ],
  });
}

describe('POST /api/english/generate-shadowing-phrases', () => {
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

  it('retorna erro amigável (503) sem chamar o Gemini quando falta GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = makeRes();
    await handler({ method: 'POST', body: { videoTitle: 'Daily routines' } }, res);
    expect(res.statusCode).toBe(503);
    expect((res.body as { success: boolean }).success).toBe(false);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('retorna 400 quando não há vídeo nem tema para basear as frases', async () => {
    const res = makeRes();
    await handler({ method: 'POST', body: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('aceita um videoId sozinho (sem título/descrição/transcript) como contexto válido — bug de vídeo colado manualmente', async () => {
    generateContentMock.mockResolvedValue({ text: validPhrasesJson() });
    const res = makeRes();
    await handler({ method: 'POST', body: { videoId: 'abc12345678' } }, res);
    expect(res.statusCode).toBe(200);
    expect(generateContentMock).toHaveBeenCalled();
  });

  it('usa gemini-2.5-flash por padrão quando GEMINI_MODEL não está definida', async () => {
    generateContentMock.mockResolvedValue({ text: validPhrasesJson() });
    const res = makeRes();
    await handler({ method: 'POST', body: { theme: 'travel' } }, res);
    expect(res.statusCode).toBe(200);
    expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-2.5-flash' }));
  });

  it('marca source "videoTranscript" quando um trecho de transcrição real é fornecido', async () => {
    generateContentMock.mockResolvedValue({ text: validPhrasesJson() });
    const res = makeRes();
    await handler({ method: 'POST', body: { videoTitle: 'Daily routines', transcriptExcerpt: 'Real transcript content here.' } }, res);
    expect((res.body as { source: string }).source).toBe('videoTranscript');
  });

  it('marca source "videoMetadata" quando só há descrição do vídeo (sem transcript)', async () => {
    generateContentMock.mockResolvedValue({ text: validPhrasesJson() });
    const res = makeRes();
    await handler({ method: 'POST', body: { videoTitle: 'Daily routines', videoDescription: 'A video about daily routines in the US.' } }, res);
    expect((res.body as { source: string }).source).toBe('videoMetadata');
  });

  it('marca source "aiGenerated" quando não há transcript nem descrição — só tema/título', async () => {
    generateContentMock.mockResolvedValue({ text: validPhrasesJson() });
    const res = makeRes();
    await handler({ method: 'POST', body: { theme: 'ordering food' } }, res);
    expect((res.body as { source: string }).source).toBe('aiGenerated');
  });

  it('não quebra quando o Gemini responde texto fora do JSON — trata como erro amigável (502)', async () => {
    generateContentMock.mockResolvedValue({ text: 'Aqui estão as frases: 1) ... (sem JSON)' });
    const res = makeRes();
    await handler({ method: 'POST', body: { theme: 'travel' } }, res);
    expect(res.statusCode).toBe(502);
    expect((res.body as { success: boolean }).success).toBe(false);
  });

  it('retorna 502 amigável quando o JSON não bate com o schema esperado', async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ foo: 'bar' }) });
    const res = makeRes();
    await handler({ method: 'POST', body: { theme: 'travel' } }, res);
    expect(res.statusCode).toBe(502);
  });

  it('retorna 502 amigável sem propagar exceção quando a chamada ao Gemini falha', async () => {
    generateContentMock.mockRejectedValue(new Error('Gemini indisponível'));
    const res = makeRes();
    await expect(handler({ method: 'POST', body: { theme: 'travel' } }, res)).resolves.not.toThrow();
    expect(res.statusCode).toBe(502);
  });
});
