import { BookOpen, Headphones, MessageSquare, Mic, RefreshCw, Languages } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/Card';

const blocos = [
  { titulo: 'Vocabulário', icon: BookOpen },
  { titulo: 'Listening', icon: Headphones },
  { titulo: 'Speaking', icon: Mic },
  { titulo: 'Frases úteis', icon: MessageSquare },
  { titulo: 'Revisões', icon: RefreshCw },
];

export function InglesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Inglês</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Área para organizar estudos de inglês dentro do app.
        </p>
      </div>

      <Card>
        <CardHeader title="Base de estudos" icon={<Languages size={18} />} />
        <CardBody>
          <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
            Esta área será usada futuramente para organizar vocabulário, listening, speaking, frases úteis e revisões de inglês.
          </p>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {blocos.map(({ titulo, icon: Icon }) => (
          <Card key={titulo}>
            <CardBody className="pt-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <Icon size={18} />
                </div>
                <p className="text-sm font-semibold text-surface-900 dark:text-white">{titulo}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
