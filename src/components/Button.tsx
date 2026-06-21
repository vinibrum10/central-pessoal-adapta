import React from 'react';
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantStyles = {
  primary: 'text-white shadow-sm',
  secondary: 'bg-surface-100 hover:bg-surface-200 text-surface-700 dark:bg-surface-700 dark:hover:bg-surface-600 dark:text-surface-200',
  danger: 'bg-danger-600 hover:bg-danger-700 text-white shadow-sm shadow-danger-600/20',
  ghost: 'bg-transparent hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300',
  success: 'bg-success-600 hover:bg-success-700 text-white shadow-sm shadow-success-600/20',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  style,
  onMouseEnter,
  onMouseLeave,
  ...props
}: ButtonProps) {
  const isPrimary = variant === 'primary';

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isPrimary) {
      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-primary-hover)';
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isPrimary) {
      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-primary)';
    }
    onMouseLeave?.(e);
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={isPrimary ? { backgroundColor: 'var(--color-primary)', ...style } : style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        inline-flex items-center justify-center font-medium rounded-lg
        transition-all duration-150 focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-primary-500 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
