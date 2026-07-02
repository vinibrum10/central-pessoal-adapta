import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, Award, ClipboardList, Loader2, Plus, Sparkles } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import { Button } from '../Button';
import type { InterviewAnswer, InterviewQuestion, MockInterviewSession, MockSessionQuestion } from '../../types/englishInterview';
import { blobToBase64, formatBytes, formatDuration, MAX_AUDIO_BYTES_FOR_AI } from '../../services/english/interviewAudio';
import { evaluateInterviewAnswer } from '../../services/english/interviewAnswerApi';
import { listInterviewAnswers, saveAnswerFeedback, saveInterviewAnswerWithAudio } from '../../services/english/interviewAnswersRepository';
import {
  createMockSession,
  getMockSession,
  linkAnswerToMockQuestion,
  listMockSessionQuestions,
  listMockSessions,
  saveMockOverallFeedback,
  updateMockSessionQuestionScore,
} from '../../services/english/mockInterviewRepository';
import { evaluateMockInterview } from '../../services/english/mockInterviewApi';
import { InterviewAnswerHistory } from './InterviewAnswerHistory';
import { InterviewAnswerRecorder } from './InterviewAnswerRecorder';
import { MockInterviewSummary } from './MockInterviewSummary';

interface MonthlyMockInterviewProps {
  userId: string;
  questions: InterviewQuestion[];
}

const DEFAULT_QUESTION_COUNT = 5;

const STATUS_LABELS: Record<MockInterviewSession['status'], string> = {
  draft: 'Rascunho',
  in_progress: 'Em andamento',
  completed: 'Concluído',
};

type RowStatus = 'pendente' | 'respondida' | 'avaliada';

const ROW_STATUS_STYLES: Record<RowStatus, string> = {
  pendente: 'bg-surface-100 text-surface-600 dark:bg-white/10 dark:text-surface-300',
  respondida: 'bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300',
  avaliada: 'bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-300',
};

function rowStatus(row: MockSessionQuestion): RowStatus {
  if (!row.answer_id) return 'pendente';
  return row.interview_answers?.gemini_feedback ? 'avaliada' : 'respondida';
}

function mockTitle(mock: MockInterviewSession): string {
  return mock.title?.trim() || `Mock de ${new Date(mock.created_at).toLocaleDateString('pt-BR')}`;
}

