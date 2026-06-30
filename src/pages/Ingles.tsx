import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Eye, EyeOff, History, Mic, Plus,
  RotateCcw, RotateCw, Settings, Sparkles, Trash2, TrendingUp, Video,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Button } from '../components/Button';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Modal } from '../components/Modal';
import { Badge, ProgressBar } from '../components/Badge';
import { MetricCard, PageHeader } from '../components/DesignSystem';
import { useAuth } from '../contexts/AuthContext';
import { dailyEnglishVideos, getDailyEnglishVideoById, type DailyEnglishVideo } from '../data/englishDailyVideos';
import {
  buscarVideosIngles,
  getYouTubeEmbedUrl,
  getYouTubeEnglishConfigMessage,
  isValidYouTubeVideoId,
  isYouTubeEnglishConfigured,
  validateYouTubeEnglishVideo,
  DURACAO_MAX_SECONDS,
} from '../services/youtubeEnglish';
import { generateEnglishQuiz } from '../services/englishQuizApi';
import { translateWeeklyWord } from '../services/englishWordTranslateApi';
import {
  addDaysISO,
  addPreplyAula,
  addShadowingSession,
  addWeeklyWord,
  deletePreplyAula,
  deleteWeeklyWord,
  getCurrentStudyDate,
  getEnglishStudyData,
  getWatchedVideoIds,
  getWeekStartISO,
  markVideoWatched,
  reviewWeeklyWord,
  saveDuolingoStreak,
  saveEnglishStudyData,
} from '../services/englishStudyStorage';
import { gerarId } from '../utils';
import type {
  DuolingoStreak,
  EnglishQuizAttempt,
  EnglishCefrLevel,
  EnglishDailyStudy,
  EnglishStudyData,
  GeneratedEnglishQuiz,
  PreplyAula,
  ShadowingSession,
  StudySession,
  WeeklyWord,
} from '../types/englishStudy';

type YouTubePlayerState = -1 | 0 | 1 | 2 | 3 | 5;

type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getIframe?: () => HTMLIFrameElement;
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
      onError?: (event?: { data?: number }) => void;
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
  shadowingSessions: [],
  preplyAulas: [],
  watchedVideos: [],
  duolingoStreak: { currentStreak: 0, longestStreak: 0, lastUpdatedDate: '', history: [] },
  weeklyWords: [],
};

const passingScorePercent = 60;
const unlockPercent = 80;
// Shadowing guiado: "nível avançado, 2-5 minutos" — janela estrita de duração,
// rejeita Shorts (<2min) e vídeos longos (>5min) tanto na API quanto no fallback local.
const MIN_SHADOWING_SECONDS = 120;
const MAX_SHADOWING_SECONDS = 300;
const NO_FRESH_VIDEO_MESSAGE = 'Não encontrei um vídeo novo agora. Tente trocar o tema ou buscar novamente.';

function isWithinShadowingDuration(durationSeconds: number): boolean {
  return durationSeconds >= MIN_SHADOWING_SECONDS && durationSeconds <= MAX_SHADOWING_SECONDS;
}

function getLibraryFilterKey(nivel: NivelFiltro, duracao: DuracaoFiltro) {
  return `${nivel}:${duracao}`;
}

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

