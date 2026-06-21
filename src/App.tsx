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
import { ConfiguracoesPage } from './pages/Configuracoes';

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<InicioPage />} />
                <Route path="/metas" element={<MetasPage />} />
                <Route path="/plano" element={<PlanoAcaoPage />} />
                <Route path="/agenda" element={<AgendaTempoPage />} />
                <Route path="/orcamento" element={<OrcamentoPage />} />
                <Route path="/leitura" element={<LeituraDiariaPage />} />
                <Route path="/configuracoes" element={<ConfiguracoesPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
