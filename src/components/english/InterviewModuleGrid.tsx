import { BookOpen, Briefcase, ClipboardList, Headphones, MessageSquareText } from 'lucide-react';
import { Card, CardBody } from '../Card';

export type InterviewModuleShortcut = 'listening' | 'glossary' | 'questions' | 'mock' | 'jobsVocabulary';

const modules = [
  { title: 'Listening setorial', subtitle: 'Podcasts e vídeos do setor elétrico', icon: Headphones, shortcut: 'listening' },
  { title: 'Glossário técnico 200', subtitle: 'SRS Leitner para vocabulário de entrevista', icon: BookOpen, shortcut: 'glossary' },
  { title: 'Banco de entrevista', subtitle: '40 perguntas técnicas, perfil e STAR', icon: ClipboardList, shortcut: 'questions' },
  { title: 'Log de mock interviews', subtitle: 'Histórico mensal com professor', icon: MessageSquareText, shortcut: 'mock' },
  { title: 'Vocabulário das vagas', subtitle: 'Termos novos de job postings', icon: Briefcase, shortcut: 'jobsVocabulary' },
];

interface InterviewModuleGridProps {
  onShortcut: (shortcut: InterviewModuleShortcut) => void;
}

export function InterviewModuleGrid({ onShortcut }: InterviewModuleGridProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-surface-950 dark:text-white">Biblioteca de módulos</h2>
        <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">Use os atalhos para ir direto ao bloco de estudo.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {modules.map(module => {
          const Icon = module.icon;
          return (
            <button
              key={module.title}
              type="button"
              onClick={() => onShortcut(module.shortcut as InterviewModuleShortcut)}
              className="group block h-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-950"
            >
              <Card hover className="h-full">
                <CardBody className="p-4">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500/10 text-primary-700 transition-colors group-hover:bg-primary-600 group-hover:text-white dark:text-primary-200">
                    <Icon size={18} />
                  </div>
                  <p className="text-sm font-semibold text-surface-950 dark:text-white">{module.title}</p>
                  <p className="mt-1 text-xs leading-5 text-surface-500 dark:text-surface-400">{module.subtitle}</p>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-primary-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-primary-200">
                    Abrir seção
                  </p>
                </CardBody>
              </Card>
            </button>
          );
        })}
      </div>
    </section>
  );
}
