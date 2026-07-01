import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { AppProvider } from './hooks/useApp';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './layouts/Layout';
import { prepararMicrosoftCalendar } from './services/microsoftCalendar';

// Cada página carrega sob demanda (code splitting por rota) — evita empacotar
// tudo (recharts, xlsx, o módulo inteiro de Inglês Diário etc.) num único
// bundle que o navegador precisa baixar/parsear antes da 1ª tela aparecer.
// O fallback do Suspense só aparece na 1ª visita a cada rota nesta sessão —
// depois disso o chunk já está em cache e a navegação não suspende de novo.
const InicioPage = lazy(() => import('./pages/Inicio').then(m => ({ default: m.InicioPage })));
const MetasPage = lazy(() => import('./pages/Metas').then(m => ({ default: m.MetasPage })));
const PlanoAcaoPage = lazy(() => import('./pages/PlanoAcao').then(m => ({ default: m.PlanoAcaoPage })));
const AgendaTempoPage = lazy(() => import('./pages/AgendaTempo').then(m => ({ default: m.AgendaTempoPage })));
const OrcamentoPage = lazy(() => import('./pages/Orcamento').then(m => ({ default: m.OrcamentoPage })));
const LeituraDiariaPage = lazy(() => import('./pages/LeituraDiaria').then(m => ({ default: m.LeituraDiariaPage })));
const InglesPage = lazy(() => import('./pages/Ingles').then(m => ({ default: m.InglesPage })));
const ConfiguracoesPage = lazy(() => import('./pages/Configuracoes').then(m => ({ default: m.ConfiguracoesPage })));
const UsuariosPage = lazy(() => import('./pages/Usuarios').then(m => ({ default: m.UsuariosPage })));
const RedefinirSenhaPage = lazy(() => import('./pages/RedefinirSenha').then(m => ({ default: m.RedefinirSenhaPage })));

function PageLoadingFallback() {
  return (
    <div className="flex h-full min-h-[50vh] w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
    </div>
  );
}

function App() {
  useEffect(() => {
    void prepararMicrosoftCalendar().catch(() => {
      // A página de Agenda mostra mensagens acionáveis quando o usuário sincroniza.
    });
  }, []);

  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              {/* Rota pública — redefinição de senha via link do e-mail */}
              <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />

              {/* Rotas protegidas */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <Layout>
                    <Suspense fallback={<PageLoadingFallback />}>
                      <Routes>
                        <Route path="/" element={<InicioPage />} />
                        <Route path="/metas" element={<MetasPage />} />
                        <Route path="/plano" element={<PlanoAcaoPage />} />
                        <Route path="/plano-acao" element={<PlanoAcaoPage />} />
                        <Route path="/agenda" element={<AgendaTempoPage />} />
                        <Route path="/orcamento" element={<OrcamentoPage />} />
                        <Route path="/leitura" element={<LeituraDiariaPage />} />
                        <Route path="/estudo/leitura" element={<LeituraDiariaPage />} />
                        <Route path="/estudo/ingles" element={<InglesPage />} />
                        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                        <Route path="/usuarios" element={<UsuariosPage />} />
                      </Routes>
                    </Suspense>
                  </Layout>
                </ProtectedRoute>
              } />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
