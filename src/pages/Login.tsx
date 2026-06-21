import { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';

function AppLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="16,4 24,8.5 24,17.5 16,22 8,17.5 8,8.5" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5"/>
      <path d="M18 10L14 16H17L14 22" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [modo, setModo] = useState<'login' | 'cadastro'>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    if (!email || !senha) { setErro('Preencha e-mail e senha.'); return; }
    if (modo === 'cadastro' && !nome) { setErro('Informe seu nome.'); return; }

    setCarregando(true);
    if (modo === 'login') {
      const { error } = await signIn(email, senha);
      if (error) setErro(error);
    } else {
      const { error } = await signUp(email, senha, nome);
      if (error) setErro(error);
      else setSucesso('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
    }
    setCarregando(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-900 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-600/30">
            <AppLogo />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-surface-900 dark:text-white">Sistema de Gestão Pessoal</h1>
            <p className="text-sm text-surface-400 dark:text-surface-500">Organizado, focado e no controle</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl border border-surface-200 dark:border-surface-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white text-center">
            {modo === 'login' ? 'Entrar na sua conta' : 'Criar conta'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            {modo === 'cadastro' && (
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Senha"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                className="w-full pl-9 pr-10 py-2.5 rounded-lg border text-sm bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-600 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
              >
                {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {erro && (
              <div className="flex items-start gap-2 text-xs text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg px-3 py-2">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                {erro}
              </div>
            )}

            {sucesso && (
              <div className="text-xs text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg px-3 py-2">
                {sucesso}
              </div>
            )}

            <Button type="submit" loading={carregando} className="w-full">
              {modo === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <p className="text-center text-xs text-surface-500 dark:text-surface-400">
            {modo === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
            <button
              onClick={() => { setModo(modo === 'login' ? 'cadastro' : 'login'); setErro(''); setSucesso(''); }}
              className="text-primary-600 dark:text-primary-400 font-medium hover:underline"
            >
              {modo === 'login' ? 'Criar agora' : 'Fazer login'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-surface-400 dark:text-surface-500 mt-4">
          Sem conta Supabase? O app funciona localmente sem login.
        </p>
      </div>
    </div>
  );
}
