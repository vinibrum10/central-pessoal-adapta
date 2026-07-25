// Validação do usuário Supabase autenticado a partir do header Authorization
// enviado pelo frontend. Reaproveitada por todas as Edge Functions "normais"
// (todas exceto youtube-oauth-callback, que é o único endpoint público —
// ver comentário naquele arquivo sobre por quê).
import { createClient } from 'jsr:@supabase/supabase-js@2';

export interface AuthenticatedUser {
  id: string;
}

export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return null;

  // Cliente com a chave anon + o JWT do usuário (nunca a service_role aqui) —
  // só serve para validar QUEM está chamando, nunca para consultar dados.
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

export function serviceRoleClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados nos Secrets da função.');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export function jsonResponse(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
