import { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';

const googleAtivo = import.meta.env.VITE_GOOGLE_ENABLED === 'true';
const microsoftAtivo = import.meta.env.VITE_MICROSOFT_ENABLED === 'true';

function AppLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="16,4 24,8.5 24,17.5 16,22 8,17.5 8,8.5" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5"/>
      <path d="M18 10L14 16H17L14 22" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
      <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
    </svg>
  );
}

type Modo = 'login' | 'cadastro' | 'recuperar';

export function LoginPage() {
  const { signIn, signUp, signInWithGoogle, signInWithMicrosoft, recuperarSenha } = useAuth();
  const [modo, setModo] = useState<Modo>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [carregandoGoogle, setCarregandoGoogle] = useState(false);
  const [carregandoMicrosoft, setCarregandoMicrosoft] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const trocarModo = (m: Modo) => { setModo(m); setErro(''); setSucesso(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (modo === 'recuperar') {
      if (!email) { setErro('Informe seu e-mail.'); return; }
      setCarregando(true);
      const { error } = await recuperarSenha(email);
      if (error) setErro(error);
      else setSucesso('E-mail enviado! Verifique sua caixa de entrada e clique no link para redefinir sua senha.');
      setCarregando(false);
      return;
    }

    if (!email || !senha) { setErro('Preencha e-mail e senha.'); return; }
    if (modo === 'cadastro' && !nome) { setErro('Informe seu nome.'); return; }

    setCarregando(true);
    if (modo === 'login') {
      const { error } = await signIn(email, senha);
      if (error) setErro(error);
    } else {
      const { error } = await signUp(email, senha, nome);
      if (error) setErro(error);
      else setSucesso('Conta criada! Aguarde a aprovação do administrador para acessar o sistema.');
    }
    setCarregando(false);
  };

  const handleGoogle = async () => {
    setErro('');
    if (!googleAtivo) {
      setErro('Login com Google não está disponível. Use e-mail e senha.');
      return;
    }
    setCarregandoGoogle(true);
    const { error } = await signInWithGoogle();
    if (error) setErro(error);
    setCarregandoGoogle(false);
  };

  const handleMicrosoft = async () => {
    setErro('');
    if (!microsoftAtivo) {
      setErro('Login com Microsoft não está disponível. Use e-mail e senha.');
      return;
    }
    setCarregandoMicrosoft(true);
    const { error } = await signInWithMicrosoft();
    if (error) setErro(error);
    setCarregandoMicrosoft(false);
  };

  const titulo = modo === 'login' ? 'Entrar na sua conta' : modo === 'cadastro' ? 'Criar conta' : 'Recuperar senha';

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
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white text-center">{titulo}</h2>

          {/* Botões sociais — apenas login e cadastro */}
          {modo !== 'recuperar' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={carregandoGoogle}
                  title={!googleAtivo ? 'Login com Google não configurado' : ''}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                    googleAtivo
                      ? 'border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700'
                      : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-400 dark:text-surface-600 cursor-not-allowed'
                  }`}
                >
                  <GoogleIcon />
                  <span className="text-xs">{carregandoGoogle ? '...' : 'Google'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleMicrosoft}
                  disabled={carregandoMicrosoft}
                  title={!microsoftAtivo ? 'Login com Microsoft não configurado' : ''}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                    microsoftAtivo
                      ? 'border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700'
                      : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-400 dark:text-surface-600 cursor-not-allowed'
                  }`}
                >
                  <MicrosoftIcon />
                  <span className="text-xs">{carregandoMicrosoft ? '...' : 'Microsoft'}</span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
                <span className="text-xs text-surface-400 dark:text-surface-500">ou continue com e-mail</span>
                <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Campo nome — só cadastro */}
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

            {/* Campo e-mail */}
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

            {/* Campo senha — login e cadastro */}
            {modo !== 'recuperar' && (
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
            )}

            {/* Link esqueceu senha — só no login */}
            {modo === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => trocarModo('recuperar')}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 ml-auto"
                >
                  <KeyRound size={11} />
                  Esqueceu sua senha?
                </button>
              </div>
            )}

            {/* Feedback */}
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
              {modo === 'login' ? 'Entrar' : modo === 'cadastro' ? 'Criar conta' : 'Enviar link de recuperação'}
            </Button>
          </form>

          {/* Aviso de acesso */}
          {modo !== 'recuperar' && (
            <div className="flex items-center gap-2 text-xs text-surface-400 dark:text-surface-500 bg-surface-50 dark:bg-surface-700/30 rounded-lg px-3 py-2">
              <ShieldCheck size={13} className="flex-shrink-0 text-primary-500" />
              <span>Acesso protegido. Novos usuários precisam de aprovação.</span>
            </div>
          )}

          {/* Troca de modo */}
          <p className="text-center text-xs text-surface-500 dark:text-surface-400">
            {modo === 'recuperar' ? (
              <>
                Lembrou a senha?{' '}
                <button onClick={() => trocarModo('login')} className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
                  Fazer login
                </button>
              </>
            ) : modo === 'login' ? (
              <>
                Ainda não tem conta?{' '}
                <button onClick={() => trocarModo('cadastro')} className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
                  Criar agora
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button onClick={() => trocarModo('login')} className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
                  Fazer login
                </button>
              </>
            )}
          </p>
        </div>

        <p className="text-center text-xs text-surface-400 dark:text-surface-500 mt-4">
          Sem conta Supabase? O app funciona localmente sem login.
        </p>
      </div>
    </div>
  );
}
