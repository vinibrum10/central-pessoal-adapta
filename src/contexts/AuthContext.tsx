import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RoleUsuario, StatusUsuario, PerfilUsuario } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  perfil: PerfilUsuario | null;
  loading: boolean;
  supabaseAtivo: boolean;
  role: RoleUsuario;
  statusConta: StatusUsuario;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  recarregarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function carregarPerfil(userId: string): Promise<PerfilUsuario | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, email, nome, role, status, created_at, updated_at')
    .eq('id', userId)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email ?? '',
    nome: data.nome ?? '',
    role: (data.role ?? 'visualizador') as RoleUsuario,
    status: (data.status ?? 'pendente') as StatusUsuario,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const recarregarPerfil = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    const p = await carregarPerfil(user.id);
    setPerfil(p);
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) setPerfil(await carregarPerfil(u.id));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      const u = newSession?.user ?? null;
      setUser(u);
      if (u) setPerfil(await carregarPerfil(u.id));
      else setPerfil(null);
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
        role: isFirstUser ? 'admin' : 'visualizador',
        status: isFirstUser ? 'aprovado' : 'pendente',
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

  // Role e status derivados do perfil (fallback editor em modo local)
  const role: RoleUsuario = isSupabaseConfigured ? (perfil?.role ?? 'visualizador') : 'admin';
  const statusConta: StatusUsuario = isSupabaseConfigured ? (perfil?.status ?? 'pendente') : 'aprovado';

  return (
    <AuthContext.Provider value={{
      user, session, perfil, loading,
      supabaseAtivo: isSupabaseConfigured,
      role,
      statusConta,
      signIn, signUp, signOut,
      recarregarPerfil,
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
