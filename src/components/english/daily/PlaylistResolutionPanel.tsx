import { AlertTriangle, ListVideo, RefreshCw, Search } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../Card';
import { Button } from '../../Button';
import { LoadingState } from '../../DesignSystem';
import type { PlaylistDiscoveryResult, YoutubeApiError } from '../../../types/dailyVideoEnglish';
import { DAILY_VIDEO_TARGET_PLAYLIST_TITLE } from '../../../types/dailyVideoEnglish';

interface PlaylistResolutionPanelProps {
  discovery: PlaylistDiscoveryResult | null;
  discoveryLoading: boolean;
  onRetryDiscovery: () => void;
}

function describeApiError(error: YoutubeApiError): string {
  switch (error.kind) {
    case 'unauthorized':
      return 'Sua conexão com o YouTube expirou. Reconecte para continuar.';
    case 'quota_exceeded':
      return 'O limite de uso da API do YouTube foi atingido. Tente novamente mais tarde.';
    case 'api_not_enabled':
      return 'A API do YouTube não está habilitada para este projeto no Google Cloud Console.';
    case 'insufficient_permissions':
      return 'A autorização concedida não permite acessar suas playlists.';
    case 'forbidden_other':
      return 'Acesso negado ao consultar suas playlists.';
    case 'network_error':
      return 'Falha de conexão ao consultar o YouTube.';
    case 'invalid_response':
      return 'O YouTube respondeu de forma inesperada.';
    case 'not_found':
      return 'Recurso não encontrado no YouTube.';
    default:
      return error.message;
  }
}

export function PlaylistResolutionPanel({ discovery, discoveryLoading, onRetryDiscovery }: PlaylistResolutionPanelProps) {
  if (discoveryLoading) {
    return (
      <Card>
        <CardBody className="py-6">
          <LoadingState label={`Procurando a playlist "${DAILY_VIDEO_TARGET_PLAYLIST_TITLE}"...`} />
        </CardBody>
      </Card>
    );
  }

  if (!discovery) return null;

  if (discovery.kind === 'not_found') {
    return (
      <Card>
        <CardHeader title="Playlist não encontrada" icon={<Search size={18} />} />
        <CardBody className="space-y-3">
          <p className="text-sm leading-6 text-surface-600 dark:text-surface-300">
            Não encontramos, na sua conta do YouTube, uma playlist com o nome exato{' '}
            <strong>&ldquo;{DAILY_VIDEO_TARGET_PLAYLIST_TITLE}&rdquo;</strong>. Crie a playlist com esse nome exato
            (marcada como privada) no YouTube Studio e busque novamente.
          </p>
          <Button type="button" variant="secondary" icon={<RefreshCw size={16} />} onClick={onRetryDiscovery}>
            Buscar novamente
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (discovery.kind === 'duplicate') {
    return (
      <Card>
        <CardHeader title="Mais de uma playlist com o mesmo nome" icon={<AlertTriangle size={18} />} />
        <CardBody className="space-y-3">
          <p className="text-sm leading-6 text-surface-600 dark:text-surface-300">
            Encontramos {discovery.playlists.length} playlists chamadas exatamente{' '}
            <strong>&ldquo;{DAILY_VIDEO_TARGET_PLAYLIST_TITLE}&rdquo;</strong>. Nenhuma foi escolhida automaticamente.
            Renomeie as duplicatas na sua conta do YouTube até restar apenas uma e busque novamente.
          </p>
          <ul className="list-inside list-disc text-xs text-surface-500 dark:text-surface-400">
            {discovery.playlists.map(playlist => (
              <li key={playlist.playlistId}>{playlist.playlistTitle} ({playlist.playlistId})</li>
            ))}
          </ul>
          <Button type="button" variant="secondary" icon={<RefreshCw size={16} />} onClick={onRetryDiscovery}>
            Buscar novamente
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (discovery.kind === 'incomplete') {
    return (
      <Card>
        <CardHeader title="Busca ainda incompleta" icon={<Search size={18} />} />
        <CardBody className="space-y-3">
          <p className="text-sm leading-6 text-surface-600 dark:text-surface-300">
            Você tem muitas playlists e não terminamos de verificar todas em uma única consulta. Isto ainda não é um
            resultado definitivo.
          </p>
          <Button type="button" variant="primary" icon={<RefreshCw size={16} />} onClick={onRetryDiscovery}>
            Tentar novamente
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (discovery.kind === 'error') {
    return (
      <Card>
        <CardHeader title="Não foi possível buscar sua playlist" icon={<AlertTriangle size={18} />} />
        <CardBody className="space-y-3">
          <p className="text-sm leading-6 text-surface-600 dark:text-surface-300">{describeApiError(discovery.error)}</p>
          <Button type="button" variant="secondary" icon={<RefreshCw size={16} />} onClick={onRetryDiscovery}>
            Tentar novamente
          </Button>
        </CardBody>
      </Card>
    );
  }

  // 'found' — transitório: os vídeos já devem estar carregando/carregados.
  return (
    <Card>
      <CardBody className="flex items-center gap-2 py-4 text-sm text-success-700 dark:text-success-300">
        <ListVideo size={16} />
        Playlist &ldquo;{discovery.playlist.playlistTitle}&rdquo; encontrada e configurada.
      </CardBody>
    </Card>
  );
}
