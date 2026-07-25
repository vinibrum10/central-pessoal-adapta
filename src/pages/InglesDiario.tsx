import { useState } from 'react';
import { AlertTriangle, PlayCircle } from 'lucide-react';
import { PageHeader } from '../components/DesignSystem';
import { Button } from '../components/Button';
import { ConnectYoutubeStep } from '../components/english/daily/ConnectYoutubeStep';
import { PlaylistResolutionPanel } from '../components/english/daily/PlaylistResolutionPanel';
import { RecentVideosPanel } from '../components/english/daily/RecentVideosPanel';
import { DailyStudyFlow, STUDY_STEP_ORDER, type StudyStep } from '../components/english/daily/DailyStudyFlow';
import { useAuth } from '../contexts/AuthContext';
import { useDailyVideoConnection } from '../hooks/useDailyVideoConnection';
import { describeOAuthRedirectFailure } from './inglesDiarioOAuthMessages';
import { shouldConfirmVideoSwitch } from './inglesDiarioVideoSwitch';

// Página da Etapa 3 da V1 "Inglês Diário" — registrada em /estudo/ingles-diario
// (rota nova e independente, ver src/App.tsx e src/layouts/Layout.tsx). Não
// substitui nem altera src/pages/Ingles.tsx (Modo Entrevista), que continua
// intocado em /estudo/ingles.
//
// Autorização do YouTube via OAuth 2.0 server-side (Authorization Code Flow,
// access_type=offline) — ver supabase/functions/youtube-oauth-*. A conexão é
// restaurada automaticamente após F5 sem exigir novo consentimento, exceto
// quando o refresh_token foi revogado/expirado/inválido.
export function InglesDiarioPage() {
  const { user } = useAuth();
  const connection = useDailyVideoConnection(user?.id ?? null);

  // Progresso do fluxo de estudo (Listening → Questionário → Shadowing →
  // Revisão) é local a esta sessão de navegador — só a SELEÇÃO do vídeo é
  // persistida (daily_video_sessions, via connection.selectVideo). Por isso
  // o progresso sempre começa em "listening" quando a página é montada,
  // mesmo que o vídeo selecionado seja restaurado de uma sessão anterior.
  const [studyStep, setStudyStep] = useState<StudyStep>('listening');
  const [pendingVideoId, setPendingVideoId] = useState<string | null>(null);

  const isConnected = connection.connection.status === 'connected';
  const playlistConfirmed = connection.discovery?.kind === 'found';
  const oauthRedirectFailure = describeOAuthRedirectFailure(connection.authRedirectMessage);

  const selectedVideo = connection.videos?.kind === 'videos'
    ? connection.videos.videos.find(video => video.videoId === connection.selectedVideoId) ?? null
    : null;

  const hasStudyProgress = STUDY_STEP_ORDER.indexOf(studyStep) > 0;

  function applyVideoSelection(videoId: string): void {
    connection.selectVideo(videoId);
    setStudyStep('listening');
    setPendingVideoId(null);
  }

  function handleSelectVideo(videoId: string): void {
    if (shouldConfirmVideoSwitch(selectedVideo?.videoId ?? null, videoId, hasStudyProgress)) {
      setPendingVideoId(videoId);
      return;
    }
    applyVideoSelection(videoId);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inglês Diário"
        title="Vídeo de hoje"
        subtitle="Conecte sua conta do YouTube, localize a playlist 'SGP — Inglês' e escolha o vídeo que você estudou hoje."
      />

      {oauthRedirectFailure && (
        <div className="flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50/60 p-3 text-sm text-danger-800 dark:border-danger-300/20 dark:bg-danger-500/10 dark:text-danger-200">
          <AlertTriangle size={16} />
          {oauthRedirectFailure}
        </div>
      )}

      {!isConnected && (
        <ConnectYoutubeStep connection={connection.connection} onConnect={connection.connect} />
      )}

      {isConnected && !playlistConfirmed && (
        <PlaylistResolutionPanel
          discovery={connection.discovery}
          discoveryLoading={connection.discoveryLoading}
          onRetryDiscovery={connection.retryDiscovery}
        />
      )}

      {isConnected && playlistConfirmed && (
        <RecentVideosPanel
          videos={connection.videos}
          videosLoading={connection.videosLoading}
          selectedVideoId={connection.selectedVideoId}
          onSelectVideo={handleSelectVideo}
          onRetryLoadVideos={connection.retryLoadVideos}
        />
      )}

      {pendingVideoId && (
        <div className="space-y-3 rounded-lg border border-warning-200 bg-warning-50/60 p-3 text-sm text-warning-800 dark:border-warning-300/20 dark:bg-warning-500/10 dark:text-warning-200">
          <p>
            Você já avançou no estudo do vídeo atual. Trocar de vídeo agora reinicia o progresso desta sessão
            (Listening/Questionário/Shadowing/Revisão) — a seleção do vídeo em si não é perdida, só o progresso.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" onClick={() => applyVideoSelection(pendingVideoId)}>
              Trocar mesmo assim
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPendingVideoId(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {selectedVideo && (
        <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50/60 p-3 text-sm text-primary-800 dark:border-primary-300/20 dark:bg-primary-500/10 dark:text-primary-200">
          <PlayCircle size={16} />
          Vídeo selecionado para hoje: <strong>{selectedVideo.title}</strong>
        </div>
      )}

      {selectedVideo && (
        <DailyStudyFlow
          video={selectedVideo}
          step={studyStep}
          onCompleteListening={() => setStudyStep('quiz')}
          onGoToStep={setStudyStep}
        />
      )}
    </div>
  );
}
