import { ClipboardList } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import type { InterviewQuestion } from '../../types/englishInterview';
import { INTERVIEW_THEME_LABELS } from '../../types/englishInterview';

interface InterviewQuestionBankProps {
  questions: InterviewQuestion[];
  selectedQuestionId: string | null;
  categoryFilter: string;
  themeFilter: string;
  onCategoryFilterChange: (value: string) => void;
  onThemeFilterChange: (value: string) => void;
  onSelectQuestion: (question: InterviewQuestion) => void;
}

const categoryLabels: Record<string, string> = {
  all: 'Todas',
  comportamental: 'Comportamental',
  tecnica: 'Técnica',
  perfil: 'Perfil',
};

export function InterviewQuestionBank({
  questions,
  selectedQuestionId,
  categoryFilter,
  themeFilter,
  onCategoryFilterChange,
  onThemeFilterChange,
  onSelectQuestion,
}: InterviewQuestionBankProps) {
  const themes = Array.from(new Set(questions.flatMap(question => question.temas_relacionados))).sort();
  const categories = ['all', ...Array.from(new Set(questions.map(question => question.category))).sort()];

  const filtered = questions.filter(question =>
    (categoryFilter === 'all' || question.category === categoryFilter)
    && (themeFilter === 'all' || question.temas_relacionados.includes(themeFilter)),
  );

  return (
    <Card>
      <CardHeader
        title="Banco de entrevista"
        subtitle={`${filtered.length}/${questions.length} perguntas`}
        icon={<ClipboardList size={18} />}
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Categoria</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => onCategoryFilterChange(category)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    categoryFilter === category
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-white/10 dark:text-surface-300 dark:hover:bg-white/15'
                  }`}
                >
                  {categoryLabels[category] ?? category}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Tema</p>
            <div className="flex flex-wrap gap-2">
              {['all', ...themes].map(theme => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => onThemeFilterChange(theme)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    themeFilter === theme
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-white/10 dark:text-surface-300 dark:hover:bg-white/15'
                  }`}
                >
                  {theme === 'all' ? 'Todos' : INTERVIEW_THEME_LABELS[theme] ?? theme}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-h-[680px] space-y-3 overflow-y-auto pr-1">
          {filtered.map(question => {
            const selected = selectedQuestionId === question.id;
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => onSelectQuestion(question)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? 'border-primary-400 bg-primary-500/10'
                    : 'border-surface-200 bg-white/70 hover:border-primary-300 dark:border-primary-300/15 dark:bg-white/[0.03] dark:hover:border-primary-300/35'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-semibold text-primary-700 dark:text-primary-200">{question.id}</span>
                  <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">{categoryLabels[question.category] ?? question.category}</span>
                  <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">{question.timer_sugerido_min} min</span>
                </div>
                <p className="text-sm font-semibold leading-6 text-surface-950 dark:text-white">{question.question_en}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {question.temas_relacionados.map(theme => (
                    <span key={theme} className="rounded-lg bg-white/70 px-2 py-0.5 text-[11px] font-medium text-surface-500 dark:bg-white/10 dark:text-surface-400">
                      {INTERVIEW_THEME_LABELS[theme] ?? theme}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
