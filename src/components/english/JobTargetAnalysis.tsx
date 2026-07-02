import { Award, CalendarDays, Sparkles } from 'lucide-react';
import type { JobTargetAnalysis as JobTargetAnalysisData } from '../../types/englishInterview';

interface JobTargetAnalysisProps {
  analysis: JobTargetAnalysisData;
}

function ChipList({ title, items, comingSoonAction }: { title: string; items: string[]; comingSoonAction?: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{title}</p>
        {comingSoonAction && (
          <span className="rounded-lg bg-surface-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface-400 dark:bg-white/10 dark:text-surface-500">
            {comingSoonAction} · em breve
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span key={item} className="rounded-lg bg-white/70 px-2 py-1 text-xs font-medium text-surface-700 dark:bg-white/10 dark:text-surface-200">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function BulletList({ title, items, comingSoonAction }: { title: string; items: string[]; comingSoonAction?: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{title}</p>
        {comingSoonAction && (
          <span className="rounded-lg bg-surface-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface-400 dark:bg-white/10 dark:text-surface-500">
            {comingSoonAction} · em breve
          </span>
        )}
      </div>
      <ul className="space-y-1 text-sm leading-6 text-surface-700 dark:text-surface-200">
        {items.map((item, index) => <li key={`${title}-${index}`}>• {item}</li>)}
      </ul>
    </div>
  );
}

export function JobTargetAnalysis({ analysis }: JobTargetAnalysisProps) {
  return (
    <div className="space-y-4 rounded-lg border border-primary-300/20 bg-primary-500/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles size={16} className="text-primary-600 dark:text-primary-200" />
        <span className="text-sm font-semibold text-surface-950 dark:text-white">Análise da vaga com IA</span>
        <span className="rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-primary-700 dark:bg-white/10 dark:text-primary-200">
          Match: {analysis.match_score}/10
        </span>
        <span className="rounded-lg bg-white/70 px-2 py-1 text-xs font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">
          {analysis.role_type}
        </span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Resumo da vaga</p>
        <p className="mt-1 text-sm leading-6 text-surface-700 dark:text-surface-200">{analysis.summary_pt}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChipList title="Habilidades obrigatórias" items={analysis.required_skills} />
        <ChipList title="Habilidades desejáveis" items={analysis.preferred_skills} />
        <ChipList title="Palavras técnicas" items={analysis.technical_keywords} />
        <ChipList title="Vocabulário para estudar" items={analysis.missing_vocabulary} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BulletList title="Pontos fortes" items={analysis.strengths_pt} />
        <BulletList title="Lacunas a treinar" items={analysis.gaps_pt} />
      </div>

      <BulletList title="Perguntas prováveis de entrevista" items={analysis.likely_interview_questions} />
      <BulletList title="Sugestões de respostas STAR" items={analysis.star_story_suggestions} />

      <div className="rounded-lg bg-white/70 p-3 dark:bg-white/10">
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
          <CalendarDays size={12} /> Plano de 7 dias
        </p>
        <ol className="mt-2 space-y-1 text-sm leading-6 text-surface-700 dark:text-surface-200">
          {analysis.study_plan_7_days_pt.map((item, index) => (
            <li key={`day-${index}`}>
              <span className="font-semibold text-surface-900 dark:text-white">Dia {index + 1}:</span> {item.replace(/^dia\s*\d+\s*[:.\-—]?\s*/i, '')}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-lg bg-white/70 p-3 dark:bg-white/10">
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
          <Award size={12} /> Foco recomendado para o próximo mock
        </p>
        <p className="mt-1 text-sm leading-6 text-surface-700 dark:text-surface-200">{analysis.recommended_mock_focus}</p>
      </div>
    </div>
  );
}
