import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, modoLocalAtivo } from '../lib/supabase';
import type { RoleUsuario, StatusUsuario, TipoAcesso, PerfilUsuario } from '../types';
import type { UserPermission } from '../utils/permissions';

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

async function carregarPerfil(userId: string): Promise<PerfilUsuario | null> {
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

  const atualizarUltimoAcesso = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured) return;
    const agora = new Date().toISOString();
    await supabase
      .from('profiles')
      .update({ ultimo_acesso: agora, updated_at: agora })
      .eq('id', userId);
    setUltimoAcesso(agora);
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

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        let p = await carregarPerfil(u.id);
        if (!p && u.email) {
          // Profile não existe — criar como usuario ativo (fallback para OAuth)
          await supabase.from('profiles').upsert({
            id: u.id,
            email: u.email,
            nome: u.user_metadata?.name ?? u.user_metadata?.nome ?? u.email.split('@')[0],
            role: 'usuario',
            status: 'ativo',
            tipo_acesso: 'visualizacao',
            updated_at: new Date().toISOString(),
          });
          p = await carregarPerfil(u.id);
        }
        setPerfil(p);
        await carregarPermissoes(u.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      const u = newSession?.user ?? null;
      setUser(u);
      if (u) {
        let p = await carregarPerfil(u.id);
        if (!p && u.email) {
          // Profile não existe — criar como usuario ativo (fallback para OAuth)
          await supabase.from('profiles').upsert({
            id: u.id,
            email: u.email,
            nome: u.user_metadata?.name ?? u.user_metadata?.nome ?? u.email.split('@')[0],
            role: 'usuario',
            status: 'ativo',
            tipo_acesso: 'visualizacao',
            updated_at: new Date().toISOString(),
          });
          p = await carregarPerfil(u.id);
        }
        setPerfil(p);
        if (u) {
          await carregarPermissoes(u.id);
          await atualizarUltimoAcesso(u.id);
        }
      } else {
        setPerfil(null);
        setPermissoes([]);
        setUltimoAcesso(null);
      }
    });

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
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
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
