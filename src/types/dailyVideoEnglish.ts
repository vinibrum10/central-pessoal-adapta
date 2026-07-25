// Tipos da fundação de integração YouTube do Inglês Diário (Etapa 2 da V1).
// Isolado de src/types/englishInterview.ts e src/types/englishStudy.ts de propósito:
// o Inglês Diário não compartilha modelo de dados nem regras com o Modo Entrevista.

export const YOUTUBE_READONLY_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
export const DAILY_VIDEO_TARGET_PLAYLIST_TITLE = 'SGP — Inglês';
export const DAILY_VIDEO_RECENT_VIDEOS_LIMIT = 10;

// ------------------------------------------------------------------
// Estado de autorização — vive somente em memória (ver src/services/youtubeAuth.ts).
// Nunca é serializado para localStorage/sessionStorage/cookies/IndexedDB/Supabase.
//
// IMPORTANTE: este tipo é o que é publicado para listeners/componentes via
// subscribeToYoutubeAuthState()/getYoutubeAuthState() — por isso NÃO tem (e não
// deve ganhar) um campo de access token. O token real vive numa variável
// privada dentro de youtubeAuth.ts, só acessível via getInMemoryYoutubeAccessToken().
// ------------------------------------------------------------------
export type YoutubeAuthStatus =
  | 'gis_loading'
  | 'ready'
  | 'authorizing'
  | 'authorized'
  | 'insufficient_scope' // hasGrantedAllScopes() retornou false
  | 'authorization_denied' // usuário recusou no próprio consentimento do Google (error: 'access_denied')
  | 'token_invalid'
  | 'popup_closed' // popup foi fechado antes de concluir
  | 'popup_failed_to_open' // popup nem chegou a abrir (bloqueado pelo navegador)
  | 'authorization_timeout' // o timeout defensivo expirou sem nenhuma evidência de que o usuário fechou o popup
  | 'config_error'
  | 'unknown_error';

export interface YoutubeAuthState {
  status: YoutubeAuthStatus;
  /** epoch ms; só relevante quando status === 'authorized'. Nunca contém o token em si. */
  expiresAt: number | null;
  grantedScopes: string[];
  errorMessage: string | null;
}

// ------------------------------------------------------------------
// Erros tipados da YouTube Data API / GIS
// ------------------------------------------------------------------
export type YoutubeApiErrorKind =
  | 'unauthorized' // 401
  | 'quota_exceeded' // 403 quotaExceeded / dailyLimitExceeded
  | 'insufficient_permissions' // 403 escopo/permissão insuficiente
  | 'api_not_enabled' // 403 accessNotConfigured (API do YouTube não habilitada)
  | 'forbidden_other' // outros 403 — nunca presumido como token expirado
  | 'not_found' // 404
  | 'network_error'
  | 'invalid_response'
  | 'pagination_incomplete'
  | 'popup_closed'
  | 'config_error'
  | 'unknown_error';

export interface YoutubeApiError {
  kind: YoutubeApiErrorKind;
  message: string;
  /** `reason` bruto do corpo de erro do Google, quando disponível. Nunca inclui o token. */
  reason?: string;
  status?: number;
}

// ------------------------------------------------------------------
// Descoberta de playlist (playlists.list, mine=true, título exato)
// ------------------------------------------------------------------
export interface DiscoveredPlaylist {
  playlistId: string;
  playlistTitle: string;
}

export type PlaylistDiscoveryResult =
  | { kind: 'not_found' }
  | { kind: 'found'; playlist: DiscoveredPlaylist }
  | { kind: 'duplicate'; playlists: DiscoveredPlaylist[] }
  | { kind: 'incomplete'; playlistsSeenSoFar: DiscoveredPlaylist[]; resumePageToken: string | null }
  | { kind: 'error'; error: YoutubeApiError };

// ------------------------------------------------------------------
// Validação de um playlist_id previamente persistido
// ------------------------------------------------------------------
export type PlaylistValidationResult =
  | { kind: 'valid'; playlist: DiscoveredPlaylist }
  | { kind: 'invalid_or_missing' }
  | { kind: 'inaccessible' }
  | { kind: 'auth_error'; error: YoutubeApiError }
  | { kind: 'temporary_failure'; error: YoutubeApiError };

// ------------------------------------------------------------------
// Vídeos recentes (playlistItems.list + videos.list)
// ------------------------------------------------------------------
export interface DailyVideoItem {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  /** snippet.publishedAt do item de playlist — data de adição à playlist. */
  addedAt: string;
  durationIso: string;
  durationSeconds: number;
  /** mm:ss, ou h:mm:ss quando a duração tem 1 hora ou mais. */
  durationFormatted: string;
}

export type RecentVideosResult =
  | { kind: 'videos'; videos: DailyVideoItem[]; skippedInvalidCount: number }
  | { kind: 'empty' }
  | { kind: 'incomplete'; resumePageToken: string | null }
  | { kind: 'error'; error: YoutubeApiError };

// ------------------------------------------------------------------
// Persistência (Supabase) — espelha manualmente as colunas de
// public.youtube_playlist_settings, criada em
// supabase/migrations/20260723_english_daily_video.sql.
//
// Mantido como tipo manual (não gerado) porque: (a) o projeto não usa
// `supabase gen types typescript` em nenhum lugar hoje — não existe nenhum
// arquivo Database/gerado no repositório — e (b) mesmo que usasse, essa
// migration ainda não foi aplicada a nenhum banco (local ou produção), então
// não haveria schema real para gerar tipos a partir dele. Se o projeto passar
// a gerar tipos automaticamente no futuro, este tipo deve ser conferido/
// substituído pelo gerado assim que a migration for aplicada.
// ------------------------------------------------------------------
export interface YoutubePlaylistSettingsRow {
  id: string;
  user_id: string;
  playlist_id: string;
  playlist_title: string;
  configured_at: string;
  last_verified_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------
// Autorização server-side (OAuth 2.0 Authorization Code Flow, access_type=
// offline) — ver supabase/functions/youtube-oauth-*. Substitui, para o fluxo
// de restauração após F5, o modelo antigo (YoutubeAuthStatus/YoutubeAuthState
// acima, baseado em Google Identity Services client-side, mantido no
// repositório mas não mais usado pelo controller do Inglês Diário).
//
// Nenhum campo aqui é ou deriva do token: o frontend só enxerga status +
// metadados. O refresh_token cifrado vive só em
// public.youtube_oauth_connections, lido/decifrado somente pelas Edge
// Functions com a service_role key + TOKEN_ENCRYPTION_KEY (Secrets).
// ------------------------------------------------------------------
export type YoutubeConnectionStatus =
  | 'checking' // consultando o estado no backend (getYoutubeConnectionStatus em andamento)
  | 'not_connected' // nunca autorizado, ou desconectado explicitamente
  | 'connected' // refresh_token válido no backend
  | 'reconnect_required' // refresh_token revogado/expirado/inválido (invalid_grant do Google)
  | 'authorization_denied' // usuário negou na tela de consentimento do Google
  | 'error'; // falha de configuração, timeout, ou erro inesperado do backend

export interface YoutubeConnectionState {
  status: YoutubeConnectionStatus;
  grantedScopes: string[];
  lastRefreshedAt: string | null;
  errorMessage: string | null;
}
