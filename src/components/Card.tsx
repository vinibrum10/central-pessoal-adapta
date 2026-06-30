import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className = '', onClick, hover = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-lg border border-surface-200/80 bg-white/90 shadow-sm shadow-surface-200/50
        backdrop-blur-sm dark:border-primary-300/15 dark:bg-surface-950/55 dark:shadow-black/25
        mobile-card
        ${hover ? 'glow-copper-hover cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md hover:shadow-primary-900/10 dark:hover:border-primary-300/35 dark:hover:bg-surface-900/75' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, subtitle, action, icon }: CardHeaderProps) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-100 bg-primary-50 text-primary-600 dark:border-primary-300/20 dark:bg-primary-500/10 dark:text-primary-200">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="mobile-text text-sm font-semibold text-surface-950 dark:text-white">{title}</h3>
          {subtitle && <p className="mobile-text mt-0.5 text-xs leading-5 text-surface-500 dark:text-surface-400">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="action-row-responsive flex-shrink-0 sm:justify-end">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 max-w-full overflow-hidden px-4 pb-4 sm:px-5 sm:pb-5 ${className}`}>{children}</div>;
}
