/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_URL.startsWith('https://') &&
  SUPABASE_KEY && SUPABASE_KEY.length > 10
);

// Se não configurado, exporta um cliente mock para evitar erros de importação
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_KEY!)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');
