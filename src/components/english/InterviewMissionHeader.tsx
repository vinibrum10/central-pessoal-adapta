import { BookOpen, CalendarDays, Mic, Trophy } from 'lucide-react';
import { PageHeader, MetricCard } from '../DesignSystem';
import type { InterviewMissionMetrics } from '../../types/englishInterview';

function daysUntilInterview() {
  const target = new Date('2026-12-31T12:00:00');
  const today = new Date();
  const diff = target.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function InterviewMissionHeader({ metrics }: { metrics: InterviewMissionMetrics }) {
  const days = daysUntilInterview();
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Estudo"
        title="Inglês — Modo Entrevista"
        subtitle="Meta: entrevista técnica de 30 min sem travar"
        action={(
          <div className="inline-flex items-center gap-2 rounded-lg border border-primary-300/25 bg-primary-500/10 px-3 py-2 text-sm font-semibold text-primary-700 dark:text-primary-200">
            <CalendarDays size={16} />
            Dez/2026 · {days} dias
          </div>
        )}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Glossário"
          value={`${metrics.masteredTerms}/${metrics.totalSeedTerms || 200}`}
          hint="termos dominados"
          icon={<BookOpen size={18} />}
        />
        <MetricCard
          label="Shadowing semana"
          value={`${metrics.shadowingThisWeek}/3`}
          hint="sessões concluídas"
          icon={<Mic size={18} />}
          tone={metrics.shadowingThisWeek >= 3 ? 'success' : 'warning'}
        />
        <MetricCard
          label="Último mock"
          value={metrics.lastMockRating == null ? '—/10' : `${metrics.lastMockRating}/10`}
          hint="mock interview mensal"
          icon={<Trophy size={18} />}
          tone="neutral"
        />
      </div>
    </div>
  );
}
