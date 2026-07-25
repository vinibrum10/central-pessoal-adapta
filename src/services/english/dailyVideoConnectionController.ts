// Orquestração do Inglês Diário — V1, arquitetura OAuth 2.0 server-side.
//
// Deliberadamente NÃO é um hook React — é um controlador simples (estado +
// ações) que recebe suas dependências por injeção (`DailyVideoConnectionDeps`),
// testável sem renderizar nenhum componente (o projeto não tem
// @testing-library/react instalado). O hook React
// (src/hooks/useDailyVideoConnection.ts) é só um adaptador fino por cima
// deste controlador.
//
// Regra de segurança mais importante deste arquivo: nenhuma função aqui, nem
// as injetadas via deps, jamais manuseia access_token/refresh_token — tudo
// isso vive exclusivamente nas Edge Functions (supabase/functions/
// youtube-oauth-*, youtube-playlist). Este controlador só decide QUANDO
// chamar cada endpoint e como reagir ao resultado.
import type {
  DiscoveredPlaylist,
  PlaylistDiscoveryResult,
  RecentVideosResult,
  YoutubeConnectionState,
  YoutubePlaylistSettingsRow,
} from '../../types/dailyVideoEnglish';
import type { DailyVideoSessionRow, SelectedVideoMetadata } from './dailyVideoSessionsRepository';

type DiscoverPlaylistResponse = PlaylistDiscoveryResult | { kind: 'not_connected' } | { kind: 'reconnect_required' };
type RecentVideosResponse = RecentVideosResult | { kind: 'not_connected' } | { kind: 'reconnect_required' };

export interface DailyVideoConnectionDeps {
  getYoutubeConnectionStatus: () => Promise<YoutubeConnectionState>;
  startYoutubeAuthorization: () => Promise<void>;
  disconnectYoutube: () => Promise<void>;
  discoverYoutubePlaylist: () => Promise<DiscoverPlaylistResponse>;
  getRecentVideos: (playlist: DiscoveredPlaylist) => Promise<RecentVideosResponse>;
  saveYoutubePlaylistSettings: (
    userId: string,
    playlist: { playlistId: string; playlistTitle: string },
  ) => Promise<YoutubePlaylistSettingsRow>;
  getTodaysVideoSession: (userId: string, sessionDate: string) => Promise<DailyVideoSessionRow | null>;
  saveSelectedVideoForToday: (
    userId: string,
    sessionDate: string,
    timezone: string,
    video: SelectedVideoMetadata,
  ) => Promise<DailyVideoSessionRow>;
}

export interface DailyVideoConnectionState {
  /** Estado da conexão server-side — nunca contém token, só status/metadados. */
  connection: YoutubeConnectionState;
  discovery: PlaylistDiscoveryResult | null;
  discoveryLoading: boolean;
  videos: RecentVideosResult | null;
  videosLoading: boolean;
  selectedVideoId: string | null;
}

export interface DailyVideoConnectionController {
  getState: () => DailyVideoConnectionState;
  subscribe: (listener: (state: DailyVideoConnectionState) => void) => () => void;
  /** Deve ser chamada uma vez, ao montar a página — nunca abre popup/redirect por conta própria. */
  initialize: (userId: string, sessionDate: string, timezone: string) => Promise<void>;
  /** Só deve ser chamada a partir de um clique explícito — faz um redirect de página inteira, nunca um popup. */
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  retryDiscovery: () => Promise<void>;
  retryLoadVideos: () => Promise<void>;
  selectVideo: (videoId: string) => void;
  dispose: () => void;
}

