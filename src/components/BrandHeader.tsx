import { useState, type ReactNode } from 'react';

const LOGO_SRC = '/brand/sgp-logo-tech.png';

interface BrandMarkProps {
  compact?: boolean;
  className?: string;
}

export function BrandMark({ compact = false, className = '' }: BrandMarkProps) {
  const [failed, setFailed] = useState(false);
  const sizeClass = compact ? 'h-9 w-9' : 'h-16 w-16 sm:h-20 sm:w-20';

  return (
    <div
      className={`
        relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg
        border border-primary-300/35 bg-surface-950/80 shadow-lg shadow-primary-950/25
        ring-1 ring-white/10
        ${sizeClass}
        ${className}
      `}
    >
      {failed ? (
        <span className="text-xs font-bold tracking-wide text-primary-200">SGP</span>
      ) : (
        <img
          src={LOGO_SRC}
          alt="SGP"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

interface BrandHeaderProps {
  compact?: boolean;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function BrandHeader({
  compact = false,
  title = 'Sistema de Gestão Pessoal',
  subtitle = 'Gestão integrada de rotina, estudos, agenda, orçamento e metas.',
  actions,
  className = '',
}: BrandHeaderProps) {
  const [failed, setFailed] = useState(false);

  if (compact) {
    return (
      <div className={`flex items-center justify-between gap-3 rounded-lg border border-primary-400/15 bg-surface-950/35 px-3 py-2 backdrop-blur-xl ${className}`}>
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark compact />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-white">{title}</p>
            {subtitle && <p className="truncate text-xs text-surface-400">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    );
  }

  return (
    <section
      className={`
        relative overflow-hidden rounded-lg border border-primary-300/20
        bg-surface-950/80 shadow-2xl shadow-black/30 backdrop-blur-xl
        ${className}
      `}
    >
      <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(90deg,rgba(209,150,88,0.11)_1px,transparent_1px),linear-gradient(0deg,rgba(96,165,250,0.06)_1px,transparent_1px)] [background-size:38px_38px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-300/70 to-transparent" />

      <div className="relative grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-stretch lg:p-6">
        <div className="flex min-w-0 flex-col justify-between gap-5">
          <div className="flex items-start gap-4">
            <BrandMark className="hidden sm:flex" />
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary-200/90">
                SGP
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-surface-300">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>

        <div className="relative min-h-36 overflow-hidden rounded-lg border border-white/10 bg-black/30 sm:min-h-44 lg:min-h-0">
          {failed ? (
            <div className="flex h-full min-h-36 items-center justify-center text-3xl font-bold tracking-wide text-primary-200">
              SGP
            </div>
          ) : (
            <img
              src={LOGO_SRC}
              alt="SGP - Sistema de Gestão Pessoal"
              className="h-full min-h-36 w-full object-cover sm:min-h-44"
              onError={() => setFailed(true)}
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-surface-950/20" />
        </div>
      </div>
    </section>
  );
}
