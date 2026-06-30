import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const mouseDownStartedOnBackdrop = useRef(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden p-4 animate-fade-in"
      onMouseDown={(e) => {
        mouseDownStartedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (mouseDownStartedOnBackdrop.current && e.target === e.currentTarget) {
          onClose();
        }
        mouseDownStartedOnBackdrop.current = false;
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-surface-950/70 sm:backdrop-blur-md" />
      <div className={`relative flex max-h-[90vh] w-[calc(100vw-32px)] max-w-full ${sizeMap[size]} animate-scale-in flex-col overflow-hidden rounded-lg border border-surface-200 bg-white shadow-2xl shadow-black/20 dark:border-white/10 dark:bg-surface-900`}>
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-surface-200 px-4 py-4 dark:border-white/10 sm:px-5">
          <h2 className="mobile-text text-sm font-semibold text-surface-950 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700 dark:hover:bg-white/10 dark:hover:text-surface-100"
          >
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="mobile-safe flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
