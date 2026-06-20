import { useState, useRef } from 'react';
import { Settings, User, Moon, Sun, Download, Upload, RotateCcw, Trash2, CheckCircle } from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Input, Select } from '../components/FormFields';

export function ConfiguracoesPage() {
  const { data, setData, exportData, importData, resetToDemo, clearAll, tema, toggleTema } = useApp();
  const [nome, setNome] = useState(data.configuracoes.nomeUsuario);
  const [visualizacao, setVisualizacao] = useState(data.configuracoes.visualizacaoPadrao);
  const [salvo, setSalvo] = useState(false);
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
      alert(ok ? '✅ Dados importados com sucesso!' : '❌ Arquivo inválido. Certifique-se de usar um backup do ADAPTA.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearAll = () => {
    if (!confirm('⚠️ Isso vai apagar TODOS os seus dados. Tem certeza? Esta ação não pode ser desfeita.')) return;
    if (!confirm('Confirme novamente: apagar tudo?')) return;
    clearAll();
  };

  const handleResetDemo = () => {
    if (!confirm('Restaurar os dados de demonstração? Seus dados atuais serão substituídos.')) return;
    resetToDemo();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">Configurações</h2>
        <p className="text-sm text-surface-500 dark:text-surface-400">Personalize o app para a sua rotina</p>
      </div>

      {/* Perfil */}
      <Card>
        <CardHeader title="Perfil" icon={<User size={18} />} />
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
            <Button onClick={salvarConfiguracoes} icon={salvo ? <CheckCircle size={16} /> : undefined} variant={salvo ? 'success' : 'primary'}>
              {salvo ? 'Salvo!' : 'Salvar configurações'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Aparência */}
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

      {/* Dados */}
      <Card>
        <CardHeader title="Seus Dados" subtitle="Exportar, importar e restaurar" icon={<Download size={18} />} />
        <CardBody>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-700/30 rounded-xl">
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Exportar dados</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Baixe um backup completo em JSON</p>
              </div>
              <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportData}>
                Exportar
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-700/30 rounded-xl">
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Importar dados</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Restaure a partir de um arquivo JSON</p>
              </div>
              <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" id="import-input" />
              <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => importRef.current?.click()}>
                Importar
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-800/30 rounded-xl">
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Restaurar demonstração</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Volta os dados de exemplo do ADAPTA</p>
              </div>
              <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />} onClick={handleResetDemo}>
                Restaurar
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Zona de perigo */}
      <Card className="border-danger-200 dark:border-danger-800/40">
        <CardHeader title="Zona de Risco" subtitle="Ações irreversíveis" icon={<Trash2 size={18} />} />
        <CardBody>
          <div className="flex items-center justify-between p-3 bg-danger-50 dark:bg-danger-900/10 rounded-xl">
            <div>
              <p className="text-sm font-medium text-danger-700 dark:text-danger-400">Apagar todos os dados</p>
              <p className="text-xs text-danger-500 dark:text-danger-600">Isso não pode ser desfeito. Faça backup antes.</p>
            </div>
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={handleClearAll}>
              Apagar tudo
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Info do app */}
      <div className="text-center py-4 text-xs text-surface-400 dark:text-surface-500 space-y-1">
        <p className="font-semibold text-surface-500 dark:text-surface-400">Central Pessoal ADAPTA</p>
        <p>Versão 1.0.0 MVP · Dados salvos localmente no navegador</p>
        <p>Desenvolvido sob medida para suas metas e sua rotina</p>
      </div>
    </div>
  );
}
