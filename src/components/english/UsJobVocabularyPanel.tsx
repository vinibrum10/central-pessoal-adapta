import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Briefcase, CheckCircle2, Loader2, RotateCcw, Search, Star } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import { Button } from '../Button';
import type { EmployabilityTermStatus, UsJobVocabularyTerm } from '../../types/englishInterview';
import {
  listUsJobVocabularyCategories,
  listUsJobVocabularyTerms,
  setUsJobVocabularyStatus,
} from '../../services/english/employabilityRepository';

interface UsJobVocabularyPanelProps {
  userId: string;
}

const statusLabels: Record<EmployabilityTermStatus, string> = {
  domino: 'Domino',
  revisar: 'Revisar',
  nao_domino: 'Ainda não domino',
};

const statusOptions: Array<{ value: EmployabilityTermStatus; label: string }> = [
  { value: 'domino', label: 'Domino' },
  { value: 'revisar', label: 'Revisar' },
  { value: 'nao_domino', label: 'Ainda não domino' },
];

function statusClasses(status: EmployabilityTermStatus) {
  if (status === 'domino') return 'bg-success-500/10 text-success-700 dark:text-success-300';
  if (status === 'revisar') return 'bg-warning-500/10 text-warning-700 dark:text-warning-300';
  return 'bg-surface-100 text-surface-600 dark:bg-white/10 dark:text-surface-300';
}

function statusButtonClasses(status: EmployabilityTermStatus, active: boolean) {
  if (!active) {
    return 'border-surface-200 bg-white text-surface-600 hover:border-primary-300 hover:bg-surface-50 dark:border-primary-300/15 dark:bg-white/[0.04] dark:text-surface-300 dark:hover:bg-white/10';
  }
  if (status === 'domino') {
    return 'border-success-500 bg-success-600 text-white shadow-sm shadow-success-600/20';
  }
  if (status === 'revisar') {
    return 'border-warning-500 bg-warning-500 text-white shadow-sm shadow-warning-600/20';
  }
  return 'border-surface-500 bg-surface-700 text-white shadow-sm shadow-surface-900/15 dark:border-surface-300 dark:bg-surface-200 dark:text-surface-950';
}

export function UsJobVocabularyPanel({ userId }: UsJobVocabularyPanelProps) {
  const [terms, setTerms] = useState<UsJobVocabularyTerm[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingTermId, setSavingTermId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [termErrors, setTermErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextCategories, nextTerms] = await Promise.all([
        listUsJobVocabularyCategories(),
        listUsJobVocabularyTerms(category, userId),
      ]);
      setCategories(nextCategories);
      setTerms(nextTerms);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível carregar o vocabulário de vagas dos EUA.';
      console.error('[EnglishEmployability] Failed to load vocabulary', { message });
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [category, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredTerms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return terms;
    return terms.filter(item =>
      item.term.term.toLowerCase().includes(normalized)
      || item.term.translation_pt.toLowerCase().includes(normalized)
      || item.term.example_en.toLowerCase().includes(normalized),
    );
  }, [query, terms]);

  async function handleSetStatus(termId: string, status: EmployabilityTermStatus) {
    if (import.meta.env.DEV) {
      console.info('[EnglishEmployability]', 'vocabulary status clicked', {
        clickedTermId: termId,
        requestedStatus: status,
        hasUserId: Boolean(userId),
      });
    }

    setSavingTermId(termId);
    setError('');
    setTermErrors(prev => ({ ...prev, [termId]: '' }));
    const previousTerms = terms;
    setTerms(prev => prev.map(item => item.term.id === termId ? { ...item, status } : item));

    try {
      const userStatus = await setUsJobVocabularyStatus({ userId, termId, status });
      setTerms(prev => prev.map(item => item.term.id === termId ? { ...item, userStatus, status } : item));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar o status do termo.';
      console.error('[EnglishEmployability] Failed to update vocabulary status', { message });
      setTerms(previousTerms);
      setError('Não foi possível salvar o status. Veja o console.');
      setTermErrors(prev => ({ ...prev, [termId]: 'Não foi possível salvar o status. Veja o console.' }));
    } finally {
      setSavingTermId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Vocabulário EUA"
        subtitle="Termos que aparecem em vagas americanas de engenharia elétrica."
        icon={<Briefcase size={18} />}
        action={(
          <Button type="button" size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={load}>
            Atualizar
          </Button>
        )}
      />
      <CardBody className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Buscar</span>
            <div className="flex min-h-10 items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 dark:border-primary-300/15 dark:bg-white/[0.03]">
              <Search size={15} className="text-surface-400" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="SCADA, relay, transformer..."
                className="min-w-0 flex-1 bg-transparent text-sm text-surface-900 outline-none placeholder:text-surface-400 dark:text-white"
              />
            </div>
          </label>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Categoria</p>
            <div className="flex flex-wrap gap-2">
              {['all', ...categories].map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCategory(option)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    category === option
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-white/10 dark:text-surface-300 dark:hover:bg-white/15'
                  }`}
                >
                  {option === 'all' ? 'Todas' : option}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
            <Loader2 size={16} className="animate-spin" />
            Carregando vocabulário...
          </div>
        ) : filteredTerms.length === 0 ? (
          <p className="text-sm text-surface-500 dark:text-surface-400">Nenhum termo encontrado. Rode o seed da Fase 3A se a lista estiver vazia.</p>
        ) : (
          <div className="space-y-3">
            {filteredTerms.map(item => {
              const saving = savingTermId === item.term.id;
              const termError = termErrors[item.term.id];
              return (
                <div key={item.term.id} className="rounded-lg border border-surface-200 bg-white/75 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-surface-950 dark:text-white">{item.term.term}</p>
                        <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${statusClasses(item.status)}`}>
                          {statusLabels[item.status]}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-semibold text-primary-700 dark:text-primary-200">
                          <Star size={12} />
                          {item.term.importance_level ?? 3}/5
                        </span>
                        <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">
                          {item.term.category ?? item.term.theme}
                        </span>
                      </div>
                      <p className="text-sm text-surface-700 dark:text-surface-200">{item.term.translation_pt}</p>
                      <p className="text-sm leading-6 text-surface-600 dark:text-surface-300">{item.term.example_en}</p>
                      {termError && (
                        <p className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs font-semibold text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
                          {termError}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Status</p>
                      <div className="flex flex-wrap gap-2 rounded-lg border border-surface-200 bg-surface-50 p-1 dark:border-primary-300/15 dark:bg-white/[0.03]">
                        {statusOptions.map(option => {
                          const active = item.status === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              disabled={saving}
                              onClick={() => handleSetStatus(item.term.id, option.value)}
                              aria-pressed={active}
                              className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${statusButtonClasses(option.value, active)}`}
                            >
                              {active && (saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />)}
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
