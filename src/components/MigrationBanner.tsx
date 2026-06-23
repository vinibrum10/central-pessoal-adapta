import { UploadCloud, Download, X } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../hooks/useApp';

export function MigrationBanner() {
  const { syncStatus, migrateLocalToSupabase, dismissMigrationPrompt, exportData } = useApp();
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState(false);

  if (syncStatus !== 'needs-migration') return null;

  async function handleMigrate() {
    setMigrating(true);
    setError(false);
    const ok = await migrateLocalToSupabase();
    if (!ok) setError(true);
    setMigrating(false);
  }

  return (
    <div className="mx-4 lg:mx-6 mt-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <UploadCloud size={20} className="text-blue-500 flex-shrink-0 mt-0.5 sm:mt-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
          Dados locais detectados
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
          Você tem dados salvos neste dispositivo que ainda não estão na nuvem. Migre para acessá-los em qualquer dispositivo.
        </p>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            Falha ao migrar. Verifique sua conexão e tente novamente.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={exportData}
          title="Exportar backup local"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          <Download size={14} />
          Backup
        </button>
        <button
          onClick={handleMigrate}
          disabled={migrating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          <UploadCloud size={14} />
          {migrating ? 'Migrando…' : 'Migrar para nuvem'}
        </button>
        <button
          onClick={dismissMigrationPrompt}
          title="Ignorar por enquanto"
          className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
