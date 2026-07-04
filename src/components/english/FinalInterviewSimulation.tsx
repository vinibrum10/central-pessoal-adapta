import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Award, ClipboardCheck, Loader2, Plus, Sparkles } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import { Button } from '../Button';
import {
  FINAL_INTERVIEW_STATUS_LABELS,
  type FinalInterviewFocusArea,
  type FinalInterviewQuestionRow,
  type FinalInterviewSimulation as FinalInterviewSimulationRow,
  type InterviewQuestion,
  type JobTarget,
} from '../../types/englishInterview';
import { blobToBase64, formatBytes, MAX_AUDIO_BYTES_FOR_AI } from '../../services/english/interviewAudio';
import { evaluateInterviewAnswer } from '../../services/english/interviewAnswerApi';
import { evaluateFinalInterview } from '../../services/english/finalInterviewApi';
import { buildFinalInterviewQuestions } from '../../services/english/finalInterviewPlanner';
import {
  createFinalInterviewSimulation,
  getFinalInterviewSimulation,
  listFinalInterviewQuestions,
  listFinalInterviewSimulations,
  saveFinalAnswerAudio,
  saveFinalOverallFeedback,
  saveFinalQuestionFeedback,
} from '../../services/english/finalInterviewRepository';
import { listJobTargets } from '../../services/english/jobTargetsRepository';
import { listStarAnswers } from '../../services/english/starAnswerRepository';
import { FinalInterviewHistory } from './FinalInterviewHistory';
import { FinalInterviewProgress } from './FinalInterviewProgress';
import { FinalInterviewQuestionStep } from './FinalInterviewQuestionStep';
import { FinalInterviewResult } from './FinalInterviewResult';
import { FinalInterviewSetup } from './FinalInterviewSetup';

interface FinalInterviewSimulationProps {
  userId: string;
  questions: InterviewQuestion[];
}

