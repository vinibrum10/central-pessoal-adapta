import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoginPage } from '../pages/Login';
import { isSupabaseConfigured, modoLocalAtivo } from '../lib/supabase';
import { AppBackground } from './layout/AppBackground';

// ── Tela: Supabase não configurado em produção ──────────────────
function NaoConfiguradoScreen() {
  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center p-4 bg-[#050404]">
      <AppBackground standalone />
      <div className="relative z-10 max-w-md w-full rounded-2xl shadow-2xl p-8 text-center space-y-5 border border-[rgba(217,158,94,0.18)] bg-[rgba(12,10,8,0.80)] backdrop-blur-xl">
        <div className="w-16 h-16 bg-[rgba(201,130,58,0.12)] rounded-full flex items-center justify-center mx-auto border border-[rgba(201,130,58,0.35)]">
          <span className="text-3xl">⚙️</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Banco de dados não configurado</h2>
          <p className="text-sm text-[#a6a69d] mt-2 leading-relaxed">
            O <strong className="text-white">Sistema de Gestão Pessoal</strong> requer Supabase configurado para funcionar em produção.
          </p>
        </div>
        <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-4 text-left space-y-2 border border-[rgba(217,158,94,0.12)]">
          <p className="text-xs font-semibold text-[rgba(217,158,94,0.90)]">Configure as variáveis de ambiente na Vercel:</p>
          <code className="block text-xs text-[#c98040] leading-relaxed">
            VITE_SUPABASE_URL=https://xxx.supabase.co<br />
            VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
          </code>
        </div>
        <p className="text-xs text-[#6b6b65]">
          Crie um projeto gratuito em{' '}
          <span className="text-[#60a5fa] font-medium">app.supabase.com</span>{' '}
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
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center p-4 bg-[#050404]">
      <AppBackground standalone />
      <div className="relative z-10 max-w-md w-full rounded-2xl shadow-xl p-8 text-center space-y-4 border border-[rgba(217,158,94,0.18)] bg-[rgba(12,10,8,0.80)] backdrop-blur-xl">
        <div className="w-16 h-16 bg-[rgba(220,60,60,0.12)] rounded-full flex items-center justify-center mx-auto border border-[rgba(220,60,60,0.30)]">
          <span className="text-3xl">🚫</span>
        </div>
        <h2 className="text-xl font-bold text-white">Acesso bloqueado</h2>
        <p className="text-sm text-[#a6a69d]">
          Acesso bloqueado. Entre em contato com o administrador.
        </p>
        <button
          onClick={() => signOut()}
          className="text-sm text-[#c98040] hover:text-[#e8aa60] transition-colors hover:underline"
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
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-[#050404]">
      <AppBackground standalone />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-[rgba(217,158,94,0.20)] border-t-[rgba(201,130,58,0.90)] animate-spin" />
        <p className="text-sm text-[rgba(217,158,94,0.60)] tracking-widest uppercase">Carregando…</p>
      </div>
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
