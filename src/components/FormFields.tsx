import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';

interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
}

// Input
interface InputProps extends FieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
}

export function Input({ label, error, required, hint, id, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-surface-700 dark:text-surface-300">
        {label} {required && <span className="text-danger-500">*</span>}
      </label>
      <input
        id={id}
        {...props}
        className={`
          w-full px-3 py-2 rounded-lg border text-sm
          bg-white dark:bg-surface-900
          border-surface-300 dark:border-surface-600
          text-surface-900 dark:text-white
          placeholder:text-surface-400 dark:placeholder:text-surface-500
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
          ${error ? 'border-danger-500 focus:ring-danger-500' : ''}
          ${className}
        `}
      />
      {hint && !error && <p className="text-xs text-surface-400 dark:text-surface-500">{hint}</p>}
      {error && <p className="text-xs text-danger-600 dark:text-danger-400">{error}</p>}
    </div>
  );
}

// Textarea
interface TextareaProps extends FieldProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id: string;
}

export function Textarea({ label, error, required, hint, id, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-surface-700 dark:text-surface-300">
        {label} {required && <span className="text-danger-500">*</span>}
      </label>
      <textarea
        id={id}
        rows={3}
        {...props}
        className={`
          w-full px-3 py-2 rounded-lg border text-sm resize-none
          bg-white dark:bg-surface-900
          border-surface-300 dark:border-surface-600
          text-surface-900 dark:text-white
          placeholder:text-surface-400 dark:placeholder:text-surface-500
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          transition-colors
          ${error ? 'border-danger-500' : ''}
          ${className}
        `}
      />
      {hint && !error && <p className="text-xs text-surface-400 dark:text-surface-500">{hint}</p>}
      {error && <p className="text-xs text-danger-600 dark:text-danger-400">{error}</p>}
    </div>
  );
}

// Select
interface SelectProps extends FieldProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  children: ReactNode;
}

export function Select({ label, error, required, hint, id, className = '', children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-surface-700 dark:text-surface-300">
        {label} {required && <span className="text-danger-500">*</span>}
      </label>
      <select
        id={id}
        {...props}
        className={`
          w-full px-3 py-2 rounded-lg border text-sm
          bg-white dark:bg-surface-900
          border-surface-300 dark:border-surface-600
          text-surface-900 dark:text-white
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          transition-colors
          ${error ? 'border-danger-500' : ''}
          ${className}
        `}
      >
        {children}
      </select>
      {hint && !error && <p className="text-xs text-surface-400 dark:text-surface-500">{hint}</p>}
      {error && <p className="text-xs text-danger-600 dark:text-danger-400">{error}</p>}
    </div>
  );
}

// Checkbox
interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  id: string;
  label: string;
}

export function Checkbox({ id, label, className = '', ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className={`flex items-center gap-2.5 cursor-pointer ${className}`}>
      <input
        type="checkbox"
        id={id}
        {...props}
        className="w-4 h-4 rounded border-surface-300 dark:border-surface-600 text-primary-600 focus:ring-primary-500"
      />
      <span className="text-sm text-surface-700 dark:text-surface-300">{label}</span>
    </label>
  );
}
