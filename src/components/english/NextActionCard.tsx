import { Compass } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';

interface NextActionCardProps {
  nextAction: string;
}

export function NextActionCard({ nextAction }: NextActionCardProps) {
  return (
    <Card>
      <CardHeader
        title="Próxima ação recomendada"
        subtitle="Sugestão baseada no seu progresso atual."
        icon={<Compass size={18} />}
      />
      <CardBody>
        <p className="text-base font-semibold leading-7 text-primary-700 dark:text-primary-200">{nextAction}</p>
      </CardBody>
    </Card>
  );
}
