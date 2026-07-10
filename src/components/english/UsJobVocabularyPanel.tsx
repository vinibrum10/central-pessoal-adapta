import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Briefcase, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  GraduationCap, List, Loader2, Repeat, RotateCcw, Search, Shuffle, Star, Volume2,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import { Button } from '../Button';
import type { EmployabilityTermStatus, UsJobVocabularyTerm } from '../../types/englishInterview';
import {
  listUsJobVocabularyCategories,
  listUsJobVocabularyTerms,
  setUsJobVocabularyStatus,
} from '../../services/english/employabilityRepository';
import { speakEnglish } from '../../utils/textToSpeech';

interface UsJobVocabularyPanelProps {
  userId: string;
}

type ViewMode = 'review' | 'list';

const LIST_PAGE_SIZE = 10;

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

  const [mode, setMode] = useState<ViewMode>('review');
  const [reviewIndex, setReviewIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

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

  // Ao mudar filtros, volta para o início da revisão e recolhe a lista
  useEffect(() => {
    setReviewIndex(0);
    setFlipped(false);
    setExpandedTermId(null);
    setVisibleCount(LIST_PAGE_SIZE);
  }, [category, query]);

  // Mantém o índice válido quando a quantidade de termos filtrados muda
  useEffect(() => {
    setReviewIndex(prev => (filteredTerms.length === 0 ? 0 : Math.min(prev, filteredTerms.length - 1)));
  }, [filteredTerms.length]);

  const summary = useMemo(() => {
    const total = filteredTerms.length;
    const domino = filteredTerms.filter(item => item.status === 'domino').length;
    const revisar = filteredTerms.filter(item => item.status === 'revisar').length;
    const naoDomino = total - domino - revisar;
    const percentual = total > 0 ? Math.round((domino / total) * 100) : 0;
    return { total, domino, revisar, naoDomino, percentual };
  }, [filteredTerms]);

  async function handleSetStatus(termId: string, status: EmployabilityTermStatus): Promise<boolean> {
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
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar o status do termo.';
      console.error('[EnglishEmployability] Failed to update vocabulary status', { message });
      setTerms(previousTerms);
      setError('Não foi possível salvar o status. Veja o console.');
      setTermErrors(prev => ({ ...prev, [termId]: 'Não foi possível salvar o status. Veja o console.' }));
      return false;
    } finally {
      setSavingTermId(null);
    }
  }

  function goToIndex(index: number) {
    setReviewIndex(index);
    setFlipped(false);
  }

  function goPrevious() {
    if (filteredTerms.length === 0) return;
    goToIndex((reviewIndex - 1 + filteredTerms.length) % filteredTerms.length);
  }

  function goNext() {
    if (filteredTerms.length === 0) return;
    goToIndex((reviewIndex + 1) % filteredTerms.length);
  }

  function goRandom() {
    if (filteredTerms.length <= 1) return;
    let next = reviewIndex;
    while (next === reviewIndex) {
      next = Math.floor(Math.random() * filteredTerms.length);
    }
    goToIndex(next);
  }

  async function handleReviewStatus(termId: string, status: EmployabilityTermStatus) {
    const saved = await handleSetStatus(termId, status);
    // Avança automaticamente para o próximo termo quando há mais de um
    if (saved && filteredTerms.length > 1) {
      goNext();
    }
  }

  const currentTerm = filteredTerms.length > 0
    ? filteredTerms[Math.min(reviewIndex, filteredTerms.length - 1)]
    : null;

  const renderStatusButtons = (item: UsJobVocabularyTerm, onSelect: (status: EmployabilityTermStatus) => void) => {
    const saving = savingTermId === item.term.id;
    return (
      <div className="flex flex-wrap gap-2 rounded-lg border border-surface-200 bg-surface-50 p-1 dark:border-primary-300/15 dark:bg-white/[0.03]">
        {statusOptions.map(option => {
          const active = item.status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={saving}
              onClick={() => onSelect(option.value)}
              aria-pressed={active}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${statusButtonClasses(option.value, active)}`}
            >
              {active && (saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />)}
              {option.label}
            </button>
          );
        })}
      </div>
    );
  };

  const renderTermBadges = (item: UsJobVocabularyTerm) => (
    <div className="flex flex-wrap items-center gap-2">
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
  );

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

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Total de termos', value: String(summary.total), classes: 'text-surface-900 dark:text-white' },
            { label: 'Domino', value: String(summary.domino), classes: 'text-success-600 dark:text-success-300' },
            { label: 'Revisar', value: String(summary.revisar), classes: 'text-warning-600 dark:text-warning-300' },
            { label: 'Ainda não domino', value: String(summary.naoDomino), classes: 'text-surface-600 dark:text-surface-300' },
            { label: 'Dominado', value: `${summary.percentual}%`, classes: 'text-primary-600 dark:text-primary-300' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-lg border border-surface-200 bg-white/75 px-3 py-2 dark:border-primary-300/15 dark:bg-white/[0.03]">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{kpi.label}</p>
              <p className={`text-lg font-bold ${kpi.classes}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

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

        <div className="inline-flex rounded-lg border border-surface-200 bg-surface-50 p-1 dark:border-primary-300/15 dark:bg-white/[0.03]" role="tablist" aria-label="Modo de visualização">
          {([
            { value: 'review', label: 'Revisar agora', icon: <GraduationCap size={14} /> },
            { value: 'list', label: 'Lista completa', icon: <List size={14} /> },
          ] as Array<{ value: ViewMode; label: string; icon: JSX.Element }>).map(option => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={mode === option.value}
              onClick={() => setMode(option.value)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === option.value
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-white/10'
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
            <Loader2 size={16} className="animate-spin" />
            Carregando vocabulário...
          </div>
        ) : filteredTerms.length === 0 ? (
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Nenhum termo encontrado com os filtros atuais. Ajuste a busca ou a categoria — ou rode o seed da Fase 3A se a lista estiver vazia.
          </p>
        ) : mode === 'review' && currentTerm ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
              Termo {reviewIndex + 1} de {filteredTerms.length}
            </p>

            <div className="rounded-xl border border-surface-200 bg-white/75 p-5 dark:border-primary-300/15 dark:bg-white/[0.03]">
              <div className="space-y-3">
                {renderTermBadges(currentTerm)}
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-surface-950 dark:text-white">{currentTerm.term.term}</p>
                  <button
                    type="button"
                    onClick={() => speakEnglish(currentTerm.term.term)}
                    className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-surface-200 text-surface-600 transition-colors hover:bg-surface-50 dark:border-primary-300/15 dark:text-surface-300 dark:hover:bg-white/10"
                    title="Ouvir pronúncia"
                    aria-label="Ouvir pronúncia"
                  >
                    <Volume2 size={16} />
                  </button>
                </div>

                {flipped ? (
                  <div className="space-y-2 rounded-lg border border-primary-200/60 bg-primary-500/5 p-4 dark:border-primary-300/20">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Tradução</p>
                      <p className="break-words text-sm font-medium text-surface-800 dark:text-surface-100">{currentTerm.term.translation_pt}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Exemplo</p>
                      <p className="break-words text-sm leading-6 text-surface-600 dark:text-surface-300">{currentTerm.term.example_en}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    Tente lembrar da tradução e de um exemplo antes de virar o card.
                  </p>
                )}

                {termErrors[currentTerm.term.id] && (
                  <p className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs font-semibold text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
                    {termErrors[currentTerm.term.id]}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" icon={<Repeat size={14} />} onClick={() => setFlipped(prev => !prev)}>
                    {flipped ? 'Ocultar resposta' : 'Virar card'}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" icon={<ChevronLeft size={14} />} onClick={goPrevious} disabled={filteredTerms.length <= 1}>
                    Anterior
                  </Button>
                  <Button type="button" size="sm" variant="secondary" icon={<ChevronRight size={14} />} onClick={goNext} disabled={filteredTerms.length <= 1}>
                    Próximo
                  </Button>
                  <Button type="button" size="sm" variant="secondary" icon={<Shuffle size={14} />} onClick={goRandom} disabled={filteredTerms.length <= 1}>
                    Aleatório
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Como você está com este termo?</p>
                  {renderStatusButtons(currentTerm, status => void handleReviewStatus(currentTerm.term.id, status))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {filteredTerms.slice(0, visibleCount).map(item => {
                const expanded = expandedTermId === item.term.id;
                const termError = termErrors[item.term.id];
                return (
                  <div key={item.term.id} className="rounded-lg border border-surface-200 bg-white/75 dark:border-primary-300/15 dark:bg-white/[0.03]">
                    <button
                      type="button"
                      onClick={() => setExpandedTermId(expanded ? null : item.term.id)}
                      aria-expanded={expanded}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-surface-950 dark:text-white">{item.term.term}</p>
                          <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${statusClasses(item.status)}`}>
                            {statusLabels[item.status]}
                          </span>
                          <span className="rounded-lg bg-surface-100 px-2 py-0.5 text-[11px] font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">
                            {item.term.category ?? item.term.theme}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-surface-500 dark:text-surface-400">{item.term.translation_pt}</p>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 text-surface-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {expanded && (
                      <div className="space-y-3 border-t border-surface-200 px-4 py-3 dark:border-primary-300/15">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-semibold text-primary-700 dark:text-primary-200">
                            <Star size={12} />
                            Dificuldade {item.term.importance_level ?? 3}/5
                          </span>
                          <button
                            type="button"
                            onClick={() => speakEnglish(item.term.term)}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-surface-200 px-2 text-xs font-semibold text-surface-600 transition-colors hover:bg-surface-50 dark:border-primary-300/15 dark:text-surface-300 dark:hover:bg-white/10"
                            title="Ouvir pronúncia"
                          >
                            <Volume2 size={12} />
                            Ouvir pronúncia
                          </button>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Exemplo</p>
                          <p className="break-words text-sm leading-6 text-surface-600 dark:text-surface-300">{item.term.example_en}</p>
                        </div>
                        {termError && (
                          <p className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs font-semibold text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
                            {termError}
                          </p>
                        )}
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Status</p>
                          {renderStatusButtons(item, status => void handleSetStatus(item.term.id, status))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredTerms.length > visibleCount && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setVisibleCount(prev => prev + LIST_PAGE_SIZE)}
                >
                  Mostrar mais ({filteredTerms.length - visibleCount} restantes)
                </Button>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
