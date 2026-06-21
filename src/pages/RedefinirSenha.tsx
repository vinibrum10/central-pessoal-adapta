import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';

function AppLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="16,4 24,8.5 24,17.5 16,22 8,17.5 8,8.5" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5"/>
      <path d="M18 10L14 16H17L14 22" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function RedefinirSenhaPage() {
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [tokenValido, setTokenValido] = useState(false);

  useEffect(() => {
    // Supabase injeta a sessão via hash na URL após clicar no link do e-mail
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setTokenValido(true);
    });

    // Escutar o evento PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setTokenValido(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRedefinir = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!senha || senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return; }

    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setErro('Erro ao redefinir senha. O link pode ter expirado. Solicite um novo.');
    } else {
      setSucesso(true);
      setTimeout(() => { window.location.href = '/'; }, 3000);
    }
    setCarregando(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-900 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-600/30">
            <AppLogo />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-surface-900 dark:text-white">Sistema de Gestão Pessoal</h1>
            <p className="text-sm text-surface-400 dark:text-surface-500">Redefinição de senha</p>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl border border-surface-200 dark:border-surface-700 p-6 space-y-4">
          {sucesso ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-14 h-14 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-success-600 dark:text-success-400" />
              </div>
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white">Senha redefinida!</h2>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Sua senha foi alterada com sucesso. Redirecionando para o login...
              </p>
            </div>
          ) : !tokenValido ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={28} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white">Link inválido ou expirado</h2>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Solicite um novo link de redefinição de senha na tela de login.
              </p>
              <a href="/" className="text-sm text-primary-600 dark:text-primary-400 hover:underline block">
                Voltar ao login
              </a>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white text-center">
                Criar nova senha
              </h2>

              <form onSubmit={handleRedefinir} className="space-y-3">
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder="Nova senha (mín. 6 caracteres)"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-lg border text-sm bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                  >
                    {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder="Confirmar nova senha"
                    value={confirmar}
                    onChange={e => setConfirmar(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {erro && (
                  <div className="flex items-start gap-2 text-xs text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg px-3 py-2">
                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                    {erro}
                  </div>
                )}

                <Button type="submit" loading={carregando} className="w-full">
                  Redefinir senha
                </Button>
              </form>

              <p className="text-center text-xs text-surface-500 dark:text-surface-400">
                <a href="/" className="text-primary-600 dark:text-primary-400 hover:underline">
                  Cancelar e voltar ao login
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
