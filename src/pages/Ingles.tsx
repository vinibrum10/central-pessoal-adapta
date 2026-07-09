import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { AlertCircle, Award, BookOpen, Briefcase, CalendarDays, ClipboardList, Edit3, LayoutDashboard, Loader2, MessageSquareText, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardBody, CardHeader } from '../components/Card';
import { LoadingState } from '../components/DesignSystem';
import { InterviewAnswerHistory } from '../components/english/InterviewAnswerHistory';
import { InterviewAnswerRecorder } from '../components/english/InterviewAnswerRecorder';
import { DailyInterviewSession } from '../components/english/DailyInterviewSession';
import { EmployabilityDashboard } from '../components/english/EmployabilityDashboard';
import { EnglishOverviewDashboard } from '../components/english/EnglishOverviewDashboard';
import { InterviewQuestionBank } from '../components/english/InterviewQuestionBank';
import { InterviewMissionHeader } from '../components/english/InterviewMissionHeader';
import { InterviewModuleGrid, type InterviewModuleShortcut } from '../components/english/InterviewModuleGrid';
import { JobTargetsPanel } from '../components/english/JobTargetsPanel';
import { MonthlyMockInterview } from '../components/english/MonthlyMockInterview';
import { SectorListeningPanel } from '../components/english/SectorListeningPanel';
import { StarAnswerBuilder } from '../components/english/StarAnswerBuilder';
import { TechnicalGlossaryCards } from '../components/english/TechnicalGlossaryCards';
import { UsJobVocabularyPanel } from '../components/english/UsJobVocabularyPanel';
import { WeeklyPreparationPlan } from '../components/english/WeeklyPreparationPlan';
import { FinalInterviewSimulation } from '../components/english/FinalInterviewSimulation';
import { useAuth } from '../contexts/AuthContext';
import type {
  DailySession,
  EnglishInterviewLevel,
  InterviewAnswer,
  GlossaryReviewCard,
  InterviewModeState,
  InterviewQuestion,
  WeeklyPreparationTask,
  WeeklyPreparationTaskType,
} from '../types/englishInterview';
import { blobToBase64, MAX_AUDIO_BYTES_FOR_AI, formatBytes } from '../services/english/interviewAudio';
import { evaluateInterviewAnswer } from '../services/english/interviewAnswerApi';
import { listInterviewAnswers, saveAnswerFeedback, saveInterviewAnswerWithAudio } from '../services/english/interviewAnswersRepository';
import { extractYouTubeVideoId } from '../services/english/youtubeListeningService';
import { isInterviewModeStorageReady, listInterviewQuestions, reviewGlossaryTerm, updateDailySession } from '../services/english/interviewModeRepository';
import { loadInterviewModeState, reselectDailyEpisode } from '../services/english/interviewModeSession';

type StepKey = 'step_listening_done' | 'step_shadowing_done' | 'step_cards_done' | 'step_question_done';
type EnglishInterviewTab = 'overview' | 'daily' | 'vocabulary' | 'star' | 'mock' | 'evolution' | 'jobs' | 'weekly' | 'final';

// Fase 5.4 — cada tipo de tarefa do plano semanal leva para a aba onde ela é executada
const WEEKLY_TASK_TAB: Record<WeeklyPreparationTaskType, EnglishInterviewTab> = {
  speaking: 'daily',
  vocabulary: 'vocabulary',
  star: 'star',
  mock: 'mock',
  job_target: 'jobs',
  application: 'jobs',
  follow_up: 'jobs',
  review: 'evolution',
};

const EMPTY_METRICS = {
  masteredTerms: 0,
  totalSeedTerms: 200,
  shadowingThisWeek: 0,
  lastMockRating: null,
};

