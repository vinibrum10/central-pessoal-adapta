// Cliente das Edge Functions server-side do YouTube (Etapa 3 — OAuth
// server-side). Nenhuma função aqui manuseia access_token/refresh_token: tudo
// isso fica exclusivamente dentro das Edge Functions
// (supabase/functions/youtube-oauth-*, youtube-playlist). Este arquivo só
// invoca essas funções via supabase.functions.invoke() (que já anexa o JWT
// da sessão atual automaticamente) e tipa as respostas.
import { supabase } from '../../lib/supabase';
import type {
  DiscoveredPlaylist,
  PlaylistDiscoveryResult,
  RecentVideosResult,
  YoutubeConnectionState,
  YoutubeConnectionStatus,
} from '../../types/dailyVideoEnglish';

// Contrato REAL de supabase/functions/youtube-oauth-status/index.ts: ele já
// traduz o vocabulário interno do banco ('active'/'revoked'/'invalid') para
// este vocabulário de conexão antes de responder — nunca o valor cru da
// coluna. `status` aqui é só o que a Edge Function promete devolver.
type StatusFieldFromEdgeFunction = 'connected' | 'reconnect_required' | 'none';
const KNOWN_STATUS_VALUES: readonly StatusFieldFromEdgeFunction[] = ['connected', 'reconnect_required', 'none'];

interface StatusResponseBody {
  connected: unknown;
  status: unknown;
  grantedScopes: unknown;
  lastRefreshedAt: unknown;
}

/**
 * Validação defensiva em tempo de execução — nunca confia só na asserção de
 * tipo do `invoke<StatusResponseBody>()` (isso é só uma promessa do
 * TypeScript, não uma garantia sobre o que realmente chegou pela rede). Um
 * valor de `status` fora do vocabulário conhecido (bug na Edge Function,
 * versão desalinhada, resposta corrompida) vira `'error'` em vez de ser
 * repassado adiante como se fosse válido.
 */
function mapStatusResponse(body: unknown): YoutubeConnectionState {
  const record = body as Partial<StatusResponseBody> | null | undefined;
  const rawStatus = record?.status;

  if (typeof rawStatus !== 'string' || !KNOWN_STATUS_VALUES.includes(rawStatus as StatusFieldFromEdgeFunction)) {
    return {
      status: 'error',
      grantedScopes: [],
      lastRefreshedAt: null,
      errorMessage: 'O servidor retornou um estado de conexão inesperado.',
    };
  }

  const validatedStatus = rawStatus as StatusFieldFromEdgeFunction;
  const status: YoutubeConnectionStatus = validatedStatus === 'none' ? 'not_connected' : validatedStatus;
  const grantedScopes = Array.isArray(record?.grantedScopes) ? (record.grantedScopes as string[]) : [];
  const lastRefreshedAt = typeof record?.lastRefreshedAt === 'string' ? record.lastRefreshedAt : null;

  return { status, grantedScopes, lastRefreshedAt, errorMessage: null };
}

export async function getYoutubeConnectionStatus(): Promise<YoutubeConnectionState> {
  const { data, error } = await supabase.functions.invoke('youtube-oauth-status', { method: 'GET' });
  if (error) {
    return { status: 'error', grantedScopes: [], lastRefreshedAt: null, errorMessage: error.message };
  }
  return mapStatusResponse(data);
}

/**
 * Só deve ser chamada a partir de um clique explícito do usuário (botão
 * "Conectar"/"Reconectar ao YouTube"). Faz um REDIRECT DE PÁGINA INTEIRA para
 * a tela de consentimento do Google — nunca abre popup via JS.
 */
export async function startYoutubeAuthorization(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ authorizationUrl: string }>('youtube-oauth-start');
  if (error || !data?.authorizationUrl) {
    throw new Error(error?.message ?? 'Não foi possível iniciar a autorização do YouTube.');
  }
  window.location.href = data.authorizationUrl;
}

export async function disconnectYoutube(): Promise<void> {
  const { error } = await supabase.functions.invoke('youtube-oauth-disconnect');
  if (error) throw new Error(error.message);
}

type DiscoverResponseBody =
  | PlaylistDiscoveryResult
  | { kind: 'not_connected' }
  | { kind: 'reconnect_required' };

export async function discoverYoutubePlaylist(): Promise<DiscoverResponseBody> {
  const { data, error } = await supabase.functions.invoke<DiscoverResponseBody>('youtube-playlist?action=discover', { method: 'GET' });
  if (error) return { kind: 'error', error: { kind: 'unknown_error', message: error.message } };
  return data as DiscoverResponseBody;
}

type VideosResponseBody =
  | RecentVideosResult
  | { kind: 'not_connected' }
  | { kind: 'reconnect_required' };

export async function getRecentVideosServerSide(playlist: DiscoveredPlaylist): Promise<VideosResponseBody> {
  const { data, error } = await supabase.functions.invoke<VideosResponseBody>(
    `youtube-playlist?action=videos&playlistId=${encodeURIComponent(playlist.playlistId)}`,
    { method: 'GET' },
  );
  if (error) return { kind: 'error', error: { kind: 'unknown_error', message: error.message } };
  return data as VideosResponseBody;
}
