import { Briefcase } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../Card';
import type { JobTargetStatus } from '../../types/englishInterview';

interface PipelineStage {
  key: string;
  label: string;
  count: number;
  dotClassName: string;
  segmentClassName: string;
}

interface JobPipelinePanelProps {
  byStatus: Partial<Record<JobTargetStatus, number>>;
  activeCount: number;
}

export function JobPipelinePanel({ byStatus, activeCount }: JobPipelinePanelProps) {
  const stages: PipelineStage[] = [
    {
      key: 'preparacao',
      label: 'Em preparação',
      count: (byStatus.researching ?? 0) + (byStatus.to_apply ?? 0),
      dotClassName: 'bg-surface-400 dark:bg-surface-500',
      segmentClassName: 'bg-surface-400 dark:bg-surface-500',
    },
    {
      key: 'applied',
      label: 'Aplicado',
      count: byStatus.applied ?? 0,
      dotClassName: 'bg-primary-500',
      segmentClassName: 'bg-primary-500',
    },
    {
      key: 'interview',
      label: 'Entrevista',
      count: byStatus.interview ?? 0,
      dotClassName: 'bg-warning-500',
      segmentClassName: 'bg-warning-500',
    },
    {
      key: 'offer',
      label: 'Oferta',
      count: byStatus.offer ?? 0,
      dotClassName: 'bg-success-500',
      segmentClassName: 'bg-success-500',
    },
  ];

  const totalNoFunil = stages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <Card>
      <CardHeader
        title="Pipeline de candidaturas"
        subtitle={`${activeCount} vaga${activeCount !== 1 ? 's' : ''} ativa${activeCount !== 1 ? 's' : ''} nos EUA`}
        icon={<Briefcase size={18} />}
      />
      <CardBody className="space-y-4">
        <div className="flex h-2.5 overflow-hidden rounded-full border border-surface-200/70 bg-surface-100 dark:border-white/[0.08] dark:bg-white/[0.05]">
          {totalNoFunil > 0 ? (
            stages.map(stage => (
              stage.count > 0 && (
                <div
                  key={stage.key}
                  className={stage.segmentClassName}
                  style={{ width: `${(stage.count / totalNoFunil) * 100}%` }}
                />
              )
            ))
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stages.map(stage => (
            <div key={stage.key} className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
                <span className={`h-2 w-2 rounded-full ${stage.dotClassName}`} />
                {stage.label}
              </span>
              <p className="font-mono text-lg font-bold text-surface-950 dark:text-white">{stage.count}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