export function MonthlyMockInterview({ userId, questions }: MonthlyMockInterviewProps) {
  const [mocks, setMocks] = useState<MockInterviewSession[]>([]);
  const [loadingMocks, setLoadingMocks] = useState(true);
  const [selectedMockId, setSelectedMockId] = useState<string | null>(null);
  const [mockDetail, setMockDetail] = useState<MockInterviewSession | null>(null);
  const [mockQuestions, setMockQuestions] = useState<MockSessionQuestion[]>([]);
  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, InterviewAnswer[]>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTION_COUNT);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [savingRowQuestionId, setSavingRowQuestionId] = useState<string | null>(null);
  const [evaluatingAnswerId, setEvaluatingAnswerId] = useState<string | null>(null);
  const [generatingOverall, setGeneratingOverall] = useState(false);
  const [error, setError] = useState('');

  const questionById = useMemo(() => new Map(questions.map(question => [question.id, question])), [questions]);

  const refreshMocksList = useCallback(async () => {
    setLoadingMocks(true);
    try {
      setMocks(await listMockSessions());
    } catch (err) {
      console.error('[MonthlyMockInterview] Failed to load mocks', err);
      setError('Não foi possível carregar os mocks salvos.');
    } finally {
      setLoadingMocks(false);
    }
  }, []);

  useEffect(() => {
    void refreshMocksList();
  }, [refreshMocksList]);

  const loadMockDetail = useCallback(async (mockId: string) => {
    setLoadingDetail(true);
    setError('');
    try {
      const [session, rows] = await Promise.all([getMockSession(mockId), listMockSessionQuestions(mockId)]);
      setMockDetail(session);
      setMockQuestions(rows);
      const histories = await Promise.all(rows.map(row => listInterviewAnswers(row.question_id)));
      const map: Record<string, InterviewAnswer[]> = {};
      rows.forEach((row, index) => { map[row.question_id] = histories[index]; });
      setAnswersByQuestion(map);
    } catch (err) {
      console.error('[MonthlyMockInterview] Failed to load mock detail', err);
      setError('Não foi possível carregar os detalhes do mock.');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  function openMock(mockId: string) {
    setSelectedMockId(mockId);
    void loadMockDetail(mockId);
  }

  function backToList() {
    setSelectedMockId(null);
    setMockDetail(null);
    setMockQuestions([]);
    setAnswersByQuestion({});
  }

  function openCreateForm() {
    setSelectedQuestionIds(new Set(questions.slice(0, questionCount).map(question => question.id)));
    setNewTitle('');
    setShowCreateForm(true);
    setError('');
  }

  function selectFirstN() {
    setSelectedQuestionIds(new Set(questions.slice(0, questionCount).map(question => question.id)));
  }

  function toggleQuestionSelection(questionId: string) {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  async function handleCreateMock(event: FormEvent) {
    event.preventDefault();
    if (selectedQuestionIds.size === 0) {
      setError('Selecione ao menos uma pergunta para o mock.');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const orderedIds = questions.filter(question => selectedQuestionIds.has(question.id)).map(question => question.id);
      const session = await createMockSession({ userId, questionIds: orderedIds, title: newTitle });
      setShowCreateForm(false);
      await refreshMocksList();
      openMock(session.id);
    } catch (err) {
      console.error('[MonthlyMockInterview] Failed to create mock', err);
      setError(err instanceof Error ? err.message : 'Não foi possível criar o mock.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveAnswer(question: InterviewQuestion, params: { audio: Blob; mimeType: string; durationSec: number; selfRating: number }) {
    if (!mockDetail) return;
    if (params.audio.size > MAX_AUDIO_BYTES_FOR_AI) {
      setError(`A gravação está grande demais (${formatBytes(params.audio.size)}). Grave uma resposta mais curta.`);
      return;
    }
    setSavingRowQuestionId(question.id);
    setError('');
    try {
      const answer = await saveInterviewAnswerWithAudio({
        userId,
        questionId: question.id,
        audio: params.audio,
        mimeType: params.mimeType,
        durationSec: params.durationSec,
        selfRating: params.selfRating,
        mockSessionId: mockDetail.id,
      });
      await linkAnswerToMockQuestion({ mockSessionId: mockDetail.id, questionId: question.id, answerId: answer.id });
      await loadMockDetail(mockDetail.id);
    } catch (err) {
      console.error('[MonthlyMockInterview] Failed to save mock answer', err);
      setError('Não foi possível salvar a resposta gravada.');
    } finally {
      setSavingRowQuestionId(null);
    }
  }

  async function handleEvaluateAnswer(question: InterviewQuestion, answer: InterviewAnswer) {
    if (!answer.audioUrl || !mockDetail) return;
    setEvaluatingAnswerId(answer.id);
    setError('');
    try {
      const audioResponse = await fetch(answer.audioUrl);
      const audioBlob = await audioResponse.blob();
      if (audioBlob.size > MAX_AUDIO_BYTES_FOR_AI) {
        setError(`Esta gravação tem ${formatBytes(audioBlob.size)} e excede o limite para avaliação com IA. Grave uma resposta mais curta.`);
        return;
      }
      const feedback = await evaluateInterviewAnswer({
        audioBase64: await blobToBase64(audioBlob),
        mimeType: audioBlob.type || 'audio/webm',
        question_en: question.question_en,
        como_responder: question.como_responder,
        duration_sec: answer.duration_sec ?? 1,
      });
      await saveAnswerFeedback(answer.id, feedback);

      const linkedRow = mockQuestions.find(row => row.question_id === question.id && row.answer_id === answer.id);
      if (linkedRow) {
        await updateMockSessionQuestionScore({ mockSessionId: mockDetail.id, questionId: question.id, score: feedback.score });
      }
      await loadMockDetail(mockDetail.id);
    } catch (err) {
      console.error('[MonthlyMockInterview] Failed to evaluate mock answer', err);
      setError(err instanceof Error ? err.message : 'Não foi possível avaliar a resposta com IA.');
    } finally {
      setEvaluatingAnswerId(null);
    }
  }

  const canGenerateOverall = mockQuestions.some(row => row.interview_answers?.gemini_feedback);
  const answeredCount = mockQuestions.filter(row => row.answer_id).length;

  async function handleGenerateOverall() {
    if (!mockDetail) return;
    setGeneratingOverall(true);
    setError('');
    try {
      const feedback = await evaluateMockInterview({
        questions: mockQuestions.map(row => ({
          question_id: row.question_id,
          question_en: row.interview_questions?.question_en ?? row.question_id,
          transcript: row.interview_answers?.gemini_feedback?.transcript,
          score: row.interview_answers?.gemini_feedback?.score,
          duration_sec: row.interview_answers?.duration_sec ?? undefined,
        })),
      });
      const totalDurationSec = mockQuestions.reduce((sum, row) => sum + (row.interview_answers?.duration_sec ?? 0), 0);
      const updated = await saveMockOverallFeedback({ mockSessionId: mockDetail.id, feedback, totalDurationSec });
      setMockDetail(updated);
      await refreshMocksList();
    } catch (err) {
      console.error('[MonthlyMockInterview] Failed to generate overall mock feedback', err);
      setError(err instanceof Error ? err.message : 'Não foi possível gerar a avaliação geral do mock.');
    } finally {
      setGeneratingOverall(false);
    }
  }

  if (selectedMockId) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="secondary" size="sm" icon={<ArrowLeft size={14} />} onClick={backToList}>
            Voltar para a lista
          </Button>
          {mockDetail && (
            <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-semibold text-surface-600 dark:bg-white/10 dark:text-surface-300">
              {STATUS_LABELS[mockDetail.status]}
            </span>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loadingDetail || !mockDetail ? (
          <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
            <Loader2 size={16} className="animate-spin" />
            Carregando mock...
          </div>
        ) : (
          <>
            <Card>
              <CardHeader
                title={mockTitle(mockDetail)}
                subtitle={`${answeredCount} de ${mockQuestions.length} perguntas respondidas`}
                icon={<ClipboardList size={18} />}
              />
              <CardBody className="space-y-4">
                {mockQuestions.map((row, index) => {
                  const question = row.interview_questions ?? questionById.get(row.question_id) ?? null;
                  const status = rowStatus(row);
                  const linkedAnswer = row.interview_answers ?? null;
                  const history = answersByQuestion[row.question_id] ?? [];

                  return (
                    <div key={row.id} className="space-y-3 rounded-lg border border-surface-200 bg-white/70 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
                          Pergunta {index + 1} de {mockQuestions.length}
                        </span>
                        <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${ROW_STATUS_STYLES[status]}`}>
                          {status === 'pendente' ? 'Pendente' : status === 'respondida' ? 'Respondida' : 'Avaliada'}
                        </span>
                      </div>

                      {question ? (
                        <p className="text-sm font-semibold leading-6 text-surface-950 dark:text-white">{question.question_en}</p>
                      ) : (
                        <p className="text-sm text-surface-500 dark:text-surface-400">Pergunta {row.question_id} não encontrada no banco.</p>
                      )}

                      {question && (
                        <InterviewAnswerRecorder
                          question={question}
                          saving={savingRowQuestionId === question.id}
                          onSave={params => handleSaveAnswer(question, params)}
                        />
                      )}

                      {linkedAnswer && (
                        <div className="rounded-lg border border-primary-300/20 bg-primary-500/5 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
                            Resposta registrada neste mock · {formatDuration(linkedAnswer.duration_sec)}
                          </p>
                          {question && !linkedAnswer.gemini_feedback && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              icon={evaluatingAnswerId === linkedAnswer.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                              loading={evaluatingAnswerId === linkedAnswer.id}
                              disabled={!linkedAnswer.audioUrl || evaluatingAnswerId === linkedAnswer.id}
                              onClick={() => handleEvaluateAnswer(question, linkedAnswer)}
                            >
                              Avaliar resposta com IA
                            </Button>
                          )}
                        </div>
                      )}

                      {question && history.length > 0 && (
                        <details className="rounded-lg border border-surface-200 bg-white/60 p-3 dark:border-primary-300/15 dark:bg-white/[0.03]">
                          <summary className="cursor-pointer text-xs font-semibold text-surface-700 dark:text-surface-200">
                            Ver histórico completo desta pergunta
                          </summary>
                          <div className="mt-3">
                            <InterviewAnswerHistory
                              answers={history}
                              evaluatingAnswerId={evaluatingAnswerId}
                              onEvaluate={historyAnswer => handleEvaluateAnswer(question, historyAnswer)}
                            />
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Avaliação geral do mock"
                subtitle="Gere um feedback consolidado quando houver ao menos uma resposta avaliada com IA."
                icon={<Award size={18} />}
                action={(
                  <Button
                    type="button"
                    size="sm"
                    icon={generatingOverall ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    loading={generatingOverall}
                    disabled={!canGenerateOverall || generatingOverall}
                    onClick={handleGenerateOverall}
                  >
                    Gerar avaliação geral do mock
                  </Button>
                )}
              />
              <CardBody>
                {mockDetail.overall_feedback ? (
                  <MockInterviewSummary feedback={mockDetail.overall_feedback} />
                ) : (
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    {canGenerateOverall
                      ? 'Respostas avaliadas encontradas. Gere a avaliação geral quando estiver pronto.'
                      : 'Avalie ao menos uma resposta com IA para liberar a avaliação geral.'}
                  </p>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader
          title="Mock mensal"
          subtitle="Simule uma entrevista completa em inglês para vagas nos EUA."
          icon={<ClipboardList size={18} />}
          action={(
            <Button type="button" size="sm" icon={<Plus size={14} />} onClick={openCreateForm}>
              Criar mock mensal
            </Button>
          )}
        />
        <CardBody className="space-y-3">
          {showCreateForm && (
            <form className="space-y-4 rounded-lg border border-primary-300/20 bg-primary-500/5 p-4" onSubmit={handleCreateMock}>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Título (opcional)</span>
                <input
                  value={newTitle}
                  onChange={event => setNewTitle(event.target.value)}
                  placeholder="Ex.: Mock de julho — foco em Protection"
                  className="min-h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900 outline-none placeholder:text-surface-400 focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-white"
                />
              </label>

              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Quantidade sugerida</span>
                  <input
                    type="number"
                    min={1}
                    max={questions.length || 1}
                    value={questionCount}
                    onChange={event => setQuestionCount(Math.max(1, Math.min(questions.length || 1, Number(event.target.value) || 1)))}
                    className="min-h-10 w-28 rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900 outline-none focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-white"
                  />
                </label>
                <Button type="button" variant="secondary" size="sm" onClick={selectFirstN}>
                  Selecionar as {questionCount} primeiras
                </Button>
                <span className="text-xs text-surface-500 dark:text-surface-400">{selectedQuestionIds.size} perguntas selecionadas</span>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-surface-200 p-2 dark:border-primary-300/15">
                {questions.map(question => (
                  <label key={question.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-surface-50 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={selectedQuestionIds.has(question.id)}
                      onChange={() => toggleQuestionSelection(question.id)}
                      className="mt-1 accent-primary-600"
                    />
                    <span className="text-sm text-surface-700 dark:text-surface-200">
                      <span className="mr-2 rounded bg-surface-100 px-1.5 py-0.5 text-xs font-semibold text-surface-600 dark:bg-white/10 dark:text-surface-300">{question.category}</span>
                      {question.question_en}
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={creating} icon={<Plus size={16} />}>
                  Criar mock
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {loadingMocks ? (
            <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
              <Loader2 size={16} className="animate-spin" />
              Carregando mocks...
            </div>
          ) : mocks.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">Nenhum mock criado ainda. Crie o primeiro mock mensal para começar.</p>
          ) : (
            <div className="space-y-2">
              {mocks.map(mock => (
                <button
                  key={mock.id}
                  type="button"
                  onClick={() => openMock(mock.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-200 bg-white/70 p-3 text-left transition-colors hover:bg-surface-50 dark:border-primary-300/15 dark:bg-white/[0.03] dark:hover:bg-white/10"
                >
                  <div>
                    <p className="text-sm font-semibold text-surface-950 dark:text-white">{mockTitle(mock)}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">{mock.question_ids.length} perguntas</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {mock.overall_feedback && (
                      <span className="rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-semibold text-primary-700 dark:text-primary-200">
                        Nota geral: {mock.overall_feedback.overall_score}/10
                      </span>
                    )}
                    <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-semibold text-surface-600 dark:bg-white/10 dark:text-surface-300">
                      {STATUS_LABELS[mock.status]}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
