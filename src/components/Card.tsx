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
        backdrop-blur-sm dark:border-white/10 dark:bg-surface-900/70 dark:shadow-black/20
        ${hover ? 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md hover:shadow-primary-900/10 dark:hover:border-primary-700/60' : ''}
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
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-100 bg-primary-50 text-primary-600 dark:border-primary-900/50 dark:bg-primary-950/40 dark:text-primary-300">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-surface-950 dark:text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs leading-5 text-surface-500 dark:text-surface-400">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 pb-5 ${className}`}>{children}</div>;
}
