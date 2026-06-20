import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AppData } from '../types';
import { dadosDemonstracaoInicial } from '../data/dadosDemonstracao';

const STORAGE_KEY = 'adapta-central-pessoal-v1';

interface AppContextType {
  data: AppData;
  setData: (data: AppData | ((prev: AppData) => AppData)) => void;
  resetToDemo: () => void;
  clearAll: () => void;
  exportData: () => void;
  importData: (jsonString: string) => boolean;
  tema: 'claro' | 'escuro';
  toggleTema: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<AppData>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as AppData;
    } catch { /* ignore */ }
    return dadosDemonstracaoInicial;
  });

  const [tema, setTema] = useState<'claro' | 'escuro'>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const d = JSON.parse(stored) as AppData;
        if (d.configuracoes?.tema === 'claro') return 'claro';
      }
    } catch { /* ignore */ }
    return 'escuro';
  });

  useEffect(() => {
    if (tema === 'escuro') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [tema]);

  const setData = useCallback((value: AppData | ((prev: AppData) => AppData)) => {
    setDataState(prev => {
      const next = value instanceof Function ? value(prev) : value;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleTema = useCallback(() => {
    setTema(prev => {
      const next = prev === 'escuro' ? 'claro' : 'escuro';
      setData(d => ({ ...d, configuracoes: { ...d.configuracoes, tema: next } }));
      return next;
    });
  }, [setData]);

  const resetToDemo = useCallback(() => {
    setDataState(dadosDemonstracaoInicial);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dadosDemonstracaoInicial));
  }, []);

  const clearAll = useCallback(() => {
    const empty: AppData = {
      ...dadosDemonstracaoInicial,
      metas: [],
      tarefas: [],
      blocosTempo: [],
      receitas: [],
      despesas: [],
      cartoes: [],
      dividas: [],
      reservas: [],
      bens: [],
      diarioEvolucao: [],
      revisoesSemana: [],
    };
    setDataState(empty);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
  }, []);

  const exportData = useCallback(() => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adapta-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const importData = useCallback((jsonString: string): boolean => {
    try {
      const imported = JSON.parse(jsonString) as AppData;
      setDataState(imported);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      return true;
    } catch {
      return false;
    }
  }, []);

  return (
    <AppContext.Provider value={{ data, setData, resetToDemo, clearAll, exportData, importData, tema, toggleTema }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
