// Verificações estruturais (leitura de texto-fonte) da arquitetura OAuth
// server-side — mesmo padrão já usado em src/App.test.ts e
// src/layouts/Layout.test.ts para validar propriedades que não dependem de
// renderizar um componente. Aqui, como as Edge Functions rodam em Deno (não
// dá para executá-las dentro do Vitest/Node), estas asserções cobrem
// invariantes de segurança que PODEM ser checadas estaticamente: nenhum
// token no frontend, e todo acesso a dados do usuário nas Edge Functions
// vindo do JWT verificado, nunca de um parâmetro que o cliente poderia forjar.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
}

describe('frontend nunca manuseia token do YouTube', () => {
  const frontendSource = readSource('src/services/english/youtubeServerConnection.ts');

  it('não usa localStorage/sessionStorage/document.cookie/IndexedDB em nenhum ponto', () => {
    expect(frontendSource).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/i);
  });

  it('nunca declara/atribui um valor de access_token ou refresh_token (comentários explicando a ausência são esperados e ok)', () => {
    const codeOnly = frontendSource
      .split('\n')
      .filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    expect(codeOnly).not.toMatch(/\b(const|let|var)\s+(accessToken|refreshToken|access_token|refresh_token)\b/);
    expect(codeOnly).not.toMatch(/(accessToken|refreshToken|access_token|refresh_token)\s*:/);
  });
});

describe('Edge Functions "normais" exigem usuário autenticado e nunca confiam em user_id vindo do cliente', () => {
  const protectedFunctions = ['youtube-oauth-start', 'youtube-oauth-status', 'youtube-playlist', 'youtube-oauth-disconnect'];

  it.each(protectedFunctions)('%s chama getAuthenticatedUser antes de qualquer acesso a dados', name => {
    const source = readSource(`supabase/functions/${name}/index.ts`);
    expect(source).toMatch(/getAuthenticatedUser\(req\)/);
    expect(source).toMatch(/if \(!user\)/);
  });

  it.each(protectedFunctions)('%s nunca lê um user_id/userId vindo de query string ou body para identificar de quem são os dados', name => {
    const source = readSource(`supabase/functions/${name}/index.ts`);
    // Não deve existir nenhuma leitura de "userId"/"user_id" a partir de
    // searchParams ou de um corpo de requisição desserializado — o único
    // user.id usado deve vir do retorno de getAuthenticatedUser().
    expect(source).not.toMatch(/searchParams\.get\(['"](user_id|userId)['"]\)/);
    expect(source).not.toMatch(/body\.(user_id|userId)/);
  });

  it('o callback público (youtube-oauth-callback) nunca confia em um user_id da query string — só no state validado', () => {
    const source = readSource('supabase/functions/youtube-oauth-callback/index.ts');
    expect(source).not.toMatch(/searchParams\.get\(['"](user_id|userId)['"]\)/);
    expect(source).toMatch(/validateStateRecord/);
    // O user_id efetivamente usado vem da linha retornada pelo UPDATE atômico
    // (markUsedRows[0].user_id), não de uma leitura solta anterior.
    expect(source).toMatch(/markUsedRows\[0\]\.user_id/);
  });

  it('o consumo do state é uma única operação atômica: o UPDATE exige used_at nulo E expires_at no futuro na mesma cláusula WHERE', () => {
    const source = readSource('supabase/functions/youtube-oauth-callback/index.ts');
    const updateBlockMatch = source.match(/\.from\('youtube_oauth_states'\)\s*\.update\([\s\S]*?\.select\('user_id'\)/);
    expect(updateBlockMatch).not.toBeNull();
    const updateBlock = updateBlockMatch?.[0] ?? '';
    expect(updateBlock).toMatch(/\.is\('used_at', null\)/);
    expect(updateBlock).toMatch(/\.gt\('expires_at', nowIso\)/);
  });
});

describe('o refresh_token nunca é gravado em texto puro', () => {
  it('youtube-oauth-callback sempre cifra antes de gravar em youtube_oauth_connections', () => {
    const source = readSource('supabase/functions/youtube-oauth-callback/index.ts');
    expect(source).toMatch(/encryptRefreshToken/);
    // A tabela só recebe os campos cifrados — nunca "refresh_token:" bruto.
    expect(source).not.toMatch(/refresh_token:\s*tokenResult\.refreshToken/);
  });
});

describe('migration bloqueia acesso direto do frontend às tabelas sensíveis', () => {
  const migrationSource = readSource('supabase/migrations/20260725_youtube_oauth_serverside.sql');

  it('revoga todo privilégio de public, anon e authenticated nas duas tabelas', () => {
    expect(migrationSource).toMatch(/revoke all on public\.youtube_oauth_connections from public, anon, authenticated/i);
    expect(migrationSource).toMatch(/revoke all on public\.youtube_oauth_states from public, anon, authenticated/i);
  });

  it('concede ao service_role somente select/insert/update/delete (nunca ALL) nas duas tabelas', () => {
    expect(migrationSource).toMatch(/grant select, insert, update, delete\s+on public\.youtube_oauth_connections\s+to service_role/i);
    expect(migrationSource).toMatch(/grant select, insert, update, delete\s+on public\.youtube_oauth_states\s+to service_role/i);
    expect(migrationSource).not.toMatch(/grant all/i);
  });

  it('não cria nenhuma policy RLS para anon/authenticated nessas tabelas (só service_role, que ignora RLS, deve acessar)', () => {
    expect(migrationSource).not.toMatch(/create policy[\s\S]*?youtube_oauth_connections/i);
    expect(migrationSource).not.toMatch(/create policy[\s\S]*?youtube_oauth_states/i);
  });

  it('habilita RLS em ambas as tabelas (defesa em profundidade, mesmo sem policies)', () => {
    expect(migrationSource).toMatch(/alter table public\.youtube_oauth_connections enable row level security/i);
    expect(migrationSource).toMatch(/alter table public\.youtube_oauth_states enable row level security/i);
  });
});
