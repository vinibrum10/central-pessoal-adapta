import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, History, RotateCcw, Settings, Video } from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { getEnglishStudyData, saveEnglishStudyData } from '../services/englishStudyStorage';
import { gerarId, hojeISO } from '../utils';
import type {
  EnglishDailyQuizQuestion,
  EnglishDailyStudy,
  EnglishLevel,
  EnglishStudyData,
  StudySession,
} from '../types/englishStudy';

type YouTubePlayerState = -1 | 0 | 1 | 2 | 3 | 5;

type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
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

interface DailyEnglishVideo {
  videoId: string;
  title: string;
  channel: string;
  level: EnglishLevel;
  theme: string;
  estimatedDuration: number;
  quiz: EnglishDailyQuizQuestion[];
}

const emptyStudyData: EnglishStudyData = {
  dailyPlan: [],
  sessions: [],
  vocabulary: [],
  phrases: [],
  speakingPractices: [],
  savedVideos: [],
  dailyStudies: [],
};

const dailyVideos: DailyEnglishVideo[] = [
  {
    videoId: 'n3kNlFMXslo',
    title: 'How to Introduce Yourself in English',
    channel: 'English with Emma',
    level: 'iniciante',
    theme: 'Apresentação pessoal',
    estimatedDuration: 360,
    quiz: [
      {
        question: 'Qual é o objetivo principal do vídeo?',
        options: ['Falar sobre comida', 'Praticar apresentação pessoal', 'Explicar esportes', 'Ensinar pronúncia de cidades'],
        correctIndex: 1,
      },
      {
        question: 'Qual informação costuma aparecer em uma apresentação pessoal?',
        options: ['Nome e ocupação', 'Senha do e-mail', 'Número do passaporte', 'Preço de produtos'],
        correctIndex: 0,
      },
      {
        question: 'Qual frase combina com o tema do vídeo?',
        options: ['I am from Brazil', 'Turn left at the bank', 'The soup is hot', 'The train was late'],
        correctIndex: 0,
      },
    ],
  },
  {
    videoId: 'qZhl1UDf63s',
    title: 'Learn English Conversation: Daily Routine',
    channel: 'English Singsing',
    level: 'iniciante',
    theme: 'Rotina diária',
    estimatedDuration: 300,
    quiz: [
      {
        question: 'Que tipo de vocabulário o vídeo trabalha?',
        options: ['Rotina diária', 'Finanças avançadas', 'Termos jurídicos', 'Programação'],
        correctIndex: 0,
      },
      {
        question: 'Qual ação faz parte de uma rotina comum?',
        options: ['Wake up', 'Export revenue', 'Sue a company', 'Debug memory'],
        correctIndex: 0,
      },
      {
        question: 'O vídeo é mais útil para praticar:',
        options: ['Listening do dia a dia', 'Leitura acadêmica', 'Escrita técnica', 'Gramática formal avançada'],
        correctIndex: 0,
      },
    ],
  },
  {
    videoId: 'HAnw168huqA',
    title: 'English Conversation Practice: At the Restaurant',
    channel: 'Learn English with EnglishClass101.com',
    level: 'intermediário',
    theme: 'Restaurante',
    estimatedDuration: 420,
    quiz: [
      {
        question: 'Qual situação o vídeo simula?',
        options: ['Uma conversa em restaurante', 'Uma entrevista de emprego', 'Uma aula de direção', 'Uma reunião médica'],
        correctIndex: 0,
      },
      {
        question: 'Qual frase pode aparecer nesse contexto?',
        options: ['Can I see the menu?', 'The printer is broken', 'My flight was cancelled', 'I need a bigger screen'],
        correctIndex: 0,
      },
      {
        question: 'Qual habilidade é o foco principal?',
        options: ['Pedir comida e entender respostas', 'Escrever contratos', 'Ler artigos científicos', 'Fazer apresentações longas'],
        correctIndex: 0,
      },
    ],
  },
  {
    videoId: 'F4Zu5ZZAG7I',
    title: 'Business English Conversation: Meetings',
    channel: 'Learn English with Rebecca',
    level: 'intermediário',
    theme: 'Reuniões de trabalho',
    estimatedDuration: 480,
    quiz: [
      {
        question: 'Qual é o tema principal do vídeo?',
        options: ['Reuniões de trabalho', 'Receitas culinárias', 'Compras no mercado', 'Esportes'],
        correctIndex: 0,
      },
      {
        question: 'Qual expressão combina com uma reunião?',
        options: ['Let us get started', 'The beach is crowded', 'I need two tickets', 'The soup is cold'],
        correctIndex: 0,
      },
      {
        question: 'Esse vídeo ajuda principalmente em:',
        options: ['Comunicação profissional', 'Gírias de adolescentes', 'Vocabulário de animais', 'Nomes de capitais'],
        correctIndex: 0,
      },
    ],
  },
];

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
    durationSeconds: video.estimatedDuration,
    watchedSeconds: [],
    progressPercent: 0,
    quizStatus: 'locked',
    completed: false,
  };
}

