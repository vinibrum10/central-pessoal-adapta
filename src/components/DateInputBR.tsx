import { useRef, type InputHTMLAttributes } from 'react';
import { Calendar } from 'lucide-react';
import { dataBRParaISO, isoParaDataBR } from '../utils';

interface DateInputBRProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'value' | 'onChange'> {
  id: string;
  label: string;
  value: string; // yyyy-MM-dd ou ''
  onChange: (iso: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
}

export function DateInputBR({ id, label, value, onChange, required, error, hint, className = '', ...props }: DateInputBRProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isoValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : dataBRParaISO(value);
  const display = isoValue ? isoParaDataBR(isoValue) : value || '';

  const abrirCalendario = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value || '');
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-surface-700 dark:text-surface-300">
        {label} {required && <span className="text-danger-500">*</span>}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={abrirCalendario}
          disabled={props.disabled}
          className={`
            w-full px-3 py-2 pr-10 rounded-lg border text-sm text-left
            bg-white dark:bg-surface-900
            border-surface-300 dark:border-surface-600
            text-surface-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors
            ${error ? 'border-danger-500 focus:ring-danger-500' : ''}
            ${className}
          `}
        >
          <span className={display ? '' : 'text-surface-400 dark:text-surface-500'}>
            {display || 'dd/mm/aaaa'}
          </span>
        </button>
        <Calendar size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={isoValue}
          onChange={handleChange}
          {...props}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </div>
      {hint && !error && <p className="text-xs text-surface-400 dark:text-surface-500">{hint}</p>}
      {error && <p className="text-xs text-danger-600 dark:text-danger-400">{error}</p>}
    </div>
  );
}