function hashString(value: string): number {
  return Array.from(value).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

/**
 * Escolha SÍNCRONA e local (sem chamar a API do YouTube) usada apenas para o
 * primeiro paint, antes do efeito assíncrono em InglesPage poder buscar um
 * vídeo real via buscarVideosIngles. Nunca escolhe um vídeo já assistido
 * (histórico completo, não só os últimos N dias) nem um vídeo já concluído
 * hoje, nem um vídeo fora da janela de 2-5 minutos.
 */
function selectDailyVideo(date: string, userId: string | null, data: EnglishStudyData): DailyEnglishVideo {
  const savedStudy = data.dailyStudies.find(study => study.date === date);
  if (savedStudy && !savedStudy.completed && isWithinShadowingDuration(savedStudy.durationSeconds)) {
    return resolveDailyVideoFromStudy(savedStudy);
  }

  const watchedIds = getWatchedVideoIds(data);
  const recentVideoIds = new Set([
    ...data.dailyStudies.map(study => study.videoId),
    ...watchedIds,
  ]);
  const candidates = dailyEnglishVideos.filter(video =>
    !recentVideoIds.has(video.videoId) && isWithinShadowingDuration(video.durationSeconds),
  );
  const pool = candidates.length > 0
    ? candidates
    : dailyEnglishVideos.filter(video => !watchedIds.has(video.videoId) && isWithinShadowingDuration(video.durationSeconds));
  if (pool.length === 0) return dailyEnglishVideos[0];
  const index = Math.abs(hashString(`${userId ?? 'anon'}:${date}`)) % pool.length;
  return pool[index];
}

function resolveDailyVideoFromStudy(study: EnglishDailyStudy): DailyEnglishVideo {
  const localVideo = dailyEnglishVideos.find(video => video.videoId === study.videoId);
  if (localVideo) return localVideo;
  return {
    videoId: study.videoId,
    title: study.title,
    channel: 'YouTube',
    level: 'intermediário',
    cefrLevel: 'B1',
    theme: 'Listening',
    durationSeconds: study.durationSeconds,
    summary: '',
  };
}

function getTodayStudy(data: EnglishStudyData, video: DailyEnglishVideo, today: string) {
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
  const today = getCurrentStudyDate();
  const weekStart = getWeekStartISO(today);

  const weekStudies = data.dailyStudies.filter(study => {
    return study.date >= weekStart && study.date <= today;
  });

  const studiedDays = weekStudies.filter(study => study.watchedSeconds.length > 0 || study.completed).length;
  const minutes = Math.round(weekStudies.reduce((sum, study) => sum + study.watchedSeconds.length, 0) / 60);
  const completedVideos = weekStudies.filter(study => study.completed).length;

  return { studiedDays, minutes, completedVideos };
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface DayActivity {
  date: string;
  label: string;
  isToday: boolean;
  hasDailyStudy: boolean;
  hasShadowing: boolean;
  hasPreply: boolean;
  hasDuolingo: boolean;
  hasWordReview: boolean;
  active: boolean;
}

function getWeekActivity(data: EnglishStudyData): DayActivity[] {
  const today = getCurrentStudyDate();
  const weekStart = getWeekStartISO(today);
  const days: DayActivity[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDaysISO(weekStart, i);
    const hasDailyStudy = data.dailyStudies.some(s => s.date === date && (s.watchedSeconds.length > 0 || s.completed));
    const hasShadowing = data.shadowingSessions.some(s => s.date === date);
    const hasPreply = data.preplyAulas.some(a => a.date === date);
    const hasDuolingo = data.duolingoStreak.history.some(h => h.date === date && h.xp > 0);
    const hasWordReview = data.weeklyWords.some(w => w.lastReviewedAt?.slice(0, 10) === date || w.addedAt.slice(0, 10) === date);
    days.push({
      date,
      label: WEEKDAY_LABELS[i],
      isToday: date === today,
      hasDailyStudy,
      hasShadowing,
      hasPreply,
      hasDuolingo,
      hasWordReview,
      active: hasDailyStudy || hasShadowing || hasPreply || hasDuolingo || hasWordReview,
    });
  }
  return days;
}

function getShadowingStreak(sessions: ShadowingSession[]): number {
  if (sessions.length === 0) return 0;
  const dates = new Set(sessions.map(s => s.date));
  let streak = 0;
  let cursor = getCurrentStudyDate();
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
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
  const isPlayerPlayingRef = useRef(false);
  const currentVideoRef = useRef<DailyEnglishVideo | null>(null);
  const activePlayerVideoIdRef = useRef<string | null>(null);
  const lastProgressPersistAtRef = useRef(0);
  const invalidVideoIdsRef = useRef(new Set<string>());
  const checkedVideoIdRef = useRef<string | null>(null);
  const recoveringVideoRef = useRef(false);

  const [data, setData] = useState<EnglishStudyData>(emptyStudyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playerStatus, setPlayerStatus] = useState<'loading' | 'ready' | 'playing' | 'paused' | 'unavailable' | 'error'>('loading');
  const [, setIsPlayerPlaying] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizMessage, setQuizMessage] = useState('');
  const [shortcutModal, setShortcutModal] = useState<'Histórico' | 'Configurações' | null>(null);
  const [libraryResultsByFilter, setLibraryResultsByFilter] = useState<Record<string, VideoResult[]>>({});
  const [changingVideo, setChangingVideo] = useState(false);
  const [shadowingWizardOpen, setShadowingWizardOpen] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [preplyModalOpen, setPreplyModalOpen] = useState(false);
  const todayDate = getCurrentStudyDate();

  const dailyVideoForDate = useMemo(() => selectDailyVideo(todayDate, userId, data), [data, todayDate, userId]);
  const todayStudy = useMemo(() => getTodayStudy(data, dailyVideoForDate, todayDate), [dailyVideoForDate, data, todayDate]);
  const currentVideo = useMemo(() => resolveDailyVideoFromStudy(todayStudy), [todayStudy]);
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
  const weekActivity = useMemo(() => getWeekActivity(data), [data]);
  const shadowingStreak = useMemo(() => getShadowingStreak(data.shadowingSessions), [data.shadowingSessions]);
  const currentWeekStart = useMemo(() => getWeekStartISO(todayDate), [todayDate]);
  const wordsThisWeek = useMemo(
    () => data.weeklyWords.filter(w => w.weekStart === currentWeekStart),
    [data.weeklyWords, currentWeekStart],
  );
  const wordsDueForReview = useMemo(
    () => data.weeklyWords.filter(w => !w.mastered && w.nextReviewAt <= todayDate),
    [data.weeklyWords, todayDate],
  );
  // Shadowing usa sempre nível avançado e vídeos curtos (2-5 min) — sem busca livre/manual.
  const selectedNivel: NivelFiltro = 'Avançado';
  const selectedDuracao: DuracaoFiltro = 'curto';
  const selectedFilterKey = getLibraryFilterKey(selectedNivel, selectedDuracao);
  const cachedVideosForSelectedFilter = libraryResultsByFilter[selectedFilterKey] ?? [];

  const cacheLibraryResults = useCallback((nivel: NivelFiltro, duracao: DuracaoFiltro, videos: VideoResult[]) => {
    setLibraryResultsByFilter(prev => ({
      ...prev,
      [getLibraryFilterKey(nivel, duracao)]: videos,
    }));
  }, []);

  /**
   * Único ponto de escolha de vídeo "fresco" (não usado por "vídeo do dia"
   * inicial nem por "Trocar vídeo"): tenta cache local de busca, depois a API
   * do YouTube (variando a query algumas vezes), depois o dataset local —
   * em todos os casos excluindo `excludeIds` (histórico completo de vídeos
   * assistidos + o vídeo atual) e exigindo duração entre 2 e 5 minutos.
   * Retorna null se nenhum vídeo novo for encontrado em lugar nenhum.
   */
  const pickFreshVideo = useCallback(async (excludeIds: Set<string>): Promise<DailyEnglishVideo | null> => {
    const cachedCandidates = cachedVideosForSelectedFilter.filter(video =>
      !excludeIds.has(video.videoId) && isWithinShadowingDuration(video.durationSeconds),
    );
    if (cachedCandidates.length > 0) {
      return videoResultToDailyVideo(cachedCandidates[0], selectedNivel, dailyEnglishVideos);
    }

    if (isYouTubeEnglishConfigured()) {
      try {
        for (let queryIndex = 0; queryIndex < 4; queryIndex += 1) {
          const result = await buscarVideosIngles({
            nivel: selectedNivel,
            duracao: selectedDuracao,
            queryIndex,
            seenVideoIds: excludeIds,
          });
          const videos = result.videos.map(youtubeResultToVideoResult);
          if (videos.length > 0) cacheLibraryResults(selectedNivel, selectedDuracao, videos);
          const candidate = result.videos.find(video =>
            !excludeIds.has(video.id) && isWithinShadowingDuration(video.durationSeconds),
          );
          if (candidate) {
            return videoResultToDailyVideo(youtubeResultToVideoResult(candidate), selectedNivel, dailyEnglishVideos);
          }
        }
      } catch {
        // API falhou ou ficou sem resultados — cai para o fallback local abaixo
        // em vez de repetir o último vídeo conhecido.
      }
    }

    const localFallback = getLocalFallbackVideos(dailyEnglishVideos, selectedNivel, selectedDuracao)
      .filter(video => !excludeIds.has(video.videoId) && isWithinShadowingDuration(video.durationSeconds));
    if (localFallback.length > 0) {
      cacheLibraryResults(selectedNivel, selectedDuracao, localFallback);
      return videoResultToDailyVideo(localFallback[0], selectedNivel, dailyEnglishVideos);
    }

    return null;
  }, [cachedVideosForSelectedFilter, cacheLibraryResults, selectedDuracao, selectedNivel]);

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
    const now = Date.now();
    const previousProgress = latestStudyRef.current?.progressPercent ?? 0;
    let nextData = mergeDailyStudy(latestDataRef.current, study);
    const crossedUnlock = previousProgress < unlockPercent && study.progressPercent >= unlockPercent;

    // Cruzou o limiar de "assistido o suficiente" agora — marca no histórico
    // permanente para que esse vídeo nunca mais seja sugerido novamente,
    // mesmo que o usuário não termine o questionário.
    if (crossedUnlock) {
      const watchedVideo = resolveDailyVideoFromStudy(study);
      nextData = markVideoWatched(nextData, {
        videoId: study.videoId,
        title: watchedVideo.title,
        channel: watchedVideo.channel,
        durationSeconds: study.durationSeconds,
        status: 'watched',
      });
    }

    latestDataRef.current = nextData;
    latestStudyRef.current = study;

    if (!crossedUnlock && now - lastProgressPersistAtRef.current < 5000) {
      return;
    }

    lastProgressPersistAtRef.current = now;
    console.info('[Inglês Diário] Salvando progresso sem recriar player.', {
      videoId: study.videoId,
      watchedSeconds: study.watchedSeconds.length,
      progressPercent: Math.round(study.progressPercent),
    });
    setData(nextData);
    void saveEnglishStudyData(userId, nextData);
  }, [userId]);

  const trackCurrentPlayerSecond = useCallback(() => {
    const player = playerRef.current;
    const study = latestStudyRef.current;
    if (!player || !study || document.visibilityState !== 'visible') return;

    const currentTime = player.getCurrentTime();
    const durationFromPlayer = player.getDuration();
    const duration = Math.floor(durationFromPlayer || study.durationSeconds || currentVideoRef.current?.durationSeconds || 0);
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
  }, [persistStudyProgress]);

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
          shadowingSessions: studyData.shadowingSessions ?? [],
          preplyAulas: studyData.preplyAulas ?? [],
          duolingoStreak: studyData.duolingoStreak ?? emptyStudyData.duolingoStreak,
          weeklyWords: studyData.weeklyWords ?? [],
          watchedVideos: studyData.watchedVideos ?? [],
        };
        const studyDate = getCurrentStudyDate();
        const video = selectDailyVideo(studyDate, userId, normalizedData);
        const study = getTodayStudy(normalizedData, video, studyDate);
        const hydratedData = mergeDailyStudy(normalizedData, study);
        latestDataRef.current = hydratedData;
        setData(hydratedData);
        if (!normalizedData.dailyStudies.some(item => item.date === studyDate)) {
          void saveEnglishStudyData(userId, hydratedData);
        }
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
    currentVideoRef.current = currentVideo;
  }, [currentVideo]);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  // Garante que o "vídeo do dia" nunca fique parado em um vídeo já concluído
  // ou fora da janela de 2-5 minutos: se acontecer, busca um substituto real
  // (excluindo todo o histórico assistido) assim que os dados carregam ou o
  // estudo de hoje muda de status. Idempotente por "requestKey" — só dispara
  // de novo se a condição realmente mudar (evita loop de chamadas à API).
  const dailyVideoRequestRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    if (isPlayerPlayingRef.current || playerRef.current?.getPlayerState() === 1) {
      console.info('[Inglês Diário] Busca automática ignorada: vídeo em reprodução.');
      return;
    }

    const savedToday = latestDataRef.current.dailyStudies.find(study => study.date === todayDate);
    const needsFreshVideo = !savedToday
      || savedToday.completed
      || !isWithinShadowingDuration(savedToday.durationSeconds);
    if (!needsFreshVideo) return;

    const requestKey = `${todayDate}:${savedToday ? `${savedToday.videoId}:${savedToday.completed}` : 'none'}`;
    if (dailyVideoRequestRef.current === requestKey) return;
    dailyVideoRequestRef.current = requestKey;

    let cancelled = false;
    (async () => {
      console.info('[Inglês Diário] Busca automática inicial disparada.', {
        efeito: 'dailyVideoRequest',
        requestKey,
        motivo: !savedToday ? 'sem estudo do dia' : savedToday.completed ? 'estudo concluído' : 'duração fora da janela',
      });
      const excludeIds = new Set([
        ...getWatchedVideoIds(latestDataRef.current),
        ...(savedToday ? [savedToday.videoId] : []),
      ]);
      const video = await pickFreshVideo(excludeIds).catch(() => null);
      if (cancelled) return;
      if (!video) {
        // Não encontrou um vídeo novo em lugar nenhum — nunca repete o vídeo
        // antigo/concluído só para preencher a tela; mostra mensagem amigável.
        setError(NO_FRESH_VIDEO_MESSAGE);
        return;
      }
      await saveStudy(createDailyStudy(todayDate, video));
    })();

    return () => { cancelled = true; };
  }, [loading, todayDate, pickFreshVideo, saveStudy]);

  useEffect(() => {
    if (loading || recoveringVideoRef.current || checkedVideoIdRef.current === currentVideo.videoId) return;

    let cancelled = false;
    checkedVideoIdRef.current = currentVideo.videoId;
    const videoIdToValidate = currentVideo.videoId;
    const videoToValidate = currentVideo;
    console.info('[Inglês Diário] Validando vídeo carregado.', { videoId: videoIdToValidate });

    validateDailyVideo(videoToValidate)
      .then(validation => {
        if (cancelled) return;
        if (!validation.ok) {
          invalidVideoIdsRef.current.add(videoIdToValidate);
          void replaceCurrentVideo(validation.reason ?? 'Vídeo atual inválido.');
          return;
        }

        const latestStudy = latestStudyRef.current;
        if (validation.video && latestStudy?.videoId === videoIdToValidate && Math.abs(validation.video.durationSeconds - latestStudy.durationSeconds) > 1) {
          const nextStudy = recalculateStudy({
            ...latestStudy,
            title: validation.video.title,
            durationSeconds: validation.video.durationSeconds,
          });
          void saveStudy(nextStudy);
        }
      })
      .catch(err => {
        console.warn('[Inglês Diário] Falha ao validar vídeo atual.', {
          videoId: videoIdToValidate,
          erro: err,
        });
      });

    return () => { cancelled = true; };
  }, [currentVideo.videoId, loading, saveStudy]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const videoIdForPlayer = currentVideo.videoId;

    function createPlayer() {
      if (cancelled || !window.YT?.Player) return;
      if (!isValidYouTubeVideoId(videoIdForPlayer)) {
        void recoverFromUnavailableVideo(videoIdForPlayer, 'videoId ausente ou inválido antes de criar o player.');
        return;
      }
      if (playerRef.current && activePlayerVideoIdRef.current === videoIdForPlayer) {
        console.info('[Inglês Diário] Player já montado para o vídeo atual; mantendo iframe.', { videoId: videoIdForPlayer });
        return;
      }

      console.info('[Inglês Diário] Montando iframe/player do YouTube.', {
        videoId: videoIdForPlayer,
        src: getYouTubeEmbedUrl(videoIdForPlayer),
      });
      playerRef.current?.destroy();
      stopWatchTimer();
      activePlayerVideoIdRef.current = videoIdForPlayer;
      setPlayerStatus('loading');
      setIsPlayerPlaying(false);
      playerRef.current = new window.YT.Player(playerContainerId, {
        videoId: videoIdForPlayer,
        playerVars: {
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: event => {
            const fallbackDuration = currentVideoRef.current?.videoId === videoIdForPlayer
              ? currentVideoRef.current.durationSeconds
              : 0;
            const duration = Math.floor(event.target.getDuration() || fallbackDuration);
            const iframe = event.target.getIframe?.();
            iframe?.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
            iframe?.setAttribute('allowfullscreen', 'true');
            iframe?.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            console.info('[Inglês Diário] Player pronto.', { videoId: videoIdForPlayer, duration });
            setPlayerStatus('ready');
            const study = latestStudyRef.current;
            if (study?.videoId === videoIdForPlayer && duration > 0 && Math.abs(study.durationSeconds - duration) > 1) {
              const nextStudy = recalculateStudy({ ...study, durationSeconds: duration });
              void saveStudy(nextStudy);
            }
          },
          onStateChange: event => {
            if (event.data === 1) {
              isPlayerPlayingRef.current = true;
              setIsPlayerPlaying(true);
              setPlayerStatus('playing');
              console.info('[Inglês Diário] Reprodução iniciada/retomada.', { videoId: videoIdForPlayer });
              startWatchTimer();
              return;
            }

            isPlayerPlayingRef.current = false;
            setIsPlayerPlaying(false);
            stopWatchTimer();
            if (event.data === 2 || event.data === 0) {
              setPlayerStatus('paused');
              console.info('[Inglês Diário] Reprodução pausada/finalizada pelo player.', {
                videoId: videoIdForPlayer,
                state: event.data,
              });
            }
          },
          onError: event => {
            stopWatchTimer();
            isPlayerPlayingRef.current = false;
            setPlayerStatus('unavailable');
            console.warn('[Inglês Diário] Vídeo marcado como indisponível por erro real do YouTube.', {
              videoId: videoIdForPlayer,
              errorCode: event?.data ?? 'desconhecido',
            });
            void recoverFromUnavailableVideo(videoIdForPlayer, `Erro do player do YouTube: ${event?.data ?? 'desconhecido'}.`);
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
      console.info('[Inglês Diário] Desmontando iframe/player do YouTube.', { videoId: videoIdForPlayer });
      isPlayerPlayingRef.current = false;
      setIsPlayerPlaying(false);
      stopWatchTimer();
      playerRef.current?.destroy();
      playerRef.current = null;
      if (activePlayerVideoIdRef.current === videoIdForPlayer) activePlayerVideoIdRef.current = null;
    };
  }, [currentVideo.videoId, loading, playerContainerId, saveStudy, startWatchTimer, stopWatchTimer]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') {
        setIsPlayerPlaying(false);
        stopWatchTimer();
        console.info('[Inglês Diário] Aba perdeu visibilidade; pausando apenas o timer de progresso.');
        return;
      }

      if (playerRef.current?.getPlayerState() === 1) {
        isPlayerPlayingRef.current = true;
        setIsPlayerPlaying(true);
        console.info('[Inglês Diário] Aba visível novamente; retomando timer de progresso.');
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

  async function validateDailyVideo(video: DailyEnglishVideo) {
    if (!isValidYouTubeVideoId(video.videoId)) {
      return { ok: false, reason: 'videoId ausente ou inválido.' };
    }

    const validation = await validateYouTubeEnglishVideo(video.videoId);
    if (!validation.ok) return validation;

    if (validation.video && Math.abs(validation.video.durationSeconds - video.durationSeconds) > 1) {
      return {
        ...validation,
        video: {
          ...validation.video,
          durationSeconds: validation.video.durationSeconds,
        },
      };
    }
    return validation;
  }

  async function findNextDailyVideo(recentVideoIds: Set<string>): Promise<DailyEnglishVideo | null> {
    const cachedCandidates = cachedVideosForSelectedFilter.filter(video => (
      isValidYouTubeVideoId(video.videoId)
      && !recentVideoIds.has(video.videoId)
      && !invalidVideoIdsRef.current.has(video.videoId)
      && isWithinShadowingDuration(video.durationSeconds)
    ));

    if (cachedCandidates.length > 0) {
      const cachedVideo = videoResultToDailyVideo(cachedCandidates[0], selectedNivel, dailyEnglishVideos);
      console.info('[Inglês Diário] Vídeo selecionado do cache.', { videoId: cachedVideo.videoId });
      return cachedVideo;
    }

    if (isYouTubeEnglishConfigured()) {
      for (let queryIndex = 0; queryIndex < 4; queryIndex += 1) {
        const result = await buscarVideosIngles({
          nivel: selectedNivel,
          duracao: selectedDuracao,
          queryIndex,
          seenVideoIds: new Set([...recentVideoIds, ...invalidVideoIdsRef.current]),
          allowFallback: true,
        });
        const videos = result.videos.map(youtubeResultToVideoResult);
        if (videos.length > 0) cacheLibraryResults(selectedNivel, selectedDuracao, videos);

        const candidate = result.videos.find(video => (
          isValidYouTubeVideoId(video.id)
          && !recentVideoIds.has(video.id)
          && !invalidVideoIdsRef.current.has(video.id)
          && isWithinShadowingDuration(video.durationSeconds)
        ));

        if (candidate) {
          console.info('[Inglês Diário] Vídeo selecionado da API.', {
            videoId: candidate.id,
            fallback: result.usedFallback,
          });
          return videoResultToDailyVideo(youtubeResultToVideoResult(candidate), selectedNivel, dailyEnglishVideos);
        }
      }
    } else {
      console.warn('[Inglês Diário] YouTube sem configuração.', {
        motivo: getYouTubeEnglishConfigMessage(),
        variavelEsperada: 'VITE_YOUTUBE_API_KEY',
      });
    }

    const fallback = getLocalFallbackVideos(dailyEnglishVideos, selectedNivel, selectedDuracao)
      .filter(video => (
        isValidYouTubeVideoId(video.videoId)
        && !recentVideoIds.has(video.videoId)
        && !invalidVideoIdsRef.current.has(video.videoId)
        && isWithinShadowingDuration(video.durationSeconds)
      ));

    for (const video of fallback) {
      if (!isYouTubeEnglishConfigured()) {
        cacheLibraryResults(selectedNivel, selectedDuracao, fallback);
        console.info('[Inglês Diário] Vídeo local selecionado sem validação remota.', { videoId: video.videoId });
        return videoResultToDailyVideo(video, selectedNivel, dailyEnglishVideos);
      }

      const validation = await validateYouTubeEnglishVideo(video.videoId);
      if (validation.ok) {
        cacheLibraryResults(selectedNivel, selectedDuracao, fallback);
        console.info('[Inglês Diário] Vídeo local validado e selecionado.', { videoId: video.videoId });
        return videoResultToDailyVideo(video, selectedNivel, dailyEnglishVideos);
      }

      invalidVideoIdsRef.current.add(video.videoId);
      console.warn('[Inglês Diário] Vídeo local descartado.', { videoId: video.videoId, motivo: validation.reason });
    }

    return null;
  }

  async function replaceCurrentVideo(reason: string) {
    if (recoveringVideoRef.current) return;
    recoveringVideoRef.current = true;
    stopWatchTimer();
    isPlayerPlayingRef.current = false;
    setIsPlayerPlaying(false);
    setPlayerStatus('loading');
    setChangingVideo(true);

    const recentVideoIds = new Set([
      todayStudy.videoId,
      ...getWatchedVideoIds(latestDataRef.current),
      ...latestDataRef.current.sessions.slice(0, 12)
        .map(session => getVideoIdFromYouTubeUrl(session.url))
        .filter(Boolean),
      ...invalidVideoIdsRef.current,
    ]);

    try {
      console.warn('[Inglês Diário] Buscando substituto para vídeo atual.', {
        motivo: reason,
        videoIdAtual: todayStudy.videoId,
      });
      const nextVideo = await findNextDailyVideo(recentVideoIds);
      if (!nextVideo) {
        setError(NO_FRESH_VIDEO_MESSAGE);
        setPlayerStatus('unavailable');
        return;
      }

      const nextStudy = createDailyStudy(todayDate, nextVideo);
      setAnswers({});
      setQuizMessage('');
      setError('');
      await saveStudy(nextStudy);
    } catch (err) {
      console.error('[Inglês Diário] Falha ao substituir vídeo.', err);
      setError('Não consegui carregar outro vídeo agora. Tente novamente em instantes.');
      setPlayerStatus('unavailable');
    } finally {
      recoveringVideoRef.current = false;
      setChangingVideo(false);
    }
  }

  async function recoverFromUnavailableVideo(videoId: string, reason: string) {
    invalidVideoIdsRef.current.add(videoId);
    checkedVideoIdRef.current = null;
    console.warn('[Inglês Diário] Vídeo indisponível removido da rotação.', { videoId, motivo: reason });
    await replaceCurrentVideo(reason);
  }

  async function handleChangeVideo() {
    if (changingVideo) return;
    setError('');
    await replaceCurrentVideo('Troca manual solicitada.');
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

    let quiz: GeneratedEnglishQuiz;
    try {
      quiz = await generateEnglishQuiz({
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
    } catch {
      const nextStudy: EnglishDailyStudy = {
        ...generatingStudy,
        quizStatus: 'available',
        quizGenerated: false,
      };
      await saveStudy(nextStudy);
      setError('Não foi possível gerar o questionário agora. Tente novamente.');
      setQuizLoading(false);
      return;
    }

    try {
      const nextStudy: EnglishDailyStudy = {
        ...generatingStudy,
        quizStatus: 'available',
        quizGenerated: true,
      };
      await saveData(mergeDailyStudy(mergeGeneratedQuiz(latestDataRef.current, quiz), nextStudy));
      setQuizMessage(quiz.warning ?? 'Questionário gerado com IA.');
    } catch (err) {
      console.error('English quiz save failed', err);
      const nextData = mergeDailyStudy(mergeGeneratedQuiz(latestDataRef.current, quiz), {
        ...generatingStudy,
        quizStatus: 'available',
        quizGenerated: true,
      });
      latestDataRef.current = nextData;
      setData(nextData);
      const nextStudy: EnglishDailyStudy = {
        ...generatingStudy,
        quizStatus: 'available',
        quizGenerated: true,
      };
      await saveStudy(nextStudy).catch(saveErr => console.error('English quiz status save failed', saveErr));
      setQuizMessage('Questionário gerado, mas não foi possível salvar automaticamente. Ele pode ser perdido ao recarregar a página.');
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
      date: todayDate,
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
          date: todayDate,
          source: 'youtube',
          title: currentVideo.title,
          url: getYouTubeEmbedUrl(currentVideo.videoId),
          minutes: Math.round(todayStudy.watchedSeconds.length / 60),
          level: currentVideo.level,
          understoodPercent: percent,
          newWords: [],
          usefulPhrases: [],
          notes: 'Meta diária de Inglês Diário concluída.',
        }
      : undefined;

    setQuizMessage(passed ? 'Questionário aprovado. Meta diária concluída.' : 'Resultado abaixo de 60%. Revise e refaça o questionário.');
    let nextData = addQuizAttempt(mergeDailyStudy(latestDataRef.current, nextStudy), attempt);
    if (completed) {
      // Concluiu de fato (assistiu + passou no questionário) — nunca mais sugerir este vídeo.
      nextData = markVideoWatched(nextData, {
        videoId: currentVideo.videoId,
        title: currentVideo.title,
        channel: currentVideo.channel,
        durationSeconds: todayStudy.durationSeconds,
        status: 'completed',
      });
    }
    await saveData(nextData);
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

  async function handleSaveShadowingSession(session: ShadowingSession) {
    const next = await addShadowingSession(userId, session);
    await saveData(next);
  }

  async function handleAddPreplyAula(aula: PreplyAula) {
    const next = await addPreplyAula(userId, aula);
    await saveData(next);
  }

  async function handleDeletePreplyAula(id: string) {
    const next = await deletePreplyAula(userId, id);
    await saveData(next);
  }

  async function handleUpdateDuolingoStreak(streak: DuolingoStreak) {
    const next = await saveDuolingoStreak(userId, streak);
    await saveData(next);
  }

  async function handleAddWeeklyWord(word: { word: string; translation: string; example?: string }) {
    const next = await addWeeklyWord(userId, {
      word: word.word,
      translation: word.translation,
      example: word.example,
      weekStart: currentWeekStart,
    });
    await saveData(next);
  }

  async function handleReviewWeeklyWord(id: string, remembered: boolean) {
    const next = await reviewWeeklyWord(userId, id, remembered);
    await saveData(next);
  }

  async function handleDeleteWeeklyWord(id: string) {
    const next = await deleteWeeklyWord(userId, id);
    await saveData(next);
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
          action={<Button size="sm" variant="secondary" icon={<RotateCcw size={14} className={changingVideo ? 'animate-spin' : ''} />} onClick={handleChangeVideo} disabled={changingVideo}>{changingVideo ? 'Buscando...' : 'Trocar vídeo'}</Button>}
        />
        <CardBody className="space-y-4">
          <StateNote>Vídeo do dia: nível avançado, 2-5 minutos, temas de carreira, tecnologia, notícias ou cultura americana — carregado automaticamente.</StateNote>

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

      <Card>
        <CardHeader title="Atividade da semana" subtitle="Um círculo por dia: estudo diário, shadowing, Preply, Duolingo ou revisão de palavras." icon={<TrendingUp size={18} />} />
        <CardBody>
          <WeekActivityRow days={weekActivity} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Shadowing guiado"
          subtitle={`Sequência de 5 passos para praticar pronúncia. Streak atual: ${shadowingStreak} dia(s).`}
          icon={<Mic size={18} />}
          action={<Button size="sm" icon={<Mic size={14} />} onClick={() => setShadowingWizardOpen(true)}>Iniciar shadowing</Button>}
        />
        <CardBody>
          {data.shadowingSessions.length === 0 ? (
            <StateNote>Nenhuma sessão de shadowing registrada ainda. Use o vídeo de hoje para praticar.</StateNote>
          ) : (
            <div className="space-y-2">
              {data.shadowingSessions.slice(0, 3).map(session => (
                <div key={session.id} className="flex items-center justify-between rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700">
                  <span className="text-surface-700 dark:text-surface-200">{session.date} · {session.title}</span>
                  <Badge variant={session.status === 'completa' ? 'success' : 'default'}>{session.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <PalavrasDaSemanaCard
        wordsThisWeek={wordsThisWeek}
        wordsDueForReview={wordsDueForReview}
        allWords={data.weeklyWords}
        onAdd={handleAddWeeklyWord}
        onReview={handleReviewWeeklyWord}
        onDelete={handleDeleteWeeklyWord}
      />

      <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:justify-center sm:flex-wrap">
        <Button variant="ghost" icon={<History size={16} />} onClick={() => setShortcutModal('Histórico')}>Histórico</Button>
        <Button variant="ghost" icon={<BarChart3 size={16} />} onClick={() => setProgressModalOpen(true)}>Meu Progresso</Button>
        <Button variant="ghost" icon={<Settings size={16} />} onClick={() => setShortcutModal('Configurações')}>Configurações</Button>
      </div>

      <ShadowingWizardModal
        isOpen={shadowingWizardOpen}
        onClose={() => setShadowingWizardOpen(false)}
        video={currentVideo}
        onSave={handleSaveShadowingSession}
        onAddWords={handleAddWeeklyWord}
      />

      <MeuProgressoModal
        isOpen={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
        data={data}
        shadowingStreak={shadowingStreak}
        onOpenPreplyModal={() => setPreplyModalOpen(true)}
        onUpdateDuolingo={handleUpdateDuolingoStreak}
      />

      <PreplyModal
        isOpen={preplyModalOpen}
        onClose={() => setPreplyModalOpen(false)}
        aulas={data.preplyAulas}
        onAdd={handleAddPreplyAula}
        onDelete={handleDeletePreplyAula}
        onAddWords={handleAddWeeklyWord}
      />

      <Modal isOpen={shortcutModal !== null} onClose={() => setShortcutModal(null)} title={shortcutModal ?? ''} size="lg">
        <div className="space-y-3">
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

// ============================================================
// BIBLIOTECA DE VÍDEOS
// ============================================================
type NivelFiltro = 'Iniciante' | 'Intermediário' | 'Avançado';
type DuracaoFiltro = 'curto' | 'medio' | 'longo';

const NIVEL_CEFR: Record<NivelFiltro, string[]> = {
  'Iniciante':     ['A1', 'A2'],
  'Intermediário': ['B1', 'B2'],
  'Avançado':      ['C1', 'C2'],
};

// Default CEFR representative for each level (used when creating a synthetic DailyEnglishVideo)
const NIVEL_CEFR_DEFAULT: Record<NivelFiltro, EnglishCefrLevel> = {
  'Iniciante':     'A2',
  'Intermediário': 'B1',
  'Avançado':      'C1',
};

const DURACAO_LABEL: Record<DuracaoFiltro, string> = {
  'curto': 'Curto (até 5 min)',
  'medio': 'Médio (até 10 min)',
  'longo': 'Longo (até 20 min)',
};

// Unified result type used inside BibliotecaVideos (covers both YouTube API and local fallback)
interface VideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl?: string;
  url: string;
  durationSeconds: number;
  cefrLevel?: string;
  theme?: string;
}

function toVideoResult(v: DailyEnglishVideo): VideoResult {
  return {
    videoId: v.videoId,
    title: v.title,
    channelTitle: v.channel,
    thumbnailUrl: `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
    url: getYouTubeEmbedUrl(v.videoId),
    durationSeconds: v.durationSeconds,
    cefrLevel: v.cefrLevel,
    theme: v.theme,
  };
}

function getVideoIdFromYouTubeUrl(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.split('/').filter(Boolean)[0] ?? '';
    if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] ?? '';
    return parsed.searchParams.get('v') ?? '';
  } catch {
    return '';
  }
}

function getLocalFallbackVideos(allVideos: DailyEnglishVideo[], nivel: NivelFiltro, duracao: DuracaoFiltro): VideoResult[] {
  const maxSec = DURACAO_MAX_SECONDS[duracao];
  return allVideos
    .filter(v => NIVEL_CEFR[nivel].includes(v.cefrLevel) && v.durationSeconds <= maxSec)
    .map(toVideoResult);
}

function videoResultToDailyVideo(video: VideoResult, nivel: NivelFiltro, allVideos: DailyEnglishVideo[]): DailyEnglishVideo {
  const localMatch = allVideos.find(v => v.videoId === video.videoId);
  if (localMatch) return localMatch;
  return {
    videoId: video.videoId,
    title: video.title,
    channel: video.channelTitle,
    level: nivel === 'Iniciante' ? 'iniciante' : nivel === 'Avançado' ? 'avançado' : 'intermediário',
    cefrLevel: NIVEL_CEFR_DEFAULT[nivel],
    theme: video.theme ?? 'Listening',
    durationSeconds: video.durationSeconds,
    summary: '',
  };
}

function youtubeResultToVideoResult(video: Awaited<ReturnType<typeof buscarVideosIngles>>['videos'][number]): VideoResult {
  return {
    videoId: video.id,
    title: video.title,
    channelTitle: video.channelTitle,
    thumbnailUrl: video.thumbnailUrl,
    url: video.url,
    durationSeconds: video.durationSeconds,
  };
}

export function BibliotecaVideos({
  allVideos,
  onSelectVideo,
  nivel,
  duracao,
  onNivelChange,
  onDuracaoChange,
  cachedResults,
  onCacheResults,
}: {
  allVideos: DailyEnglishVideo[];
  onSelectVideo: (v: DailyEnglishVideo) => void;
  nivel: NivelFiltro;
  duracao: DuracaoFiltro;
  onNivelChange: (nivel: NivelFiltro) => void;
  onDuracaoChange: (duracao: DuracaoFiltro) => void;
  cachedResults: VideoResult[];
  onCacheResults: (nivel: NivelFiltro, duracao: DuracaoFiltro, videos: VideoResult[]) => void;
}) {
  const [resultados, setResultados] = useState<VideoResult[]>(cachedResults);
  const [hasSearched, setHasSearched] = useState(cachedResults.length > 0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [noMoreResults, setNoMoreResults] = useState(false);

  // Pagination state held in a ref to avoid stale closures between buscar and buscarNovasOpcoes
  const pageStateRef = useRef<{
    nextPageToken: string | null;
    queryIndex: number;
    seenVideoIds: Set<string>;
  }>({ nextPageToken: null, queryIndex: 0, seenVideoIds: new Set() });

  const nivelOpts: NivelFiltro[] = ['Iniciante', 'Intermediário', 'Avançado'];
  const duracaoOpts: DuracaoFiltro[] = ['curto', 'medio', 'longo'];

  useEffect(() => {
    setResultados(cachedResults);
    setHasSearched(cachedResults.length > 0);
    setError('');
    setNoMoreResults(false);
  }, [cachedResults, nivel, duracao]);

  function changeNivel(n: NivelFiltro) {
    onNivelChange(n);
    setHasSearched(false);
    setResultados([]);
    setError('');
    setNoMoreResults(false);
  }

  function changeDuracao(d: DuracaoFiltro) {
    onDuracaoChange(d);
    setHasSearched(false);
    setResultados([]);
    setError('');
    setNoMoreResults(false);
  }

  async function buscar() {
    setError('');
    setNoMoreResults(false);
    setHasSearched(true);
    pageStateRef.current = { nextPageToken: null, queryIndex: 0, seenVideoIds: new Set() };

    if (!isYouTubeEnglishConfigured()) {
      console.warn('[Inglês Diário] Busca online desativada.', {
        motivo: getYouTubeEnglishConfigMessage(),
        variavelEsperada: 'VITE_YOUTUBE_API_KEY',
      });
      setIsUsingFallback(true);
      const fallback = getLocalFallbackVideos(allVideos, nivel, duracao);
      setResultados(fallback);
      onCacheResults(nivel, duracao, fallback);
      return;
    }

    setIsUsingFallback(false);
    setIsLoading(true);
    setResultados([]);

    try {
      const result = await buscarVideosIngles({ nivel, duracao, queryIndex: 0 });

      // Mark all fetched (not just displayed) as seen to avoid repeats when "buscar novas opções"
      const newSeen = new Set(result.videos.map(v => v.id));
      pageStateRef.current = {
        nextPageToken: result.nextPageToken,
        queryIndex: result.queryIndex,
        seenVideoIds: newSeen,
      };

      if (result.videos.length === 0) {
        // YouTube returned nothing matching duration — try local fallback
        const fallback = getLocalFallbackVideos(allVideos, nivel, duracao);
        if (fallback.length > 0) {
          setIsUsingFallback(true);
          setResultados(fallback);
          onCacheResults(nivel, duracao, fallback);
        }
        // else: setResultados stays [] and hasSearched=true → empty state shows
      } else {
        // Show up to 4 results; the rest are "new options" via nextPageToken
        const videos = result.videos.slice(0, 4).map(youtubeResultToVideoResult);
        setResultados(videos);
        onCacheResults(nivel, duracao, videos);
      }
    } catch (e) {
      console.error('[Inglês Diário] Falha na busca da biblioteca.', e);
      setError('Não consegui buscar vídeos online agora. Mostrei sugestões salvas para você continuar.');
      // Show local fallback alongside the error so the screen is not blank
      const fallback = getLocalFallbackVideos(allVideos, nivel, duracao);
      if (fallback.length > 0) {
        setIsUsingFallback(true);
        setResultados(fallback);
        onCacheResults(nivel, duracao, fallback);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function buscarNovasOpcoes() {
    if (isLoading || isLoadingMore) return;

    if (isUsingFallback) {
      setNoMoreResults(true);
      return;
    }

    const pageState = pageStateRef.current;
    setError('');
    setNoMoreResults(false);
    setIsLoadingMore(true);

    try {
      // Prefer nextPageToken; fall back to next query variation when the page is exhausted
      const useNextPage = Boolean(pageState.nextPageToken);
      const result = await buscarVideosIngles({
        nivel,
        duracao,
        pageToken: useNextPage ? pageState.nextPageToken! : undefined,
        queryIndex: useNextPage ? pageState.queryIndex : pageState.queryIndex + 1,
        seenVideoIds: pageState.seenVideoIds,
      });

      if (result.videos.length === 0 && useNextPage) {
        // Page was exhausted; try the next query variation immediately
        const result2 = await buscarVideosIngles({
          nivel,
          duracao,
          queryIndex: pageState.queryIndex + 1,
          seenVideoIds: pageState.seenVideoIds,
        });

        if (result2.videos.length === 0) {
          setNoMoreResults(true);
        } else {
          const newSeen = new Set([...pageState.seenVideoIds, ...result2.videos.map(v => v.id)]);
          pageStateRef.current = { nextPageToken: result2.nextPageToken, queryIndex: result2.queryIndex, seenVideoIds: newSeen };
          const videos = result2.videos.slice(0, 4).map(youtubeResultToVideoResult);
          setResultados(videos);
          onCacheResults(nivel, duracao, videos);
        }
      } else if (result.videos.length === 0) {
        setNoMoreResults(true);
      } else {
        const newSeen = new Set([...pageState.seenVideoIds, ...result.videos.map(v => v.id)]);
        pageStateRef.current = { nextPageToken: result.nextPageToken, queryIndex: result.queryIndex, seenVideoIds: newSeen };
        const videos = result.videos.slice(0, 4).map(youtubeResultToVideoResult);
        setResultados(videos);
        onCacheResults(nivel, duracao, videos);
      }
    } catch (e) {
      console.error('[Inglês Diário] Falha ao buscar novas opções.', e);
      setError('Não consegui buscar novas opções agora. Tente novamente em instantes.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  const buscando = isLoading || isLoadingMore;

  return (
    <div className="space-y-4">
      {/* Filtro Nível */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-2">Nível</p>
        <div className="flex flex-wrap gap-2">
        {nivelOpts.map(n => (
            <button
              key={n}
              onClick={() => changeNivel(n)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                nivel === n
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
              }`}
            >{n}</button>
          ))}
        </div>
      </div>

      {/* Filtro Duração */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-2">Duração</p>
        <div className="flex flex-wrap gap-2">
          {duracaoOpts.map(d => (
            <button
              key={d}
              onClick={() => changeDuracao(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                duracao === d
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
              }`}
            >{DURACAO_LABEL[d]}</button>
          ))}
        </div>
      </div>

      {/* Botão buscar */}
      <button
        onClick={() => { void buscar(); }}
        disabled={isLoading}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Buscando vídeos...' : 'Buscar vídeos'}
      </button>

      {/* Aviso fallback */}
      {isUsingFallback && (
        <p className="text-xs text-surface-400 dark:text-surface-500 text-center">
          Sugestões salvas localmente. A busca online não está disponível neste momento.
        </p>
      )}

      {/* Erro */}
      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-300">
          {error}
        </div>
      )}

      {/* Estado inicial sem busca */}
      {!hasSearched && !isLoading && (
        <p className="text-center text-sm text-surface-400 dark:text-surface-500 py-4">
          Clique em "Buscar vídeos" para carregar sugestões.
        </p>
      )}

      {/* Estado vazio após busca */}
      {hasSearched && !isLoading && resultados.length === 0 && !error && (
        <p className="text-center text-sm text-surface-400 dark:text-surface-500 py-4">
          Nenhum vídeo encontrado com esses filtros. Tente outra duração ou nível.
        </p>
      )}

      {/* Resultados */}
      {resultados.length > 0 && (
        <div className="space-y-2">
          {resultados.map(video => (
            <div key={video.videoId} className="flex items-start gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
              <img
                src={video.thumbnailUrl ?? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
                alt={video.title}
                className="w-24 h-16 object-cover rounded-md flex-shrink-0 bg-surface-100 dark:bg-surface-700"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-900 dark:text-white leading-tight line-clamp-2">{video.title}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                  {video.channelTitle} · {Math.floor(video.durationSeconds / 60)}min
                  {video.cefrLevel ? ` · ${video.cefrLevel}` : ''}
                  {video.theme ? ` · ${video.theme}` : ''}
                </p>
                <button
                  onClick={() => {
                    // Map VideoResult back to DailyEnglishVideo so the existing saveStudy flow is unchanged
                    onSelectVideo(videoResultToDailyVideo(video, nivel, allVideos));
                  }}
                  className="mt-2 rounded-lg bg-primary-600 px-3 py-1 text-xs font-semibold text-white hover:bg-primary-700 transition-all"
                >
                  Usar como aula de hoje
                </button>
              </div>
            </div>
          ))}

          {/* Buscar novas opções */}
          <div className="pt-1 border-t border-surface-100 dark:border-surface-700">
            {noMoreResults ? (
              <p className="text-center text-xs text-surface-400 dark:text-surface-500 py-2">
                Não encontrei novas opções para esses filtros. Tente outro nível ou duração.
              </p>
            ) : (
              <>
                <button
                  onClick={() => { void buscarNovasOpcoes(); }}
                  disabled={buscando || isUsingFallback}
                  className="w-full rounded-lg border border-surface-200 dark:border-surface-700 px-4 py-2 text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoadingMore ? 'Buscando novas opções...' : 'Buscar novas opções'}
                </button>
                <p className="text-center text-[10px] text-surface-400 dark:text-surface-500 mt-1">
                  Não gostou? Busque novas sugestões com os mesmos filtros.
                </p>
              </>
            )}
          </div>
        </div>
      )}
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

// ============================================================
// ATIVIDADE DA SEMANA — 7 CÍRCULOS
// ============================================================
function WeekActivityRow({ days }: { days: DayActivity[] }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {days.map(day => (
        <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
          <div
            title={day.date}
            className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all sm:h-10 sm:w-10 ${
              day.active
                ? 'border-primary-500 bg-primary-500 text-white shadow-sm shadow-primary-600/30'
                : 'border-surface-200 bg-surface-50 text-surface-400 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-500'
            } ${day.isToday ? 'ring-2 ring-offset-2 ring-primary-400 dark:ring-offset-surface-900' : ''}`}
          >
            {day.active ? <CheckCircle2 size={16} /> : day.label}
          </div>
          <span className={`text-[10px] font-medium ${day.isToday ? 'text-primary-600 dark:text-primary-300' : 'text-surface-400 dark:text-surface-500'}`}>
            {day.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// SHADOWING WIZARD — 5 PASSOS
// ============================================================
const SHADOWING_STEPS = [
  'Assista sem legenda',
  'Avalie seu entendimento',
  'Assista com legenda e anote expressões novas',
  'Pratique o shadowing (repita em voz alta)',
  'Avalie seu progresso e conclua',
];

const ENTENDIMENTO_BUCKETS = [
  { label: '0-25%', value: 12 },
  { label: '25-50%', value: 37 },
  { label: '50-75%', value: 62 },
  { label: '75-100%', value: 87 },
];

function ShadowingWizardModal({
  isOpen,
  onClose,
  video,
  onSave,
  onAddWords,
}: {
  isOpen: boolean;
  onClose: () => void;
  video: DailyEnglishVideo;
  onSave: (session: ShadowingSession) => Promise<void>;
  onAddWords: (word: { word: string; translation: string; example?: string }) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [entendimentoPrimeira, setEntendimentoPrimeira] = useState<number | null>(null);
  const [entendimentoTerceira, setEntendimentoTerceira] = useState<number | null>(null);
  const [repeatCount, setRepeatCount] = useState(3);
  const [novaExpressaoTexto, setNovaExpressaoTexto] = useState('');
  const [novaExpressaoTraducao, setNovaExpressaoTraducao] = useState('');
  const [expressoesAdicionadas, setExpressoesAdicionadas] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setEntendimentoPrimeira(null);
      setEntendimentoTerceira(null);
      setRepeatCount(3);
      setNovaExpressaoTexto('');
      setNovaExpressaoTraducao('');
      setExpressoesAdicionadas([]);
      setNotes('');
    }
  }, [isOpen]);

  function handleAddExpressao() {
    if (!novaExpressaoTexto.trim()) return;
    setExpressoesAdicionadas(prev => [...prev, novaExpressaoTexto.trim()]);
    void onAddWords({
      word: novaExpressaoTexto.trim(),
      translation: novaExpressaoTraducao.trim() || '—',
    });
    setNovaExpressaoTexto('');
    setNovaExpressaoTraducao('');
  }

  async function handleFinish() {
    setSaving(true);
    const now = new Date().toISOString();
    const session: ShadowingSession = {
      id: gerarId(),
      date: getCurrentStudyDate(),
      videoId: video.videoId,
      title: video.title,
      durationSeconds: video.durationSeconds,
      repeatCount,
      notes: notes || undefined,
      createdAt: now,
      entendimentoPrimeiraPassada: entendimentoPrimeira ?? undefined,
      entendimentoTerceiraPassada: entendimentoTerceira ?? undefined,
      expressoesAdicionadas: expressoesAdicionadas.length > 0 ? expressoesAdicionadas : undefined,
      status: 'completa',
      atualizadoEm: now,
    };
    try {
      await onSave(session);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const canAdvance = (() => {
    if (step === 1) return entendimentoPrimeira !== null;
    if (step === 4) return entendimentoTerceira !== null;
    return true;
  })();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Shadowing guiado" size="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
          <span>Passo {step + 1} de {SHADOWING_STEPS.length}</span>
          <span>{video.title}</span>
        </div>
        <ProgressBar value={Math.round(((step + 1) / SHADOWING_STEPS.length) * 100)} height="sm" />
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white">{SHADOWING_STEPS[step]}</h3>

        {step === 0 && (
          <StateNote>Assista o vídeo de hoje inteiro, sem ativar legendas. Foque em entender o máximo possível só pelo áudio.</StateNote>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <p className="text-sm text-surface-600 dark:text-surface-300">Quanto você entendeu sem legenda?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ENTENDIMENTO_BUCKETS.map(bucket => (
                <button
                  key={bucket.label}
                  type="button"
                  onClick={() => setEntendimentoPrimeira(bucket.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    entendimentoPrimeira === bucket.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600'
                  }`}
                >
                  {bucket.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <StateNote>Agora assista novamente com legendas em inglês ativadas. Anote palavras ou expressões novas abaixo (vão para "Palavras da Semana").</StateNote>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={novaExpressaoTexto}
                onChange={e => setNovaExpressaoTexto(e.target.value)}
                placeholder="Palavra ou expressão"
                className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
              />
              <input
                value={novaExpressaoTraducao}
                onChange={e => setNovaExpressaoTraducao(e.target.value)}
                placeholder="Tradução (opcional)"
                className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
              />
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={handleAddExpressao}>Adicionar</Button>
            </div>
            {expressoesAdicionadas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {expressoesAdicionadas.map(expr => (
                  <Badge key={expr} variant="default">{expr}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <StateNote>Pratique o shadowing: repita as falas em voz alta, junto com o áudio, tentando imitar pronúncia e ritmo.</StateNote>
            <div>
              <p className="mb-2 text-sm text-surface-600 dark:text-surface-300">Quantas vezes você repetiu o trecho?</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRepeatCount(n)}
                    className={`h-9 w-9 rounded-lg text-sm font-semibold transition-all ${
                      repeatCount === n
                        ? 'bg-primary-600 text-white'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-surface-600 dark:text-surface-300">Depois do shadowing, como está seu entendimento e fluência nesse trecho?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ENTENDIMENTO_BUCKETS.map(bucket => (
                <button
                  key={bucket.label}
                  type="button"
                  onClick={() => setEntendimentoTerceira(bucket.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    entendimentoTerceira === bucket.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600'
                  }`}
                >
                  {bucket.label}
                </button>
              ))}
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notas finais (opcional)"
              rows={3}
              className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
            />
            {entendimentoPrimeira !== null && entendimentoTerceira !== null && (
              <StateNote>
                {entendimentoTerceira > entendimentoPrimeira
                  ? 'Ótimo progresso! Seu entendimento melhorou após o shadowing.'
                  : 'Continue praticando — repetir o mesmo trecho em dias diferentes ajuda a fixar.'}
              </StateNote>
            )}
          </div>
        )}

        <div className="flex justify-between gap-2 pt-2">
          <Button
            variant="secondary"
            icon={<ChevronLeft size={16} />}
            disabled={step === 0}
            onClick={() => setStep(s => Math.max(0, s - 1))}
          >
            Voltar
          </Button>
          {step < SHADOWING_STEPS.length - 1 ? (
            <Button icon={<ChevronRight size={16} />} disabled={!canAdvance} onClick={() => setStep(s => Math.min(SHADOWING_STEPS.length - 1, s + 1))}>
              Próximo
            </Button>
          ) : (
            <Button icon={<CheckCircle2 size={16} />} disabled={!canAdvance} loading={saving} onClick={handleFinish}>
              Concluir shadowing
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// PALAVRAS DA SEMANA
// ============================================================
function PalavrasDaSemanaCard({
  wordsThisWeek,
  wordsDueForReview,
  allWords,
  onAdd,
  onReview,
  onDelete,
}: {
  wordsThisWeek: WeeklyWord[];
  wordsDueForReview: WeeklyWord[];
  allWords: WeeklyWord[];
  onAdd: (word: { word: string; translation: string; example?: string }) => Promise<void>;
  onReview: (id: string, remembered: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [word, setWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [example, setExample] = useState('');
  const [adding, setAdding] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState('');
  const lastTranslatedWordRef = useRef('');
  const [showAllWords, setShowAllWords] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const capReached = wordsThisWeek.length >= 10;

  async function handleTranslate() {
    const term = word.trim();
    if (!term || translating || capReached) return;
    setTranslating(true);
    setTranslateError('');
    try {
      const result = await translateWeeklyWord(term);
      // Only apply if the word field hasn't changed in the meantime
      if (word.trim() === term) {
        setTranslation(result.translation);
        setExample(result.example);
      }
      lastTranslatedWordRef.current = term;
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : 'Não foi possível traduzir agora.');
    } finally {
      setTranslating(false);
    }
  }

  function handleWordBlur() {
    const term = word.trim();
    if (!term || term === lastTranslatedWordRef.current) return;
    void handleTranslate();
  }

  async function handleAdd() {
    if (!word.trim() || !translation.trim() || capReached) return;
    setAdding(true);
    try {
      await onAdd({ word: word.trim(), translation: translation.trim(), example: example.trim() || undefined });
      setWord('');
      setTranslation('');
      setExample('');
      lastTranslatedWordRef.current = '';
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Palavras da Semana"
        subtitle={`${wordsThisWeek.length}/10 palavras adicionadas esta semana · revisão espaçada por 3 meses`}
        icon={<Sparkles size={18} />}
      />
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={word}
            onChange={e => setWord(e.target.value)}
            onBlur={handleWordBlur}
            placeholder="Palavra/expressão em inglês"
            disabled={capReached}
            className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm disabled:opacity-50 dark:border-surface-700 dark:bg-surface-800 dark:text-white"
          />
          <input
            value={translation}
            onChange={e => setTranslation(e.target.value)}
            placeholder={translating ? 'Traduzindo com IA...' : 'Tradução (preenchida pela IA)'}
            disabled={capReached || translating}
            className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm disabled:opacity-50 dark:border-surface-700 dark:bg-surface-800 dark:text-white"
          />
          <input
            value={example}
            onChange={e => setExample(e.target.value)}
            placeholder={translating ? '...' : 'Exemplo (preenchido pela IA)'}
            disabled={capReached || translating}
            className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm disabled:opacity-50 dark:border-surface-700 dark:bg-surface-800 dark:text-white"
          />
          <Button
            size="sm"
            variant="secondary"
            icon={<Sparkles size={14} />}
            disabled={capReached || translating || !word.trim()}
            loading={translating}
            onClick={handleTranslate}
          >
            Traduzir
          </Button>
          <Button size="sm" icon={<Plus size={14} />} disabled={capReached || adding || translating || !translation.trim()} loading={adding} onClick={handleAdd}>
            Adicionar
          </Button>
        </div>

        {translateError && <StateNote>{translateError}</StateNote>}

        {capReached && <StateNote>Limite de 10 palavras desta semana atingido. Volte na próxima semana para adicionar mais.</StateNote>}

        {wordsDueForReview.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning-200 bg-warning-50/60 px-4 py-3 dark:border-warning-900/40 dark:bg-warning-900/10">
            <p className="text-sm text-surface-700 dark:text-surface-200">
              <strong>{wordsDueForReview.length}</strong> palavra(s) para revisar hoje.
            </p>
            <Button size="sm" variant="success" icon={<RotateCw size={14} />} onClick={() => setReviewModalOpen(true)}>
              Revisar agora
            </Button>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => setShowAllWords(prev => !prev)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-surface-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-surface-500 transition-colors hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400 dark:hover:bg-surface-800"
          >
            <span>Todas as palavras ({allWords.length})</span>
            {showAllWords ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>

          {showAllWords && (
            allWords.length === 0 ? (
              <div className="mt-2"><StateNote>Nenhuma palavra cadastrada ainda. Adicione até 10 por semana.</StateNote></div>
            ) : (
              <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {allWords.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700">
                    <div className="min-w-0">
                      <span className="font-medium text-surface-900 dark:text-white">{item.word}</span>
                      <span className="text-surface-500 dark:text-surface-400"> — {item.translation}</span>
                      {item.example && <p className="text-xs text-surface-400 dark:text-surface-500">{item.example}</p>}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Badge variant={item.mastered ? 'success' : 'default'}>{item.mastered ? 'dominada' : `revisar ${item.nextReviewAt}`}</Badge>
                      <button onClick={() => onDelete(item.id)} className="text-surface-400 hover:text-danger-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </CardBody>

      <FlashcardReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        words={wordsDueForReview}
        onReview={onReview}
      />
    </Card>
  );
}

// ============================================================
// FLASHCARDS DE REVISÃO (repetição espaçada)
// ============================================================
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maskWordInExample(example: string, word: string): string {
  const trimmedWord = word.trim();
  if (!trimmedWord) return example;
  const pattern = new RegExp(escapeRegExp(trimmedWord), 'gi');
  if (!pattern.test(example)) return example;
  return example.replace(new RegExp(escapeRegExp(trimmedWord), 'gi'), '_____');
}

function FlashcardReviewModal({
  isOpen,
  onClose,
  words,
  onReview,
}: {
  isOpen: boolean;
  onClose: () => void;
  words: WeeklyWord[];
  onReview: (id: string, remembered: boolean) => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIndex(0);
      setFlipped(false);
    }
  }, [isOpen]);

  const currentWord = words[index];
  const finished = !currentWord;

  async function handleAnswer(remembered: boolean) {
    if (!currentWord || submitting) return;
    setSubmitting(true);
    try {
      await onReview(currentWord.id, remembered);
      setFlipped(false);
      setIndex(prev => prev + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Revisar Palavras da Semana" size="lg">
      <div className="space-y-4">
        {finished ? (
          <div className="space-y-3 text-center">
            <CheckCircle2 size={32} className="mx-auto text-success-600" />
            <p className="text-sm font-medium text-surface-900 dark:text-white">
              {words.length === 0 ? 'Nenhuma palavra para revisar agora.' : 'Revisão concluída por hoje!'}
            </p>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        ) : (
          <>
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
              Cartão {index + 1} de {words.length}
            </p>

            <button
              type="button"
              onClick={() => setFlipped(prev => !prev)}
              className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border border-surface-200 bg-surface-50/80 p-6 text-center transition-colors hover:bg-surface-100 dark:border-surface-700 dark:bg-surface-800/60 dark:hover:bg-surface-800"
            >
              {!flipped ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-surface-500 dark:text-surface-400">
                    Qual a tradução desta frase?
                  </p>
                  <p className="text-lg font-semibold text-surface-900 dark:text-white">
                    {currentWord.example ? maskWordInExample(currentWord.example, currentWord.word) : currentWord.word}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-surface-400 dark:text-surface-500">
                    <RotateCw size={12} /> Toque para virar o cartão
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-surface-900 dark:text-white">{currentWord.word}</p>
                  <p className="text-base text-primary-600 dark:text-primary-300">{currentWord.translation}</p>
                  {currentWord.example && (
                    <p className="text-sm text-surface-500 dark:text-surface-400">{currentWord.example}</p>
                  )}
                </>
              )}
            </button>

            {flipped && (
              <div className="flex justify-center gap-3">
                <Button variant="secondary" disabled={submitting} onClick={() => handleAnswer(false)}>Esqueci</Button>
                <Button variant="success" disabled={submitting} onClick={() => handleAnswer(true)}>Lembrei</Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ============================================================
// MEU PROGRESSO
// ============================================================
function MeuProgressoModal({
  isOpen,
  onClose,
  data,
  shadowingStreak,
  onOpenPreplyModal,
  onUpdateDuolingo,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: EnglishStudyData;
  shadowingStreak: number;
  onOpenPreplyModal: () => void;
  onUpdateDuolingo: (streak: DuolingoStreak) => Promise<void>;
}) {
  const [xpInput, setXpInput] = useState('10');
  const [savingXp, setSavingXp] = useState(false);

  const shadowingChartData = useMemo(() => {
    const byDate = new Map<string, number>();
    data.shadowingSessions.forEach(session => {
      byDate.set(session.date, (byDate.get(session.date) ?? 0) + session.repeatCount);
    });
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, repeats]) => ({ date: date.slice(5), repeats }));
  }, [data.shadowingSessions]);

  async function handleRegisterDuolingoToday() {
    const xp = Number(xpInput) || 0;
    setSavingXp(true);
    const today = getCurrentStudyDate();
    const alreadyToday = data.duolingoStreak.history.some(h => h.date === today);
    const history = alreadyToday
      ? data.duolingoStreak.history.map(h => h.date === today ? { date: today, xp } : h)
      : [...data.duolingoStreak.history, { date: today, xp }];
    const wasYesterdayActive = data.duolingoStreak.lastUpdatedDate === addDaysISO(today, -1);
    const currentStreak = alreadyToday
      ? data.duolingoStreak.currentStreak
      : (wasYesterdayActive || data.duolingoStreak.currentStreak === 0 ? data.duolingoStreak.currentStreak + 1 : 1);
    const longestStreak = Math.max(data.duolingoStreak.longestStreak, currentStreak);
    try {
      await onUpdateDuolingo({ currentStreak, longestStreak, lastUpdatedDate: today, history });
    } finally {
      setSavingXp(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Meu Progresso" size="xl">
      <div className="space-y-5">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
            <Mic size={16} /> Shadowing
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryItem label="Streak atual" value={`${shadowingStreak} dia(s)`} />
            <SummaryItem label="Sessões totais" value={String(data.shadowingSessions.length)} />
            <SummaryItem
              label="Repetições (últ. sessão)"
              value={data.shadowingSessions[0] ? String(data.shadowingSessions[0].repeatCount) : '—'}
            />
          </div>
          {shadowingChartData.length > 0 ? (
            <div className="mt-3 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={shadowingChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="repeats" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-3"><StateNote>Sem sessões de shadowing registradas ainda.</StateNote></div>
          )}
        </div>

        <div className="border-t border-surface-200 pt-4 dark:border-surface-700">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
              <BookOpen size={16} /> Preply
            </h3>
            <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={onOpenPreplyModal}>Registrar aula</Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryItem label="Aulas registradas" value={String(data.preplyAulas.length)} />
            <SummaryItem
              label="Minutos totais"
              value={String(data.preplyAulas.reduce((sum, a) => sum + a.minutes, 0))}
            />
            <SummaryItem
              label="Última aula"
              value={data.preplyAulas[0]?.date ?? '—'}
            />
          </div>
        </div>

        <div className="border-t border-surface-200 pt-4 dark:border-surface-700">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
            <Sparkles size={16} /> Duolingo
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryItem label="Streak atual" value={`${data.duolingoStreak.currentStreak} dia(s)`} />
            <SummaryItem label="Maior streak" value={`${data.duolingoStreak.longestStreak} dia(s)`} />
            <SummaryItem label="Última atualização" value={data.duolingoStreak.lastUpdatedDate || '—'} />
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="number"
              min={0}
              value={xpInput}
              onChange={e => setXpInput(e.target.value)}
              placeholder="XP de hoje"
              className="w-32 rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
            />
            <Button size="sm" loading={savingXp} onClick={handleRegisterDuolingoToday}>Registrar XP de hoje</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// PREPLY — MODAL DE REGISTRO
// ============================================================
function PreplyModal({
  isOpen,
  onClose,
  aulas,
  onAdd,
  onDelete,
  onAddWords,
}: {
  isOpen: boolean;
  onClose: () => void;
  aulas: PreplyAula[];
  onAdd: (aula: PreplyAula) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddWords: (word: { word: string; translation: string; example?: string }) => Promise<void>;
}) {
  const [teacher, setTeacher] = useState('');
  const [professor, setProfessor] = useState<'brasileira' | 'nativo'>('nativo');
  const [minutes, setMinutes] = useState(50);
  const [topic, setTopic] = useState('');
  const [expressoesNovas, setExpressoesNovas] = useState('');
  const [pontosDeDificuldade, setPontosDeDificuldade] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!teacher.trim() || !topic.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const aula: PreplyAula = {
      id: gerarId(),
      date: getCurrentStudyDate(),
      teacher: teacher.trim(),
      minutes,
      topic: topic.trim(),
      createdAt: now,
      professor,
      expressoesNovas: expressoesNovas.trim() || undefined,
      pontosDeDificuldade: pontosDeDificuldade.trim() || undefined,
    };
    try {
      await onAdd(aula);
      if (expressoesNovas.trim()) {
        const items = expressoesNovas.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
        for (const item of items) {
          await onAddWords({ word: item, translation: '—' });
        }
      }
      setTeacher('');
      setTopic('');
      setExpressoesNovas('');
      setPontosDeDificuldade('');
      setMinutes(50);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar aula de Preply" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={teacher}
            onChange={e => setTeacher(e.target.value)}
            placeholder="Nome do professor"
            className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
          />
          <div className="flex gap-2">
            {(['nativo', 'brasileira'] as const).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setProfessor(opt)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  professor === opt
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-700 dark:text-surface-300'
                }`}
              >
                {opt === 'nativo' ? 'Nativo' : 'Brasileira'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Tópico da aula"
            className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
          />
          <input
            type="number"
            min={5}
            value={minutes}
            onChange={e => setMinutes(Number(e.target.value) || 0)}
            placeholder="Minutos"
            className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
          />
        </div>
        <textarea
          value={expressoesNovas}
          onChange={e => setExpressoesNovas(e.target.value)}
          placeholder="Expressões novas (separe por vírgula ou linha) — vão para Palavras da Semana"
          rows={2}
          className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
        />
        <textarea
          value={pontosDeDificuldade}
          onChange={e => setPontosDeDificuldade(e.target.value)}
          placeholder="Pontos de dificuldade observados"
          rows={2}
          className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
        />
        <Button className="w-full sm:w-auto" loading={saving} disabled={!teacher.trim() || !topic.trim()} onClick={handleSave}>
          Salvar aula
        </Button>

        {aulas.length > 0 && (
          <div className="border-t border-surface-200 pt-3 dark:border-surface-700">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Histórico</p>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {aulas.map(aula => (
                <div key={aula.id} className="flex items-center justify-between gap-2 rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700">
                  <div className="min-w-0">
                    <p className="font-medium text-surface-900 dark:text-white">{aula.date} · {aula.teacher} ({aula.minutes}min)</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">{aula.topic}</p>
                  </div>
                  <button onClick={() => onDelete(aula.id)} className="flex-shrink-0 text-surface-400 hover:text-danger-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
