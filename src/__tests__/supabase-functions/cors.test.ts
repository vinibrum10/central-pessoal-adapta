import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildCorsHeaders, handlePreflight } from '../../../supabase/functions/_shared/cors';

// _shared/cors.ts roda em Deno nas Edge Functions e lê Deno.env.get('APP_URL').
// Aqui, fora do Deno, fornecemos um polyfill mínimo só do que o módulo usa,
// para poder testar a lógica pura sem subir o runtime do Deno.
declare global {
  // eslint-disable-next-line no-var
  var Deno: { env: { get: (key: string) => string | undefined } } | undefined;
}

function setAppUrlEnv(value: string | undefined) {
  globalThis.Deno = { env: { get: (key: string) => (key === 'APP_URL' ? value : undefined) } };
}

describe('cors', () => {
  beforeEach(() => setAppUrlEnv('https://app.exemplo.com'));
  afterEach(() => { globalThis.Deno = undefined; });

  it('responde ao preflight OPTIONS com 204 (nunca 405)', () => {
    const req = new Request('https://fn.supabase.co/youtube-oauth-start', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
    });
    const resp = handlePreflight(req);
    expect(resp).not.toBeNull();
    expect(resp?.status).toBe(204);
  });

  it('retorna null (não intercepta) para métodos que não são OPTIONS', () => {
    const req = new Request('https://fn.supabase.co/youtube-oauth-status', { method: 'GET' });
    expect(handlePreflight(req)).toBeNull();
  });

  it('reflete a origem quando é http://localhost:5173 (permitida explicitamente)', () => {
    const req = new Request('https://fn.supabase.co/x', { method: 'GET', headers: { Origin: 'http://localhost:5173' } });
    const headers = buildCorsHeaders(req);
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });

  it('reflete a origem quando bate com APP_URL', () => {
    const req = new Request('https://fn.supabase.co/x', { method: 'GET', headers: { Origin: 'https://app.exemplo.com' } });
    const headers = buildCorsHeaders(req);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.exemplo.com');
  });

  it('nunca reflete uma origem arbitrária/não confiável — cai no APP_URL configurado', () => {
    const req = new Request('https://fn.supabase.co/x', { method: 'GET', headers: { Origin: 'https://site-malicioso.example' } });
    const headers = buildCorsHeaders(req);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.exemplo.com');
    expect(headers['Access-Control-Allow-Origin']).not.toBe('https://site-malicioso.example');
  });

  it('nunca usa "*" como Access-Control-Allow-Origin (incompatível com credenciais)', () => {
    const req = new Request('https://fn.supabase.co/x', { method: 'GET' });
    const headers = buildCorsHeaders(req);
    expect(headers['Access-Control-Allow-Origin']).not.toBe('*');
  });

  it('inclui authorization, apikey, x-client-info e content-type em Allow-Headers', () => {
    const req = new Request('https://fn.supabase.co/x', { method: 'OPTIONS' });
    const headers = buildCorsHeaders(req);
    const allowHeaders = headers['Access-Control-Allow-Headers'].toLowerCase();
    for (const required of ['authorization', 'apikey', 'x-client-info', 'content-type']) {
      expect(allowHeaders).toContain(required);
    }
  });

  it('inclui Vary: Origin (resposta varia por origem, não deve ser cacheada de forma cruzada)', () => {
    const req = new Request('https://fn.supabase.co/x', { method: 'GET' });
    expect(buildCorsHeaders(req).Vary).toBe('Origin');
  });
});
