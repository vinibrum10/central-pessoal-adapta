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

/**
 * Tempo máximo tolerado para cada etapa do carregamento inicial. Existe porque
 * supabase.auth.getSession() pode FICAR PRESO PARA SEMPRE (nem resolve, nem rejeita) em
 * vez de falhar — é um problema conhecido do lock interno (Web Locks API) usado pra evitar
 * refresh de token concorrente, que pode não ser liberado direito num cold-start de PWA no
 * iOS. Um try/catch sozinho não pega isso, porque a promise nunca chega a rejeitar.
 */
export const AUTH_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} excedeu ${ms}ms sem responder`)), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      err => { clearTimeout(timer); reject(err); },
    );
  });
}

export interface AuthStateDeps {
  getSession: () => Promise<{ data: { session: Session | null } }>;
  fetchPerfil: (userId: string) => Promise<PerfilUsuario | null>;
  fetchPermissoes: (userId: string) => Promise<UserPermission[]>;
  ensureProfileExists: (user: User) => Promise<void>;
}

/**
 * Resolve o estado inicial de auth sem nunca travar nem rejeitar — qualquer falha (rede,
 * erro de leitura do perfil) OU trava (promise que nunca resolve nem rejeita) vira um estado
 * seguro em vez de deixar o caller pendurado. Isso é o que garante que a tela de loading do
 * app sempre libere no primeiro carregamento, mesmo num cold-start problemático.
 *
 * Uma falha/trava em getSession() é tratada como deslogado (não há sessão para preservar).
 * Já uma falha/trava ao carregar perfil/permissões DEPOIS de obter uma sessão válida não deve
 * derrubar essa sessão — senão um usuário autenticado seria jogado de volta pro login só
 * porque uma chamada secundária (perfil, permissões) falhou ou demorou demais.
 */
export async function resolveInitialAuthState(deps: AuthStateDeps): Promise<InitialAuthState> {
  let session: Session | null;
  let user: User | null;
  try {
    const { data } = await withTimeout(deps.getSession(), AUTH_TIMEOUT_MS, 'getSession()');
    session = data.session;
    user = session?.user ?? null;
  } catch (err) {
    console.error('[Auth] Falha ou timeout ao obter sessão inicial — seguindo como deslogado', err);
    return EMPTY_AUTH_STATE;
  }

  if (!user) return { session, user: null, perfil: null, permissoes: [] };

  try {
    // Um único orçamento de timeout pra etapa inteira (perfil + fallback de criação +
    // permissões) — timeout por chamada individual deixaria o pior caso somar até 4x
    // AUTH_TIMEOUT_MS (perfil + criar + reler perfil + permissões), o que recriaria a
    // sensação de app travado que este fix existe pra evitar.
    const { perfil, permissoes } = await withTimeout((async () => {
      let p = await deps.fetchPerfil(user.id);
      if (!p && user.email) {
        await deps.ensureProfileExists(user);
        p = await deps.fetchPerfil(user.id);
      }
      const perms = await deps.fetchPermissoes(user.id);
      return { perfil: p, permissoes: perms };
    })(), AUTH_TIMEOUT_MS, 'carregar perfil/permissões');

    return { session, user, perfil, permissoes };
  } catch (err) {
    console.error('[Auth] Falha ou timeout ao carregar perfil/permissões — sessão mantida sem perfil', err);
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
