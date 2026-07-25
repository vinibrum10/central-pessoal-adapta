// CORS compartilhado por todas as Edge Functions "normais" (todas exceto
// youtube-oauth-callback, que nunca é chamada via fetch/CORS — é um
// redirecionamento de navegador vindo do Google).
//
// Não usamos "Access-Control-Allow-Origin: *": o frontend chama estas funções
// via supabase.functions.invoke(), que envia Authorization/apikey — headers de
// credencial. O CORS spec proíbe combinar `*` com credenciais, e mesmo onde o
// navegador tolerasse, seria um convite a qualquer site de terceiros chamar
// estas funções em nome de um usuário logado. Em vez disso, refletimos a
// origem só quando ela está numa lista de permissões explícita.
//
// `Deno` só existe de verdade no runtime das Edge Functions. Esta declaração
// é só para o type-checker deste arquivo (escopo local ao módulo, não vaza
// para outros arquivos) — em teste, um polyfill de `globalThis.Deno` supre o
// valor real (ver src/__tests__/supabase-functions/cors.test.ts).
declare const Deno: { env: { get(key: string): string | undefined } };

const STATIC_ALLOWED_ORIGINS = ['http://localhost:5173'];

function allowedOrigins(): string[] {
  const appUrl = Deno.env.get('APP_URL');
  return appUrl ? [...STATIC_ALLOWED_ORIGINS, appUrl] : STATIC_ALLOWED_ORIGINS;
}

function resolveAllowedOrigin(req: Request): string {
  const origin = req.headers.get('Origin');
  const allowList = allowedOrigins();
  if (origin && allowList.includes(origin)) return origin;
  // Sem Origin (ex.: chamada server-to-server) ou origem não reconhecida:
  // cai no APP_URL configurado (nunca em "*"), mantendo a resposta determinística.
  return allowList[allowList.length - 1];
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveAllowedOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Responde ao preflight (OPTIONS) com 204 + os headers de CORS. Retorna
 * `null` para qualquer outro método, para o handler seguir seu fluxo normal. */
export function handlePreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
}