function buildManualEmbedUrl(url: string): string | null {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

export function InglesPage() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<InterviewModeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('all');
  const [level, setLevel] = useState<EnglishInterviewLevel | 'all'>('advanced');
  const [manualUrl, setManualUrl] = useState('');
  const [reviewedCards, setReviewedCards] = useState<Set<string>>(new Set());
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestion | null>(null);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState('all');
  const [questionThemeFilter, setQuestionThemeFilter] = useState('all');
  const [evaluatingAnswerId, setEvaluatingAnswerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EnglishInterviewTab>('daily');
  const sessionRef = useRef<HTMLDivElement | null>(null);
  const listeningRef = useRef<HTMLDivElement | null>(null);
  const glossaryRef = useRef<HTMLDivElement | null>(null);
  const questionsRef = useRef<HTMLDivElement | null>(null);

  const storageReady = isInterviewModeStorageReady(user?.id);
  const manualEmbedUrl = useMemo(() => buildManualEmbedUrl(manualUrl), [manualUrl]);

  const loadState = useCallback(async () => {
    if (!user?.id || !storageReady) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const next = await loadInterviewModeState({ userId: user.id, theme, level });
      setState(next);
      const bank = await listInterviewQuestions();
      setQuestions(bank);
      const selected = next.question ?? bank[0] ?? null;
      setSelectedQuestion(selected);
      if (selected) {
        setAnswers(await listInterviewAnswers(selected.id));
      }
    } catch (err) {
      console.error('[EnglishInterview] Failed to load mode', err);
      setError('Não foi possível carregar o Modo Entrevista. Confira a migration e os seeds.');
    } finally {
      setLoading(false);
    }
  }, [level, storageReady, theme, user?.id]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function persistSession(updates: Partial<DailySession>) {
    if (!state?.session) return;
    setSaving(true);
    setError('');
    try {
      const session = await updateDailySession(state.session.id, updates);
      setState(prev => prev ? { ...prev, session } : prev);
    } catch (err) {
      console.error('[EnglishInterview] Failed to update daily session', err);
      setError('Não foi possível salvar o progresso da sessão.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStep(step: StepKey) {
    if (!state) return;
    await persistSession({ [step]: !state.session[step] } as Partial<DailySession>);
  }

  async function handleThemeChange(nextTheme: string) {
    setTheme(nextTheme);
    if (!state || !user?.id) return;
    setSaving(true);
    try {
      const session = await reselectDailyEpisode(state.session, { userId: user.id, theme: nextTheme, level });
      const next = await loadInterviewModeState({ userId: user.id, theme: nextTheme, level });
      setState({ ...next, session });
    } catch (err) {
      console.error('[EnglishInterview] Failed to change theme', err);
      setError('Não foi possível trocar o tema do listening.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLevelChange(nextLevel: EnglishInterviewLevel | 'all') {
    setLevel(nextLevel);
    if (!state || !user?.id) return;
    setSaving(true);
    try {
      const session = await reselectDailyEpisode(state.session, { userId: user.id, theme, level: nextLevel });
      const next = await loadInterviewModeState({ userId: user.id, theme, level: nextLevel });
      setState({ ...next, session });
    } catch (err) {
      console.error('[EnglishInterview] Failed to change level', err);
      setError('Não foi possível trocar o nível do listening.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReviewCard(card: GlossaryReviewCard, result: 'acertou' | 'errou') {
    if (!user?.id) return;
    setSaving(true);
    setError('');
    try {
      await reviewGlossaryTerm(user.id, card, result);
      const nextReviewed = new Set(reviewedCards);
      nextReviewed.add(card.term.id);
      setReviewedCards(nextReviewed);

      const next = await loadInterviewModeState({ userId: user.id, theme, level });
      setState(next);
      if (state?.reviewCards.length && nextReviewed.size >= state.reviewCards.length) {
        await persistSession({ step_cards_done: true });
      }
    } catch (err) {
      console.error('[EnglishInterview] Failed to review card', err);
      setError('Não foi possível registrar a revisão do card.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectQuestion(question: InterviewQuestion) {
    setSelectedQuestion(question);
    setAnswers(await listInterviewAnswers(question.id));
  }

  async function handleSaveAnswer(params: { audio: Blob; mimeType: string; durationSec: number; selfRating: number }) {
    if (!user?.id || !selectedQuestion) return;
    if (params.audio.size > MAX_AUDIO_BYTES_FOR_AI) {
      setError(`A gravação está grande demais (${formatBytes(params.audio.size)}). Grave uma resposta mais curta.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveInterviewAnswerWithAudio({
        userId: user.id,
        questionId: selectedQuestion.id,
        audio: params.audio,
        mimeType: params.mimeType,
        durationSec: params.durationSec,
        selfRating: params.selfRating,
      });
      setAnswers(await listInterviewAnswers(selectedQuestion.id));
      if (state?.session.question_id === selectedQuestion.id && !state.session.step_question_done) {
        await persistSession({ step_question_done: true });
      }
    } catch (err) {
      console.error('[EnglishInterview] Failed to save answer', err);
      setError('Não foi possível salvar a resposta gravada.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEvaluateAnswer(answer: InterviewAnswer) {
    if (!selectedQuestion || !answer.audioUrl) return;
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
        question_en: selectedQuestion.question_en,
        como_responder: selectedQuestion.como_responder,
        duration_sec: answer.duration_sec ?? 1,
      });
      await saveAnswerFeedback(answer.id, feedback);
      setAnswers(await listInterviewAnswers(selectedQuestion.id));
    } catch (err) {
      console.error('[EnglishInterview] Failed to evaluate answer', err);
      setError(err instanceof Error ? err.message : 'Não foi possível avaliar a resposta com IA.');
    } finally {
      setEvaluatingAnswerId(null);
    }
  }

  function handleStartSession() {
    sessionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollToDailySection(ref: RefObject<HTMLDivElement | null>) {
    setActiveTab('daily');
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  function handleWeeklyTaskAction(task: WeeklyPreparationTask) {
    setActiveTab(WEEKLY_TASK_TAB[task.task_type] ?? 'daily');
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  }

  function handleModuleShortcut(shortcut: InterviewModuleShortcut) {
    if (shortcut === 'listening') {
      scrollToDailySection(listeningRef);
      return;
    }
    if (shortcut === 'glossary') {
      scrollToDailySection(glossaryRef);
      return;
    }
    if (shortcut === 'questions') {
      scrollToDailySection(questionsRef);
      return;
    }
    if (shortcut === 'mock') {
      setActiveTab('mock');
      return;
    }
    setActiveTab('vocabulary');
  }

  if (authLoading || loading) {
    return (
      <div className="space-y-4">
        <LoadingState label="Carregando Inglês — Modo Entrevista..." />
      </div>
    );
  }

  if (!storageReady) {
    return (
      <div className="space-y-4">
        <InterviewMissionHeader metrics={EMPTY_METRICS} />
        <Card>
          <CardHeader title="Supabase necessário" icon={<AlertCircle size={18} />} />
          <CardBody>
            <p className="text-sm leading-6 text-surface-600 dark:text-surface-300">
              O Modo Entrevista usa tabelas Supabase normalizadas para sessão diária, SRS e conteúdo compartilhado.
              Configure o Supabase e rode a migration/seed para ativar esta página.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const currentState = state ?? {
    session: {
      id: '',
      user_id: user?.id ?? '',
      session_date: '',
      episode_id: null,
      question_id: null,
      step_listening_done: false,
      step_shadowing_done: false,
      step_cards_done: false,
      step_question_done: false,
    },
    episode: null,
    question: null,
    reviewCards: [],
    metrics: EMPTY_METRICS,
  };
  const userId = user?.id ?? '';

  const tabs: Array<{ id: EnglishInterviewTab; label: string; icon: JSX.Element }> = [
    { id: 'overview', label: 'Visão geral', icon: <LayoutDashboard size={15} /> },
    { id: 'daily', label: 'Sessão diária', icon: <BookOpen size={15} /> },
    { id: 'vocabulary', label: 'Vocabulário EUA', icon: <Briefcase size={15} /> },
    { id: 'star', label: 'Respostas STAR', icon: <Edit3 size={15} /> },
    { id: 'mock', label: 'Mock mensal', icon: <ClipboardList size={15} /> },
    { id: 'evolution', label: 'Evolução', icon: <TrendingUp size={15} /> },
    { id: 'jobs', label: 'Vagas EUA', icon: <Briefcase size={15} /> },
    { id: 'weekly', label: 'Plano semanal', icon: <CalendarDays size={15} /> },
    { id: 'final', label: 'Simulado final', icon: <Award size={15} /> },
  ];

  return (
    <div className="space-y-6">
      <InterviewMissionHeader metrics={currentState.metrics} />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saving && (
        <div className="inline-flex items-center gap-2 rounded-lg border border-primary-300/20 bg-primary-500/10 px-3 py-2 text-xs font-semibold text-primary-700 dark:text-primary-200">
          <Loader2 size={14} className="animate-spin" />
          Salvando...
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white shadow-sm shadow-primary-700/20'
                : 'border border-surface-200 bg-white/80 text-surface-600 hover:bg-surface-50 dark:border-primary-300/15 dark:bg-white/[0.05] dark:text-surface-300 dark:hover:bg-white/10'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'daily' && (
        <>
          <div ref={sessionRef}>
            <DailyInterviewSession
              session={currentState.session}
              episode={currentState.episode}
              question={currentState.question}
              onToggleStep={handleToggleStep}
              onStart={handleStartSession}
            />
          </div>

          <div ref={listeningRef} className="scroll-mt-4">
            <SectorListeningPanel
              episode={currentState.episode}
              theme={theme}
              level={level}
              manualUrl={manualUrl}
              manualEmbedUrl={manualEmbedUrl}
              onThemeChange={handleThemeChange}
              onLevelChange={handleLevelChange}
              onManualUrlChange={setManualUrl}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div ref={glossaryRef} className="scroll-mt-4">
              <TechnicalGlossaryCards cards={currentState.reviewCards} onReview={handleReviewCard} />
            </div>

            <div ref={questionsRef} className="scroll-mt-4">
              <InterviewQuestionBank
                questions={questions}
                selectedQuestionId={selectedQuestion?.id ?? null}
                categoryFilter={questionCategoryFilter}
                themeFilter={questionThemeFilter}
                onCategoryFilterChange={setQuestionCategoryFilter}
                onThemeFilterChange={setQuestionThemeFilter}
                onSelectQuestion={handleSelectQuestion}
              />
            </div>
          </div>

          <Card>
            <CardHeader
              title="Resposta gravada"
              subtitle="Grave, salve no histórico e avalie com IA quando quiser."
              icon={<MessageSquareText size={18} />}
              action={(
                <Button type="button" size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={loadState}>
                  Atualizar
                </Button>
              )}
            />
            <CardBody className="space-y-4">
              {selectedQuestion ? (
                <>
                  <div className="rounded-lg border border-surface-200 bg-white/70 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-semibold text-primary-700 dark:text-primary-200">
                        {selectedQuestion.id}
                      </span>
                      <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">
                        {selectedQuestion.category}
                      </span>
                      <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">
                        {selectedQuestion.timer_sugerido_min} min
                      </span>
                    </div>
                    <p className="text-base font-semibold leading-7 text-surface-950 dark:text-white">
                      {selectedQuestion.question_en}
                    </p>
                  </div>

                  <div className="space-y-3 text-sm leading-6">
                    <details className="rounded-lg border border-surface-200 bg-white/60 p-3 dark:border-primary-300/15 dark:bg-white/[0.03]">
                      <summary className="cursor-pointer font-semibold text-surface-800 dark:text-surface-100">O que avaliam</summary>
                      <p className="mt-2 text-surface-600 dark:text-surface-300">{selectedQuestion.o_que_avaliam}</p>
                    </details>
                    <details className="rounded-lg border border-surface-200 bg-white/60 p-3 dark:border-primary-300/15 dark:bg-white/[0.03]">
                      <summary className="cursor-pointer font-semibold text-surface-800 dark:text-surface-100">Como responder</summary>
                      <p className="mt-2 text-surface-600 dark:text-surface-300">{selectedQuestion.como_responder}</p>
                    </details>
                  </div>

                  <InterviewAnswerRecorder question={selectedQuestion} saving={saving} onSave={handleSaveAnswer} />
                  <InterviewAnswerHistory answers={answers} evaluatingAnswerId={evaluatingAnswerId} onEvaluate={handleEvaluateAnswer} />
                </>
              ) : (
                <p className="text-sm text-surface-500 dark:text-surface-400">Rode o seed do banco de perguntas para ativar esta etapa.</p>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {activeTab === 'overview' && userId && <EnglishOverviewDashboard userId={userId} />}
      {activeTab === 'vocabulary' && userId && <UsJobVocabularyPanel userId={userId} />}
      {activeTab === 'star' && userId && <StarAnswerBuilder userId={userId} questions={questions} />}
      {activeTab === 'mock' && userId && <MonthlyMockInterview userId={userId} questions={questions} />}
      {activeTab === 'evolution' && userId && <EmployabilityDashboard userId={userId} />}
      {activeTab === 'jobs' && userId && <JobTargetsPanel userId={userId} questions={questions} />}
      {activeTab === 'weekly' && userId && <WeeklyPreparationPlan userId={userId} onTaskAction={handleWeeklyTaskAction} />}
      {activeTab === 'final' && userId && <FinalInterviewSimulation userId={userId} questions={questions} />}

      <InterviewModuleGrid onShortcut={handleModuleShortcut} />
    </div>
  );
}
