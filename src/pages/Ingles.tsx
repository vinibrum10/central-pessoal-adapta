import { useEffect, useRef, useState } from 'react';
import { BookOpen, ExternalLink, Mic, Plus, RotateCcw, Trash2, Video } from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Badge } from '../components/Badge';
import { PageHeader } from '../components/DesignSystem';
import {
  type EnglishDataV2,
  type ListeningVideo,
  type VideoQuiz,
  type VocabularyCard,
  DEFAULT_SHADOWING,
  loadEnglishData,
  saveEnglishData,
} from '../services/english/englishStorage';
import {
  isYouTubeConfigured,
  searchListeningVideo,
  extractYouTubeVideoId,
  buildManualListeningVideo,
  type ListeningLevel,
} from '../services/english/youtubeListeningService';
import { generateFallbackQuiz } from '../services/english/videoQuizService';
import { parseShadowingLink, buildShadowingFromLink } from '../services/english/shadowingService';

// ============================================================
// HELPERS
// ============================================================
function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const LEVEL_LABEL: Record<ListeningLevel, string> = {
  basic: 'Básico',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
  fluent: 'Fluente',
};

const STATUS_LABEL: Record<VocabularyCard['reviewStatus'], string> = {
  new: 'Novo',
  learning: 'Aprendendo',
  review: 'Revisão',
  known: 'Dominado',
};

const STATUS_VARIANT: Record<VocabularyCard['reviewStatus'], 'default' | 'primary' | 'warning' | 'success'> = {
  new: 'default',
  learning: 'primary',
  review: 'warning',
  known: 'success',
};

const REVIEW_ACTIONS = [
  { label: 'Errei', status: 'learning', days: 1 },
  { label: 'Difícil', status: 'learning', days: 3 },
  { label: 'Bom', status: 'review', days: 7 },
  { label: 'Fácil', status: 'known', days: 30 },
] as const;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateOnly(date);
}

function formatReviewDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
}

