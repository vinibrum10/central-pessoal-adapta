import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './hooks/useApp';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './layouts/Layout';
import { InicioPage } from './pages/Inicio';
import { MetasPage } from './pages/Metas';
import { PlanoAcaoPage } from './pages/PlanoAcao';
import { AgendaTempoPage } from './pages/AgendaTempo';
import { OrcamentoPage } from './pages/Orcamento';
import { LeituraDiariaPage } from './pages/LeituraDiaria';
import { InglesPage } from './pages/Ingles';
import { ConfiguracoesPage } from './pages/Configuracoes';
import { UsuariosPage } from './pages/Usuarios';
import { RedefinirSenhaPage } from './pages/RedefinirSenha';

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            {/* Rota pública — redefinição de senha via link do e-mail */}
            <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />

            {/* Rotas protegidas */}
            <Route path="/*" element={
              <ProtectedRoute>
                <Layout>
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
