import { useEffect, useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { AppBackground } from '../components/layout/AppBackground';

const googleAtivo = import.meta.env.VITE_GOOGLE_ENABLED === 'true';

function getOAuthErrorMessage(): string {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const error = params.get('error') ?? hash.get('error');
  const description = params.get('error_description') ?? hash.get('error_description') ?? '';
  if (!error && !description) return '';

  const raw = `${error ?? ''} ${description}`.toLowerCase();
  if (raw.includes('access_denied')) {
    return 'Acesso pelo Google não autorizado. O app ainda está em modo de testes no Google Cloud ou seu e-mail não foi adicionado como testador. Use e-mail e senha ou peça ao administrador para liberar seu acesso Google.';
  }
  return description || 'Não foi possível concluir o login com Google. Tente novamente ou use e-mail e senha.';
}

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

type Modo = 'login' | 'cadastro' | 'recuperar';

export function LoginPage() {
  const { signIn, signUp, signInWithGoogle, recuperarSenha } = useAuth();
  const [modo, setModo] = useState<Modo>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [carregandoGoogle, setCarregandoGoogle] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    const oauthError = getOAuthErrorMessage();
    if (!oauthError) return;
    setErro(oauthError);
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

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
      else setSucesso('Conta criada! Você já pode fazer login com acesso básico de visualização.');
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

  const titulo = modo === 'login' ? 'Entrar na sua conta' : modo === 'cadastro' ? 'Criar conta' : 'Recuperar senha';

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-[#050404] p-4">
      <AppBackground standalone />
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 bg-[rgba(201,130,58,0.18)] border border-[rgba(201,130,58,0.45)] rounded-2xl flex items-center justify-center shadow-lg shadow-[rgba(201,130,58,0.20)]">
            <AppLogo />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Sistema de Gestão Pessoal</h1>
            <p className="text-sm text-[#a6a69d]">Organizado, focado e no controle</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl shadow-2xl border border-[rgba(217,158,94,0.18)] bg-[rgba(10,8,6,0.82)] backdrop-blur-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white text-center">{titulo}</h2>

          {/* Botões sociais — apenas login e cadastro */}
          {modo !== 'recuperar' && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={carregandoGoogle}
                title={!googleAtivo ? 'Login com Google não configurado' : ''}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                  googleAtivo
                    ? 'border-[rgba(217,158,94,0.20)] bg-[rgba(255,255,255,0.05)] text-white hover:bg-[rgba(255,255,255,0.09)]'
                    : 'border-[rgba(217,158,94,0.10)] bg-[rgba(255,255,255,0.03)] text-[#6b6b65] cursor-not-allowed'
                }`}
              >
                <GoogleIcon />
                <span className="text-xs">{carregandoGoogle ? '...' : 'Entrar com Google'}</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[rgba(217,158,94,0.15)]" />
                <span className="text-xs text-[#6b6b65]">ou continue com e-mail</span>
                <div className="flex-1 h-px bg-[rgba(217,158,94,0.15)]" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Campo nome — só cadastro */}
            {modo === 'cadastro' && (
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a69d]" />
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm bg-[rgba(255,255,255,0.05)] border-[rgba(217,158,94,0.20)] text-white placeholder-[#6b6b65] focus:outline-none focus:ring-1 focus:ring-[rgba(201,130,58,0.60)] focus:border-[rgba(201,130,58,0.50)]"
                />
              </div>
            )}

            {/* Campo e-mail */}
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a69d]" />
              <input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm bg-[rgba(255,255,255,0.05)] border-[rgba(217,158,94,0.20)] text-white placeholder-[#6b6b65] focus:outline-none focus:ring-1 focus:ring-[rgba(201,130,58,0.60)] focus:border-[rgba(201,130,58,0.50)]"
              />
            </div>

            {/* Campo senha — login e cadastro */}
            {modo !== 'recuperar' && (
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a69d]" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Senha"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border text-sm bg-[rgba(255,255,255,0.05)] border-[rgba(217,158,94,0.20)] text-white placeholder-[#6b6b65] focus:outline-none focus:ring-1 focus:ring-[rgba(201,130,58,0.60)] focus:border-[rgba(201,130,58,0.50)]"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a6a69d] hover:text-[#e8aa60] transition-colors"
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
                  className="text-xs text-[#c98040] hover:text-[#e8aa60] transition-colors flex items-center gap-1 ml-auto"
                >
                  <KeyRound size={11} />
                  Esqueceu sua senha?
                </button>
              </div>
            )}

            {/* Feedback */}
            {erro && (
              <div className="flex items-start gap-2 text-xs text-red-400 bg-[rgba(220,60,60,0.10)] border border-[rgba(220,60,60,0.25)] rounded-lg px-3 py-2">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                {erro}
              </div>
            )}
            {sucesso && (
              <div className="text-xs text-emerald-400 bg-[rgba(52,211,153,0.10)] border border-[rgba(52,211,153,0.25)] rounded-lg px-3 py-2">
                {sucesso}
              </div>
            )}

            <Button type="submit" loading={carregando} className="w-full">
              {modo === 'login' ? 'Entrar' : modo === 'cadastro' ? 'Criar conta' : 'Enviar link de recuperação'}
            </Button>
          </form>

          {/* Aviso de acesso */}
          {modo === 'cadastro' && (
            <div className="flex items-center gap-2 text-xs text-[#a6a69d] bg-[rgba(255,255,255,0.04)] rounded-lg px-3 py-2 border border-[rgba(217,158,94,0.10)]">
              <span>Novos usuários entram com acesso básico de visualização.</span>
            </div>
          )}

          {/* Troca de modo */}
          <p className="text-center text-xs text-[#6b6b65]">
            {modo === 'recuperar' ? (
              <>
                Lembrou a senha?{' '}
                <button onClick={() => trocarModo('login')} className="text-[#c98040] hover:text-[#e8aa60] font-medium hover:underline transition-colors">
                  Fazer login
                </button>
              </>
            ) : modo === 'login' ? (
              <>
                Ainda não tem conta?{' '}
                <button onClick={() => trocarModo('cadastro')} className="text-[#c98040] hover:text-[#e8aa60] font-medium hover:underline transition-colors">
                  Criar agora
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button onClick={() => trocarModo('login')} className="text-[#c98040] hover:text-[#e8aa60] font-medium hover:underline transition-colors">
                  Fazer login
                </button>
              </>
            )}
          </p>
        </div>

        <p className="text-center text-xs text-[#6b6b65] mt-4">
          Sem conta Supabase? O app funciona localmente sem login.
        </p>
      </div>
    </div>
  );
}
