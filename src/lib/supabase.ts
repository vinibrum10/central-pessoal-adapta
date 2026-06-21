/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_URL.startsWith('https://') &&
  SUPABASE_KEY && SUPABASE_KEY.length > 10
);

/**
 * Em produção (não-dev), o app SEMPRE exige Supabase configurado.
 * Em desenvolvimento, pode-se usar VITE_ENABLE_LOCAL_MODE=true para
 * rodar sem banco (dados no LocalStorage).
 */
export const isDev = import.meta.env.DEV === true;
export const localModeEnabled = isDev && import.meta.env.VITE_ENABLE_LOCAL_MODE === 'true';

/**
 * O app está em modo seguro (exige autenticação) quando:
 * - Supabase está configurado, OU
 * - Está em produção (independente de configuração)
 *
 * Modo local apenas funciona em DEV com VITE_ENABLE_LOCAL_MODE=true.
 */
export const modoLocalAtivo = localModeEnabled && !isSupabaseConfigured;

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_KEY!)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');