function getTodayStudy(data: EnglishStudyData, video: DailyEnglishVideo) {
  const today = hojeISO();
  return data.dailyStudies.find(study => study.date === today) ?? createDailyStudy(today, video);
}

function getVideoById(videoId: string) {
  return dailyVideos.find(video => video.videoId === videoId) ?? dailyVideos[0];
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

function getGoalStatus(study: EnglishDailyStudy) {
  if (study.completed) return 'Concluída';
  if (study.watchedSeconds.length > 0 || study.quizScore !== undefined) return 'Em andamento';
  return 'Não iniciada';
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

  const [data, setData] = useState<EnglishStudyData>(emptyStudyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playerStatus, setPlayerStatus] = useState<'loading' | 'ready' | 'playing' | 'paused' | 'unavailable' | 'error'>('loading');
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizMessage, setQuizMessage] = useState('');
  const [shortcutModal, setShortcutModal] = useState<'Biblioteca' | 'Histórico' | 'Configurações' | null>(null);

  const initialVideo = useMemo(() => getVideoById(getTodayStudy(data, dailyVideos[0]).videoId), [data]);
  const todayStudy = useMemo(() => getTodayStudy(data, initialVideo), [data, initialVideo]);
  const currentVideo = useMemo(() => getVideoById(todayStudy.videoId), [todayStudy.videoId]);
  const watchedCount = todayStudy.watchedSeconds.length;
  const progressPercent = Math.min(100, Math.round(todayStudy.progressPercent));
  const quizAvailable = todayStudy.quizStatus !== 'locked';
  const quizCompleted = todayStudy.quizStatus === 'completed';
  const quizPercent = todayStudy.quizTotal ? Math.round(((todayStudy.quizScore ?? 0) / todayStudy.quizTotal) * 100) : 0;
  const weekSummary = useMemo(() => getWeekSummary(data), [data]);

  const saveStudy = useCallback(async (study: EnglishDailyStudy, session?: StudySession) => {
    const nextData = mergeDailyStudy(latestDataRef.current, study);
    const withSession = session ? { ...nextData, sessions: [session, ...nextData.sessions] } : nextData;
    latestDataRef.current = withSession;
    setData(withSession);
    await saveEnglishStudyData(userId, withSession);
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    getEnglishStudyData(userId)
      .then(studyData => {
        if (!mounted) return;
        const study = getTodayStudy(studyData, dailyVideos[0]);
        setData(mergeDailyStudy(studyData, study));
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
            const duration = Math.floor(event.target.getDuration() || currentVideo.estimatedDuration);
            setPlayerStatus('ready');
            const study = latestStudyRef.current;
            if (study && duration > 0 && Math.abs(study.durationSeconds - duration) > 1) {
              const nextStudy = recalculateStudy({ ...study, durationSeconds: duration });
              void saveStudy(nextStudy);
            }
          },
          onStateChange: event => {
            setIsPlayerPlaying(event.data === 1);
            if (event.data === 1) setPlayerStatus('playing');
            if (event.data === 2 || event.data === 0) setPlayerStatus('paused');
          },
          onError: () => setPlayerStatus('unavailable'),
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
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [currentVideo.videoId, currentVideo.estimatedDuration, loading, playerContainerId, saveStudy]);

  useEffect(() => {
    if (!isPlayerPlaying || document.visibilityState !== 'visible') {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    intervalRef.current = window.setInterval(() => {
      const player = playerRef.current;
      const study = latestStudyRef.current;
      if (!player || !study || document.visibilityState !== 'visible') return;

      const second = Math.floor(player.getCurrentTime());
      const duration = Math.floor(player.getDuration() || study.durationSeconds || currentVideo.estimatedDuration);
      if (second < 0 || second >= duration) return;

      const watchedSeconds = uniqueSortedSeconds([...study.watchedSeconds, second]);
      if (watchedSeconds.length === study.watchedSeconds.length) return;

      const nextStudy = recalculateStudy({ ...study, durationSeconds: duration, watchedSeconds });
      latestStudyRef.current = nextStudy;
      void saveStudy(nextStudy);
    }, 1000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [currentVideo.estimatedDuration, isPlayerPlaying, saveStudy]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') setIsPlayerPlaying(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

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
    const currentIndex = dailyVideos.findIndex(video => video.videoId === todayStudy.videoId);
    const nextVideo = dailyVideos[(currentIndex + 1) % dailyVideos.length];
    const nextStudy = createDailyStudy(hojeISO(), nextVideo);
    setAnswers({});
    setQuizMessage('');
    await saveStudy(nextStudy);
  }

  async function handleSubmitQuiz() {
    if (!quizAvailable || currentVideo.quiz.length === 0) return;
    const allAnswered = currentVideo.quiz.every((_, index) => answers[index] !== undefined);
    if (!allAnswered) {
      setQuizMessage('Responda todas as perguntas antes de enviar.');
      return;
    }

    const score = currentVideo.quiz.reduce((total, question, index) => total + (answers[index] === question.correctIndex ? 1 : 0), 0);
    const percent = Math.round((score / currentVideo.quiz.length) * 100);
    const passed = percent >= passingScorePercent;
    const completed = passed && todayStudy.progressPercent >= unlockPercent;
    const nextStudy: EnglishDailyStudy = {
      ...todayStudy,
      quizScore: score,
      quizTotal: currentVideo.quiz.length,
      quizStatus: passed ? 'completed' : 'available',
      completed,
      completedAt: completed ? new Date().toISOString() : todayStudy.completedAt,
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

    setQuizMessage(passed ? 'Questionário aprovado. Meta diária concluída.' : 'Resultado abaixo de 60%. Revise o vídeo e refaça o questionário.');
    if (!passed) setAnswers({});
    await saveStudy(nextStudy, session);
  }

  if (loading) {
    return <p className="text-sm text-surface-500 dark:text-surface-400">Carregando Inglês Diário...</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Inglês Diário</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Assista 1 vídeo curto por dia e responda ao questionário para concluir sua meta.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader title="Meta de hoje" icon={<CheckCircle2 size={18} />} />
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryItem label="Status da meta" value={getGoalStatus(todayStudy)} />
            <SummaryItem label="Meta" value={`Assistir ${unlockPercent}% do vídeo`} />
            <SummaryItem label="Questionário" value={quizCompleted ? 'Concluído' : quizAvailable ? 'Liberado' : 'Pendente'} />
          </div>
          <div className="mt-4 rounded-lg bg-surface-50 p-4 text-sm text-surface-700 dark:bg-surface-900/40 dark:text-surface-200">
            Tempo assistido: <strong>{formatTime(watchedCount)}</strong> · Progresso: <strong>{progressPercent}%</strong> · Pontuação:{' '}
            <strong>{todayStudy.quizTotal ? `${todayStudy.quizScore}/${todayStudy.quizTotal} (${quizPercent}%)` : 'pendente'}</strong>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Vídeo do dia"
          icon={<Video size={18} />}
          action={<Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={handleChangeVideo}>Trocar vídeo</Button>}
        />
        <CardBody className="space-y-4">
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-surface-900">
            <div id={playerContainerId} className="h-full w-full" />
          </div>

          {playerStatus === 'loading' && <StateNote>Carregando vídeo...</StateNote>}
          {playerStatus === 'unavailable' && <StateNote>Vídeo indisponível. Use "Trocar vídeo" para escolher outro.</StateNote>}
          {playerStatus === 'error' && <StateNote>Erro ao carregar player do YouTube. Verifique sua conexão e tente novamente.</StateNote>}

          <div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white">{currentVideo.title}</h2>
            <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
              {currentVideo.channel} · {formatTime(todayStudy.durationSeconds)} · {currentVideo.level} · {currentVideo.theme}
            </p>
          </div>

          <div className="space-y-2">
            <div className="h-3 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-700">
              <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="flex flex-col gap-1 text-sm text-surface-600 dark:text-surface-300 sm:flex-row sm:items-center sm:justify-between">
              <span>Tempo assistido: {formatTime(watchedCount)} / {formatTime(todayStudy.durationSeconds)}</span>
              <span>Progresso: {progressPercent}%</span>
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

          {quizAvailable && currentVideo.quiz.length === 0 && (
            <StateNote>Este vídeo ainda não possui questionário. Escolha outro vídeo para concluir a meta diária.</StateNote>
          )}

          {quizAvailable && currentVideo.quiz.length > 0 && (
            <>
              <div className="space-y-4">
                {currentVideo.quiz.map((question, questionIndex) => (
                  <fieldset key={question.question} className="rounded-lg border border-surface-200 p-4 dark:border-surface-700">
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
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Semana" icon={<History size={18} />} />
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryItem label="Dias estudados" value={`${weekSummary.studiedDays}`} />
            <SummaryItem label="Minutos estudados" value={`${weekSummary.minutes}`} />
            <SummaryItem label="Vídeos concluídos" value={`${weekSummary.completedVideos}`} />
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:justify-center">
        <Button variant="ghost" icon={<BookOpen size={16} />} onClick={() => setShortcutModal('Biblioteca')}>Biblioteca</Button>
        <Button variant="ghost" icon={<History size={16} />} onClick={() => setShortcutModal('Histórico')}>Histórico</Button>
        <Button variant="ghost" icon={<Settings size={16} />} onClick={() => setShortcutModal('Configurações')}>Configurações</Button>
      </div>

      <Modal isOpen={shortcutModal !== null} onClose={() => setShortcutModal(null)} title={shortcutModal ?? ''} size="md">
        <div className="space-y-3">
          {shortcutModal === 'Biblioteca' && dailyVideos.map(video => (
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
    <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700">
      <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-surface-900 dark:text-white">{value}</p>
    </div>
  );
}

function StateNote({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600 dark:border-surface-700 dark:bg-surface-900/40 dark:text-surface-300">
      {children}
    </div>
  );
}
