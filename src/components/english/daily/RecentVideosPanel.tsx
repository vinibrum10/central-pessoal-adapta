import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Clapperboard, RefreshCw, Video } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../Card';
import { Button } from '../../Button';
import { EmptyState } from '../../DesignSystem';
import type { DailyVideoItem, RecentVideosResult, YoutubeApiError } from '../../../types/dailyVideoEnglish';

interface RecentVideosPanelProps {
  videos: RecentVideosResult | null;
  videosLoading: boolean;
  selectedVideoId: string | null;
  onSelectVideo: (videoId: string) => void;
  onRetryLoadVideos: () => void;
}

function describeApiError(error: YoutubeApiError): string {
  switch (error.kind) {
    case 'unauthorized':
      return 'Sua conexão com o YouTube expirou. Reconecte para continuar.';
    case 'quota_exceeded':
      return 'O limite de uso da API do YouTube foi atingido. Tente novamente mais tarde.';
    case 'api_not_enabled':
      return 'A API do YouTube não está habilitada para este projeto.';
    case 'insufficient_permissions':
    case 'forbidden_other':
      return 'Acesso negado ao carregar os vídeos desta playlist.';
    case 'network_error':
      return 'Falha de conexão ao carregar os vídeos.';
    case 'invalid_response':
      return 'O YouTube respondeu de forma inesperada ao carregar os vídeos.';
    default:
      return error.message;
  }
}

function formatAddedAt(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

function SkeletonGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key -- placeholders puramente visuais, sem identidade própria
          key={index}
          className="h-40 animate-pulse rounded-xl border border-surface-200 bg-surface-100 dark:border-primary-300/15 dark:bg-white/5"
        />
      ))}
    </div>
  );
}

interface VideoCardProps {
  video: DailyVideoItem;
  selected: boolean;
  onSelect: (videoId: string) => void;
}

function VideoCard({ video, selected, onSelect }: VideoCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(video.videoId)}
      aria-pressed={selected}
      className={`
        flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-surface-950
        ${selected
          ? 'border-primary-500 bg-primary-50/60 shadow-md shadow-primary-900/10 dark:border-primary-300 dark:bg-primary-500/10'
          : 'border-surface-200 bg-white/90 hover:border-primary-300 hover:shadow-sm dark:border-primary-300/15 dark:bg-white/[0.04] dark:hover:border-primary-300/30'}
      `}
    >
      <div className="relative aspect-video w-full bg-surface-200 dark:bg-white/10">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-surface-400 dark:text-surface-500">
            <Clapperboard size={28} />
          </div>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-xs font-semibold text-white">
          {video.durationFormatted}
        </span>
        {selected && (
          <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white shadow">
            <CheckCircle2 size={14} />
          </span>
        )}
      </div>
      <div className="flex-1 space-y-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-5 text-surface-950 dark:text-white">{video.title}</p>
        <p className="text-xs text-surface-500 dark:text-surface-400">
          Adicionado à playlist em {formatAddedAt(video.addedAt)}
        </p>
      </div>
    </button>
  );
}

export function RecentVideosPanel({
  videos,
  videosLoading,
  selectedVideoId,
  onSelectVideo,
  onRetryLoadVideos,
}: RecentVideosPanelProps) {
  if (videosLoading) {
    return (
      <Card>
        <CardHeader title="Vídeos recentes" icon={<Video size={18} />} />
        <CardBody>
          <SkeletonGrid />
        </CardBody>
      </Card>
    );
  }

  if (!videos) return null;

  if (videos.kind === 'empty') {
    return (
      <Card>
        <CardHeader title="Vídeos recentes" icon={<Video size={18} />} />
        <CardBody>
          <EmptyState
            title="Sua playlist ainda não tem vídeos utilizáveis"
            description="Adicione um vídeo à playlist 'SGP — Inglês' no YouTube e volte aqui."
          />
        </CardBody>
      </Card>
    );
  }

  if (videos.kind === 'incomplete') {
    return (
      <Card>
        <CardHeader title="Vídeos recentes" icon={<Video size={18} />} />
        <CardBody className="space-y-3">
          <p className="text-sm leading-6 text-surface-600 dark:text-surface-300">
            Ainda estamos carregando os vídeos desta playlist (ela tem muitos itens) — este ainda não é um resultado
            definitivo.
          </p>
          <Button type="button" variant="secondary" icon={<RefreshCw size={16} />} onClick={onRetryLoadVideos}>
            Tentar novamente
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (videos.kind === 'error') {
    return (
      <Card>
        <CardHeader title="Não foi possível carregar os vídeos" icon={<AlertTriangle size={18} />} />
        <CardBody className="space-y-3">
          <p className="text-sm leading-6 text-surface-600 dark:text-surface-300">{describeApiError(videos.error)}</p>
          <Button type="button" variant="secondary" icon={<RefreshCw size={16} />} onClick={onRetryLoadVideos}>
            Tentar novamente
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Vídeos recentes"
        subtitle="Selecione o vídeo que você estudou hoje. Ordenados pela data em que foram adicionados à playlist."
        icon={<Video size={18} />}
      />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {videos.videos.map(video => (
            <VideoCard
              key={video.videoId}
              video={video}
              selected={video.videoId === selectedVideoId}
              onSelect={onSelectVideo}
            />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
