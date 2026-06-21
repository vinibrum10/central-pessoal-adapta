import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoginPage } from '../pages/Login';
import { isSupabaseConfigured, modoLocalAtivo } from '../lib/supabase';

// ── Tela: Supabase não configurado em produção ──────────────────
function NaoConfiguradoScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl p-8 text-center space-y-5 border border-slate-700">
        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/30">
          <span className="text-3xl">⚙️</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Banco de dados não configurado</h2>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            O <strong className="text-white">Sistema de Gestão Pessoal</strong> requer Supabase configurado para funcionar em produção.
          </p>
        </div>
        <div className="bg-slate-700/50 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs font-semibold text-slate-300">Configure as variáveis de ambiente na Vercel:</p>
          <code className="block text-xs text-amber-400 leading-relaxed">
            VITE_SUPABASE_URL=https://xxx.supabase.co<br />
            VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
          </code>
        </div>
        <p className="text-xs text-slate-500">
          Crie um projeto gratuito em{' '}
          <span className="text-blue-400 font-medium">app.supabase.com</span>{' '}
          e cole as credenciais acima nas configurações da Vercel.
        </p>
      </div>
    </div>
  );
}

// ── Tela: bloqueado ─────────────────────────────────────────────
function BlockedScreen() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-surface-800 rounded-2xl shadow-xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-danger-100 dark:bg-danger-900/30 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl">🚫</span>
        </div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">Acesso bloqueado</h2>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          Acesso bloqueado. Entre em contato com o administrador.
        </p>
        <button
          onClick={() => signOut()}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          Sair
        </button>
      </div>
    </div>
  );
}

// ── Spinner ─────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── ProtectedRoute principal ────────────────────────────────────
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, statusConta } = useAuth();

  // Em produção sem Supabase → bloqueia tudo
  if (!isSupabaseConfigured && !modoLocalAtivo) {
    return <NaoConfiguradoScreen />;
  }

  // Modo local (apenas dev) → passa direto
  if (modoLocalAtivo) return <>{children}</>;

  // Supabase configurado → fluxo normal de auth
  if (loading) return <LoadingSpinner />;
  if (!user) return <LoginPage />;
  if (statusConta === 'bloqueado') return <BlockedScreen />;

  return <>{children}</>;
}
