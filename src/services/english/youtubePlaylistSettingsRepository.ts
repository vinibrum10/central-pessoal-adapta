// Persistência de public.youtube_playlist_settings (Supabase) — SOMENTE
// metadados não sensíveis da playlist configurada (playlist_id, playlist_title,
// timestamps). O access token do Google NUNCA é lido, aceito como parâmetro ou
// enviado ao Supabase por nenhuma função deste arquivo.
//
// A migration supabase/migrations/20260723_english_daily_video.sql (Etapa 1)
// ainda não foi aplicada a nenhum banco (local ou produção). Os tipos usados
// aqui vêm de src/types/dailyVideoEnglish.ts (mantidos manualmente) em vez de
// tipos gerados pelo Supabase CLI — ver o comentário naquele arquivo.

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { YoutubePlaylistSettingsRow } from '../../types/dailyVideoEnglish';

async function throwIfError<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export function isYoutubePlaylistSettingsStorageReady(userId?: string | null): boolean {
  return Boolean(isSupabaseConfigured && userId);
}

export async function getYoutubePlaylistSettings(userId: string): Promise<YoutubePlaylistSettingsRow | null> {
  return throwIfError<YoutubePlaylistSettingsRow | null>(
    supabase
      .from('youtube_playlist_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle() as never,
  );
}

/**
 * Insere ou atualiza a configuração da playlist encontrada. Usa upsert por
 * `user_id` (UNIQUE(user_id) na migration) — uma configuração por usuário.
 * `configured_at` só é definido pelo banco na primeira inserção (default now()
 * na migration); aqui só tocamos os campos que uma nova descoberta deve
 * atualizar.
 */
export async function saveYoutubePlaylistSettings(
  userId: string,
  playlist: { playlistId: string; playlistTitle: string },
): Promise<YoutubePlaylistSettingsRow> {
  return throwIfError<YoutubePlaylistSettingsRow>(
    supabase
      .from('youtube_playlist_settings')
      .upsert(
        {
          user_id: userId,
          playlist_id: playlist.playlistId,
          playlist_title: playlist.playlistTitle,
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single() as never,
  );
}

export async function touchYoutubePlaylistLastVerifiedAt(userId: string): Promise<YoutubePlaylistSettingsRow> {
  return throwIfError<YoutubePlaylistSettingsRow>(
    supabase
      .from('youtube_playlist_settings')
      .update({ last_verified_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('*')
      .single() as never,
  );
}

export async function touchYoutubePlaylistLastSyncedAt(userId: string): Promise<YoutubePlaylistSettingsRow> {
  return throwIfError<YoutubePlaylistSettingsRow>(
    supabase
      .from('youtube_playlist_settings')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('*')
      .single() as never,
  );
}

/** Reservada para uso futuro pela interface (ex.: "desconectar YouTube"). */
export async function deleteYoutubePlaylistSettings(userId: string): Promise<void> {
  const { error } = await supabase
    .from('youtube_playlist_settings')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}
