interface BadgeProps {
  children: string;
  className?: string;
}

export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
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
      <div className={`flex-1 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden ${height === 'sm' ? 'h-1.5' : 'h-2.5'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${color === 'primary' ? colorClass : progressColors[color]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-surface-500 dark:text-surface-400 w-8 text-right">{clamped}%</span>
      )}
    </div>
  );
}
