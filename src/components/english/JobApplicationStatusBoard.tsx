import { JOB_TARGET_PRIORITY_LABELS, JOB_TARGET_STATUS_LABELS, type JobTarget, type JobTargetStatus } from '../../types/englishInterview';

interface JobApplicationStatusBoardProps {
  targets: JobTarget[];
  onSelect: (targetId: string) => void;
}

const BOARD_STATUSES: JobTargetStatus[] = ['researching', 'to_apply', 'applied', 'interview', 'offer', 'rejected', 'archived'];

function formatShortDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function JobApplicationStatusBoard({ targets, onSelect }: JobApplicationStatusBoardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {BOARD_STATUSES.map(status => {
        const items = targets.filter(target => target.status === status);
        return (
          <div key={status} className="min-h-[180px] rounded-lg border border-surface-200 bg-white/65 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-surface-800 dark:text-surface-100">{JOB_TARGET_STATUS_LABELS[status]}</p>
              <span className="rounded-lg bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-600 dark:bg-white/10 dark:text-surface-300">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-surface-200 bg-surface-50/70 px-3 py-6 text-center dark:border-primary-300/10 dark:bg-white/[0.02]">
                <p className="text-xs text-surface-400 dark:text-surface-500">Sem vagas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map(target => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => onSelect(target.id)}
                    className="w-full rounded-lg border border-surface-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/50 dark:border-primary-300/10 dark:bg-white/[0.04] dark:hover:bg-white/10"
                  >
                    <p className="text-sm font-semibold leading-5 text-surface-950 dark:text-white">{target.title}</p>
                    <p className="mt-1 text-xs leading-5 text-surface-500 dark:text-surface-400">{target.company || 'Sem empresa'}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {target.priority && (
                        <span className="rounded-md bg-warning-100 px-2 py-0.5 text-[11px] font-semibold text-warning-700 dark:bg-warning-500/15 dark:text-warning-300">
                          {JOB_TARGET_PRIORITY_LABELS[target.priority]}
                        </span>
                      )}
                      {formatShortDate(target.follow_up_at) && (
                        <span className="rounded-md bg-primary-500/10 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:text-primary-200">
                          FU {formatShortDate(target.follow_up_at)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
