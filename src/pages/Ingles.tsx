import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, HelpCircle, Loader2, MessageSquareText, RefreshCw } from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardBody, CardHeader } from '../components/Card';
import { LoadingState } from '../components/DesignSystem';
import { DailyInterviewSession } from '../components/english/DailyInterviewSession';
import { InterviewMissionHeader } from '../components/english/InterviewMissionHeader';
import { InterviewModuleGrid } from '../components/english/InterviewModuleGrid';
import { SectorListeningPanel } from '../components/english/SectorListeningPanel';
import { TechnicalGlossaryCards } from '../components/english/TechnicalGlossaryCards';
import { useAuth } from '../contexts/AuthContext';
import type {
  DailySession,
  EnglishInterviewLevel,
  GlossaryReviewCard,
  InterviewModeState,
} from '../types/englishInterview';
import { extractYouTubeVideoId } from '../services/english/youtubeListeningService';
import { isInterviewModeStorageReady, reviewGlossaryTerm, updateDailySession } from '../services/english/interviewModeRepository';
import { loadInterviewModeState, reselectDailyEpisode } from '../services/english/interviewModeSession';

type StepKey = 'step_listening_done' | 'step_shadowing_done' | 'step_cards_done' | 'step_question_done';

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
  const sessionRef = useRef<HTMLDivElement | null>(null);

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

  function handleStartSession() {
    sessionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

      <div ref={sessionRef}>
        <DailyInterviewSession
          session={currentState.session}
          episode={currentState.episode}
          question={currentState.question}
          onToggleStep={handleToggleStep}
          onStart={handleStartSession}
        />
      </div>

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

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <TechnicalGlossaryCards cards={currentState.reviewCards} onReview={handleReviewCard} />

        <Card>
          <CardHeader
            title="Pergunta de entrevista"
            subtitle="Treino curto para responder em voz alta."
            icon={<MessageSquareText size={18} />}
            action={(
              <Button type="button" size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={loadState}>
                Atualizar
              </Button>
            )}
          />
          <CardBody className="space-y-4">
            {currentState.question ? (
              <>
                <div className="rounded-lg border border-surface-200 bg-white/70 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-semibold text-primary-700 dark:text-primary-200">
                      {currentState.question.id}
                    </span>
                    <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">
                      {currentState.question.category}
                    </span>
                    <span className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 dark:bg-white/10 dark:text-surface-300">
                      {currentState.question.timer_sugerido_min} min
                    </span>
                  </div>
                  <p className="text-base font-semibold leading-7 text-surface-950 dark:text-white">
                    {currentState.question.question_en}
                  </p>
                </div>

                <div className="space-y-3 text-sm leading-6">
                  <details className="rounded-lg border border-surface-200 bg-white/60 p-3 dark:border-primary-300/15 dark:bg-white/[0.03]">
                    <summary className="cursor-pointer font-semibold text-surface-800 dark:text-surface-100">O que avaliam</summary>
                    <p className="mt-2 text-surface-600 dark:text-surface-300">{currentState.question.o_que_avaliam}</p>
                  </details>
                  <details className="rounded-lg border border-surface-200 bg-white/60 p-3 dark:border-primary-300/15 dark:bg-white/[0.03]">
                    <summary className="cursor-pointer font-semibold text-surface-800 dark:text-surface-100">Como responder</summary>
                    <p className="mt-2 text-surface-600 dark:text-surface-300">{currentState.question.como_responder}</p>
                  </details>
                </div>

                <Button
                  type="button"
                  variant={currentState.session.step_question_done ? 'success' : 'primary'}
                  icon={currentState.session.step_question_done ? <CheckCircle2 size={16} /> : <HelpCircle size={16} />}
                  onClick={() => handleToggleStep('step_question_done')}
                >
                  {currentState.session.step_question_done ? 'Pergunta concluída' : 'Marcar pergunta como concluída'}
                </Button>
              </>
            ) : (
              <p className="text-sm text-surface-500 dark:text-surface-400">Rode o seed do banco de perguntas para ativar esta etapa.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <InterviewModuleGrid />
    </div>
  );
}
