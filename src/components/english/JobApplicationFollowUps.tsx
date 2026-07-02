import { CalendarClock, Flame, Send, Video } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import { JOB_TARGET_STATUS_LABELS, type JobTarget } from '../../types/englishInterview';

interface JobApplicationFollowUpsProps {
  targets: JobTarget[];
  onSelect: (targetId: string) => void;
}

function isPast(value: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function isFuture(value: string | null) {
  return Boolean(value && new Date(value).getTime() >= Date.now());
}

function formatDateTime(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function JobApplicationFollowUps({ targets, onSelect }: JobApplicationFollowUpsProps) {
  const activeTargets = targets.filter(target => target.status !== 'archived' && target.status !== 'rejected');
  const overdueFollowUps = activeTargets
    .filter(target => isPast(target.follow_up_at))
    .sort((a, b) => String(a.follow_up_at).localeCompare(String(b.follow_up_at)))
    .slice(0, 4);
  const upcomingInterviews = activeTargets
    .filter(target => isFuture(target.interview_at))
    .sort((a, b) => String(a.interview_at).localeCompare(String(b.interview_at)))
    .slice(0, 4);
  const toApply = activeTargets.filter(target => target.status === 'to_apply').slice(0, 4);
  const highPriority = activeTargets.filter(target => target.priority === 'high').slice(0, 4);

  const groups = [
    { title: 'Follow-up vencido', icon: <CalendarClock size={16} />, items: overdueFollowUps, detail: (target: JobTarget) => formatDateTime(target.follow_up_at) },
    { title: 'Entrevista futura', icon: <Video size={16} />, items: upcomingInterviews, detail: (target: JobTarget) => formatDateTime(target.interview_at) },
    { title: 'Para aplicar', icon: <Send size={16} />, items: toApply, detail: (target: JobTarget) => target.next_action || JOB_TARGET_STATUS_LABELS[target.status] },
    { title: 'Alta prioridade', icon: <Flame size={16} />, items: highPriority, detail: (target: JobTarget) => target.next_action || JOB_TARGET_STATUS_LABELS[target.status] },
  ];

  return (
    <Card>
      <CardHeader title="Próximas ações" subtitle="Itens que merecem atenção no funil de candidatura." icon={<CalendarClock size={18} />} />
      <CardBody className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {groups.map(group => (
            <div key={group.title} className="min-h-[150px] rounded-lg border border-surface-200 bg-white/70 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/10 text-primary-700 dark:text-primary-200">
                  {group.icon}
                </span>
                {group.title}
              </div>
              {group.items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-surface-200 bg-surface-50/70 px-3 py-5 text-center dark:border-primary-300/10 dark:bg-white/[0.02]">
                  <p className="text-xs text-surface-500 dark:text-surface-400">Nada pendente</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {group.items.map(target => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => onSelect(target.id)}
                      className="w-full rounded-lg bg-surface-50 px-3 py-2.5 text-left transition-colors hover:bg-surface-100 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <p className="text-xs font-semibold leading-5 text-surface-900 dark:text-white">{target.title}</p>
                      <p className="mt-0.5 text-[11px] leading-4 text-surface-500 dark:text-surface-400">{group.detail(target)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
