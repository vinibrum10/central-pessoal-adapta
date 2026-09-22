import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { AppProvider } from './hooks/useApp';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './layouts/Layout';
import { prepararMicrosoftCalendar } from './services/microsoftCalendar';

// Páginas carregadas SOB DEMANDA (code-splitting).
// Cada import() dinâmico vira um arquivo separado no build; a página só é
// baixada quando a rota é acessada. Isso reduz o tamanho do carregamento
// inicial (antes tudo vinha num bundle único de ~2 MB).
// Como as páginas usam export NOMEADO, mapeamos para `default`, que é o que
// React.lazy espera.
const InicioPage = lazy(() => import('./pages/Inicio').then((m) => ({ default: m.InicioPage })));
const MetasPage = lazy(() => import('./pages/Metas').then((m) => ({ default: m.MetasPage })));
const PlanoAcaoPage = lazy(() => import('./pages/PlanoAcao').then((m) => ({ default: m.PlanoAcaoPage })));
const AgendaTempoPage = lazy(() => import('./pages/AgendaTempo').then((m) => ({ default: m.AgendaTempoPage })));
const OrcamentoPage = lazy(() => import('./pages/Orcamento').then((m) => ({ default: m.OrcamentoPage })));
const LeituraDiariaPage = lazy(() => import('./pages/LeituraDiaria').then((m) => ({ default: m.LeituraDiariaPage })));
const VagasPage = lazy(() => import('./pages/Vagas').then((m) => ({ default: m.VagasPage })));
const InglesPage = lazy(() => import('./pages/Ingles').then((m) => ({ default: m.InglesPage })));
const InglesDiarioPage = lazy(() => import('./pages/InglesDiario').then((m) => ({ default: m.InglesDiarioPage })));
const ConfiguracoesPage = lazy(() => import('./pages/Configuracoes').then((m) => ({ default: m.ConfiguracoesPage })));
const UsuariosPage = lazy(() => import('./pages/Usuarios').then((m) => ({ default: m.UsuariosPage })));
const RedefinirSenhaPage = lazy(() => import('./pages/RedefinirSenha').then((m) => ({ default: m.RedefinirSenhaPage })));

/** Indicador leve exibido enquanto o arquivo da página está sendo baixado. */
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20 text-gray-500">
      <span className="animate-pulse">Carregando…</span>
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
          <Routes>
            {/* Rota pública — redefinição de senha via link do e-mail */}
            <Route path="/redefinir-senha" element={
              <Suspense fallback={<PageLoader />}><RedefinirSenhaPage /></Suspense>
            } />

            {/* Rotas protegidas */}
            <Route path="/*" element={
              <ProtectedRoute>
                <Layout>
                  {/* Suspense DENTRO do Layout: durante a navegação, só a área de
                      conteúdo mostra "Carregando…", o menu/estrutura continua na tela. */}
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<InicioPage />} />
                      <Route path="/metas" element={<MetasPage />} />
                      <Route path="/plano" element={<PlanoAcaoPage />} />
                      <Route path="/plano-acao" element={<PlanoAcaoPage />} />
                      <Route path="/agenda" element={<AgendaTempoPage />} />
                      <Route path="/orcamento" element={<OrcamentoPage />} />
                      <Route path="/vagas" element={<VagasPage />} />
                      <Route path="/leitura" element={<LeituraDiariaPage />} />
                      <Route path="/estudo/leitura" element={<LeituraDiariaPage />} />
                      <Route path="/estudo/ingles" element={<InglesPage />} />
                      <Route path="/estudo/ingles-diario" element={<InglesDiarioPage />} />
                      <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                      <Route path="/usuarios" element={<UsuariosPage />} />
                    </Routes>
                  </Suspense>
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
