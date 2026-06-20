import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './hooks/useApp';
import { Layout } from './layouts/Layout';
import { InicioPage } from './pages/Inicio';
import { MetasPage } from './pages/Metas';
import { PlanoAcaoPage } from './pages/PlanoAcao';
import { AgendaTempoPage } from './pages/AgendaTempo';
import { OrcamentoPage } from './pages/Orcamento';
import { DiarioPage } from './pages/Diario';
import { ConfiguracoesPage } from './pages/Configuracoes';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<InicioPage />} />
            <Route path="/metas" element={<MetasPage />} />
            <Route path="/plano" element={<PlanoAcaoPage />} />
            <Route path="/agenda" element={<AgendaTempoPage />} />
            <Route path="/orcamento" element={<OrcamentoPage />} />
            <Route path="/diario" element={<DiarioPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
