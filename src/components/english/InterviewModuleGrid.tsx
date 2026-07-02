import { BookOpen, Briefcase, ClipboardList, Headphones, MessageSquareText } from 'lucide-react';
import { Card, CardBody } from '../Card';

const modules = [
  { title: 'Listening setorial', subtitle: 'Podcasts e vídeos do setor elétrico', icon: Headphones },
  { title: 'Glossário técnico 200', subtitle: 'SRS Leitner para vocabulário de entrevista', icon: BookOpen },
  { title: 'Banco de entrevista', subtitle: '40 perguntas técnicas, perfil e STAR', icon: ClipboardList },
  { title: 'Log de mock interviews', subtitle: 'Histórico mensal com professor', icon: MessageSquareText },
  { title: 'Vocabulário das vagas', subtitle: 'Termos novos de job postings', icon: Briefcase },
];

export function InterviewModuleGrid() {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-surface-950 dark:text-white">Biblioteca de módulos</h2>
        <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">A Fase 1 ativa listening, glossário, sessão diária e pergunta do dia.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {modules.map(module => {
          const Icon = module.icon;
          return (
            <Card key={module.title} hover>
              <CardBody className="p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500/10 text-primary-700 dark:text-primary-200">
                  <Icon size={18} />
                </div>
                <p className="text-sm font-semibold text-surface-950 dark:text-white">{module.title}</p>
                <p className="mt-1 text-xs leading-5 text-surface-500 dark:text-surface-400">{module.subtitle}</p>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
