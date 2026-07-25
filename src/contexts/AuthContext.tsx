import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, modoLocalAtivo } from '../lib/supabase';
import type { RoleUsuario, StatusUsuario, TipoAcesso, PerfilUsuario } from '../types';
import type { UserPermission } from '../utils/permissions';
import {
  carregarPerfil,
  createAuthStateChangeHandler,
  ensureProfileExists,
  fetchPermissoes,
  loadInitialAuthState,
  updateUltimoAcesso,
} from './authSessionLoader';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  perfil: PerfilUsuario | null;
  loading: boolean;
  supabaseAtivo: boolean;
  role: RoleUsuario;
  statusConta: StatusUsuario;
  tipoAcesso: TipoAcesso;
  permissoes: UserPermission[];
  ultimoAcesso: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  recarregarPerfil: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  recuperarSenha: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [permissoes, setPermissoes] = useState<UserPermission[]>([]);
  const [ultimoAcesso, setUltimoAcesso] = useState<string | null>(null);

  const carregarPermissoes = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase
      .from('user_permissions')
      .select('modulo, acao, permitido')
      .eq('user_id', userId);
    setPermissoes((data ?? []) as UserPermission[]);
  }, []);

  const recarregarPerfil = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    const p = await carregarPerfil(user.id);
    setPerfil(p);
    await carregarPermissoes(user.id);
  }, [user, carregarPermissoes]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // loadInitialAuthState nunca rejeita (qualquer falha de rede/DB vira "deslogado"),
    // então este .then() sempre roda e o spinner de carregamento nunca fica preso —
    // era isso que travava o app na primeira abertura no celular.
    loadInitialAuthState().then(state => {
      setSession(state.session);
      setUser(state.user);
      setPerfil(state.perfil);
      setPermissoes(state.permissoes);
      setLoading(false);
    });

    // O listener NUNCA é async e nunca faz `await` diretamente — ver o
    // comentário completo em createAuthStateChangeHandler (authSessionLoader.ts)
    // sobre por que um callback async aqui pode travar o cliente Supabase
    // inteiro (inclusive chamadas getSession() feitas em outros lugares do
    // app, como a do Inglês Diário).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      createAuthStateChangeHandler(
        { fetchPerfil: carregarPerfil, fetchPermissoes, ensureProfileExists, updateUltimoAcesso },
        {
          onSessionChange: (newSession, u) => {
            setSession(newSession);
            setUser(u);
          },
          onSecondaryDataLoaded: ({ perfil, permissoes, ultimoAcesso }) => {
            setPerfil(perfil);
            setPermissoes(permissoes);
            setUltimoAcesso(ultimoAcesso);
          },
        },
      ),
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: null };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    if (!isSupabaseConfigured) return { error: null };

    // Verificar se já existe algum usuário — se não, será admin
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    const isFirstUser = (count ?? 0) === 0;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } },
    });
    if (error) return { error: error.message };

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        nome,
        email,
        role: isFirstUser ? 'admin' : 'usuario',
        status: 'ativo',
        tipo_acesso: isFirstUser ? 'total' : 'visualizacao',
        updated_at: new Date().toISOString(),
      });
    }
    return { error: null };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setPerfil(null);
  };

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) return { error: 'Supabase não configurado.' };
    const redirectTo = new URL('/', window.location.origin).toString();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: GOOGLE_OAUTH_SCOPES,
        queryParams: {
          access_type: 'offline',
          include_granted_scopes: 'true',
        },
      },
    });
    return { error: error?.message ?? null };
  };

  const recuperarSenha = async (email: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) return { error: 'Supabase não configurado.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    return { error: error?.message ?? null };
  };

  // Role, status e tipoAcesso derivados do perfil (fallback admin em modo local dev)
  const role: RoleUsuario = (isSupabaseConfigured && user) ? (perfil?.role ?? 'usuario') : (modoLocalAtivo ? 'admin' : 'usuario');
  const statusConta: StatusUsuario = (isSupabaseConfigured && user) ? (perfil?.status ?? 'ativo') : (modoLocalAtivo ? 'ativo' : 'ativo');
  const tipoAcesso: TipoAcesso = (isSupabaseConfigured && user) ? (perfil?.tipoAcesso ?? 'visualizacao') : (modoLocalAtivo ? 'total' : 'visualizacao');

  return (
    <AuthContext.Provider value={{
      user, session, perfil, loading,
      supabaseAtivo: isSupabaseConfigured && !modoLocalAtivo,
      role,
      statusConta,
      tipoAcesso,
      permissoes,
      ultimoAcesso,
      signIn, signUp, signOut,
      recarregarPerfil,
      signInWithGoogle, recuperarSenha,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
