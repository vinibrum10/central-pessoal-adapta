// Adaptador React fino sobre src/services/english/dailyVideoConnectionController.ts.
// Toda a lógica de orquestração (quando descobrir a playlist, quando carregar
// vídeos, como reagir ao estado da conexão) já está no controller e é
// testada lá sem precisar renderizar nada — este hook só liga o controller ao
// ciclo de vida do componente (useEffect), calcula a data/timezone local do
// usuário, e trata a mensagem de retorno do redirect OAuth (?youtube_auth=...).

import { useEffect, useRef, useState } from 'react';
import {
  disconnectYoutube,
  discoverYoutubePlaylist,
  getRecentVideosServerSide,
  getYoutubeConnectionStatus,
  startYoutubeAuthorization,
} from '../services/english/youtubeServerConnection';
import { getTodaysVideoSession, saveSelectedVideoForToday } from '../services/english/dailyVideoSessionsRepository';
import { saveYoutubePlaylistSettings } from '../services/english/youtubePlaylistSettingsRepository';
import {
  createDailyVideoConnectionController,
  type DailyVideoConnectionController,
  type DailyVideoConnectionState,
} from '../services/english/dailyVideoConnectionController';

const PRODUCTION_DEPS = {
  getYoutubeConnectionStatus,
  startYoutubeAuthorization,
  disconnectYoutube,
  discoverYoutubePlaylist,
  getRecentVideos: getRecentVideosServerSide,
  saveYoutubePlaylistSettings,
  getTodaysVideoSession,
  saveSelectedVideoForToday,
};

/** YYYY-MM-DD na data LOCAL do navegador — nunca UTC, nunca calculado no servidor. */
function todayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readAndClearYoutubeAuthQueryParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  const value = params.get('youtube_auth');
  if (!value) return null;
  params.delete('youtube_auth');
  const newSearch = params.toString();
  const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
  window.history.replaceState(null, '', newUrl);
  return value;
}

export interface UseDailyVideoConnectionResult extends DailyVideoConnectionState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  retryDiscovery: () => Promise<void>;
  retryLoadVideos: () => Promise<void>;
  selectVideo: (videoId: string) => void;
  /** Mensagem transitória lida uma vez de ?youtube_auth=... após o redirect do Google. */
  authRedirectMessage: string | null;
}

export function useDailyVideoConnection(userId: string | null): UseDailyVideoConnectionResult {
  const controllerRef = useRef<DailyVideoConnectionController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createDailyVideoConnectionController(PRODUCTION_DEPS);
  }
  const controller = controllerRef.current;
  const [state, setState] = useState<DailyVideoConnectionState>(() => controller.getState());
  const [authRedirectMessage] = useState<string | null>(() => readAndClearYoutubeAuthQueryParam());

  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);
    if (userId) {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      void controller.initialize(userId, todayLocalDateString(), timezone);
    }
    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, [controller, userId]);

  return {
    ...state,
    connect: controller.connect,
    disconnect: controller.disconnect,
    retryDiscovery: controller.retryDiscovery,
    retryLoadVideos: controller.retryLoadVideos,
    selectVideo: controller.selectVideo,
    authRedirectMessage,
  };
}
