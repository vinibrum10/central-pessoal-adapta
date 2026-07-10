import type { ReactNode } from 'react';
import { Card, CardBody, CardHeader } from '../Card';

export interface MetricLine {
  label: string;
  value: string;
}

interface EvolutionMetricCardProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  highlight: string;
  highlightLabel: string;
  lines?: MetricLine[];
  children?: ReactNode;
}

export function EvolutionMetricCard({ title, subtitle, icon, highlight, highlightLabel, lines = [], children }: EvolutionMetricCardProps) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} icon={icon} />
      <CardBody className="space-y-3">
        <div>
          <p className="font-mono text-2xl font-bold tracking-tight text-surface-950 dark:text-white">{highlight}</p>
          <p className="text-xs text-surface-500 dark:text-surface-400">{highlightLabel}</p>
        </div>

        {lines.length > 0 && (
          <dl className="space-y-1.5">
            {lines.map(line => (
              <div key={line.label} className="flex items-baseline justify-between gap-2">
                <dt className="text-xs text-surface-500 dark:text-surface-400">{line.label}</dt>
                <dd className="font-mono text-sm font-semibold text-surface-800 dark:text-surface-100">{line.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {children}
      </CardBody>
    </Card>
  );
}