export function FinalInterviewSimulation({ userId, questions }: FinalInterviewSimulationProps) {
  const [simulations, setSimulations] = useState<FinalInterviewSimulationRow[]>([]);
  const [jobTargets, setJobTargets] = useState<JobTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [creating, setCreating] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FinalInterviewSimulationRow | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<FinalInterviewQuestionRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [savingAnswer, setSavingAnswer] = useState(false);
  const [evaluatingQuestionId, setEvaluatingQuestionId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextSimulations, nextTargets] = await Promise.all([
        listFinalInterviewSimulations(),
        listJobTargets(),
      ]);
      setSimulations(nextSimulations);
      setJobTargets(nextTargets.filter(target => target.status !== 'archived'));
    } catch (err) {
      console.error('[FinalInterview] Failed to load simulations', err);
      setError('Não foi possível carregar os simulados. Confira se a migration da Fase 6 foi aplicada.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (simulationId: string) => {
    setLoadingDetail(true);
    setError('');
    try {
      const [simulation, rows] = await Promise.all([
        getFinalInterviewSimulation(simulationId),
        listFinalInterviewQuestions(simulationId),
      ]);
      setDetail(simulation);
      setDetailQuestions(rows);
    } catch (err) {
      console.error('[FinalInterview] Failed to load simulation detail', err);
      setError('Não foi possível carregar o simulado.');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  function openSimulation(simulationId: string) {
    setSelectedId(simulationId);
    setCurrentIndex(0);
    void loadDetail(simulationId);
  }

  function backToList() {
    setSelectedId(null);
    setDetail(null);
    setDetailQuestions([]);
    void load();
  }

  async function handleCreate(params: {
    title: string;
    focus: FinalInterviewFocusArea;
    jobTargetId: string | null;
    questionCount: number;
  }) {
    setCreating(true);
    setError('');
    try {
      const [starAnswers] = await Promise.all([listStarAnswers()]);
      const jobTarget = params.jobTargetId
        ? jobTargets.find(target => target.id === params.jobTargetId) ?? null
        : null;
      const generated = buildFinalInterviewQuestions({
        focus: params.focus,
        questionCount: params.questionCount,
        bankQuestions: questions,
        starAnswers,
        jobTarget,
      });
      const simulation = await createFinalInterviewSimulation({
        userId,
        title: params.title,
        focusArea: params.focus,
        jobTargetId: params.jobTargetId,
        questions: generated,
      });
      setShowSetup(false);
      openSimulation(simulation.id);
    } catch (err) {
      console.error('[FinalInterview] Failed to create simulation', err);
      setError(err instanceof Error ? err.message : 'Não foi possível criar o simulado.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveAnswer(row: FinalInterviewQuestionRow, params: { audio: Blob; mimeType: string; durationSec: number; selfRating: number }) {
    if (!detail) return;
    if (params.audio.size > MAX_AUDIO_BYTES_FOR_AI) {
      setError(`A gravação está grande demais (${formatBytes(params.audio.size)}). Grave uma resposta mais curta.`);
      return;
    }
    setSavingAnswer(true);
    setError('');
    try {
      await saveFinalAnswerAudio({
        userId,
        simulation: detail,
        questionRowId: row.id,
        audio: params.audio,
        mimeType: params.mimeType,
        durationSec: params.durationSec,
      });
      await loadDetail(detail.id);
    } catch (err) {
      console.error('[FinalInterview] Failed to save answer', err);
      setError('Não foi possível salvar a resposta gravada.');
    } finally {
      setSavingAnswer(false);
    }
  }

  async function handleEvaluateQuestion(row: FinalInterviewQuestionRow) {
    if (!detail || !row.audioUrl) return;
    setEvaluatingQuestionId(row.id);
    setError('');
    try {
      const audioResponse = await fetch(row.audioUrl);
      const audioBlob = await audioResponse.blob();
      if (audioBlob.size > MAX_AUDIO_BYTES_FOR_AI) {
        setError(`Esta gravação tem ${formatBytes(audioBlob.size)} e excede o limite para avaliação com IA. Grave uma resposta mais curta.`);
        return;
      }
      const feedback = await evaluateInterviewAnswer({
        audioBase64: await blobToBase64(audioBlob),
        mimeType: audioBlob.type || 'audio/webm',
        question_en: row.question_text,
        como_responder: row.guidance ?? '',
        duration_sec: row.duration_sec ?? 1,
      });
      await saveFinalQuestionFeedback(row.id, feedback);
      await loadDetail(detail.id);
    } catch (err) {
      console.error('[FinalInterview] Failed to evaluate answer', err);
      setError(err instanceof Error ? err.message : 'Não foi possível avaliar a resposta com IA.');
    } finally {
      setEvaluatingQuestionId(null);
    }
  }

  async function handleFinalize() {
    if (!detail) return;
    setFinalizing(true);
    setError('');
    try {
      const jobTarget = detail.job_target_id
        ? jobTargets.find(target => target.id === detail.job_target_id) ?? null
        : null;
      const feedback = await evaluateFinalInterview({
        title: detail.title,
        focus_area: detail.focus_area ?? 'general',
        job_target_title: jobTarget ? [jobTarget.title, jobTarget.company].filter(Boolean).join(' — ') : undefined,
        questions: detailQuestions.map(row => ({
          question_text: row.question_text,
          question_category: row.question_category ?? undefined,
          transcript: row.individual_feedback?.transcript,
          score: row.individual_feedback?.score,
          duration_sec: row.duration_sec ?? undefined,
        })),
      });
      const updated = await saveFinalOverallFeedback({ simulationId: detail.id, feedback });
      setDetail(updated);
    } catch (err) {
      console.error('[FinalInterview] Failed to finalize simulation', err);
      setError(err instanceof Error ? err.message : 'Não foi possível gerar a avaliação geral do simulado.');
    } finally {
      setFinalizing(false);
    }
  }

  // ---- Vista de detalhe (fluxo do simulado / resultado) ----
  if (selectedId) {
    const evaluatedCount = detailQuestions.filter(row => row.individual_feedback).length;
    const answeredCount = detailQuestions.filter(row => row.audio_path).length;
    const canFinalize = evaluatedCount >= 1 && !finalizing;
    const currentQuestion = detailQuestions[Math.min(currentIndex, Math.max(0, detailQuestions.length - 1))] ?? null;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="secondary" size="sm" icon={<ArrowLeft size={14} />} onClick={backToList}>
            Voltar para a lista
          </Button>
          {detail && (
            <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-semibold text-surface-600 dark:bg-white/10 dark:text-surface-300">
              {FINAL_INTERVIEW_STATUS_LABELS[detail.status] ?? detail.status}
            </span>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loadingDetail || !detail ? (
          <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
            <Loader2 size={16} className="animate-spin" />
            Carregando simulado...
          </div>
        ) : (
          <>
            {detail.overall_feedback && <FinalInterviewResult feedback={detail.overall_feedback} />}

            <Card>
              <CardHeader
                title={detail.title}
                subtitle={`${answeredCount} de ${detailQuestions.length} perguntas respondidas · ${evaluatedCount} avaliadas com IA`}
                icon={<ClipboardCheck size={18} />}
              />
              <CardBody className="space-y-4">
                <FinalInterviewProgress questions={detailQuestions} currentIndex={currentIndex} />

                {currentQuestion && (
                  <FinalInterviewQuestionStep
                    question={currentQuestion}
                    index={currentIndex}
                    total={detailQuestions.length}
                    saving={savingAnswer}
                    evaluating={evaluatingQuestionId === currentQuestion.id}
                    onSaveAnswer={params => handleSaveAnswer(currentQuestion, params)}
                    onEvaluate={() => handleEvaluateQuestion(currentQuestion)}
                    onPrevious={() => setCurrentIndex(index => Math.max(0, index - 1))}
                    onNext={() => setCurrentIndex(index => Math.min(detailQuestions.length - 1, index + 1))}
                  />
                )}
              </CardBody>
            </Card>

            {!detail.overall_feedback && (
              <Card>
                <CardHeader
                  title="Finalizar simulado"
                  subtitle="Gere a avaliação geral quando houver ao menos uma resposta avaliada com IA."
                  icon={<Award size={18} />}
                  action={(
                    <Button
                      type="button"
                      size="sm"
                      icon={finalizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      loading={finalizing}
                      disabled={!canFinalize}
                      onClick={handleFinalize}
                    >
                      Finalizar simulado e gerar avaliação geral
                    </Button>
                  )}
                />
                <CardBody>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    {evaluatedCount >= 1
                      ? 'Quando terminar de responder, gere a avaliação geral de prontidão para entrevista.'
                      : 'Grave e avalie ao menos uma resposta com IA para liberar a avaliação geral.'}
                  </p>
                </CardBody>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  // ---- Vista de lista (explicação + criação + histórico) ----
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
          title="Simulado final de entrevista"
          subtitle="Estou pronto para sustentar uma entrevista técnica de 30 minutos em inglês?"
          icon={<Award size={18} />}
          action={(
            <Button type="button" size="sm" icon={<Plus size={14} />} onClick={() => { setShowSetup(true); setError(''); }}>
              Criar simulado de 30 minutos
            </Button>
          )}
        />
        <CardBody className="space-y-4">
          <p className="text-sm leading-6 text-surface-600 dark:text-surface-300">
            O simulado monta uma entrevista completa de ~30 minutos misturando apresentação pessoal, perguntas
            comportamentais STAR, perguntas técnicas de power systems, perguntas da sua vaga-alvo, adaptação aos EUA
            e encerramento. Responda uma pergunta por vez gravando em inglês, avalie com IA e gere a nota final de prontidão.
          </p>

          {showSetup && (
            <FinalInterviewSetup
              jobTargets={jobTargets}
              creating={creating}
              onCreate={handleCreate}
              onCancel={() => setShowSetup(false)}
            />
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
              <Loader2 size={16} className="animate-spin" />
              Carregando simulados...
            </div>
          ) : (
            <FinalInterviewHistory simulations={simulations} onSelect={openSimulation} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
