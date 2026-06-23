import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AppData } from '../types';

export async function loadAppData(userId: string): Promise<AppData | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('app_data')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.data as AppData;
}

export async function saveAppData(userId: string, appData: AppData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('app_data')
    .upsert(
      { user_id: userId, data: appData, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}
