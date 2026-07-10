import type { ReactNode } from 'react';
import { Card, CardBody } from '../Card';

export interface EvolutionStatRow {
  label: string;
  value: string;
}

export type EvolutionStatIconVariant = 'copper' | 'blue' | 'purple' | 'success' | 'warning';
export type EvolutionStatDeltaTone = 'up' | 'down' | 'flat';

const ICON_VARIANT_CLASSES: Record<EvolutionStatIconVariant, string> = {
  copper: 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300',
  blue: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  purple: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300',
};

const DELTA_TONE_CLASSES: Record<EvolutionStatDeltaTone, string> = {
  up: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300',
  down: 'bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-300',
  flat: 'bg-surface-100 text-surface-500 dark:bg-white/10 dark:text-surface-400',
};

interface EvolutionStatCardProps {
  title: string;
  icon: ReactNode;
  iconVariant: EvolutionStatIconVariant;
  value: string;
  caption: string;
  delta?: { label: string; tone: EvolutionStatDeltaTone };
  rows?: EvolutionStatRow[];
  children?: ReactNode;
}

export function EvolutionStatCard({ title, icon, iconVariant, value, caption, delta, rows = [], children }: EvolutionStatCardProps) {
  return (
    <Card>
      <CardBody className="space-y-3 pt-4">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${ICON_VARIANT_CLASSES[iconVariant]}`}>
            {icon}
          </div>
          <p className="text-sm font-semibold text-surface-600 dark:text-surface-300">{title}</p>
        </div>

        <div className="flex items-baseline gap-2">
          <p className="font-mono text-3xl font-bold tracking-tight text-surface-950 dark:text-white">{value}</p>
          {delta && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${DELTA_TONE_CLASSES[delta.tone]}`}>
              {delta.label}
            </span>
          )}
        </div>
        <p className="-mt-2 text-sm text-surface-500 dark:text-surface-400">{caption}</p>

        {rows.length > 0 && (
          <dl className="space-y-1.5 border-t border-surface-200/70 pt-3 dark:border-white/[0.08]">
            {rows.map(row => (
              <div key={row.label} className="flex items-baseline justify-between gap-2">
                <dt className="text-xs text-surface-500 dark:text-surface-400">{row.label}</dt>
                <dd className="font-mono text-sm font-semibold text-surface-800 dark:text-surface-100">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {children}
      </CardBody>
    </Card>
  );
}
