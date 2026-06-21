import { useState, useRef } from 'react';
import {
  Settings, User, Moon, Sun, Download, Upload, RotateCcw, Trash2,
  CheckCircle, Database, Calendar, FolderOpen, Smartphone, LogOut, RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Input, Select } from '../components/FormFields';
import { isSupabaseConfigured } from '../lib/supabase';
import { isGoogleConfigured } from '../services/googleCalendar';
import { isDriveConfigurado } from '../services/googleDrive';
import { possuiDadosLocais, migracaoConcluida, migrarDadosParaSupabase } from '../services/dataMigration';
import { exportarDadosExcel } from '../utils/exportExcel';

export function ConfiguracoesPage() {
  const { data, setData, exportData, importData, resetToDemo, clearAll, tema, toggleTema } = useApp();
  const { user, signOut, supabaseAtivo } = useAuth();
  const [nome, setNome] = useState(data.configuracoes.nomeUsuario);
  const [visualizacao, setVisualizacao] = useState(data.configuracoes.visualizacaoPadrao);
  const [salvo, setSalvo] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState(
    import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID as string ?? ''
  );
  const [migrando, setMigrando] = useState(false);
  const [logMigracao, setLogMigracao] = useState<string[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  const salvarConfiguracoes = () => {
    setData(d => ({
      ...d,
      configuracoes: { ...d.configuracoes, nomeUsuario: nome, visualizacaoPadrao: visualizacao },
    }));
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const ok = importData(text);
      alert(ok ? '✅ Dados importados com sucesso!' : '❌ Arquivo inválido.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleMigrar = async () => {
    if (!user) return;
    setMigrando(true);
    setLogMigracao([]);
    await migrarDadosParaSupabase(data, user.id, (msg) => {
      setLogMigracao(prev => [...prev, msg]);
    });
    setMigrando(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">Configurações</h2>
        <p className="text-sm text-surface-500 dark:text-surface-400">Personalize o app para a sua rotina</p>
      </div>

      {/* ── Conta ── */}
      <Card>
        <CardHeader title="Conta" icon={<User size={18} />} />
        <CardBody>
          <div className="space-y-4">
            <Input
              id="config-nome"
              label="Seu nome"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Como você quer ser chamado?"
            />
            <Select
              id="config-vis"
              label="Visualização padrão de tarefas"
              value={visualizacao}
              onChange={e => setVisualizacao(e.target.value as 'hoje' | 'semana' | 'mes')}
            >
              <option value="hoje">Hoje</option>
              <option value="semana">Semana</option>
              <option value="mes">Mês</option>
            </Select>
            <div className="flex gap-3">
              <Button onClick={salvarConfiguracoes} icon={salvo ? <CheckCircle size={16} /> : undefined} variant={salvo ? 'success' : 'primary'}>
                {salvo ? 'Salvo!' : 'Salvar configurações'}
              </Button>
              {supabaseAtivo && user && (
                <Button variant="ghost" icon={<LogOut size={15} />} onClick={signOut}>
                  Sair
                </Button>
              )}
            </div>
            {supabaseAtivo && user && (
              <p className="text-xs text-surface-400 dark:text-surface-500">
                Logado como <strong>{user.email}</strong>
              </p>
            )}
            {!supabaseAtivo && (
              <p className="text-xs text-surface-400 dark:text-surface-500">
                Modo local (sem Supabase). Configure <code>VITE_SUPABASE_URL</code> para habilitar sincronização.
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* ── Banco de dados ── */}
      <Card>
        <CardHeader title="Banco de Dados" subtitle="Sincronização com Supabase" icon={<Database size={18} />} />
        <CardBody>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isSupabaseConfigured ? 'bg-success-500' : 'bg-surface-400'}`} />
              <span className="text-sm text-surface-700 dark:text-surface-300">
                {isSupabaseConfigured ? 'Supabase conectado' : 'Supabase não configurado'}
              </span>
            </div>

            {isSupabaseConfigured && user && possuiDadosLocais() && !migracaoConcluida() && (
              <div className="space-y-2 p-3 bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800 rounded-xl">
                <p className="text-sm font-medium text-primary-700 dark:text-primary-300">
                  Dados locais encontrados
                </p>
                <p className="text-xs text-primary-600 dark:text-primary-400">
                  Deseja enviar seus dados locais para o banco de dados online?
                </p>
                <Button size="sm" icon={<RefreshCw size={14} />} loading={migrando} onClick={handleMigrar}>
                  Migrar para Supabase
                </Button>
                {logMigracao.map((msg, i) => (
                  <p key={i} className="text-xs text-surface-500 dark:text-surface-400">{msg}</p>
                ))}
              </div>
            )}

            {!isSupabaseConfigured && (
              <p className="text-xs text-surface-400 dark:text-surface-500">
                Para habilitar o banco de dados, crie um projeto em{' '}
                <strong>app.supabase.com</strong> e configure as variáveis de ambiente conforme o <code>.env.example</code>.
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* ── Calendário ── */}
      <Card>
        <CardHeader title="Calendário" subtitle="Integração com agendas externas" icon={<Calendar size={18} />} />
        <CardBody>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-700/30 rounded-xl">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isGoogleConfigured() ? 'bg-success-500' : 'bg-surface-400'}`} />
                <div>
                  <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Google Calendar</p>
                  <p className="text-xs text-surface-400 dark:text-surface-500">
                    {isGoogleConfigured() ? 'Configurado — conecte em Agenda e Tempo' : 'Configure VITE_GOOGLE_CLIENT_ID'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-surface-50 dark:bg-surface-700/30 rounded-xl opacity-60">
              <div className="w-2.5 h-2.5 rounded-full bg-surface-300" />
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Microsoft Outlook</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Em breve</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── Google Drive ── */}
      <Card>
        <CardHeader title="Google Drive" subtitle="Pasta de Leitura Diária" icon={<FolderOpen size={18} />} />
        <CardBody>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isDriveConfigurado() ? 'bg-success-500' : 'bg-surface-400'}`} />
              <span className="text-sm text-surface-700 dark:text-surface-300">
                {isDriveConfigurado() ? 'Pasta configurada' : 'Pasta não configurada'}
              </span>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-surface-600 dark:text-surface-400">
                Folder ID da pasta do Drive
              </label>
              <input
                type="text"
                value={driveFolderId}
                onChange={e => setDriveFolderId(e.target.value)}
                placeholder="1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-surface-400 dark:text-surface-500">
                Cole o ID da pasta do Google Drive. Encontre-o na URL: <code>drive.google.com/drive/folders/ID_AQUI</code>
              </p>
            </div>
            <p className="text-xs text-surface-400 dark:text-surface-500">
              Defina <code>VITE_GOOGLE_DRIVE_FOLDER_ID</code> no <code>.env</code> para aplicar permanentemente.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* ── PWA ── */}
      <Card>
        <CardHeader title="Instalar no Celular" subtitle="Acesso rápido como app" icon={<Smartphone size={18} />} />
        <CardBody>
          <div className="space-y-3 text-sm text-surface-600 dark:text-surface-400">
            <p className="font-medium text-surface-800 dark:text-surface-200">Como instalar o ADAPTA no seu celular:</p>
            <div className="space-y-2">
              <div className="flex gap-2">
                <span className="font-bold text-primary-600 dark:text-primary-400 w-5">1.</span>
                <span>Acesse o app pelo navegador do celular (Chrome no Android ou Safari no iPhone).</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary-600 dark:text-primary-400 w-5">2.</span>
                <span><strong>Android (Chrome):</strong> Toque nos três pontos → "Adicionar à tela inicial".</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary-600 dark:text-primary-400 w-5">3.</span>
                <span><strong>iPhone (Safari):</strong> Toque no ícone de compartilhar → "Adicionar à Tela de Início".</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary-600 dark:text-primary-400 w-5">4.</span>
                <span>O app abrirá em modo tela cheia, sem barra de navegador.</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── Aparência ── */}
      <Card>
        <CardHeader title="Aparência" icon={<Settings size={18} />} />
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-900 dark:text-white">Tema do aplicativo</p>
              <p className="text-xs text-surface-400 dark:text-surface-500">Atualmente: {tema === 'escuro' ? 'Modo escuro' : 'Modo claro'}</p>
            </div>
            <Button
              variant="secondary"
              icon={tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
              onClick={toggleTema}
            >
              {tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* ── Dados ── */}
      <Card>
        <CardHeader title="Seus Dados" subtitle="Exportar, importar e restaurar" icon={<Download size={18} />} />
        <CardBody>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-700/30 rounded-xl">
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Exportar Excel</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Baixe todas as abas em formato .xlsx</p>
              </div>
              <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={14} />} onClick={() => exportarDadosExcel(data)}>Exportar Excel</Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-700/30 rounded-xl">
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Exportar backup JSON</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Backup técnico completo em JSON</p>
              </div>
              <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportData}>Exportar JSON</Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-700/30 rounded-xl">
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Importar dados</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Restaure a partir de um arquivo JSON</p>
              </div>
              <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
              <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => importRef.current?.click()}>Importar</Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-800/30 rounded-xl">
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Restaurar demonstração</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Volta os dados de exemplo do sistema</p>
              </div>
              <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />} onClick={() => { if (confirm('Restaurar os dados de demonstração? Seus dados atuais serão substituídos.')) resetToDemo(); }}>Restaurar</Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── Zona de risco ── */}
      <Card className="border-danger-200 dark:border-danger-800/40">
        <CardHeader title="Zona de Risco" subtitle="Ações irreversíveis" icon={<Trash2 size={18} />} />
        <CardBody>
          <div className="flex items-center justify-between p-3 bg-danger-50 dark:bg-danger-900/10 rounded-xl">
            <div>
              <p className="text-sm font-medium text-danger-700 dark:text-danger-400">Apagar todos os dados</p>
              <p className="text-xs text-danger-500 dark:text-danger-600">Isso não pode ser desfeito. Faça backup antes.</p>
            </div>
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => {
              if (!confirm('⚠️ Apagar TODOS os dados? Esta ação não pode ser desfeita.')) return;
              if (!confirm('Confirme novamente: apagar tudo?')) return;
              clearAll();
            }}>Apagar tudo</Button>
          </div>
        </CardBody>
      </Card>

      <div className="text-center py-4 text-xs text-surface-400 dark:text-surface-500 space-y-1">
        <p className="font-semibold text-surface-500 dark:text-surface-400">Sistema de Gestão Pessoal</p>
        <p>Versão 2.1.0 · {isSupabaseConfigured ? 'Modo online (Supabase)' : 'Modo local (LocalStorage)'}</p>
        <p>Organizado, focado e no controle.</p>
      </div>
    </div>
  );
}
