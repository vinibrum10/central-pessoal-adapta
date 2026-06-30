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
  primary: 'bg-primary-600 hover:bg-primary-500 text-white shadow-sm shadow-primary-700/25 dark:text-surface-950 dark:shadow-primary-500/20',
  secondary: 'bg-white hover:bg-surface-50 text-surface-700 border border-surface-200 shadow-sm dark:bg-white/[0.07] dark:hover:bg-white/[0.12] dark:border-primary-300/20 dark:text-surface-200',
  danger: 'bg-danger-600 hover:bg-danger-700 text-white shadow-sm shadow-danger-600/20',
  ghost: 'bg-transparent hover:bg-surface-100 text-surface-600 dark:hover:bg-primary-300/10 dark:text-surface-300',
  success: 'bg-success-600 hover:bg-success-700 text-white shadow-sm shadow-success-600/20',
};

const sizeStyles = {
  sm: 'px-3 py-2 text-xs gap-1.5 min-h-9',
  md: 'px-4 py-2.5 text-sm gap-2 min-h-10',
  lg: 'px-5 py-3 text-sm gap-2.5 min-h-11',
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
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    onMouseLeave?.(e);
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        inline-flex min-w-0 max-w-full items-center justify-center whitespace-normal text-center font-semibold rounded-lg
        transition-all duration-200 focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-900
        disabled:opacity-50 disabled:cursor-not-allowed
        active:scale-[0.98]
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
