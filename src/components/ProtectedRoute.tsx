import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoginPage } from '../pages/Login';

function PendingScreen() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-surface-800 rounded-2xl shadow-xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl">⏳</span>
        </div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">Acesso aguardando aprovação</h2>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          Sua conta foi criada com sucesso. Um administrador precisa aprovar seu acesso antes de você poder usar o app.
        </p>
        <p className="text-xs text-surface-400 dark:text-surface-500">
          Entre em contato com o administrador para agilizar a aprovação.
        </p>
        <button
          onClick={() => signOut()}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          Usar outra conta
        </button>
      </div>
    </div>
  );
}

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
          Sua conta foi bloqueada pelo administrador. Entre em contato para mais informações.
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

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, supabaseAtivo, statusConta } = useAuth();

  if (!supabaseAtivo) return <>{children}</>;
  if (loading) return <LoadingSpinner />;
  if (!user) return <LoginPage />;
  if (statusConta === 'bloqueado') return <BlockedScreen />;
  if (statusConta === 'pendente') return <PendingScreen />;
  return <>{children}</>;
}
