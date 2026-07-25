// Persistência de public.daily_video_sessions — usada aqui SÓ para lembrar
// qual vídeo o usuário selecionou hoje (sobrevive a F5). Os demais campos da
// sessão diária (speaking, comprehension_scale, status) pertencem a outra
// etapa e nunca são tocados por este arquivo — o upsert abaixo envia
// exclusivamente os campos do vídeo, então uma linha já existente com esses
// outros campos preenchidos não é sobrescrita.
import { supabase } from '../../lib/supabase';

export interface DailyVideoSessionRow {
  id: string;
  user_id: string;
  session_date: string;
  timezone: string;
  youtube_video_id: string | null;
  youtube_video_title: string | null;
  youtube_video_thumbnail_url: string | null;
}

async function throwIfError<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

/** `sessionDate` no formato YYYY-MM-DD (data LOCAL do usuário — nunca calculada no servidor). */
export async function getTodaysVideoSession(userId: string, sessionDate: string): Promise<DailyVideoSessionRow | null> {
  return throwIfError<DailyVideoSessionRow | null>(
    supabase
      .from('daily_video_sessions')
      .select('id, user_id, session_date, timezone, youtube_video_id, youtube_video_title, youtube_video_thumbnail_url')
      .eq('user_id', userId)
      .eq('session_date', sessionDate)
      .maybeSingle() as never,
  );
}

export interface SelectedVideoMetadata {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
}

export async function saveSelectedVideoForToday(
  userId: string,
  sessionDate: string,
  timezone: string,
  video: SelectedVideoMetadata,
): Promise<DailyVideoSessionRow> {
  return throwIfError<DailyVideoSessionRow>(
    supabase
      .from('daily_video_sessions')
      .upsert(
        {
          user_id: userId,
          session_date: sessionDate,
          timezone,
          youtube_video_id: video.videoId,
          youtube_video_title: video.title,
          youtube_video_thumbnail_url: video.thumbnailUrl,
        },
        { onConflict: 'user_id,session_date' },
      )
      .select('id, user_id, session_date, timezone, youtube_video_id, youtube_video_title, youtube_video_thumbnail_url')
      .single() as never,
  );
}
