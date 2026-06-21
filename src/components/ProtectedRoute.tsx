import type { ReactNode } from 'react';
import { Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LoginPage } from '../pages/Login';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, supabaseAtivo } = useAuth();

  // Supabase não configurado → modo local, sem login obrigatório
  if (!supabaseAtivo) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center animate-pulse">
            <Zap size={22} className="text-white" />
          </div>
          <p className="text-sm text-surface-400 dark:text-surface-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return <>{children}</>;
}
