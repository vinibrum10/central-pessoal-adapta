import { ExternalLink, VideoOff } from 'lucide-react';
import { buildYoutubeEmbedUrl, buildYoutubeWatchUrl } from './youtubeEmbedUrl';

interface YoutubeEmbedPlayerProps {
  videoId: string;
  title: string;
}

// Player incorporado do YouTube — nunca autoplay, sempre 16:9 responsivo,
// tela cheia permitida. Não há como detectar via JavaScript se o dono do
// vídeo desabilitou a incorporação (o erro aparece DENTRO do iframe,
// isolado por origem cruzada — a página não consegue inspecioná-lo). Por
// isso o link "Assistir no YouTube" fica sempre visível, como alternativa
// permanente, em vez de depender de uma detecção que não é tecnicamente
// possível no cliente.
export function YoutubeEmbedPlayer({ videoId, title }: YoutubeEmbedPlayerProps) {
  const embedUrl = buildYoutubeEmbedUrl(videoId);
  const watchUrl = buildYoutubeWatchUrl(videoId);

  return (
    <div className="space-y-2">
      {embedUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            key={videoId}
            src={embedUrl}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-surface-200 bg-surface-100 p-8 text-center dark:border-primary-300/15 dark:bg-white/5">
          <VideoOff size={28} className="text-surface-400 dark:text-surface-500" />
          <p className="text-sm text-surface-600 dark:text-surface-300">
            Não foi possível carregar o player incorporado para este vídeo.
          </p>
        </div>
      )}
      <a
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline dark:text-primary-300"
      >
        <ExternalLink size={14} />
        Assistir no YouTube
      </a>
    </div>
  );
}
