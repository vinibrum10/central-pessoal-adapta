import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, History, RotateCcw, Settings, Video } from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Modal } from '../components/Modal';
import { Badge, ProgressBar } from '../components/Badge';
import { MetricCard, PageHeader } from '../components/DesignSystem';
import { useAuth } from '../contexts/AuthContext';
import { dailyEnglishVideos, getDailyEnglishVideoById, type DailyEnglishVideo } from '../data/englishDailyVideos';
import { generateEnglishQuiz } from '../services/englishQuizApi';
import { getEnglishStudyData, saveEnglishStudyData } from '../services/englishStudyStorage';
import { gerarId, hojeISO } from '../utils';
import type {
  EnglishQuizAttempt,
  EnglishDailyStudy,
  EnglishStudyData,
  GeneratedEnglishQuiz,
  StudySession,
} from '../types/englishStudy';

type YouTubePlayerState = -1 | 0 | 1 | 2 | 3 | 5;

type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => YouTubePlayerState;
  destroy: () => void;
};

type YouTubePlayerConstructor = new (
  elementId: string,
  options: {
    videoId: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: { target: YouTubePlayer }) => void;
      onStateChange?: (event: { data: YouTubePlayerState }) => void;
      onError?: () => void;
    };
  },
) => YouTubePlayer;

