import { ExternalLink, Headphones, Link as LinkIcon } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import { Button } from '../Button';
import type { EnglishInterviewLevel, ListeningEpisode } from '../../types/englishInterview';
import { INTERVIEW_LEVEL_LABELS, INTERVIEW_THEME_LABELS } from '../../types/englishInterview';

interface SectorListeningPanelProps {
  episode: ListeningEpisode | null;
  theme: string;
  level: EnglishInterviewLevel | 'all';
  manualUrl: string;
  manualEmbedUrl: string | null;
  onThemeChange: (theme: string) => void;
  onLevelChange: (level: EnglishInterviewLevel | 'all') => void;
  onManualUrlChange: (url: string) => void;
}

const themes = ['all', 'substations', 'protection', 'outages', 'interconnection', 'safety', 'data-ami'];
const levels: Array<EnglishInterviewLevel | 'all'> = ['all', 'basic', 'intermediate', 'advanced', 'fluent'];

function formatDuration(seconds: number | null) {
  if (!seconds) return 'Duração não informada';
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export function SectorListeningPanel({
  episode,
  theme,
  level,
  manualUrl,
  manualEmbedUrl,
  onThemeChange,
  onLevelChange,
  onManualUrlChange,
}: SectorListeningPanelProps) {
  const embedUrl = manualEmbedUrl ?? (episode?.url.includes('youtube.com') || episode?.url.includes('youtu.be') ? episode.url : null);

  return (
    <Card>
      <CardHeader
        title="Listening setorial"
        subtitle="Conteúdo sobre setor elétrico americano, com link manual como alternativa."
        icon={<Headphones size={18} />}
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Tema técnico</p>
            <div className="flex flex-wrap gap-2">
              {themes.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onThemeChange(item)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    theme === item
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-white/10 dark:text-surface-300 dark:hover:bg-white/15'
                  }`}
                >
                  {item === 'all' ? 'Todos' : INTERVIEW_THEME_LABELS[item] ?? item}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Nível</p>
            <div className="flex flex-wrap gap-2">
              {levels.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onLevelChange(item)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    level === item
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-white/10 dark:text-surface-300 dark:hover:bg-white/15'
                  }`}
                >
                  {item === 'all' ? 'Todos' : INTERVIEW_LEVEL_LABELS[item]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-surface-200 bg-white/70 p-3 dark:border-primary-300/15 dark:bg-white/[0.03]">
          <p className="text-sm font-semibold text-surface-950 dark:text-white">{episode?.title ?? 'Nenhum episódio setorial selecionado'}</p>
          <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
            {episode?.listening_sources?.name ?? 'Biblioteca'} · {formatDuration(episode?.duration_sec ?? null)}
          </p>
          {episode && (
            <div className="mt-2 flex flex-wrap gap-2">
              {episode.themes.map(item => (
                <span key={item} className="rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-medium text-primary-700 dark:text-primary-200">
                  {INTERVIEW_THEME_LABELS[item] ?? item}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="manual-listening-url" className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
            Cole um link do YouTube
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <LinkIcon size={15} className="absolute left-3 top-2.5 text-surface-400" />
              <input
                id="manual-listening-url"
                value={manualUrl}
                onChange={event => onManualUrlChange(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-lg border border-surface-200 bg-white px-9 py-2 text-sm text-surface-900 outline-none transition focus:border-primary-400 dark:border-primary-300/15 dark:bg-surface-900 dark:text-white"
              />
            </div>
            {(manualUrl || episode?.url) && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<ExternalLink size={15} />}
                onClick={() => window.open(manualUrl || episode?.url, '_blank', 'noopener,noreferrer')}
              >
                Abrir
              </Button>
            )}
          </div>
        </div>

        {manualEmbedUrl && (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <iframe
              key={manualEmbedUrl}
              src={manualEmbedUrl}
              className="h-full w-full"
              title="Listening manual"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {!manualEmbedUrl && embedUrl && episode?.url.includes('youtube') && (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <iframe
              key={episode.url}
              src={episode.url.replace('watch?v=', 'embed/')}
              className="h-full w-full"
              title="Listening setorial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
