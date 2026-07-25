import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_TIMEOUT_MS,
  createAuthStateChangeHandler,
  resolveInitialAuthState,
  type AuthStateChangeDeps,
  type AuthStateDeps,
} from './authSessionLoader';
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

describe('createAuthStateChangeHandler', () => {
  function makeChangeDeps(overrides: Partial<AuthStateChangeDeps> = {}): AuthStateChangeDeps {
    return {
      fetchPerfil: vi.fn().mockResolvedValue(null),
      fetchPermissoes: vi.fn().mockResolvedValue([]),
      ensureProfileExists: vi.fn().mockResolvedValue(undefined),
      updateUltimoAcesso: vi.fn().mockResolvedValue('2026-07-25T00:00:00.000Z'),
      ...overrides,
    };
  }

  it('o listener retornado NUNCA é async — chamá-lo não produz uma Promise (é isso que evita o deadlock do GoTrueClient)', () => {
    const deps = makeChangeDeps();
    const handler = createAuthStateChangeHandler(deps, { onSessionChange: vi.fn(), onSecondaryDataLoaded: vi.fn() });

    const result: unknown = handler('SIGNED_IN', makeSession(makeUser()));

    expect(result).toBeUndefined();
    expect(result instanceof Promise).toBe(false);
  });

  it('onSessionChange é chamado de forma síncrona, antes do trabalho assíncrono ser sequer agendado', () => {
    const deps = makeChangeDeps();
    const callOrder: string[] = [];
    const onSessionChange = vi.fn(() => callOrder.push('onSessionChange'));
    const scheduleDeferred = vi.fn(() => callOrder.push('scheduleDeferred'));
    const handler = createAuthStateChangeHandler(deps, { onSessionChange, onSecondaryDataLoaded: vi.fn() }, scheduleDeferred);
    const user = makeUser();
    const session = makeSession(user);

    handler('SIGNED_IN', session);

    expect(onSessionChange).toHaveBeenCalledWith(session, user);
    expect(callOrder).toEqual(['onSessionChange', 'scheduleDeferred']);
  });

  it('nunca chama getSession/consultas do Supabase diretamente dentro do listener — só agenda via scheduleDeferred', () => {
    const deps = makeChangeDeps();
    const scheduleDeferred = vi.fn();
    const handler = createAuthStateChangeHandler(deps, { onSessionChange: vi.fn(), onSecondaryDataLoaded: vi.fn() }, scheduleDeferred);

    handler('SIGNED_IN', makeSession(makeUser()));

    expect(deps.fetchPerfil).not.toHaveBeenCalled();
    expect(scheduleDeferred).toHaveBeenCalledTimes(1);
  });

  it('o trabalho adiado carrega perfil, permissões e último acesso, e entrega tudo via onSecondaryDataLoaded', async () => {
    const user = makeUser();
    const perfil = makePerfil();
    const permissoes = [{ modulo: 'metas' as const, acao: 'visualizar' as const, permitido: true }];
    const deps = makeChangeDeps({
      fetchPerfil: vi.fn().mockResolvedValue(perfil),
      fetchPermissoes: vi.fn().mockResolvedValue(permissoes),
      updateUltimoAcesso: vi.fn().mockResolvedValue('2026-07-25T10:00:00.000Z'),
    });
    const onSecondaryDataLoaded = vi.fn();
    let deferredRun: (() => void) | null = null;
    const handler = createAuthStateChangeHandler(deps, { onSessionChange: vi.fn(), onSecondaryDataLoaded }, run => { deferredRun = run; });

    handler('SIGNED_IN', makeSession(user));
    expect(onSecondaryDataLoaded).not.toHaveBeenCalled();

    deferredRun!();
    await vi.waitFor(() => expect(onSecondaryDataLoaded).toHaveBeenCalledWith({
      perfil,
      permissoes,
      ultimoAcesso: '2026-07-25T10:00:00.000Z',
    }));
  });

  it('cria o perfil (fallback OAuth) quando fetchPerfil retorna null na primeira vez', async () => {
    const user = makeUser();
    const perfil = makePerfil();
    const fetchPerfil = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(perfil);
    const deps = makeChangeDeps({ fetchPerfil });
    const onSecondaryDataLoaded = vi.fn();
    let deferredRun: (() => void) | null = null;
    const handler = createAuthStateChangeHandler(deps, { onSessionChange: vi.fn(), onSecondaryDataLoaded }, run => { deferredRun = run; });

    handler('SIGNED_IN', makeSession(user));
    deferredRun!();

    await vi.waitFor(() => expect(deps.ensureProfileExists).toHaveBeenCalledWith(user));
    await vi.waitFor(() => expect(onSecondaryDataLoaded).toHaveBeenCalledWith(expect.objectContaining({ perfil })));
  });

  it('evento INITIAL_SESSION: atualiza a sessão mas NÃO dispara a busca de dados secundários (evita consulta duplicada com loadInitialAuthState)', () => {
    const deps = makeChangeDeps();
    const onSessionChange = vi.fn();
    const scheduleDeferred = vi.fn();
    const handler = createAuthStateChangeHandler(deps, { onSessionChange, onSecondaryDataLoaded: vi.fn() }, scheduleDeferred);
    const user = makeUser();
    const session = makeSession(user);

    handler('INITIAL_SESSION', session);

    expect(onSessionChange).toHaveBeenCalledWith(session, user);
    expect(scheduleDeferred).not.toHaveBeenCalled();
  });

  it('sessão nula (logout): limpa os dados secundários de forma síncrona, sem agendar nada', () => {
    const deps = makeChangeDeps();
    const onSecondaryDataLoaded = vi.fn();
    const scheduleDeferred = vi.fn();
    const handler = createAuthStateChangeHandler(deps, { onSessionChange: vi.fn(), onSecondaryDataLoaded }, scheduleDeferred);

    handler('SIGNED_OUT', null);

    expect(onSecondaryDataLoaded).toHaveBeenCalledWith({ perfil: null, permissoes: [], ultimoAcesso: null });
    expect(scheduleDeferred).not.toHaveBeenCalled();
  });

  it('por padrão usa setTimeout(..., 0) real para adiar — sai do call stack síncrono do listener', async () => {
    const deps = makeChangeDeps({ fetchPerfil: vi.fn().mockResolvedValue(makePerfil()) });
    const onSecondaryDataLoaded = vi.fn();
    const handler = createAuthStateChangeHandler(deps, { onSessionChange: vi.fn(), onSecondaryDataLoaded });

    handler('SIGNED_IN', makeSession(makeUser()));
    expect(onSecondaryDataLoaded).not.toHaveBeenCalled(); // ainda não rodou — foi adiado de verdade

    await vi.waitFor(() => expect(onSecondaryDataLoaded).toHaveBeenCalled());
  });
});