// A consulta ao estado da conexão passa pela Edge Function
// youtube-oauth-status, que por sua vez depende do Supabase (mesmo problema
// documentado em src/contexts/authSessionLoader.ts: uma chamada de rede pode
// nunca resolver nem rejeitar). Timeout de segurança para nunca ficar preso
// em "checking" para sempre.
const CONNECTION_STATUS_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} excedeu ${ms}ms sem responder.`)), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      err => { clearTimeout(timer); reject(err); },
    );
  });
}

function initialState(): DailyVideoConnectionState {
  return {
    connection: { status: 'checking', grantedScopes: [], lastRefreshedAt: null, errorMessage: null },
    discovery: null,
    discoveryLoading: false,
    videos: null,
    videosLoading: false,
    selectedVideoId: null,
  };
}

export function createDailyVideoConnectionController(
  deps: DailyVideoConnectionDeps,
): DailyVideoConnectionController {
  let userId: string | null = null;
  let sessionDate: string | null = null;
  let timezone = 'UTC';
  let state = initialState();
  const listeners = new Set<(state: DailyVideoConnectionState) => void>();

  function setState(patch: Partial<DailyVideoConnectionState>): void {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  }

  async function loadVideosFor(playlist: DiscoveredPlaylist): Promise<void> {
    setState({ videosLoading: true });
    const result = await deps.getRecentVideos(playlist);
    if (result.kind === 'reconnect_required') {
      setState({ videosLoading: false, videos: null, connection: { ...state.connection, status: 'reconnect_required' } });
      return;
    }
    if (result.kind === 'not_connected') {
      setState({ videosLoading: false, videos: null, connection: { ...state.connection, status: 'not_connected' } });
      return;
    }
    setState({ videos: result, videosLoading: false });
  }

  async function runDiscovery(): Promise<void> {
    if (!userId) return;
    setState({ discoveryLoading: true, discovery: null });
    const result = await deps.discoverYoutubePlaylist();

    if (result.kind === 'reconnect_required') {
      setState({ discoveryLoading: false, discovery: null, connection: { ...state.connection, status: 'reconnect_required' } });
      return;
    }
    if (result.kind === 'not_connected') {
      setState({ discoveryLoading: false, discovery: null, connection: { ...state.connection, status: 'not_connected' } });
      return;
    }

    setState({ discovery: result, discoveryLoading: false });

    if (result.kind === 'found') {
      // Melhor-esforço: registro de configuração, não bloqueia o carregamento dos vídeos se falhar.
      deps.saveYoutubePlaylistSettings(userId, result.playlist).catch(() => undefined);
      await loadVideosFor(result.playlist);
    }
    // not_found / duplicate / incomplete / error: só exibidos, sem ação automática.
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async initialize(forUserId, forSessionDate, forTimezone) {
      userId = forUserId;
      sessionDate = forSessionDate;
      timezone = forTimezone;

      setState({ connection: { status: 'checking', grantedScopes: [], lastRefreshedAt: null, errorMessage: null } });

      // Restaura o vídeo já selecionado hoje — independente do estado da
      // conexão (o usuário pode ter selecionado um vídeo e o token ter
      // expirado depois; a seleção continua válida).
      try {
        const session = await deps.getTodaysVideoSession(forUserId, forSessionDate);
        if (session?.youtube_video_id) setState({ selectedVideoId: session.youtube_video_id });
      } catch {
        // Melhor-esforço — a seleção salva não é crítica para o restante do fluxo.
      }

      let connection: YoutubeConnectionState;
      try {
        connection = await withTimeout(
          deps.getYoutubeConnectionStatus(),
          CONNECTION_STATUS_TIMEOUT_MS,
          'Consultar a conexão com o YouTube',
        );
      } catch (err) {
        setState({
          connection: {
            status: 'error',
            grantedScopes: [],
            lastRefreshedAt: null,
            errorMessage: err instanceof Error ? err.message : 'Não foi possível consultar a conexão com o YouTube.',
          },
        });
        return;
      }

      setState({ connection });

      if (connection.status === 'connected') {
        await runDiscovery();
      }
    },

    async connect() {
      await deps.startYoutubeAuthorization();
    },

    async disconnect() {
      await deps.disconnectYoutube();
      setState({
        connection: { status: 'not_connected', grantedScopes: [], lastRefreshedAt: null, errorMessage: null },
        discovery: null,
        videos: null,
      });
    },

    async retryDiscovery() {
      await runDiscovery();
    },

    async retryLoadVideos() {
      if (state.discovery?.kind === 'found') await loadVideosFor(state.discovery.playlist);
    },

    selectVideo(videoId: string) {
      setState({ selectedVideoId: videoId });
      if (!userId || !sessionDate) return;
      const video = state.videos?.kind === 'videos' ? state.videos.videos.find(v => v.videoId === videoId) : null;
      if (!video) return;
      deps
        .saveSelectedVideoForToday(userId, sessionDate, timezone, {
          videoId: video.videoId,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
        })
        .catch(() => undefined);
    },

    dispose() {
      listeners.clear();
    },
  };
}
