import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { PerfilUsuario, RoleUsuario, StatusUsuario, TipoAcesso } from '../types';
import type { UserPermission } from '../utils/permissions';

export interface InitialAuthState {
  session: Session | null;
  user: User | null;
  perfil: PerfilUsuario | null;
  permissoes: UserPermission[];
}

const EMPTY_AUTH_STATE: InitialAuthState = { session: null, user: null, perfil: null, permissoes: [] };

export interface AuthStateDeps {
  getSession: () => Promise<{ data: { session: Session | null } }>;
  fetchPerfil: (userId: string) => Promise<PerfilUsuario | null>;
  fetchPermissoes: (userId: string) => Promise<UserPermission[]>;
  ensureProfileExists: (user: User) => Promise<void>;
}

/**
 * Resolve o estado inicial de auth sem nunca rejeitar — qualquer falha (rede, timeout,
 * erro de leitura do perfil) vira um estado seguro em vez de deixar o caller pendurado.
 * Isso é o que garante que a tela de loading do app sempre libere no primeiro carregamento.
 *
 * Uma falha em getSession() é tratada como deslogado (não há sessão para preservar).
 * Já uma falha ao carregar perfil/permissões DEPOIS de obter uma sessão válida não deve
 * derrubar essa sessão — senão um usuário autenticado seria jogado de volta pro login só
 * porque uma chamada secundária (perfil, permissões) falhou de forma passageira.
 */
export async function resolveInitialAuthState(deps: AuthStateDeps): Promise<InitialAuthState> {
  let session: Session | null;
  let user: User | null;
  try {
    const { data } = await deps.getSession();
    session = data.session;
    user = session?.user ?? null;
  } catch (err) {
    console.error('[Auth] Falha ao obter sessão inicial — seguindo como deslogado', err);
    return EMPTY_AUTH_STATE;
  }

  if (!user) return { session, user: null, perfil: null, permissoes: [] };

  try {
    let perfil = await deps.fetchPerfil(user.id);
    if (!perfil && user.email) {
      await deps.ensureProfileExists(user);
      perfil = await deps.fetchPerfil(user.id);
    }
    const permissoes = await deps.fetchPermissoes(user.id);

    return { session, user, perfil, permissoes };
  } catch (err) {
    console.error('[Auth] Falha ao carregar perfil/permissões — sessão mantida sem perfil', err);
    return { session, user, perfil: null, permissoes: [] };
  }
}

export async function carregarPerfil(userId: string): Promise<PerfilUsuario | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, email, nome, role, status, tipo_acesso, ultimo_acesso, ultimo_login_provider, created_at, updated_at')
    .eq('id', userId)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email ?? '',
    nome: data.nome ?? '',
    role: (data.role ?? 'usuario') as RoleUsuario,
    status: (data.status ?? 'ativo') as StatusUsuario,
    tipoAcesso: (data.tipo_acesso ?? 'visualizacao') as TipoAcesso,
    ultimoAcesso: data.ultimo_acesso ?? null,
    ultimoLoginProvider: data.ultimo_login_provider ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

async function fetchPermissoes(userId: string): Promise<UserPermission[]> {
  const { data } = await supabase
    .from('user_permissions')
    .select('modulo, acao, permitido')
    .eq('user_id', userId);
  return (data ?? []) as UserPermission[];
}

export async function ensureProfileExists(user: User): Promise<void> {
  await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email,
    nome: user.user_metadata?.name ?? user.user_metadata?.nome ?? user.email?.split('@')[0],
    role: 'usuario',
    status: 'ativo',
    tipo_acesso: 'visualizacao',
    updated_at: new Date().toISOString(),
  });
}

export function loadInitialAuthState(): Promise<InitialAuthState> {
  return resolveInitialAuthState({
    getSession: () => supabase.auth.getSession(),
    fetchPerfil: carregarPerfil,
    fetchPermissoes,
    ensureProfileExists,
  });
}
