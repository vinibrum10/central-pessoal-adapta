import { Archive, Briefcase, CalendarClock, CheckCircle2, Send, Trophy, Video, XCircle } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import type { JobTarget } from '../../types/englishInterview';
import { JobApplicationFollowUps } from './JobApplicationFollowUps';
import { JobApplicationStatusBoard } from './JobApplicationStatusBoard';

interface JobApplicationTrackerProps {
  targets: JobTarget[];
  onSelect: (targetId: string) => void;
}

function isFollowUpPending(target: JobTarget) {
  if (!target.follow_up_at) return false;
  if (target.status === 'archived' || target.status === 'rejected') return false;
  return new Date(target.follow_up_at).getTime() <= Date.now();
}

export function JobApplicationTracker({ targets, onSelect }: JobApplicationTrackerProps) {
  const counters = [
    { label: 'Total', value: targets.length, icon: <Briefcase size={16} /> },
    { label: 'Para aplicar', value: targets.filter(target => target.status === 'to_apply').length, icon: <Send size={16} /> },
    { label: 'Aplicadas', value: targets.filter(target => target.status === 'applied').length, icon: <CheckCircle2 size={16} /> },
    { label: 'Entrevistas', value: targets.filter(target => target.status === 'interview').length, icon: <Video size={16} /> },
    { label: 'Ofertas', value: targets.filter(target => target.status === 'offer').length, icon: <Trophy size={16} /> },
    { label: 'Rejeitadas', value: targets.filter(target => target.status === 'rejected').length, icon: <XCircle size={16} /> },
    { label: 'Arquivadas', value: targets.filter(target => target.status === 'archived').length, icon: <Archive size={16} /> },
    { label: 'Follow-ups', value: targets.filter(isFollowUpPending).length, icon: <CalendarClock size={16} /> },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Controle de candidaturas" subtitle="Funil manual das vagas dos EUA." icon={<Briefcase size={18} />} />
        <CardBody className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {counters.map(counter => (
              <div
                key={counter.label}
                className="flex min-h-[104px] items-center justify-between gap-4 rounded-lg border border-surface-200 bg-white/75 p-4 dark:border-primary-300/15 dark:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{counter.label}</p>
                  <p className="mt-2 text-3xl font-bold leading-none text-surface-950 dark:text-white">{counter.value}</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-700 dark:text-primary-200">
                  {counter.icon}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-surface-950 dark:text-white">Pipeline</h3>
              <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">Vagas agrupadas pelo estágio atual da candidatura.</p>
            </div>
            <JobApplicationStatusBoard targets={targets} onSelect={onSelect} />
          </div>
        </CardBody>
      </Card>

      <JobApplicationFollowUps targets={targets} onSelect={onSelect} />
    </div>
  );
}