declare global {
  interface Window {
    YT?: { Player: YouTubePlayerConstructor; PlayerState?: { PLAYING: 1; PAUSED: 2; ENDED: 0 } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const emptyStudyData: EnglishStudyData = {
  dailyPlan: [],
  sessions: [],
  vocabulary: [],
  phrases: [],
  speakingPractices: [],
  savedVideos: [],
  dailyStudies: [],
  generatedQuizzes: [],
  quizAttempts: [],
};

const passingScorePercent = 60;
const unlockPercent = 80;

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function uniqueSortedSeconds(seconds: number[]) {
  return Array.from(new Set(seconds.filter(second => Number.isFinite(second) && second >= 0))).sort((a, b) => a - b);
}

function createDailyStudy(date: string, video: DailyEnglishVideo): EnglishDailyStudy {
  return {
    date,
    videoId: video.videoId,
    title: video.title,
    durationSeconds: video.durationSeconds,
    watchedSeconds: [],
    progressPercent: 0,
    quizStatus: 'locked',
    quizGenerated: false,
    quizCompleted: false,
    completed: false,
  };
}

function getTodayStudy(data: EnglishStudyData, video: DailyEnglishVideo) {
  const today = hojeISO();
  const savedStudy = data.dailyStudies.find(study => study.date === today);
  if (!savedStudy) return createDailyStudy(today, video);
  return {
    ...createDailyStudy(today, getDailyEnglishVideoById(savedStudy.videoId)),
    ...savedStudy,
    watchedSeconds: Array.isArray(savedStudy.watchedSeconds) ? savedStudy.watchedSeconds : [],
    quizStatus: savedStudy.quizStatus === 'generating' ? 'available' : savedStudy.quizStatus,
    quizGenerated: Boolean(savedStudy.quizGenerated),
    quizCompleted: Boolean(savedStudy.quizCompleted),
    completed: Boolean(savedStudy.completed),
  };
}

function mergeDailyStudy(data: EnglishStudyData, study: EnglishDailyStudy): EnglishStudyData {
  const exists = data.dailyStudies.some(item => item.date === study.date);
  return {
    ...data,
    dailyStudies: exists
      ? data.dailyStudies.map(item => item.date === study.date ? study : item)
      : [study, ...data.dailyStudies],
  };
}

function mergeGeneratedQuiz(data: EnglishStudyData, quiz: GeneratedEnglishQuiz): EnglishStudyData {
  const exists = data.generatedQuizzes.some(item => item.videoId === quiz.videoId);
  return {
    ...data,
    generatedQuizzes: exists
      ? data.generatedQuizzes.map(item => item.videoId === quiz.videoId ? quiz : item)
      : [quiz, ...data.generatedQuizzes],
  };
}

function addQuizAttempt(data: EnglishStudyData, attempt: EnglishQuizAttempt): EnglishStudyData {
  return {
    ...data,
    quizAttempts: [attempt, ...data.quizAttempts],
  };
}

function getGoalStatus(study: EnglishDailyStudy) {
  if (study.completed) return 'Concluída';
  if (study.watchedSeconds.length > 0 || study.quizScorePercent !== undefined) return 'Em andamento';
  return 'Não iniciada';
}

function getQuizStatusLabel(study: EnglishDailyStudy, hasQuiz: boolean) {
  if (study.completed) return 'concluído';
  if (study.quizStatus === 'generating') return 'gerando';
  if (study.quizCompleted) return 'respondido';
  if (study.quizStatus === 'locked') return 'bloqueado';
  if (hasQuiz || study.quizGenerated) return 'disponível';
  return 'disponível';
}

function getWeekSummary(data: EnglishStudyData) {
  const today = new Date(`${hojeISO()}T00:00:00`);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const weekStudies = data.dailyStudies.filter(study => {
    const date = new Date(`${study.date}T00:00:00`);
    return date >= weekStart && date <= today;
  });

  const studiedDays = weekStudies.filter(study => study.watchedSeconds.length > 0 || study.completed).length;
  const minutes = Math.round(weekStudies.reduce((sum, study) => sum + study.watchedSeconds.length, 0) / 60);
  const completedVideos = weekStudies.filter(study => study.completed).length;

  return { studiedDays, minutes, completedVideos };
}

export function InglesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const playerContainerId = useMemo(() => `youtube-player-${gerarId()}`, []);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const intervalRef = useRef<number | null>(null);
  const latestStudyRef = useRef<EnglishDailyStudy | null>(null);
  const latestDataRef = useRef<EnglishStudyData>(emptyStudyData);
  const isTrackingRef = useRef(false);

  const [data, setData] = useState<EnglishStudyData>(emptyStudyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playerStatus, setPlayerStatus] = useState<'loading' | 'ready' | 'playing' | 'paused' | 'unavailable' | 'error'>('loading');
  const [, setIsPlayerPlaying] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizMessage, setQuizMessage] = useState('');
  const [shortcutModal, setShortcutModal] = useState<'Biblioteca' | 'Histórico' | 'Configurações' | null>(null);

  const initialVideo = useMemo(() => getDailyEnglishVideoById(getTodayStudy(data, dailyEnglishVideos[0]).videoId), [data]);
  const todayStudy = useMemo(() => getTodayStudy(data, initialVideo), [data, initialVideo]);
  const currentVideo = useMemo(() => getDailyEnglishVideoById(todayStudy.videoId), [todayStudy.videoId]);
  const generatedQuiz = useMemo(
    () => data.generatedQuizzes.find(quiz => quiz.videoId === currentVideo.videoId),
    [currentVideo.videoId, data.generatedQuizzes],
  );
  const watchedCount = todayStudy.watchedSeconds.length;
  const progressPercent = Math.min(100, Math.round(todayStudy.progressPercent));
  const quizAvailable = todayStudy.quizStatus !== 'locked';
  const quizCompleted = todayStudy.quizCompleted || todayStudy.quizStatus === 'completed';
  const quizPercent = todayStudy.quizScorePercent ?? (todayStudy.quizTotal ? Math.round(((todayStudy.quizScore ?? 0) / todayStudy.quizTotal) * 100) : 0);
  const weekSummary = useMemo(() => getWeekSummary(data), [data]);

  const saveStudy = useCallback(async (study: EnglishDailyStudy, session?: StudySession) => {
    const nextData = mergeDailyStudy(latestDataRef.current, study);
    const withSession = session ? { ...nextData, sessions: [session, ...nextData.sessions] } : nextData;
    latestDataRef.current = withSession;
    setData(withSession);
    await saveEnglishStudyData(userId, withSession);
  }, [userId]);

  const saveData = useCallback(async (nextData: EnglishStudyData) => {
    latestDataRef.current = nextData;
    setData(nextData);
    await saveEnglishStudyData(userId, nextData);
  }, [userId]);

  const stopWatchTimer = useCallback(() => {
    isTrackingRef.current = false;
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const persistStudyProgress = useCallback((study: EnglishDailyStudy) => {
    const nextData = mergeDailyStudy(latestDataRef.current, study);
    latestDataRef.current = nextData;
    latestStudyRef.current = study;
    setData(nextData);
    void saveEnglishStudyData(userId, nextData);
  }, [userId]);

  const trackCurrentPlayerSecond = useCallback(() => {
    const player = playerRef.current;
    const study = latestStudyRef.current;
    if (!player || !study || document.visibilityState !== 'visible') return;

    const currentTime = player.getCurrentTime();
    const durationFromPlayer = player.getDuration();
    const duration = Math.floor(durationFromPlayer || study.durationSeconds || currentVideo.durationSeconds);
    const currentSecond = Math.floor(currentTime);

    if (
      !Number.isFinite(currentSecond)
      || !Number.isFinite(duration)
      || currentSecond < 0
      || duration <= 0
      || currentSecond >= duration
    ) {
      return;
    }

    const watchedSecondsSet = new Set(study.watchedSeconds);
    if (watchedSecondsSet.has(currentSecond)) return;

    const watchedSeconds = uniqueSortedSeconds([...watchedSecondsSet, currentSecond]);
    const nextStudy = recalculateStudy({
      ...study,
      durationSeconds: duration,
      watchedSeconds,
    });
    persistStudyProgress(nextStudy);
  }, [currentVideo.durationSeconds, persistStudyProgress]);

  const startWatchTimer = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    if (isTrackingRef.current) return;

    isTrackingRef.current = true;
    trackCurrentPlayerSecond();
    intervalRef.current = window.setInterval(trackCurrentPlayerSecond, 1000);
  }, [trackCurrentPlayerSecond]);

  useEffect(() => {
    let mounted = true;
    getEnglishStudyData(userId)
      .then(studyData => {
        if (!mounted) return;
        const normalizedData = {
          ...emptyStudyData,
          ...studyData,
          dailyStudies: studyData.dailyStudies ?? [],
          generatedQuizzes: studyData.generatedQuizzes ?? [],
          quizAttempts: studyData.quizAttempts ?? [],
        };
        const study = getTodayStudy(normalizedData, dailyEnglishVideos[0]);
        setData(mergeDailyStudy(normalizedData, study));
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar o estudo diário.'))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [userId]);

  useEffect(() => {
    latestStudyRef.current = todayStudy;
  }, [todayStudy]);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    function createPlayer() {
      if (cancelled || !window.YT?.Player) return;
      playerRef.current?.destroy();
      stopWatchTimer();
      setPlayerStatus('loading');
      setIsPlayerPlaying(false);
      playerRef.current = new window.YT.Player(playerContainerId, {
        videoId: currentVideo.videoId,
        playerVars: {
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: event => {
            const duration = Math.floor(event.target.getDuration() || currentVideo.durationSeconds);
            setPlayerStatus('ready');
            const study = latestStudyRef.current;
            if (study && duration > 0 && Math.abs(study.durationSeconds - duration) > 1) {
              const nextStudy = recalculateStudy({ ...study, durationSeconds: duration });
              void saveStudy(nextStudy);
            }
          },
          onStateChange: event => {
            if (event.data === 1) {
              setIsPlayerPlaying(true);
              setPlayerStatus('playing');
              startWatchTimer();
              return;
            }

            setIsPlayerPlaying(false);
            stopWatchTimer();
            if (event.data === 2 || event.data === 0) setPlayerStatus('paused');
          },
          onError: () => {
            stopWatchTimer();
            setPlayerStatus('unavailable');
          },
        },
      });
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
      window.onYouTubeIframeAPIReady = createPlayer;
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = () => setPlayerStatus('error');
        document.body.appendChild(tag);
      }
    }

    return () => {
      cancelled = true;
      setIsPlayerPlaying(false);
      stopWatchTimer();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [currentVideo.videoId, currentVideo.durationSeconds, loading, playerContainerId, saveStudy, startWatchTimer, stopWatchTimer]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') {
        setIsPlayerPlaying(false);
        stopWatchTimer();
        return;
      }

      if (playerRef.current?.getPlayerState() === 1) {
        setIsPlayerPlaying(true);
        startWatchTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [startWatchTimer, stopWatchTimer]);

  function recalculateStudy(study: EnglishDailyStudy): EnglishDailyStudy {
    const duration = Math.max(1, study.durationSeconds);
    const watchedSeconds = uniqueSortedSeconds(study.watchedSeconds);
    const progress = Math.min(100, (watchedSeconds.length / duration) * 100);
    const quizStatus = study.quizStatus === 'locked' && progress >= unlockPercent ? 'available' : study.quizStatus;
    return {
      ...study,
      watchedSeconds,
      progressPercent: progress,
      quizStatus,
    };
  }

  async function handleChangeVideo() {
    stopWatchTimer();
    setIsPlayerPlaying(false);
    const currentIndex = dailyEnglishVideos.findIndex(video => video.videoId === todayStudy.videoId);
    const nextVideo = dailyEnglishVideos[(currentIndex + 1) % dailyEnglishVideos.length];
    const nextStudy = createDailyStudy(hojeISO(), nextVideo);
    setAnswers({});
    setQuizMessage('');
    await saveStudy(nextStudy);
  }

  async function handleGenerateQuiz() {
    if (!quizAvailable || quizLoading) return;
    if (generatedQuiz) {
      const nextStudy: EnglishDailyStudy = {
        ...todayStudy,
        quizStatus: 'available',
        quizGenerated: true,
      };
      await saveStudy(nextStudy);
      return;
    }

    setError('');
    setQuizMessage('');
    setQuizLoading(true);
    const generatingStudy: EnglishDailyStudy = {
      ...todayStudy,
      quizStatus: 'generating',
    };
    await saveStudy(generatingStudy);

    try {
      const quiz = await generateEnglishQuiz({
        videoId: currentVideo.videoId,
        title: currentVideo.title,
        channel: currentVideo.channel,
        level: currentVideo.cefrLevel,
        theme: currentVideo.theme,
        durationSeconds: todayStudy.durationSeconds,
        transcript: currentVideo.transcript,
        summary: currentVideo.summary,
        questionCount: 5,
      });

      const nextStudy: EnglishDailyStudy = {
        ...generatingStudy,
        quizStatus: 'available',
        quizGenerated: true,
      };
      await saveData(mergeDailyStudy(mergeGeneratedQuiz(latestDataRef.current, quiz), nextStudy));
      setQuizMessage(quiz.warning ?? 'Questionário gerado com IA.');
    } catch (err) {
      const nextStudy: EnglishDailyStudy = {
        ...generatingStudy,
        quizStatus: 'available',
        quizGenerated: false,
      };
      await saveStudy(nextStudy);
      setError(err instanceof Error ? err.message : 'Falha de rede ao gerar questionário.');
    } finally {
      setQuizLoading(false);
    }
  }

  async function handleSubmitQuiz() {
    if (!quizAvailable || !generatedQuiz) return;
    const allAnswered = generatedQuiz.questions.every((_, index) => answers[index] !== undefined);
    if (!allAnswered) {
      setQuizMessage('Responda todas as perguntas antes de enviar.');
      return;
    }

    const score = generatedQuiz.questions.reduce((total, question, index) => total + (answers[index] === question.correctIndex ? 1 : 0), 0);
    const percent = Math.round((score / generatedQuiz.questions.length) * 100);
    const passed = percent >= passingScorePercent;
    const completed = passed && todayStudy.progressPercent >= unlockPercent;
    const nextStudy: EnglishDailyStudy = {
      ...todayStudy,
      quizScore: score,
      quizTotal: generatedQuiz.questions.length,
      quizScorePercent: percent,
      quizStatus: passed ? 'completed' : 'answered',
      quizGenerated: true,
      quizCompleted: true,
      completed,
      completedAt: completed ? new Date().toISOString() : todayStudy.completedAt,
    };
    const attempt: EnglishQuizAttempt = {
      date: hojeISO(),
      videoId: currentVideo.videoId,
      answers: generatedQuiz.questions.map((_, index) => answers[index]),
      correctCount: score,
      totalQuestions: generatedQuiz.questions.length,
      scorePercent: percent,
      passed,
      completedAt: new Date().toISOString(),
    };

    const session: StudySession | undefined = completed && !todayStudy.completed
      ? {
          id: gerarId(),
          date: hojeISO(),
          source: 'youtube',
          title: currentVideo.title,
          url: `https://www.youtube.com/watch?v=${currentVideo.videoId}`,
          minutes: Math.round(todayStudy.watchedSeconds.length / 60),
          level: currentVideo.level,
          understoodPercent: percent,
          newWords: [],
          usefulPhrases: [],
          notes: 'Meta diária de Inglês Diário concluída.',
        }
      : undefined;

    setQuizMessage(passed ? 'Questionário aprovado. Meta diária concluída.' : 'Resultado abaixo de 60%. Revise e refaça o questionário.');
    await saveData(addQuizAttempt(mergeDailyStudy(latestDataRef.current, nextStudy), attempt));
    if (session) {
      const withSession = { ...latestDataRef.current, sessions: [session, ...latestDataRef.current.sessions] };
      await saveData(withSession);
    }
  }

  async function handleRetryQuiz() {
    setAnswers({});
    setQuizMessage('');
    const nextStudy: EnglishDailyStudy = {
      ...todayStudy,
      quizStatus: 'available',
      quizCompleted: false,
      quizScore: undefined,
      quizTotal: undefined,
      quizScorePercent: undefined,
      completed: false,
      completedAt: undefined,
    };
    await saveStudy(nextStudy);
  }

  if (loading) {
    return <p className="text-sm text-surface-500 dark:text-surface-400">Carregando Inglês Diário...</p>;
  }

  return (
    <div className="mx-auto max-w-5xl page-stack">
      <PageHeader
        eyebrow="Estudos"
        title="Inglês Diário"
        subtitle="Assista 1 vídeo curto, responda ao questionário e conclua sua meta diária."
      />

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader
          title="Aula de hoje"
          subtitle="Um vídeo curto, progresso real e questionário para fixar."
          icon={<Video size={18} />}
          action={<Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={handleChangeVideo}>Trocar vídeo</Button>}
        />
        <CardBody className="space-y-4">
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-surface-950 shadow-sm">
            <div id={playerContainerId} className="h-full w-full" />
          </div>

          {playerStatus === 'loading' && <StateNote>Carregando vídeo...</StateNote>}
          {playerStatus === 'unavailable' && <StateNote>Vídeo indisponível. Use "Trocar vídeo" para escolher outro.</StateNote>}
          {playerStatus === 'error' && <StateNote>Erro ao carregar player do YouTube. Verifique sua conexão e tente novamente.</StateNote>}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-surface-950 dark:text-white">{currentVideo.title}</h2>
              <Badge variant={todayStudy.completed ? 'success' : quizAvailable ? 'primary' : 'default'}>{getGoalStatus(todayStudy)}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-surface-500 dark:text-surface-400">
              <span>{currentVideo.channel}</span>
              <span>•</span>
              <span>{formatTime(todayStudy.durationSeconds)}</span>
              <span>•</span>
              <span>{currentVideo.level}</span>
              <span>•</span>
              <span>{currentVideo.theme}</span>
            </div>
          </div>

          <div className="rounded-lg border border-surface-200 bg-surface-50/80 p-4 dark:border-white/10 dark:bg-white/5">
            <ProgressBar value={progressPercent} showLabel height="md" />
            <div className="flex flex-col gap-1 text-sm text-surface-600 dark:text-surface-300 sm:flex-row sm:items-center sm:justify-between">
              <span>Tempo assistido: {formatTime(watchedCount)} / {formatTime(todayStudy.durationSeconds)}</span>
              <span>Progresso: {progressPercent}%</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryItem label="Meta" value={`${unlockPercent}% do vídeo`} />
              <SummaryItem label="Questionário" value={getQuizStatusLabel(todayStudy, Boolean(generatedQuiz))} />
              <SummaryItem label="Nota" value={todayStudy.quizTotal ? `${todayStudy.quizScore}/${todayStudy.quizTotal} (${quizPercent}%)` : 'pendente'} />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Questionário" icon={<BookOpen size={18} />} />
        <CardBody className="space-y-4">
          {!quizAvailable && (
            <StateNote>Assista pelo menos 80% do vídeo para liberar o questionário.</StateNote>
          )}

          {quizAvailable && !generatedQuiz && !quizLoading && (
            <div className="space-y-3">
              <StateNote>Questionário liberado. Gere perguntas com IA para responder e concluir sua meta.</StateNote>
              <Button className="w-full sm:w-auto" loading={quizLoading} onClick={handleGenerateQuiz}>
                Gerar questionário com IA
              </Button>
            </div>
          )}

          {(quizLoading || todayStudy.quizStatus === 'generating') && (
            <StateNote>Gerando perguntas com IA...</StateNote>
          )}

          {quizAvailable && generatedQuiz && (
            <>
              {generatedQuiz.warning && <StateNote>{generatedQuiz.warning}</StateNote>}
              <div className="space-y-4">
                {generatedQuiz.questions.map((question, questionIndex) => (
                  <fieldset key={question.id} className="rounded-lg border border-surface-200 p-4 dark:border-surface-700">
                    <legend className="px-1 text-sm font-semibold text-surface-900 dark:text-white">{question.question}</legend>
                    <div className="mt-3 space-y-2">
                      {question.options.map((option, optionIndex) => (
                        <label key={option} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-700">
                          <input
                            type="radio"
                            name={`question-${questionIndex}`}
                            checked={answers[questionIndex] === optionIndex}
                            onChange={() => setAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }))}
                            disabled={quizCompleted}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                    {quizCompleted && (
                      <p className="mt-3 text-xs text-surface-500 dark:text-surface-400">
                        {question.explanation}
                      </p>
                    )}
                  </fieldset>
                ))}
              </div>

              {todayStudy.quizTotal && (
                <div className="rounded-lg bg-surface-50 p-4 text-sm text-surface-700 dark:bg-surface-900/40 dark:text-surface-200">
                  Acertos: <strong>{todayStudy.quizScore}/{todayStudy.quizTotal}</strong> · Percentual: <strong>{quizPercent}%</strong> · Status:{' '}
                  <strong>{quizPercent >= passingScorePercent ? 'aprovado' : 'revisar'}</strong>
                </div>
              )}

              {quizMessage && <StateNote>{quizMessage}</StateNote>}

              {!quizCompleted && (
                <Button className="w-full sm:w-auto" onClick={handleSubmitQuiz}>
                  Enviar questionário
                </Button>
              )}

              {quizCompleted && quizPercent < passingScorePercent && (
                <Button className="w-full sm:w-auto" variant="secondary" onClick={handleRetryQuiz}>
                  Refazer questionário
                </Button>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard label="Dias estudados" value={weekSummary.studiedDays} icon={<History size={18} />} tone="primary" />
        <MetricCard label="Minutos estudados" value={weekSummary.minutes} icon={<Video size={18} />} tone="success" />
        <MetricCard label="Vídeos concluídos" value={weekSummary.completedVideos} icon={<CheckCircle2 size={18} />} tone="neutral" />
      </div>

      <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:justify-center">
        <Button variant="ghost" icon={<BookOpen size={16} />} onClick={() => setShortcutModal('Biblioteca')}>Biblioteca</Button>
        <Button variant="ghost" icon={<History size={16} />} onClick={() => setShortcutModal('Histórico')}>Histórico</Button>
        <Button variant="ghost" icon={<Settings size={16} />} onClick={() => setShortcutModal('Configurações')}>Configurações</Button>
      </div>

      <Modal isOpen={shortcutModal !== null} onClose={() => setShortcutModal(null)} title={shortcutModal ?? ''} size="md">
        <div className="space-y-3">
          {shortcutModal === 'Biblioteca' && dailyEnglishVideos.map(video => (
            <button
              key={video.videoId}
              onClick={() => {
                void saveStudy(createDailyStudy(hojeISO(), video));
                setShortcutModal(null);
              }}
              className="w-full rounded-lg border border-surface-200 p-3 text-left text-sm hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-700"
            >
              <span className="block font-medium text-surface-900 dark:text-white">{video.title}</span>
              <span className="text-surface-500 dark:text-surface-400">{video.level} · {video.theme}</span>
            </button>
          ))}

          {shortcutModal === 'Histórico' && (
            <div className="space-y-2">
              {data.dailyStudies.length === 0 && <p className="text-sm text-surface-500 dark:text-surface-400">Nenhum estudo registrado ainda.</p>}
              {data.dailyStudies.slice(0, 10).map(study => (
                <div key={`${study.date}-${study.videoId}`} className="rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
                  <p className="font-medium text-surface-900 dark:text-white">{study.date} · {study.completed ? 'Concluído' : 'Em andamento'}</p>
                  <p className="text-surface-500 dark:text-surface-400">{study.title} · {Math.round(study.progressPercent)}%</p>
                </div>
              ))}
            </div>
          )}

          {shortcutModal === 'Configurações' && (
            <p className="text-sm text-surface-600 dark:text-surface-300">
              Meta atual: assistir pelo menos 80% de trechos únicos e acertar 60% do questionário.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-surface-950 dark:text-white">{value}</p>
    </div>
  );
}

function StateNote({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-surface-50/80 px-4 py-3 text-sm text-surface-600 dark:border-white/10 dark:bg-white/5 dark:text-surface-300">
      {children}
    </div>
  );
}