// ============================================================
// MAIN PAGE
// ============================================================
export function InglesPage() {
  // ── State ──────────────────────────────────────────────────
  const [data, setDataState] = useState<EnglishDataV2>(() => loadEnglishData());
  const dataRef = useRef<EnglishDataV2>(data);

  // ETAPA 1 — Listening
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [queryIndex, setQueryIndex] = useState(0);
  const [manualListeningLink, setManualListeningLink] = useState('');
  const [manualLinkError, setManualLinkError] = useState('');

  // ETAPA 2 — Questionário
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number } | null>(null);

  // ETAPA 3 — Shadowing
  const [shadowingLinkInput, setShadowingLinkInput] = useState('');
  const [shadowingLinkError, setShadowingLinkError] = useState('');

  // ETAPA 4 — Cards
  const [cardWord, setCardWord] = useState('');
  const [cardMeaning, setCardMeaning] = useState('');
  const [cardExample, setCardExample] = useState('');

  // ── Persist helper ─────────────────────────────────────────
  function setData(updater: (prev: EnglishDataV2) => EnglishDataV2) {
    setDataState(prev => {
      const next = updater(prev);
      dataRef.current = next;
      saveEnglishData(next);
      return next;
    });
  }

  // Sync dataRef on external state load
  useEffect(() => { dataRef.current = data; }, [data]);

  // Restore quiz UI from storage, and clear it when the selected video changes.
  useEffect(() => {
    const quiz = dataRef.current.videoQuiz;
    if (quiz && quiz.youtubeVideoId === data.listeningVideo?.youtubeVideoId) {
      setQuizAnswers(quiz.answers ?? {});
      setQuizSubmitted(Boolean(quiz.completedAt));
      setQuizScore(
        quiz.completedAt && quiz.score !== undefined
          ? { correct: quiz.score, total: quiz.questions.length }
          : null,
      );
      return;
    }

    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
  }, [data.listeningVideo?.youtubeVideoId, data.videoQuiz?.completedAt, data.videoQuiz?.youtubeVideoId]);

  // ── ETAPA 1: Listening ─────────────────────────────────────
  function handleLevelChange(level: ListeningLevel) {
    setData(prev => ({ ...prev, selectedListeningLevel: level }));
    setVideoError('');
    setQueryIndex(0);
  }

  async function handleSearchVideo() {
    setLoadingVideo(true);
    setVideoError('');

    if (!isYouTubeConfigured()) {
      setVideoError('Configure VITE_YOUTUBE_API_KEY para buscar vídeos reais no YouTube.');
      setLoadingVideo(false);
      return;
    }

    const level = dataRef.current.selectedListeningLevel;
    const excludeId = dataRef.current.listeningVideo?.youtubeVideoId;

    try {
      // Try up to 3 query variations if current index returns nothing
      let video: ListeningVideo | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        video = await searchListeningVideo(level, excludeId, queryIndex + attempt);
        if (video) {
          setQueryIndex(qi => qi + attempt + 1);
          break;
        }
      }

      if (!video) {
        setVideoError('Nenhum vídeo válido encontrado para este nível. Tente outro nível ou clique novamente.');
      } else {
        setData(prev => ({ ...prev, listeningVideo: video!, videoQuiz: null }));
        setManualListeningLink('');
        setManualLinkError('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar vídeo no YouTube.';
      setVideoError(msg);
    } finally {
      setLoadingVideo(false);
    }
  }

  function handleLoadManualListeningLink() {
    const videoId = extractYouTubeVideoId(manualListeningLink);
    if (!videoId) {
      setManualLinkError('Link inválido. Cole um link do YouTube válido.');
      return;
    }

    const video = buildManualListeningVideo(videoId, dataRef.current.selectedListeningLevel);
    setData(prev => ({ ...prev, listeningVideo: video, videoQuiz: null }));
    setManualListeningLink('');
    setManualLinkError('');
    setVideoError('');
  }

  function handleListeningMetaChange(field: 'title' | 'channelTitle' | 'durationSeconds', value: string) {
    setData(prev => {
      if (!prev.listeningVideo) return prev;
      return {
        ...prev,
        listeningVideo: {
          ...prev.listeningVideo,
          [field]: field === 'durationSeconds' ? Math.max(0, Number(value) || 0) : value,
        },
      };
    });
  }

  // ── ETAPA 2: Questionário ───────────────────────────────────
  function handleGenerateQuiz() {
    const videoId = data.listeningVideo?.youtubeVideoId;
    if (!videoId) return;
    const quiz = generateFallbackQuiz(videoId);
    setData(prev => ({ ...prev, videoQuiz: quiz }));
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
  }

  function handleQuizAnswer(questionId: string, answerIndex: number) {
    if (quizSubmitted) return;
    setQuizAnswers(prev => ({ ...prev, [questionId]: answerIndex }));
  }

  function handleSubmitQuiz() {
    const quiz = data.videoQuiz;
    if (!quiz) return;
    const allAnswered = quiz.questions.every(q => quizAnswers[q.id] !== undefined);
    if (!allAnswered) return;

    let correct = 0;
    quiz.questions.forEach(q => {
      if (quizAnswers[q.id] === q.correctAnswerIndex) correct++;
    });
    const total = quiz.questions.length;

    setQuizScore({ correct, total });
    setQuizSubmitted(true);

    const updatedQuiz: VideoQuiz = {
      ...quiz,
      answers: quizAnswers,
      score: correct,
      completedAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, videoQuiz: updatedQuiz }));
  }

  function handleRetryQuiz() {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    if (data.listeningVideo) {
      const newQuiz = generateFallbackQuiz(data.listeningVideo.youtubeVideoId);
      setData(prev => ({ ...prev, videoQuiz: newQuiz }));
    }
  }

  // ── ETAPA 3: Shadowing ──────────────────────────────────────
  function handleLoadShadowingLink() {
    const parsed = parseShadowingLink(shadowingLinkInput);
    if (!parsed) {
      setShadowingLinkError('Link inválido. Cole um link do YouTube (vídeo ou playlist).');
      return;
    }
    setShadowingLinkError('');
    const newPractice = buildShadowingFromLink(parsed, data.shadowingPractice.sentences);
    setData(prev => ({ ...prev, shadowingPractice: newPractice }));
    setShadowingLinkInput('');
  }

  function handleUseDefaultShadowingPlaylist() {
    setData(prev => ({
      ...prev,
      shadowingPractice: {
        ...DEFAULT_SHADOWING,
        sentences: prev.shadowingPractice.sentences,
      },
    }));
    setShadowingLinkInput('');
    setShadowingLinkError('');
  }

  function handleRestoreDefaultShadowingSentences() {
    const hasProgress = dataRef.current.shadowingPractice.sentences.some(s => s.repetitionsDone > 0);
    if (hasProgress && !window.confirm('Deseja também restaurar as frases padrão e zerar repetições?')) {
      return;
    }

    setData(prev => ({
      ...prev,
      shadowingPractice: {
        ...prev.shadowingPractice,
        sentences: DEFAULT_SHADOWING.sentences.map(s => ({ ...s, repetitionsDone: 0 })),
      },
    }));
    setShadowingLinkInput('');
    setShadowingLinkError('');
  }

  function handleRepetitionIncrement(sentenceId: string) {
    setData(prev => ({
      ...prev,
      shadowingPractice: {
        ...prev.shadowingPractice,
        sentences: prev.shadowingPractice.sentences.map(s =>
          s.id === sentenceId ? { ...s, repetitionsDone: Math.min(s.repetitionsDone + 1, s.repetitionsTarget) } : s,
        ),
      },
    }));
  }

  function handleRepetitionReset(sentenceId: string) {
    setData(prev => ({
      ...prev,
      shadowingPractice: {
        ...prev.shadowingPractice,
        sentences: prev.shadowingPractice.sentences.map(s =>
          s.id === sentenceId ? { ...s, repetitionsDone: 0 } : s,
        ),
      },
    }));
  }

  // ── ETAPA 4: Cards ──────────────────────────────────────────
  function handleAddCard() {
    if (!cardWord.trim() || !cardMeaning.trim()) return;
    const card: VocabularyCard = {
      id: genId(),
      word: cardWord.trim(),
      meaning: cardMeaning.trim(),
      example: cardExample.trim() || undefined,
      source: 'manual',
      reviewStatus: 'new',
      createdAt: new Date().toISOString(),
      nextReviewAt: toDateOnly(new Date()),
    };
    setData(prev => ({ ...prev, vocabularyCards: [card, ...prev.vocabularyCards] }));
    setCardWord('');
    setCardMeaning('');
    setCardExample('');
  }

  function handleCardReview(id: string, status: VocabularyCard['reviewStatus'], days: number) {
    setData(prev => ({
      ...prev,
      vocabularyCards: prev.vocabularyCards.map(c =>
        c.id === id ? { ...c, reviewStatus: status, nextReviewAt: addDays(days) } : c,
      ),
    }));
  }

  function handleCardDelete(id: string) {
    setData(prev => ({ ...prev, vocabularyCards: prev.vocabularyCards.filter(c => c.id !== id) }));
  }

  // ── Derived ────────────────────────────────────────────────
  const { selectedListeningLevel, listeningVideo, videoQuiz, shadowingPractice, vocabularyCards } = data;
  const answeredCount = Object.keys(quizAnswers).length;
  const totalQuestions = videoQuiz?.questions.length ?? 0;
  const allAnswered = answeredCount === totalQuestions && totalQuestions > 0;
  const today = toDateOnly(new Date());
  const cardsDueToday = vocabularyCards.filter(card => card.reviewStatus !== 'known' && card.nextReviewAt <= today);
  const futureCards = vocabularyCards.filter(card => card.reviewStatus !== 'known' && card.nextReviewAt > today);
  const knownCards = vocabularyCards.filter(card => card.reviewStatus === 'known');

  function renderVocabularyCards(cards: VocabularyCard[]) {
    if (cards.length === 0) {
      return (
        <p className="text-sm text-surface-400 dark:text-surface-500">
          Nenhum card nesta seção.
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {cards.map(card => (
          <div
            key={card.id}
            className="flex flex-col gap-3 rounded-lg border border-surface-200 px-3 py-2.5 dark:border-surface-700 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-surface-900 dark:text-white">{card.word}</span>
                <Badge variant={STATUS_VARIANT[card.reviewStatus]}>{STATUS_LABEL[card.reviewStatus]}</Badge>
                <span className="text-xs text-surface-400 dark:text-surface-500">
                  Próxima: {formatReviewDate(card.nextReviewAt)}
                </span>
              </div>
              <p className="text-sm text-surface-600 dark:text-surface-300">{card.meaning}</p>
              {card.example && (
                <p className="mt-0.5 text-xs italic text-surface-400 dark:text-surface-500">{card.example}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {REVIEW_ACTIONS.map(action => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleCardReview(card.id, action.status, action.days)}
                  className="rounded-lg border border-surface-200 px-2.5 py-1 text-xs font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-700 transition-colors"
                >
                  {action.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleCardDelete(card.id)}
                className="text-surface-400 hover:text-danger-600 transition-colors"
                title="Excluir card"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── JSX ────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl page-stack">
      <PageHeader
        eyebrow="Estudos"
        title="Inglês Diário"
        subtitle="4 etapas independentes: Listening · Questionário · Shadowing · Cards de vocabulário"
      />

      {/* ══════════════════════════════════════════════════════
          ETAPA 1 — LISTENING
      ══════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader
          title="1. Listening"
          subtitle="Vídeo curto em inglês americano — até 10 minutos."
          icon={<Video size={18} />}
          action={
            listeningVideo ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<RotateCcw size={14} className={loadingVideo ? 'animate-spin' : ''} />}
                onClick={handleSearchVideo}
                disabled={loadingVideo || !isYouTubeConfigured()}
              >
                {loadingVideo ? 'Buscando...' : 'Trocar vídeo'}
              </Button>
            ) : undefined
          }
        />
        <CardBody className="space-y-4">
          {/* Level selector */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Nível</p>
            <div className="flex flex-wrap gap-2">
              {(['basic', 'intermediate', 'advanced', 'fluent'] as const).map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleLevelChange(level)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    selectedListeningLevel === level
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600'
                  }`}
                >
                  {LEVEL_LABEL[level]}
                </button>
              ))}
            </div>
          </div>

          {!isYouTubeConfigured() && (
            <div className="rounded-lg border border-warning-200 bg-warning-50/60 px-4 py-3 text-sm text-warning-700 dark:border-warning-900/40 dark:bg-warning-900/10 dark:text-warning-300">
              Configure <code className="font-mono">VITE_YOUTUBE_API_KEY</code> para buscar vídeos reais no YouTube.
            </div>
          )}

          {videoError && (
            <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300">
              {videoError}
            </div>
          )}

          <div className="space-y-2 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
            <label className="block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
              Cole um link do YouTube para Listening
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={manualListeningLink}
                onChange={e => setManualListeningLink(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLoadManualListeningLink()}
                placeholder="https://youtu.be/..."
                className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
              />
              <Button size="sm" onClick={handleLoadManualListeningLink} disabled={!manualListeningLink.trim()}>
                Carregar link
              </Button>
              <Button size="sm" variant="secondary" loading={loadingVideo} onClick={handleSearchVideo} disabled={loadingVideo || !isYouTubeConfigured()}>
                Buscar vídeo
              </Button>
            </div>
            {manualLinkError && (
              <p className="text-sm text-danger-600 dark:text-danger-400">{manualLinkError}</p>
            )}
          </div>

          {!listeningVideo ? (
            <div className="space-y-3">
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Nenhum vídeo carregado. Busque pela API ou cole um link do YouTube para começar.
              </p>
            </div>
          ) : (
            <>
              {/* Player */}
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-black shadow-sm">
                <iframe
                  key={listeningVideo.youtubeVideoId}
                  src={listeningVideo.embedUrl}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={listeningVideo.title}
                />
              </div>

              {/* Info */}
              <div>
                {listeningVideo.source === 'manual_link' ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-warning-200 bg-warning-50/60 px-4 py-3 text-sm text-warning-700 dark:border-warning-900/40 dark:bg-warning-900/10 dark:text-warning-300">
                      Vídeo carregado manualmente. Confirme se ele tem até 10 minutos.
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        value={listeningVideo.title}
                        onChange={e => handleListeningMetaChange('title', e.target.value)}
                        placeholder="Título"
                        className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
                      />
                      <input
                        value={listeningVideo.channelTitle}
                        onChange={e => handleListeningMetaChange('channelTitle', e.target.value)}
                        placeholder="Canal"
                        className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
                      />
                      <input
                        type="number"
                        min="0"
                        value={listeningVideo.durationSeconds}
                        onChange={e => handleListeningMetaChange('durationSeconds', e.target.value)}
                        placeholder="Duração em segundos"
                        className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-surface-900 dark:text-white leading-tight">{listeningVideo.title}</h2>
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="default">{LEVEL_LABEL[listeningVideo.level]}</Badge>
                  {listeningVideo.durationSeconds > 0 && (
                    <Badge variant="default">{formatSeconds(listeningVideo.durationSeconds)}</Badge>
                  )}
                  {listeningVideo.qualityScore !== undefined && (
                    <Badge variant="default">{`Qualidade: ${listeningVideo.qualityScore}/100`}</Badge>
                  )}
                  {listeningVideo.source === 'manual_link' && (
                    <Badge variant="warning">Link manual</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">{listeningVideo.channelTitle}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={listeningVideo.watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-700"
                >
                  <ExternalLink size={14} />
                  Abrir no YouTube
                </a>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* ══════════════════════════════════════════════════════
          ETAPA 2 — QUESTIONÁRIO
      ══════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader
          title="2. Questionário"
          subtitle={listeningVideo ? `Sobre: ${listeningVideo.title}` : 'Carregue um vídeo na Etapa 1 para liberar.'}
          icon={<BookOpen size={18} />}
        />
        <CardBody className="space-y-4">
          {!listeningVideo ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Escolha um vídeo de Listening antes de gerar o questionário.
            </p>
          ) : !videoQuiz ? (
            <div className="space-y-3">
              <p className="text-sm text-surface-600 dark:text-surface-300">
                Questionário de prática geral baseado no vídeo selecionado. Para perguntas específicas, será necessário adicionar transcrição ou IA em uma etapa futura.
              </p>
              <Button onClick={handleGenerateQuiz}>
                Gerar questionário
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600 dark:border-surface-700 dark:bg-surface-800/60 dark:text-surface-300">
                Questionário de prática geral baseado no vídeo selecionado. Para perguntas específicas, será necessário adicionar transcrição ou IA em uma etapa futura.
              </div>

              {quizScore && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                  quizScore.correct / quizScore.total >= 0.6
                    ? 'border border-success-200 bg-success-50/60 text-success-700 dark:border-success-900/40 dark:bg-success-900/10 dark:text-success-300'
                    : 'border border-warning-200 bg-warning-50/60 text-warning-700 dark:border-warning-900/40 dark:bg-warning-900/10 dark:text-warning-300'
                }`}>
                  Resultado: {quizScore.correct}/{quizScore.total} ({Math.round((quizScore.correct / quizScore.total) * 100)}%)
                  {quizScore.correct / quizScore.total >= 0.6 ? ' — Aprovado!' : ' — Tente novamente.'}
                </div>
              )}

              <div className="space-y-4">
                {videoQuiz.questions.map((q, qi) => (
                  <fieldset key={q.id} className="rounded-lg border border-surface-200 p-4 dark:border-surface-700">
                    <legend className="px-1 text-sm font-semibold text-surface-900 dark:text-white">
                      {qi + 1}. {q.question}
                    </legend>
                    <div className="mt-3 space-y-2">
                      {q.options.map((opt, oi) => {
                        const isSelected = quizAnswers[q.id] === oi;
                        const isCorrect = oi === q.correctAnswerIndex;
                        const showResult = quizSubmitted;
                        return (
                          <label
                            key={oi}
                            className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              showResult
                                ? isCorrect
                                  ? 'border-success-400 bg-success-50/60 text-success-800 dark:border-success-600 dark:bg-success-900/20 dark:text-success-200'
                                  : isSelected
                                    ? 'border-danger-400 bg-danger-50/60 text-danger-800 dark:border-danger-600 dark:bg-danger-900/20 dark:text-danger-200'
                                    : 'border-surface-200 text-surface-600 dark:border-surface-700 dark:text-surface-400'
                                : isSelected
                                  ? 'border-primary-400 bg-primary-50/60 text-primary-800 dark:border-primary-600 dark:bg-primary-900/20 dark:text-primary-200'
                                  : 'border-surface-200 text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              checked={isSelected}
                              onChange={() => handleQuizAnswer(q.id, oi)}
                              disabled={quizSubmitted}
                              className="h-4 w-4 shrink-0 text-primary-600 focus:ring-primary-500"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                    {quizSubmitted && q.explanation && (
                      <p className="mt-3 text-xs text-surface-500 dark:text-surface-400">{q.explanation}</p>
                    )}
                  </fieldset>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {!quizSubmitted ? (
                  <Button onClick={handleSubmitQuiz} disabled={!allAnswered}>
                    Finalizar questionário ({answeredCount}/{totalQuestions})
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={handleRetryQuiz}>
                    Refazer questionário
                  </Button>
                )}
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* ══════════════════════════════════════════════════════
          ETAPA 3 — SHADOWING
      ══════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader
          title="3. Shadowing"
          subtitle="Ouça, leia e repita. Independente do vídeo de listening."
          icon={<Mic size={18} />}
        />
        <CardBody className="space-y-4">
          {/* Player */}
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black shadow-sm">
            <iframe
              key={shadowingPractice.embedUrl}
              src={shadowingPractice.embedUrl}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Shadowing"
            />
          </div>

          {/* Link controls */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={shadowingLinkInput}
              onChange={e => setShadowingLinkInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLoadShadowingLink()}
              placeholder="Cole link do YouTube (vídeo ou playlist)"
              className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
            />
            <Button size="sm" onClick={handleLoadShadowingLink}>Carregar link</Button>
            <Button size="sm" variant="secondary" onClick={handleUseDefaultShadowingPlaylist}>Usar playlist padrão</Button>
            <Button size="sm" variant="secondary" onClick={handleRestoreDefaultShadowingSentences}>Restaurar frases padrão</Button>
          </div>

          {shadowingLinkError && (
            <p className="text-sm text-danger-600 dark:text-danger-400">{shadowingLinkError}</p>
          )}

          {shadowingPractice.source === 'default_playlist' ? (
            <p className="text-xs text-surface-400 dark:text-surface-500">
              Usando playlist padrão de shadowing.{' '}
              <a href={shadowingPractice.watchUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary-600">
                Abrir no YouTube
              </a>
            </p>
          ) : (
            <p className="text-xs text-surface-400 dark:text-surface-500">
              Link manual carregado.{' '}
              <a href={shadowingPractice.watchUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary-600">
                Abrir no YouTube
              </a>
            </p>
          )}

          {/* Sentences */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
              Frases para repetir
            </p>
            <div className="space-y-2">
              {shadowingPractice.sentences.map(sentence => (
                <div
                  key={sentence.id}
                  className="rounded-lg border border-surface-200 p-3 dark:border-surface-700"
                >
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{sentence.text}</p>
                  <p className="mt-0.5 text-xs text-surface-400 dark:text-surface-500">{sentence.translation}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700">
                      <div
                        className="h-full rounded-full bg-primary-500 transition-all"
                        style={{ width: `${(sentence.repetitionsDone / sentence.repetitionsTarget) * 100}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-surface-500 dark:text-surface-400">
                      {sentence.repetitionsDone}/{sentence.repetitionsTarget}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRepetitionIncrement(sentence.id)}
                      disabled={sentence.repetitionsDone >= sentence.repetitionsTarget}
                      className="rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40 transition-all"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRepetitionReset(sentence.id)}
                      className="text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
                    >
                      Resetar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ══════════════════════════════════════════════════════
          ETAPA 4 — CARDS DE VOCABULÁRIO
      ══════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader
          title="4. Revisão de palavras desconhecidas"
          subtitle={`${vocabularyCards.length} card(s) salvos no dispositivo.`}
          icon={<BookOpen size={18} />}
        />
        <CardBody className="space-y-4">
          {/* Add card form */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={cardWord}
              onChange={e => setCardWord(e.target.value)}
              placeholder="Palavra em inglês"
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
            />
            <input
              value={cardMeaning}
              onChange={e => setCardMeaning(e.target.value)}
              placeholder="Significado"
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
            />
            <input
              value={cardExample}
              onChange={e => setCardExample(e.target.value)}
              placeholder="Exemplo (opcional)"
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
            />
          </div>
          <Button
            size="sm"
            icon={<Plus size={14} />}
            disabled={!cardWord.trim() || !cardMeaning.trim()}
            onClick={handleAddCard}
          >
            Adicionar card
          </Button>

          {/* Card list */}
          {vocabularyCards.length === 0 ? (
            <p className="text-sm text-surface-400 dark:text-surface-500">
              Nenhum card adicionado ainda. Adicione palavras novas enquanto assiste ou pratica.
            </p>
          ) : (
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
                  Cards para revisar hoje ({cardsDueToday.length})
                </h3>
                {renderVocabularyCards(cardsDueToday)}
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
                  Cards futuros ({futureCards.length})
                </h3>
                {renderVocabularyCards(futureCards)}
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
                  Cards dominados ({knownCards.length})
                </h3>
                {renderVocabularyCards(knownCards)}
              </section>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
