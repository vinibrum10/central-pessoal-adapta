import { useState, useCallback, useEffect } from 'react';
import { icsParaEventosAgenda } from '../utils/calendarAvailability';
import type { EventoAgenda } from '../types';

export interface ConfiguracaoCalendario {
  // Uniasselvi ICS
  uniasselviIcsUrl: string;
  uniasselviIcsAtivo: boolean;
  uniasselviUltimaSinc: string | null;
  // Bloqueio fixo de trabalho
  bloqueioTrabalhoAtivo: boolean;
  // Horários de trabalho configuráveis
  trabalhoSegQuiIni: string;   // ex: "06:30"
  trabalhoSegQuiFim: string;   // ex: "18:50"
  trabalhoSextaIni: string;    // ex: "06:30"
  trabalhoSextaFim: string;    // ex: "17:00"
  // Feriados customizados (YYYY-MM-DD)
  feriadosCustom: string[];
}

const CONFIG_KEY = 'adapta_calendario_config';
const SINC_INTERVALO_MIN = 30;

const CONFIG_PADRAO: ConfiguracaoCalendario = {
  uniasselviIcsUrl: '',
  uniasselviIcsAtivo: false,
  uniasselviUltimaSinc: null,
  bloqueioTrabalhoAtivo: true,
  trabalhoSegQuiIni: '06:30',
  trabalhoSegQuiFim: '18:50',
  trabalhoSextaIni: '06:30',
  trabalhoSextaFim: '17:00',
  feriadosCustom: [],
};

function carregarConfig(): ConfiguracaoCalendario {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...CONFIG_PADRAO, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...CONFIG_PADRAO };
}

function salvarConfig(config: ConfiguracaoCalendario) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export interface UseCalendarioResult {
  config: ConfiguracaoCalendario;
  sincronizando: boolean;
  erroSinc: string | null;
  atualizarConfig: (parcial: Partial<ConfiguracaoCalendario>) => void;
  sincronizarUniasselvi: () => Promise<EventoAgenda[]>;
  adicionarFeriadoCustom: (data: string) => void;
  removerFeriadoCustom: (data: string) => void;
}

export function useCalendario(): UseCalendarioResult {
  const [config, setConfigState] = useState<ConfiguracaoCalendario>(carregarConfig);
  const [sincronizando, setSincronizando] = useState(false);
  const [erroSinc, setErroSinc] = useState<string | null>(null);

  const atualizarConfig = useCallback((parcial: Partial<ConfiguracaoCalendario>) => {
    setConfigState(prev => {
      const nova = { ...prev, ...parcial };
      salvarConfig(nova);
      return nova;
    });
  }, []);

  const adicionarFeriadoCustom = useCallback((data: string) => {
    setConfigState(prev => {
      if (prev.feriadosCustom.includes(data)) return prev;
      const nova = { ...prev, feriadosCustom: [...prev.feriadosCustom, data].sort() };
      salvarConfig(nova);
      return nova;
    });
  }, []);

  const removerFeriadoCustom = useCallback((data: string) => {
    setConfigState(prev => {
      const nova = { ...prev, feriadosCustom: prev.feriadosCustom.filter(d => d !== data) };
      salvarConfig(nova);
      return nova;
    });
  }, []);

  const sincronizarUniasselvi = useCallback(async (): Promise<EventoAgenda[]> => {
    if (!config.uniasselviIcsUrl || !config.uniasselviIcsAtivo) return [];
    setSincronizando(true);
    setErroSinc(null);
    try {
      const resp = await fetch(config.uniasselviIcsUrl, { mode: 'cors' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const texto = await resp.text();
      const eventos = icsParaEventosAgenda(texto).map(e => ({
        ...e,
        id: e.id.replace(/^ics-/, 'ics-uniasselvi-'),
        fonte: 'ics' as const,
      }));
      atualizarConfig({ uniasselviUltimaSinc: new Date().toISOString() });
      return eventos;
    } catch (err) {
      setErroSinc(
        `Erro ao sincronizar Uniasselvi: ${err instanceof Error ? err.message : 'Falha de rede'}. ` +
        `Verifique se a URL é pública ou aceita CORS.`
      );
      return [];
    } finally {
      setSincronizando(false);
    }
  }, [config.uniasselviIcsUrl, config.uniasselviIcsAtivo, atualizarConfig]);

  // Sincronização automática ao montar
  useEffect(() => {
    if (!config.uniasselviIcsAtivo || !config.uniasselviIcsUrl) return;
    const ult = config.uniasselviUltimaSinc ? new Date(config.uniasselviUltimaSinc).getTime() : 0;
    const diffMin = (Date.now() - ult) / 60000;
    if (diffMin >= SINC_INTERVALO_MIN) {
      // Chamada silenciosa — erros são capturados internamente
      sincronizarUniasselvi().catch(() => { /* silencioso */ });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    config,
    sincronizando,
    erroSinc,
    atualizarConfig,
    sincronizarUniasselvi,
    adicionarFeriadoCustom,
    removerFeriadoCustom,
  };
}
