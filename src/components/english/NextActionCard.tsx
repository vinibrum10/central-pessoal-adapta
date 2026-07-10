import { Compass } from 'lucide-react';
import { Card, CardBody } from '../Card';

interface NextActionCardProps {
  nextAction: string;
}

export function NextActionCard({ nextAction }: NextActionCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-transparent" />
      <CardBody className="relative flex items-start gap-3.5 pt-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
          <Compass size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
            Próxima ação recomendada
          </p>
          <p className="mt-1 text-base font-semibold leading-6 text-surface-950 dark:text-white">{nextAction}</p>
        </div>
      </CardBody>
    </Card>
  );
}
