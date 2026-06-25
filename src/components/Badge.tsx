interface BadgeProps {
  children: string;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'primary';
}

const badgeVariants = {
  default: 'bg-surface-100 text-surface-700 dark:bg-white/10 dark:text-surface-200',
  success: 'bg-success-50 text-success-700 ring-1 ring-success-100 dark:bg-success-500/10 dark:text-success-300 dark:ring-success-500/20',
  warning: 'bg-warning-50 text-warning-600 ring-1 ring-warning-100 dark:bg-warning-500/10 dark:text-warning-300 dark:ring-warning-500/20',
  danger: 'bg-danger-50 text-danger-700 ring-1 ring-danger-100 dark:bg-danger-500/10 dark:text-danger-300 dark:ring-danger-500/20',
  primary: 'bg-primary-50 text-primary-700 ring-1 ring-primary-100 dark:bg-primary-500/10 dark:text-primary-300 dark:ring-primary-500/20',
};

export function Badge({ children, className = '', variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  );
}

interface ProgressBarProps {
  value: number; // 0-100
  color?: 'primary' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  height?: 'sm' | 'md';
}

const progressColors = {
  primary: 'bg-primary-600',
  success: 'bg-success-600',
  warning: 'bg-warning-500',
  danger: 'bg-danger-600',
};

export function ProgressBar({ value, color = 'primary', showLabel = false, height = 'sm' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const colorClass = value >= 75 ? progressColors.success : value >= 40 ? progressColors.primary : progressColors.warning;

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 overflow-hidden rounded-full bg-surface-200/80 dark:bg-white/10 ${height === 'sm' ? 'h-1.5' : 'h-2.5'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${color === 'primary' ? colorClass : progressColors[color]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-surface-500 dark:text-surface-400 w-10 shrink-0 text-right">{Math.round(clamped)}%</span>
      )}
    </div>
  );
}
