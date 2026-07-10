import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_TIMEOUT_MS, resolveInitialAuthState, type AuthStateDeps } from './authSessionLoader';
import type { Session, User } from '@supabase/supabase-js';
import type { PerfilUsuario } from '../types';
import type { UserPermission } from '../utils/permissions';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'vinicius@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as User;
}

function makeSession(user: User): Session {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  } as Session;
}

function makePerfil(overrides: Partial<PerfilUsuario> = {}): PerfilUsuario {
  return {
    id: 'user-1',
    email: 'vinicius@example.com',
    nome: 'Vinicius',
    role: 'usuario',
    status: 'ativo',
    tipoAcesso: 'total',
    ultimoAcesso: null,
    ultimoLoginProvider: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDeps(overrides: Partial<AuthStateDeps> = {}): AuthStateDeps {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    fetchPerfil: vi.fn().mockResolvedValue(null),
    fetchPermissoes: vi.fn().mockResolvedValue([]),
    ensureProfileExists: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('resolveInitialAuthState', () => {
  it('retorna estado deslogado quando não há sessão', async () => {
    const deps = makeDeps();

    const state = await resolveInitialAuthState(deps);

    expect(state).toEqual({ session: null, user: null, perfil: null, permissoes: [] });
  });

  it('carrega perfil e permissões quando há sessão ativa', async () => {
    const user = makeUser();
    const session = makeSession(user);
    const perfil = makePerfil();
    const permissoes = [{ modulo: 'metas' as const, acao: 'visualizar' as const, permitido: true }];
    const deps = makeDeps({
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      fetchPerfil: vi.fn().mockResolvedValue(perfil),
      fetchPermissoes: vi.fn().mockResolvedValue(permissoes),
    });

    const state = await resolveInitialAuthState(deps);

    expect(state).toEqual({ session, user, perfil, permissoes });
    expect(deps.ensureProfileExists).not.toHaveBeenCalled();
  });

  it('cria o perfil quando ele ainda não existe (fallback OAuth)', async () => {
    const user = makeUser();
    const session = makeSession(user);
    const perfil = makePerfil();
    const fetchPerfil = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(perfil);
    const deps = makeDeps({
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      fetchPerfil,
    });

    const state = await resolveInitialAuthState(deps);

    expect(deps.ensureProfileExists).toHaveBeenCalledWith(user);
    expect(fetchPerfil).toHaveBeenCalledTimes(2);
    expect(state.perfil).toEqual(perfil);
  });

  it('nunca rejeita quando getSession falha — resolve como deslogado (raiz do bug de loading infinito)', async () => {
    const deps = makeDeps({
      getSession: vi.fn().mockRejectedValue(new Error('network unreachable')),
    });

    await expect(resolveInitialAuthState(deps)).resolves.toEqual({
      session: null,
      user: null,
      perfil: null,
      permissoes: [],
    });
  });

  it('nunca rejeita quando o carregamento do perfil falha — mas preserva a sessão válida (não desloga um usuário autenticado)', async () => {
    const user = makeUser();
    const session = makeSession(user);
    const deps = makeDeps({
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      fetchPerfil: vi.fn().mockRejectedValue(new Error('db timeout')),
    });

    await expect(resolveInitialAuthState(deps)).resolves.toEqual({
      session,
      user,
      perfil: null,
      permissoes: [],
    });
  });

  it('nunca rejeita quando o carregamento de permissões falha — mas preserva a sessão válida', async () => {
    const user = makeUser();
    const session = makeSession(user);
    const perfil = makePerfil();
    const deps = makeDeps({
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      fetchPerfil: vi.fn().mockResolvedValue(perfil),
      fetchPermissoes: vi.fn().mockRejectedValue(new Error('db timeout')),
    });

    await expect(resolveInitialAuthState(deps)).resolves.toEqual({
      session,
      user,
      perfil: null,
      permissoes: [],
    });
  });

  it('nunca rejeita quando a criação de fallback do perfil falha — mas preserva a sessão válida', async () => {
    const user = makeUser();
    const session = makeSession(user);
    const deps = makeDeps({
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      fetchPerfil: vi.fn().mockResolvedValue(null),
      ensureProfileExists: vi.fn().mockRejectedValue(new Error('db timeout')),
    });

    await expect(resolveInitialAuthState(deps)).resolves.toEqual({
      session,
      user,
      perfil: null,
      permissoes: [],
    });
  });

  describe('quando uma dependência nunca resolve (trava um lock/rede, comum no cold-start iOS)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('não trava para sempre quando getSession() nunca resolve — resolve como deslogado após o timeout', async () => {
      const deps = makeDeps({
        getSession: vi.fn(() => new Promise<{ data: { session: Session | null } }>(() => {})), // nunca resolve nem rejeita
      });

      const promise = resolveInitialAuthState(deps);
      await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS + 100);

      await expect(promise).resolves.toEqual({ session: null, user: null, perfil: null, permissoes: [] });
    });

    it('não trava para sempre quando fetchPerfil nunca resolve — preserva a sessão válida após o timeout', async () => {
      const user = makeUser();
      const session = makeSession(user);
      const deps = makeDeps({
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        fetchPerfil: vi.fn(() => new Promise<PerfilUsuario | null>(() => {})), // nunca resolve nem rejeita
      });

      const promise = resolveInitialAuthState(deps);
      await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS + 100);

      await expect(promise).resolves.toEqual({ session, user, perfil: null, permissoes: [] });
    });

    it('não trava para sempre quando fetchPermissoes nunca resolve — preserva a sessão válida após o timeout', async () => {
      const user = makeUser();
      const session = makeSession(user);
      const perfil = makePerfil();
      const deps = makeDeps({
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        fetchPerfil: vi.fn().mockResolvedValue(perfil),
        fetchPermissoes: vi.fn(() => new Promise<UserPermission[]>(() => {})), // nunca resolve nem rejeita
      });

      const promise = resolveInitialAuthState(deps);
      await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS + 100);

      await expect(promise).resolves.toEqual({ session, user, perfil: null, permissoes: [] });
    });

    it('não trava para sempre quando ensureProfileExists (fallback de criação de perfil) nunca resolve — preserva a sessão válida após o timeout', async () => {
      // Nota: isto prova que uma trava em ensureProfileExists é pega pelo timeout da etapa 2
      // e não derruba a sessão. NÃO prova, por si só, que a etapa 2 usa um orçamento único em
      // vez de um timeout por sub-chamada — as duas versões resolveriam aqui em ~1x
      // AUTH_TIMEOUT_MS, já que só uma das chamadas está travando. Essa garantia (orçamento
      // único = no máximo 2x AUTH_TIMEOUT_MS no total, nunca 4x) está assegurada pela
      // estrutura do código: um único withTimeout(...) envolve toda a IIFE da etapa 2.
      const user = makeUser();
      const session = makeSession(user);
      const deps = makeDeps({
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        fetchPerfil: vi.fn().mockResolvedValue(null), // força o fallback de criação de perfil
        ensureProfileExists: vi.fn(() => new Promise<void>(() => {})), // nunca resolve nem rejeita
      });

      const promise = resolveInitialAuthState(deps);
      await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS + 100);

      await expect(promise).resolves.toEqual({ session, user, perfil: null, permissoes: [] });
    });
  });
});
