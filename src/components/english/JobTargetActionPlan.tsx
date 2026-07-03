import { useMemo, useState } from 'react';
import { BookOpen, Check, ClipboardCopy, ClipboardList, Edit3, ListChecks, Loader2, Plus } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import { Button } from '../Button';
import type { InterviewQuestion, JobTarget } from '../../types/englishInterview';
import {
  addJobVocabularyTerms,
  createStarDraftFromSuggestion,
  createTargetedMock,
} from '../../services/english/jobTargetActionsService';

interface JobTargetActionPlanProps {
  userId: string;
  jobTarget: JobTarget;
  questions: InterviewQuestion[];
}

const selectClass = 'min-h-9 w-full rounded-lg border border-surface-200 bg-white px-2 text-xs text-surface-700 outline-none focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-surface-200';

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-surface-950 dark:text-white">
        {icon} {title}
      </p>
      <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">{subtitle}</p>
    </div>
  );
}

export function JobTargetActionPlan({ userId, jobTarget, questions }: JobTargetActionPlanProps) {
  const analysis = jobTarget.ai_analysis;

  const vocabularyOptions = useMemo(() => {
    if (!analysis) return [];
    return Array.from(new Set(
      [...analysis.missing_vocabulary, ...analysis.technical_keywords].map(term => term.trim()).filter(Boolean),
    ));
  }, [analysis]);

  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  const [addingVocabulary, setAddingVocabulary] = useState(false);
  const [vocabularyMessage, setVocabularyMessage] = useState('');

  const [starQuestionByIndex, setStarQuestionByIndex] = useState<Record<number, string>>({});
  const [creatingStarIndex, setCreatingStarIndex] = useState<number | null>(null);
  const [createdStarIndexes, setCreatedStarIndexes] = useState<Set<number>>(new Set());

  const [copiedQuestionIndex, setCopiedQuestionIndex] = useState<number | null>(null);
  const [creatingMock, setCreatingMock] = useState(false);
  const [mockMessage, setMockMessage] = useState('');

  const [error, setError] = useState('');

  if (!analysis) return null;

  function toggleTerm(term: string) {
    setSelectedTerms(prev => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return next;
    });
  }

  async function handleAddVocabulary() {
    if (selectedTerms.size === 0) return;
    setAddingVocabulary(true);
    setError('');
    setVocabularyMessage('');
    try {
      const result = await addJobVocabularyTerms(Array.from(selectedTerms));
      setVocabularyMessage(
        result.inserted > 0
          ? `${result.inserted} termo(s) adicionado(s) ao Vocabulário EUA${result.skipped > 0 ? ` (${result.skipped} já existiam)` : ''}.`
          : 'Todos os termos selecionados já existiam no vocabulário.',
      );
      setSelectedTerms(new Set());
    } catch (err) {
      console.error('[JobTargetActions] Failed to add vocabulary', err);
      setError('Não foi possível adicionar os termos. Confira se a migration da Fase 4B foi aplicada.');
    } finally {
      setAddingVocabulary(false);
    }
  }

  async function handleCreateStar(index: number, suggestion: string) {
    const questionId = starQuestionByIndex[index] || questions[0]?.id;
    if (!questionId) {
      setError('Banco de perguntas vazio: não é possível criar a resposta STAR.');
      return;
    }
    setCreatingStarIndex(index);
    setError('');
    try {
      await createStarDraftFromSuggestion({ userId, jobTarget, suggestion, questionId });
      setCreatedStarIndexes(prev => new Set(prev).add(index));
    } catch (err) {
      console.error('[JobTargetActions] Failed to create STAR draft', err);
      setError('Não foi possível criar o rascunho STAR.');
    } finally {
      setCreatingStarIndex(null);
    }
  }

  async function handleCopyQuestion(index: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedQuestionIndex(index);
      window.setTimeout(() => setCopiedQuestionIndex(current => current === index ? null : current), 2000);
    } catch {
      setError('Não foi possível copiar a pergunta.');
    }
  }

  async function handleCreateMock() {
    setCreatingMock(true);
    setError('');
    setMockMessage('');
    try {
      const session = await createTargetedMock({ userId, jobTarget, questions });
      setMockMessage(`Mock "${session.title ?? 'direcionado'}" criado como rascunho. Abra a aba Mock mensal para começar.`);
    } catch (err) {
      console.error('[JobTargetActions] Failed to create targeted mock', err);
      setError(err instanceof Error ? err.message : 'Não foi possível criar o mock direcionado.');
    } finally {
      setCreatingMock(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Plano de ação para esta vaga"
        subtitle="Transforme a análise da IA em treino real. Nada é criado sem o seu clique."
        icon={<ListChecks size={18} />}
      />
      <CardBody className="space-y-6">
        {error && <p className="text-sm text-danger-600 dark:text-danger-300">{error}</p>}

        <section>
          <SectionTitle
            icon={<BookOpen size={15} />}
            title="Adicionar termos ao Vocabulário EUA"
            subtitle="Selecione os termos da vaga que quer estudar. Eles serão traduzidos e adicionados com status 'Ainda não domino'."
          />
          {vocabularyOptions.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">A análise não trouxe termos para estudar.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {vocabularyOptions.map(term => {
                  const selected = selectedTerms.has(term);
                  return (
                    <button
                      key={term}
                      type="button"
                      onClick={() => toggleTerm(term)}
                      className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? 'bg-primary-600 text-white'
                          : 'bg-white/70 text-surface-700 hover:bg-surface-100 dark:bg-white/10 dark:text-surface-200 dark:hover:bg-white/20'
                      }`}
                    >
                      {term}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  icon={addingVocabulary ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  loading={addingVocabulary}
                  disabled={selectedTerms.size === 0 || addingVocabulary}
                  onClick={handleAddVocabulary}
                >
                  Adicionar {selectedTerms.size > 0 ? `${selectedTerms.size} termo(s)` : 'termos'} ao vocabulário
                </Button>
                {vocabularyMessage && <span className="text-xs font-semibold text-success-700 dark:text-success-300">{vocabularyMessage}</span>}
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionTitle
            icon={<Edit3 size={15} />}
            title="Criar rascunhos de Respostas STAR"
            subtitle="Escolha a pergunta do banco que combina com o tema e crie o rascunho para preencher na aba Respostas STAR."
          />
          {analysis.star_story_suggestions.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">A análise não trouxe sugestões de STAR.</p>
          ) : (
            <div className="space-y-2">
              {analysis.star_story_suggestions.map((suggestion, index) => {
                const created = createdStarIndexes.has(index);
                return (
                  <div key={`star-${index}`} className="flex flex-col gap-2 rounded-lg border border-surface-200 bg-white/70 p-3 dark:border-primary-300/15 dark:bg-white/[0.03] md:flex-row md:items-center md:justify-between">
                    <p className="min-w-0 flex-1 break-words text-sm text-surface-700 dark:text-surface-200">{suggestion}</p>
                    <div className="flex w-full flex-wrap items-center gap-2 md:w-[380px] md:shrink-0">
                      <select
                        value={starQuestionByIndex[index] ?? questions[0]?.id ?? ''}
                        onChange={event => setStarQuestionByIndex(prev => ({ ...prev, [index]: event.target.value }))}
                        disabled={created}
                        className={`${selectClass} min-w-0 md:flex-1`}
                      >
                        {questions.map(question => (
                          <option key={question.id} value={question.id}>
                            {question.id} - {question.question_en.slice(0, 60)}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        variant={created ? 'success' : 'secondary'}
                        icon={creatingStarIndex === index ? <Loader2 size={14} className="animate-spin" /> : created ? <Check size={14} /> : <Plus size={14} />}
                        loading={creatingStarIndex === index}
                        disabled={created || creatingStarIndex !== null}
                        onClick={() => handleCreateStar(index, suggestion)}
                      >
                        {created ? 'Rascunho criado' : 'Criar STAR'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <SectionTitle
            icon={<ClipboardCopy size={15} />}
            title="Perguntas prováveis desta vaga"
            subtitle="Copie uma pergunta para praticar no gravador da Sessão diária ou em um mock."
          />
          {analysis.likely_interview_questions.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">A análise não trouxe perguntas prováveis.</p>
          ) : (
            <div className="space-y-2">
              {analysis.likely_interview_questions.map((question, index) => (
                <div key={`question-${index}`} className="flex items-start justify-between gap-2 rounded-lg border border-surface-200 bg-white/70 p-3 dark:border-primary-300/15 dark:bg-white/[0.03]">
                  <p className="min-w-0 flex-1 break-words text-sm leading-6 text-surface-700 dark:text-surface-200">{question}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    icon={copiedQuestionIndex === index ? <Check size={14} /> : <ClipboardCopy size={14} />}
                    onClick={() => handleCopyQuestion(index, question)}
                  >
                    {copiedQuestionIndex === index ? 'Copiada' : 'Copiar'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle
            icon={<ClipboardList size={15} />}
            title="Criar mock direcionado"
            subtitle="Cria um mock em rascunho com as 5 perguntas do banco mais relacionadas a esta vaga."
          />
          <div className="space-y-2">
            {analysis.recommended_mock_focus && (
              <p className="rounded-lg bg-primary-500/10 px-3 py-2 text-xs font-medium text-primary-700 dark:text-primary-200">
                Foco recomendado: {analysis.recommended_mock_focus}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                icon={creatingMock ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
                loading={creatingMock}
                disabled={creatingMock}
                onClick={handleCreateMock}
              >
                Criar mock direcionado
              </Button>
              {mockMessage && <span className="text-xs font-semibold text-success-700 dark:text-success-300">{mockMessage}</span>}
            </div>
          </div>
        </section>
      </CardBody>
    </Card>
  );
}
