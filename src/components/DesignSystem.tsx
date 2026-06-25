import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardBody } from './Card';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, eyebrow, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-300">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-surface-950 dark:text-white sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-surface-500 dark:text-surface-400">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex flex-wrap gap-2 sm:justify-end">{action}</div>}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-surface-950 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const toneClass = {
    primary: 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300',
    success: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300',
    warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-300',
    danger: 'bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-300',
    neutral: 'bg-surface-100 text-surface-700 dark:bg-white/10 dark:text-surface-200',
  }[tone];

  return (
    <Card>
      <CardBody className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-surface-950 dark:text-white">{value}</p>
            {hint && <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">{hint}</p>}
          </div>
          {icon && <div className={`rounded-lg p-2 ${toneClass}`}>{icon}</div>}
        </div>
      </CardBody>
    </Card>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-surface-300 bg-white/50 p-6 text-center dark:border-surface-700 dark:bg-white/5">
      <p className="text-sm font-semibold text-surface-900 dark:text-white">{title}</p>
      {description && <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}
