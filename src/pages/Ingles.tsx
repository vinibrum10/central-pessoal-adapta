import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, CheckCircle2, ExternalLink, Languages, Mic, Pencil, Plus, RotateCcw, Save, Sparkles, Trash2, Video, X } from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Badge } from '../components/Badge';
import { PageHeader } from '../components/DesignSystem';
import {
  type EnglishDataV2,
  type ListeningVideo,
  type VideoQuiz,
  type VocabularyCard,
  type VocabularyCardSource,
  type ShadowingPhrase,
  type ShadowingPhraseSource,
  DEFAULT_SHADOWING,
  getDefaultShadowingPhrases,
  getShadowingSourceKey,
  incrementPhraseRepetition,
  resetPhraseRepetition,
  markPhraseCompleted,
  createCardFromShadowingPhrase,
  mergeShadowingPhrasesWithoutDuplicates,
  loadEnglishData,
  saveEnglishData,
  getTodayISO,
  getDueTodayCards,
  getFutureCards,
  getMasteredCards,
  getCardHistory,
  deriveCurrentShadowingVideo,
} from '../services/english/englishStorage';
import {
  isYouTubeConfigured,
  searchListeningVideo,
  searchShadowingVideo,
  extractYouTubeVideoId,
  buildManualListeningVideo,
  type ListeningLevel,
} from '../services/english/youtubeListeningService';
import { generateAiQuiz, generateFallbackQuiz } from '../services/english/videoQuizService';
import { parseShadowingLink, buildShadowingFromLink } from '../services/english/shadowingService';
import { translateWithAi, type AiTranslateResult, type TranslateFocus } from '../services/english/aiTranslationService';
import { applyCardReview, type ReviewGrade } from '../services/english/spacedRepetition';
import { generateAiShadowingPhrasesFromTheme, generateAiShadowingPhrasesFromVideo, generateShadowingPhrasesForVideo } from '../services/english/shadowingPhraseService';

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

const CARD_STATUS_LABEL: Record<VocabularyCard['status'], string> = {
  learning: 'Aprendendo',
  reviewing: 'Revisando',
  mastered: 'Aprendido',
};

const CARD_STATUS_VARIANT: Record<VocabularyCard['status'], 'default' | 'primary' | 'warning' | 'success'> = {
  learning: 'warning',
  reviewing: 'primary',
  mastered: 'success',
};

const CARD_SOURCE_LABEL: Record<VocabularyCardSource, string> = {
  manual: 'Manual',
  gemini: 'IA (Gemini)',
  shadowing: 'Shadowing',
  video: 'Vídeo',
};

const PHRASE_SOURCE_LABEL: Record<ShadowingPhraseSource, string> = {
  videoTranscript: 'Vídeo (transcrição)',
  videoMetadata: 'Vídeo (descrição)',
  aiGenerated: 'IA',
  aiGeneratedFromVideo: 'IA (vídeo atual)',
  aiGeneratedFromTheme: 'IA (tema)',
  manual: 'Manual',
  fallback: 'Padrão',
};

const REVIEW_GRADE_ACTIONS: Array<{ label: string; grade: ReviewGrade; variant: 'danger' | 'secondary' | 'success' }> = [
  { label: 'Errei', grade: 'again', variant: 'danger' },
  { label: 'Difícil', grade: 'hard', variant: 'secondary' },
  { label: 'Fácil', grade: 'easy', variant: 'success' },
];

const CARDS_REVIEW_SECTION_ID = 'ingles-cards-revisao';

function formatReviewDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
}

function withYouTubePlayerApi(url: string): string {
  const [base, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  params.set('enablejsapi', '1');
  params.set('origin', window.location.origin);
  return `${base}?${params.toString()}`;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLIFrameElement,
        options: {
          events?: {
            onReady?: (event: { target: { getDuration: () => number } }) => void;
            onStateChange?: (event: { target: { getDuration: () => number } }) => void;
          };
        },
      ) => { destroy: () => void };
      PlayerState?: Record<string, number>;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
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
  const [manualDurationStatus, setManualDurationStatus] = useState<'idle' | 'detecting' | 'detected' | 'failed'>('idle');
  const listeningIframeRef = useRef<HTMLIFrameElement | null>(null);
  const detectedDurationRef = useRef<string | null>(null);

  // ETAPA 2 — Questionário
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number } | null>(null);
  const [aiQuizLoading, setAiQuizLoading] = useState(false);
  const [aiQuizError, setAiQuizError] = useState('');

  // ETAPA 3 — Shadowing
  const [loadingShadowingVideo, setLoadingShadowingVideo] = useState(false);
  const [shadowingQueryIndex, setShadowingQueryIndex] = useState(0);
  const [shadowingLinkInput, setShadowingLinkInput] = useState('');
  const [shadowingLinkError, setShadowingLinkError] = useState('');
  const [newShadowingSentence, setNewShadowingSentence] = useState('');
  const [newShadowingTranslation, setNewShadowingTranslation] = useState('');
  const [editingSentenceId, setEditingSentenceId] = useState<string | null>(null);
  const [editingSentenceText, setEditingSentenceText] = useState('');
  const [editingSentenceTranslation, setEditingSentenceTranslation] = useState('');
  const [translatingShadowingSentence, setTranslatingShadowingSentence] = useState(false);
  const [shadowingAiError, setShadowingAiError] = useState('');
  const [shadowingAutoFillLoading, setShadowingAutoFillLoading] = useState(false);
  const [shadowingThemeInput, setShadowingThemeInput] = useState('');
  const [shadowingAiGenLoading, setShadowingAiGenLoading] = useState<'video' | 'theme' | null>(null);
  const [shadowingAiGenError, setShadowingAiGenError] = useState('');
  const [shadowingAiGenSuccess, setShadowingAiGenSuccess] = useState('');
  const [savedPhraseIds, setSavedPhraseIds] = useState<Set<string>>(new Set());

  // ETAPA 4 — Cards (flashcards)
  const [cardWord, setCardWord] = useState('');
  const [cardMeaning, setCardMeaning] = useState('');
  const [cardExample, setCardExample] = useState('');
  const [cardExampleTranslation, setCardExampleTranslation] = useState('');
  const [aiCardResult, setAiCardResult] = useState<AiTranslateResult | null>(null);
  const [aiCardLoading, setAiCardLoading] = useState<TranslateFocus | null>(null);
  const [aiCardError, setAiCardError] = useState('');
  const [revealed, setRevealed] = useState(false);

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

  useEffect(() => {
    const video = data.listeningVideo;
    const iframe = listeningIframeRef.current;
    if (!video || video.source !== 'manual_link' || !iframe) {
      setManualDurationStatus('idle');
      detectedDurationRef.current = null;
      return;
    }

    const detectionKey = `${video.youtubeVideoId}:${video.durationSeconds}`;
    if (detectedDurationRef.current === detectionKey && video.durationSeconds > 0) return;

    let cancelled = false;
    let player: { destroy: () => void } | null = null;
    let failTimer: number | undefined;
    setManualDurationStatus('detecting');

    const applyDuration = (rawDuration: number) => {
      const duration = Math.round(rawDuration);
      if (cancelled || !Number.isFinite(duration) || duration <= 0) return false;
      detectedDurationRef.current = `${video.youtubeVideoId}:${duration}`;
      setManualDurationStatus('detected');
      setData(prev => {
        if (prev.listeningVideo?.youtubeVideoId !== video.youtubeVideoId || prev.listeningVideo.source !== 'manual_link') return prev;
        if (prev.listeningVideo.durationSeconds === duration) return prev;
        return {
          ...prev,
          listeningVideo: {
            ...prev.listeningVideo,
            durationSeconds: duration,
          },
        };
      });
      return true;
    };

    const initializePlayer = () => {
      if (cancelled || !window.YT?.Player || !listeningIframeRef.current) return;
      player = new window.YT.Player(listeningIframeRef.current, {
        events: {
          onReady: event => {
            window.setTimeout(() => {
              applyDuration(event.target.getDuration());
            }, 500);
          },
          onStateChange: event => {
            applyDuration(event.target.getDuration());
          },
        },
      });
      failTimer = window.setTimeout(() => {
        if (!cancelled && dataRef.current.listeningVideo?.youtubeVideoId === video.youtubeVideoId && dataRef.current.listeningVideo.durationSeconds <= 0) {
          setManualDurationStatus('failed');
        }
      }, 8000);
    };

    if (window.YT?.Player) {
      initializePlayer();
    } else {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        initializePlayer();
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (failTimer) window.clearTimeout(failTimer);
      player?.destroy();
    };
  }, [data.listeningVideo?.youtubeVideoId, data.listeningVideo?.source]);

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
    setManualDurationStatus('detecting');
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
  async function handleGenerateQuiz() {
    const video = data.listeningVideo;
    if (!video) return;
    setAiQuizError('');
    setAiQuizLoading(true);
    try {
      const quiz = await generateAiQuiz(video);
      setData(prev => ({ ...prev, videoQuiz: quiz }));
      setQuizAnswers({});
      setQuizSubmitted(false);
      setQuizScore(null);
    } catch (err) {
      console.error('[Inglês Diário] Falha ao gerar quiz com IA', err);
      setAiQuizError(err instanceof Error ? err.message : 'Não foi possível gerar o questionário com IA agora.');
    } finally {
      setAiQuizLoading(false);
    }
  }

  function handleGenerateFallbackQuiz() {
    const videoId = data.listeningVideo?.youtubeVideoId;
    if (!videoId) return;
    setAiQuizError('');
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

  async function handleRetryQuiz() {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    if (!data.listeningVideo) return;
    if (data.videoQuiz?.source === 'fallback') {
      handleGenerateFallbackQuiz();
      return;
    }
    await handleGenerateQuiz();
  }

  // ── ETAPA 3: Shadowing ──────────────────────────────────────
  function updateShadowingSentences(updater: (sentences: ShadowingPhrase[]) => ShadowingPhrase[]) {
    setData(prev => {
      const key = getShadowingSourceKey(prev.shadowingPractice);
      const nextSentences = updater(prev.shadowingPractice.sentences);
      const phraseSet = prev.shadowingPhraseSets[key] ?? {
        sourceTitle: prev.shadowingPractice.title ?? 'Shadowing',
        sourceUrl: prev.shadowingPractice.watchUrl,
        phrases: prev.shadowingPractice.sentences,
      };
      return {
        ...prev,
        shadowingPractice: {
          ...prev.shadowingPractice,
          sentences: nextSentences,
        },
        shadowingSentenceSets: {
          ...prev.shadowingSentenceSets,
          [key]: nextSentences,
        },
        shadowingPhraseSets: {
          ...prev.shadowingPhraseSets,
          [key]: {
            ...phraseSet,
            phrases: nextSentences,
          },
        },
      };
    });
  }

  function chooseSentencesForShadowingSource(sourceKey: string) {
    const currentSentences = dataRef.current.shadowingPractice.sentences;
    const savedSentences = dataRef.current.shadowingPhraseSets[sourceKey]?.phrases;
    const choice = window.prompt(
      'Deseja manter as frases atuais ou criar uma lista nova para este vídeo?\n1 - Manter frases atuais\n2 - Usar lista salva desta fonte, se existir\n3 - Criar lista nova (a IA tenta preencher automaticamente com frases do vídeo)\n4 - Usar frases padrão',
      savedSentences ? '2' : '1',
    );

    if (choice === '3') return [];
    if (choice === '4') return getDefaultShadowingPhrases();
    if (choice === '2' && savedSentences) return savedSentences;
    return currentSentences;
  }

  function persistShadowingPractice(practice: typeof data.shadowingPractice, sentences: ShadowingPhrase[]) {
    const sourceKey = getShadowingSourceKey(practice);
    setData(prev => ({
      ...prev,
      shadowingPractice: {
        ...practice,
        sentences,
        loadedAt: practice.loadedAt ?? new Date().toISOString(),
      },
      shadowingSentenceSets: {
        ...prev.shadowingSentenceSets,
        [sourceKey]: sentences,
      },
      shadowingPhraseSets: {
        ...prev.shadowingPhraseSets,
        [sourceKey]: {
          sourceTitle: practice.title ?? (practice.source === 'default_playlist' ? 'Playlist padrão' : 'Shadowing'),
          sourceUrl: practice.watchUrl,
          phrases: sentences,
        },
      },
    }));
  }

  /** Preenche automaticamente frases vindas do vídeo (ou IA/fallback) quando a lista de um vídeo novo está vazia. */
  async function autoFillShadowingIfEmpty(context: { videoId?: string; videoUrl?: string; videoTitle?: string; videoDescription?: string }) {
    if (dataRef.current.shadowingPractice.sentences.length > 0) return;
    setShadowingAutoFillLoading(true);
    try {
      const phrases = await generateShadowingPhrasesForVideo(context);
      updateShadowingSentences(() => phrases);
    } finally {
      setShadowingAutoFillLoading(false);
    }
  }

  function handleLoadShadowingLink() {
    const parsed = parseShadowingLink(shadowingLinkInput);
    if (!parsed) {
      setShadowingLinkError('Link inválido. Cole um link do YouTube (vídeo ou playlist).');
      return;
    }
    setShadowingLinkError('');
    const sourceKey = parsed.type === 'playlist' ? `playlist:${parsed.playlistId}` : `video:${parsed.videoId}`;
    const selectedSentences = chooseSentencesForShadowingSource(sourceKey);
    const newPractice = buildShadowingFromLink(parsed, selectedSentences);
    persistShadowingPractice(newPractice, selectedSentences);
    setShadowingLinkInput('');
    void autoFillShadowingIfEmpty(
      parsed.type === 'video' ? { videoId: parsed.videoId, videoUrl: newPractice.watchUrl } : {},
    );
  }

  function handleShadowingLevelChange(level: ListeningLevel) {
    setData(prev => ({ ...prev, selectedShadowingLevel: level }));
    setShadowingLinkError('');
    setShadowingQueryIndex(0);
  }

  async function handleSearchShadowingVideo() {
    setLoadingShadowingVideo(true);
    setShadowingLinkError('');

    if (!isYouTubeConfigured()) {
      setShadowingLinkError('Configure VITE_YOUTUBE_API_KEY para buscar vídeos reais no YouTube.');
      setLoadingShadowingVideo(false);
      return;
    }

    const level = dataRef.current.selectedShadowingLevel;
    const excludeId = dataRef.current.shadowingPractice.youtubeVideoId;

    try {
      let video: ListeningVideo | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        video = await searchShadowingVideo(level, excludeId, shadowingQueryIndex + attempt);
        if (video) {
          setShadowingQueryIndex(qi => qi + attempt + 1);
          break;
        }
      }

      if (!video) {
        setShadowingLinkError('Nenhum vídeo válido de shadowing encontrado para este nível. Tente outro nível ou clique novamente.');
        return;
      }

      const practice = {
        type: 'video' as const,
        youtubeVideoId: video.youtubeVideoId,
        title: video.title,
        description: video.description,
        watchUrl: video.watchUrl,
        embedUrl: video.embedUrl,
        source: 'youtube_api' as const,
        sentences: [],
      };
      const selectedSentences = chooseSentencesForShadowingSource(getShadowingSourceKey(practice));
      persistShadowingPractice(practice, selectedSentences);
      void autoFillShadowingIfEmpty({ videoId: video.youtubeVideoId, videoUrl: video.watchUrl, videoTitle: video.title, videoDescription: video.description });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar vídeo de shadowing no YouTube.';
      setShadowingLinkError(msg);
    } finally {
      setLoadingShadowingVideo(false);
    }
  }

  function handleUseDefaultShadowingPlaylist() {
    persistShadowingPractice({ ...DEFAULT_SHADOWING, sentences: dataRef.current.shadowingPractice.sentences }, dataRef.current.shadowingPractice.sentences);
    setShadowingLinkInput('');
    setShadowingLinkError('');
  }

  function handleRestoreDefaultShadowingSentences() {
    if (!window.confirm('Deseja também restaurar as frases padrão e zerar repetições?')) {
      return;
    }

    updateShadowingSentences(() => getDefaultShadowingPhrases());
    setShadowingLinkInput('');
    setShadowingLinkError('');
  }

  function handleRepetitionIncrement(sentenceId: string) {
    updateShadowingSentences(sentences => sentences.map(s => (s.id === sentenceId ? incrementPhraseRepetition(s) : s)));
  }

  function handleRepetitionReset(sentenceId: string) {
    updateShadowingSentences(sentences => sentences.map(s => (s.id === sentenceId ? resetPhraseRepetition(s) : s)));
  }

  function handleMarkSentenceCompleted(sentenceId: string) {
    updateShadowingSentences(sentences => sentences.map(s => (s.id === sentenceId ? markPhraseCompleted(s) : s)));
  }

  function handleAddShadowingSentence() {
    if (!newShadowingSentence.trim() || !newShadowingTranslation.trim()) return;
    updateShadowingSentences(sentences => [
      ...sentences,
      {
        id: genId(),
        text: newShadowingSentence.trim(),
        translation: newShadowingTranslation.trim(),
        source: 'manual',
        repetitionsDone: 0,
        repetitionsTarget: 5,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    setNewShadowingSentence('');
    setNewShadowingTranslation('');
  }

  async function handleTranslateShadowingSentence() {
    const text = newShadowingSentence.trim();
    if (!text) return;
    setShadowingAiError('');
    setTranslatingShadowingSentence(true);
    try {
      const result = await translateWithAi({ text, context: 'shadowing', focus: 'translate' });
      setNewShadowingTranslation(result.translation);
    } catch (err) {
      console.error('[Inglês Diário] Falha ao traduzir frase de shadowing com IA', err);
      setShadowingAiError(err instanceof Error ? err.message : 'Não foi possível traduzir com IA agora.');
    } finally {
      setTranslatingShadowingSentence(false);
    }
  }

  /** Insere as frases geradas ao final da lista (sem apagar nem duplicar) e mostra a mensagem de sucesso. */
  function insertGeneratedPhrases(newPhrases: ShadowingPhrase[]) {
    let addedCount = 0;
    updateShadowingSentences(sentences => {
      const merged = mergeShadowingPhrasesWithoutDuplicates(sentences, newPhrases);
      addedCount = merged.length - sentences.length;
      return merged;
    });
    setShadowingAiGenSuccess(
      addedCount > 0
        ? `${addedCount} frase(s) adicionada(s) para repetir.`
        : 'Nenhuma frase nova — todas já existiam na lista.',
    );
  }

  async function handleGenerateShadowingPhrasesFromVideo() {
    const video = deriveCurrentShadowingVideo(dataRef.current.shadowingPractice);
    if (!video) return; // botão fica desabilitado neste caso; checagem extra por segurança.
    setShadowingAiGenError('');
    setShadowingAiGenSuccess('');
    setShadowingAiGenLoading('video');
    try {
      const newPhrases = await generateAiShadowingPhrasesFromVideo({
        videoId: video.videoId,
        videoUrl: video.videoUrl,
        videoTitle: video.title,
        videoDescription: video.description,
      });
      insertGeneratedPhrases(newPhrases);
    } catch (err) {
      // Erro da IA nunca apaga frases existentes, o vídeo atual ou o tema digitado.
      console.error('[Inglês Diário] Falha ao gerar frases de shadowing com IA (vídeo atual)', err);
      setShadowingAiGenError(err instanceof Error ? err.message : 'Não foi possível gerar frases com IA agora.');
    } finally {
      setShadowingAiGenLoading(null);
    }
  }

  async function handleGenerateShadowingPhrasesFromTheme() {
    if (!shadowingThemeInput.trim()) return; // botão fica desabilitado neste caso; checagem extra por segurança.
    setShadowingAiGenError('');
    setShadowingAiGenSuccess('');
    setShadowingAiGenLoading('theme');
    try {
      const newPhrases = await generateAiShadowingPhrasesFromTheme(shadowingThemeInput);
      insertGeneratedPhrases(newPhrases);
    } catch (err) {
      console.error('[Inglês Diário] Falha ao gerar frases de shadowing com IA (tema manual)', err);
      setShadowingAiGenError(err instanceof Error ? err.message : 'Não foi possível gerar frases com IA agora.');
    } finally {
      setShadowingAiGenLoading(null);
    }
  }

  function handleSaveShadowingSentenceAsCard(sentence: ShadowingPhrase) {
    if (!sentence.text.trim() || !sentence.translation.trim()) return;
    const card = createCardFromShadowingPhrase(sentence, genId());
    setData(prev => ({ ...prev, vocabularyCards: [card, ...prev.vocabularyCards] }));
    setSavedPhraseIds(prev => new Set(prev).add(sentence.id));
    window.setTimeout(() => {
      setSavedPhraseIds(prev => {
        const next = new Set(prev);
        next.delete(sentence.id);
        return next;
      });
    }, 2000);
  }

  function handleStartEditSentence(sentenceId: string, text: string, translation: string) {
    setEditingSentenceId(sentenceId);
    setEditingSentenceText(text);
    setEditingSentenceTranslation(translation);
  }

  function handleSaveSentenceEdit() {
    if (!editingSentenceId || !editingSentenceText.trim() || !editingSentenceTranslation.trim()) return;
    updateShadowingSentences(sentences => sentences.map(s =>
      s.id === editingSentenceId
        ? { ...s, text: editingSentenceText.trim(), translation: editingSentenceTranslation.trim(), updatedAt: new Date().toISOString() }
        : s,
    ));
    setEditingSentenceId(null);
    setEditingSentenceText('');
    setEditingSentenceTranslation('');
  }

  function handleCancelSentenceEdit() {
    setEditingSentenceId(null);
    setEditingSentenceText('');
    setEditingSentenceTranslation('');
  }

  function handleDeleteShadowingSentence(sentenceId: string) {
    updateShadowingSentences(sentences => sentences.filter(s => s.id !== sentenceId));
  }

  // ── ETAPA 4: Cards (flashcards estilo Anki) ─────────────────
  function handleAddCard() {
    if (!cardWord.trim() || !cardMeaning.trim()) return;
    const card: VocabularyCard = {
      id: genId(),
      wordOrPhrase: cardWord.trim(),
      translation: cardMeaning.trim(),
      example: cardExample.trim() || undefined,
      exampleTranslation: cardExampleTranslation.trim() || undefined,
      source: aiCardResult ? 'gemini' : 'manual',
      createdAt: new Date().toISOString(),
      nextReviewAt: getTodayISO(),
      reviewCount: 0,
      errorCount: 0,
      easyStreak: 0,
      difficultCount: 0,
      status: 'learning',
    };
    setData(prev => ({ ...prev, vocabularyCards: [card, ...prev.vocabularyCards] }));
    setCardWord('');
    setCardMeaning('');
    setCardExample('');
    setCardExampleTranslation('');
    setAiCardResult(null);
    setAiCardError('');
  }

  async function handleAiCardAction(focus: TranslateFocus) {
    const text = cardWord.trim();
    if (!text) return;
    setAiCardError('');
    setAiCardLoading(focus);
    try {
      const result = await translateWithAi({ text, context: 'vocabulary', focus });
      setAiCardResult(result);
      setCardMeaning(result.translation);
      if (result.examples[0]) {
        setCardExample(result.examples[0].english);
        setCardExampleTranslation(result.examples[0].portuguese);
      }
    } catch (err) {
      // Erro da IA nunca apaga o que o usuário já digitou.
      console.error('[Inglês Diário] Falha ao consultar IA para tradução de vocabulário', err);
      setAiCardError(err instanceof Error ? err.message : 'Não foi possível consultar a IA agora.');
    } finally {
      setAiCardLoading(null);
    }
  }

  function handleAddVocabularyItemAsCard(item: { word: string; translation: string; example: string }) {
    const card: VocabularyCard = {
      id: genId(),
      wordOrPhrase: item.word,
      translation: item.translation,
      example: item.example || undefined,
      source: 'gemini',
      createdAt: new Date().toISOString(),
      nextReviewAt: getTodayISO(),
      reviewCount: 0,
      errorCount: 0,
      easyStreak: 0,
      difficultCount: 0,
      status: 'learning',
    };
    setData(prev => ({ ...prev, vocabularyCards: [card, ...prev.vocabularyCards] }));
  }

  function handleCardReview(id: string, grade: ReviewGrade) {
    const today = getTodayISO();
    setData(prev => ({
      ...prev,
      vocabularyCards: prev.vocabularyCards.map(c => (c.id === id ? applyCardReview(c, grade, today) : c)),
    }));
    setRevealed(false);
  }

  function handleCardDelete(id: string) {
    setData(prev => ({ ...prev, vocabularyCards: prev.vocabularyCards.filter(c => c.id !== id) }));
  }

  function handleToggleFutureCards() {
    setData(prev => ({ ...prev, ui: { ...prev.ui, showFutureCards: !prev.ui.showFutureCards } }));
  }

  function handleToggleMasteredCards() {
    setData(prev => ({ ...prev, ui: { ...prev.ui, showMasteredCards: !prev.ui.showMasteredCards } }));
  }

  function handleToggleHistory() {
    setData(prev => ({ ...prev, ui: { ...prev.ui, showHistory: !prev.ui.showHistory } }));
  }

  // ── Derived ────────────────────────────────────────────────
  const { selectedListeningLevel, selectedShadowingLevel, listeningVideo, videoQuiz, shadowingPractice, vocabularyCards, ui } = data;
  const answeredCount = Object.keys(quizAnswers).length;
  const totalQuestions = videoQuiz?.questions.length ?? 0;
  const allAnswered = answeredCount === totalQuestions && totalQuestions > 0;
  const today = getTodayISO();

  const dueTodayCards = getDueTodayCards(vocabularyCards, today);
  const futureCards = getFutureCards(vocabularyCards, today);
  const masteredCards = getMasteredCards(vocabularyCards);
  const historyCards = getCardHistory(vocabularyCards);

  // Fila do dia: cards ainda não tocados hoje primeiro; um card marcado
  // "Errei" (lastReviewedAt = hoje) volta pro fim da fila da sessão atual.
  const sortedDueToday = [...dueTodayCards].sort((a, b) => {
    const aTouchedToday = a.lastReviewedAt ? a.lastReviewedAt.slice(0, 10) === today : false;
    const bTouchedToday = b.lastReviewedAt ? b.lastReviewedAt.slice(0, 10) === today : false;
    if (aTouchedToday !== bTouchedToday) return aTouchedToday ? 1 : -1;
    return a.createdAt.localeCompare(b.createdAt);
  });
  const currentReviewCard = sortedDueToday[0] ?? null;

  useEffect(() => {
    setRevealed(false);
  }, [currentReviewCard?.id]);

  const shadowingSentences = shadowingPractice.sentences;
  const allShadowingPhrasesCompleted = shadowingSentences.length > 0 && shadowingSentences.every(s => s.completed);
  const shadowingRepetitionsCompletedTotal = shadowingSentences.reduce((sum, s) => sum + s.repetitionsDone, 0);
  // Estado único do vídeo atual do shadowing — sempre derivado de shadowingPractice,
  // nunca guardado à parte, para o player e o gerador de frases nunca ficarem
  // dessincronizados (era exatamente isso que causava "vídeo carregou no player
  // mas a IA não reconhece o vídeo").
  const currentShadowingVideo = deriveCurrentShadowingVideo(shadowingPractice);

  function renderVocabularyCardRow(card: VocabularyCard, options: { showNextReview?: boolean; showMasteredAt?: boolean } = {}) {
    return (
      <div
        key={card.id}
        className="flex flex-col gap-3 rounded-lg border border-surface-200 px-3 py-2.5 dark:border-surface-700 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-surface-900 dark:text-white">{card.wordOrPhrase}</span>
            <Badge variant={CARD_STATUS_VARIANT[card.status]}>{CARD_STATUS_LABEL[card.status]}</Badge>
            <Badge variant="default">{CARD_SOURCE_LABEL[card.source]}</Badge>
            {options.showNextReview && (
              <span className="text-xs text-surface-400 dark:text-surface-500">
                Próxima: {formatReviewDate(card.nextReviewAt)}
              </span>
            )}
            {options.showMasteredAt && card.masteredAt && (
              <span className="text-xs text-surface-400 dark:text-surface-500">
                Aprendida em: {new Date(card.masteredAt).toLocaleDateString('pt-BR')}
              </span>
            )}
            {(card.errorCount > 0 || card.reviewCount > 0) && (
              <span className="text-xs text-surface-400 dark:text-surface-500">
                {card.reviewCount} revisão(ões) · {card.errorCount} erro(s)
              </span>
            )}
          </div>
          <p className="text-sm text-surface-600 dark:text-surface-300">{card.translation}</p>
          {card.example && (
            <p className="mt-0.5 text-xs italic text-surface-400 dark:text-surface-500">
              {card.example}
              {card.exampleTranslation && <span className="not-italic text-surface-400 dark:text-surface-500"> — {card.exampleTranslation}</span>}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
    );
  }

  // ── JSX ────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl page-stack">
      <PageHeader
        eyebrow="Estudos"
        title="Inglês Diário"
        subtitle="4 etapas independentes: Listening · Questionário · Shadowing · Cards de vocabulário"
        action={
          <Button
            size="sm"
            variant="secondary"
            icon={<BookOpen size={14} />}
            onClick={() => document.getElementById(CARDS_REVIEW_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Revisar palavras {dueTodayCards.length > 0 ? `(${dueTodayCards.length})` : ''}
          </Button>
        }
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
                  ref={listeningIframeRef}
                  key={listeningVideo.youtubeVideoId}
                  src={listeningVideo.source === 'manual_link' ? withYouTubePlayerApi(listeningVideo.embedUrl) : listeningVideo.embedUrl}
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
                    {manualDurationStatus === 'detected' && (
                      <div className="rounded-lg border border-success-200 bg-success-50/60 px-4 py-3 text-sm text-success-700 dark:border-success-900/40 dark:bg-success-900/10 dark:text-success-300">
                        Duração detectada automaticamente pelo player.
                      </div>
                    )}
                    {manualDurationStatus === 'failed' && (
                      <div className="rounded-lg border border-warning-200 bg-warning-50/60 px-4 py-3 text-sm text-warning-700 dark:border-warning-900/40 dark:bg-warning-900/10 dark:text-warning-300">
                        Não foi possível detectar a duração. Preencha manualmente.
                      </div>
                    )}
                    {listeningVideo.durationSeconds > 600 && (
                      <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300">
                        Este vídeo tem mais de 10 minutos. Escolha um vídeo mais curto para Listening.
                      </div>
                    )}
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
                A IA (Gemini) gera até 10 perguntas sobre o vídeo selecionado. Como não há transcrição do vídeo,
                as perguntas são baseadas no título, canal e tema — isso fica sinalizado no questionário gerado.
              </p>
              {aiQuizError && (
                <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300">
                  {aiQuizError}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button icon={<Sparkles size={14} />} loading={aiQuizLoading} onClick={handleGenerateQuiz}>
                  Gerar quiz com IA
                </Button>
                <Button variant="secondary" onClick={handleGenerateFallbackQuiz} disabled={aiQuizLoading}>
                  Usar perguntas genéricas (offline)
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600 dark:border-surface-700 dark:bg-surface-800/60 dark:text-surface-300">
                {videoQuiz.warning ?? 'Questionário gerado com IA a partir do conteúdo assistido.'}
              </div>

              {aiQuizError && (
                <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300">
                  {aiQuizError}
                </div>
              )}

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
                  <Button variant="secondary" loading={aiQuizLoading} onClick={handleRetryQuiz}>
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
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Nível do shadowing</p>
              <div className="flex flex-wrap gap-2">
                {(['basic', 'intermediate', 'advanced', 'fluent'] as const).map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleShadowingLevelChange(level)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                      selectedShadowingLevel === level
                        ? 'bg-primary-600 text-white'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600'
                    }`}
                  >
                    {LEVEL_LABEL[level]}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={shadowingLinkInput}
              onChange={e => setShadowingLinkInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLoadShadowingLink()}
              placeholder="Cole link do YouTube para Shadowing"
              className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleLoadShadowingLink} disabled={!shadowingLinkInput.trim()}>Carregar link</Button>
              {!shadowingPractice.youtubeVideoId ? (
                <Button size="sm" variant="secondary" loading={loadingShadowingVideo} onClick={handleSearchShadowingVideo} disabled={loadingShadowingVideo || !isYouTubeConfigured()}>
                  Buscar vídeo de shadowing
                </Button>
              ) : (
                <Button size="sm" variant="secondary" loading={loadingShadowingVideo} onClick={handleSearchShadowingVideo} disabled={loadingShadowingVideo || !isYouTubeConfigured()}>
                  Trocar vídeo de shadowing
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={handleUseDefaultShadowingPlaylist}>Usar playlist padrão</Button>
              <Button size="sm" variant="secondary" onClick={handleRestoreDefaultShadowingSentences}>Restaurar frases padrão</Button>
            </div>
          </div>

          {shadowingLinkError && (
            <p className="text-sm text-danger-600 dark:text-danger-400">{shadowingLinkError}</p>
          )}

          {shadowingAutoFillLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600 dark:border-surface-700 dark:bg-surface-800/60 dark:text-surface-300">
              <Sparkles size={14} className="animate-pulse" />
              Buscando frases deste vídeo (transcrição, descrição ou IA)...
            </div>
          )}

          {shadowingPractice.source === 'default_playlist' ? (
            <p className="text-xs text-surface-400 dark:text-surface-500">
              Usando playlist padrão de shadowing.{' '}
              <a href={shadowingPractice.watchUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary-600">
                Abrir no YouTube
              </a>
            </p>
          ) : shadowingPractice.source === 'youtube_api' ? (
            <p className="text-xs text-surface-400 dark:text-surface-500">
              Vídeo de shadowing carregado pela YouTube API.{' '}
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

          {allShadowingPhrasesCompleted && (
            <div className="rounded-lg border border-success-200 bg-success-50/60 px-4 py-3 text-sm text-success-700 dark:border-success-900/40 dark:bg-success-900/10 dark:text-success-300">
              <p className="font-semibold">Shadowing finalizado 🎉</p>
              <p>{shadowingSentences.length} frase(s) praticada(s) — {shadowingRepetitionsCompletedTotal} repetições concluídas.</p>
            </div>
          )}

          {/* Gerar frases com IA */}
          <div className="space-y-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
              Gerar frases aleatórias com IA
            </p>

            {currentShadowingVideo ? (
              <div className="rounded-lg border border-primary-200 bg-primary-50/40 px-3 py-2 text-sm dark:border-primary-900/40 dark:bg-primary-900/10">
                <p className="font-medium text-surface-900 dark:text-white">
                  Vídeo atual do shadowing: {currentShadowingVideo.title ?? currentShadowingVideo.videoId}
                </p>
                <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
                  Você pode gerar frases com base neste vídeo ou inserir um tema manual.
                </p>
              </div>
            ) : (
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Nenhum vídeo de shadowing carregado. Carregue um vídeo ou informe um tema.
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={shadowingThemeInput}
                onChange={e => setShadowingThemeInput(e.target.value)}
                placeholder="Ex.: job interview, travel, restaurant, safety meeting"
                className="min-w-0 flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={<Sparkles size={14} />}
                loading={shadowingAiGenLoading === 'video'}
                disabled={!currentShadowingVideo || shadowingAiGenLoading !== null}
                onClick={handleGenerateShadowingPhrasesFromVideo}
              >
                Gerar com vídeo atual
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<Sparkles size={14} />}
                loading={shadowingAiGenLoading === 'theme'}
                disabled={!shadowingThemeInput.trim() || shadowingAiGenLoading !== null}
                onClick={handleGenerateShadowingPhrasesFromTheme}
              >
                Usar tema manual
              </Button>
            </div>

            {shadowingAiGenError && (
              <p className="text-sm text-danger-600 dark:text-danger-400">{shadowingAiGenError}</p>
            )}
            {shadowingAiGenSuccess && (
              <p className="text-sm text-success-600 dark:text-success-400">{shadowingAiGenSuccess}</p>
            )}
          </div>

          {/* Sentences */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
              Frases para repetir
            </p>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={newShadowingSentence}
                onChange={e => setNewShadowingSentence(e.target.value)}
                placeholder="Nova frase em inglês (manual)"
                className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
              />
              <div className="flex gap-2">
                <input
                  value={newShadowingTranslation}
                  onChange={e => setNewShadowingTranslation(e.target.value)}
                  placeholder="Tradução"
                  className="min-w-0 flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
                />
                <button
                  type="button"
                  title="Traduzir com IA"
                  onClick={handleTranslateShadowingSentence}
                  disabled={!newShadowingSentence.trim() || translatingShadowingSentence}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-surface-200 px-2.5 py-2 text-xs font-medium text-surface-600 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-700"
                >
                  <Languages size={14} className={translatingShadowingSentence ? 'animate-pulse' : ''} />
                </button>
              </div>
              <Button
                size="sm"
                icon={<Plus size={14} />}
                disabled={!newShadowingSentence.trim() || !newShadowingTranslation.trim()}
                onClick={handleAddShadowingSentence}
              >
                Adicionar frase
              </Button>
            </div>
            {shadowingAiError && (
              <p className="mb-3 text-sm text-danger-600 dark:text-danger-400">{shadowingAiError}</p>
            )}
            <div className="space-y-2">
              {shadowingSentences.length === 0 ? (
                <p className="text-sm text-surface-400 dark:text-surface-500">
                  Nenhuma frase nesta lista ainda. Use "Gerar frases com IA" ou adicione manualmente.
                </p>
              ) : shadowingSentences.map((sentence, index) => (
                  <div
                    key={sentence.id}
                    className="rounded-lg border border-surface-200 p-3 dark:border-surface-700"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-surface-400 dark:text-surface-500">
                        Frase {index + 1} de {shadowingSentences.length}
                      </span>
                      <Badge variant="default">{PHRASE_SOURCE_LABEL[sentence.source]}</Badge>
                      {sentence.completed && <Badge variant="success">Finalizado</Badge>}
                    </div>
                    {editingSentenceId === sentence.id ? (
                      <div className="space-y-2">
                        <input
                          value={editingSentenceText}
                          onChange={e => setEditingSentenceText(e.target.value)}
                          className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
                        />
                        <input
                          value={editingSentenceTranslation}
                          onChange={e => setEditingSentenceTranslation(e.target.value)}
                          className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleSaveSentenceEdit}
                            disabled={!editingSentenceText.trim() || !editingSentenceTranslation.trim()}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Save size={13} />
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelSentenceEdit}
                            className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-2.5 py-1 text-xs font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-700"
                          >
                            <X size={13} />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">{sentence.text}</p>
                        <p className="mt-0.5 text-xs text-surface-400 dark:text-surface-500">{sentence.translation}</p>
                      </>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <div className="flex h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700">
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
                        +1 repetição
                      </button>
                      {!sentence.completed && (
                        <button
                          type="button"
                          onClick={() => handleMarkSentenceCompleted(sentence.id)}
                          className="inline-flex items-center gap-1 text-xs text-surface-400 hover:text-success-600 transition-colors"
                        >
                          <Check size={13} />
                          Finalizar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartEditSentence(sentence.id, sentence.text, sentence.translation)}
                        className="inline-flex items-center gap-1 text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRepetitionReset(sentence.id)}
                        className="text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
                      >
                        Resetar
                      </button>
                      <button
                        type="button"
                        title="Salvar esta frase como card de vocabulário"
                        onClick={() => handleSaveShadowingSentenceAsCard(sentence)}
                        className="inline-flex items-center gap-1 text-xs text-surface-400 hover:text-primary-600 transition-colors"
                      >
                        {savedPhraseIds.has(sentence.id) ? <CheckCircle2 size={13} className="text-success-600" /> : <Save size={13} />}
                        {savedPhraseIds.has(sentence.id) ? 'Salvo!' : 'Salvar como card'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteShadowingSentence(sentence.id)}
                        className="inline-flex items-center gap-1 text-xs text-surface-400 hover:text-danger-600 transition-colors"
                      >
                        <Trash2 size={13} />
                        Excluir
                      </button>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ══════════════════════════════════════════════════════
          ETAPA 4 — CARDS DE VOCABULÁRIO (flashcards estilo Anki)
      ══════════════════════════════════════════════════════ */}
      <Card id={CARDS_REVIEW_SECTION_ID}>
        <CardHeader
          title="4. Revisão de palavras desconhecidas"
          subtitle={`${vocabularyCards.length} card(s) salvos no dispositivo.`}
          icon={<BookOpen size={18} />}
        />
        <CardBody className="space-y-5">
          {/* AI panel */}
          <div className="space-y-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
              Traduzir e explicar com IA (Gemini)
            </p>
            <input
              value={cardWord}
              onChange={e => setCardWord(e.target.value)}
              placeholder="Digite uma palavra ou frase em inglês"
              className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={<Sparkles size={14} />}
                loading={aiCardLoading === 'translate'}
                disabled={!cardWord.trim() || aiCardLoading !== null}
                onClick={() => handleAiCardAction('translate')}
              >
                Traduzir com IA
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={aiCardLoading === 'explain'}
                disabled={!cardWord.trim() || aiCardLoading !== null}
                onClick={() => handleAiCardAction('explain')}
              >
                Explicar frase
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={aiCardLoading === 'examples'}
                disabled={!cardWord.trim() || aiCardLoading !== null}
                onClick={() => handleAiCardAction('examples')}
              >
                Gerar exemplos
              </Button>
            </div>

            {aiCardError && (
              <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300">
                {aiCardError}
              </div>
            )}

            {aiCardResult && (
              <div className="space-y-2 rounded-lg border border-primary-200 bg-primary-50/40 p-3 text-sm dark:border-primary-900/40 dark:bg-primary-900/10">
                <p><span className="font-semibold text-surface-900 dark:text-white">Tradução:</span> {aiCardResult.translation}</p>
                <p className="text-surface-600 dark:text-surface-300">{aiCardResult.simpleExplanationPtBr}</p>
                {aiCardResult.pronunciationTipPtBr && (
                  <p className="text-xs italic text-surface-500 dark:text-surface-400">🗣 {aiCardResult.pronunciationTipPtBr}</p>
                )}
                {aiCardResult.examples.length > 0 && (
                  <ul className="space-y-1">
                    {aiCardResult.examples.map((example, idx) => (
                      <li key={idx} className="text-xs text-surface-500 dark:text-surface-400">
                        <span className="italic">{example.english}</span> — {example.portuguese}
                      </li>
                    ))}
                  </ul>
                )}
                {aiCardResult.vocabulary.length > 0 && (
                  <div className="space-y-1 border-t border-primary-200 pt-2 dark:border-primary-900/40">
                    <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
                      Vocabulário relacionado
                    </p>
                    {aiCardResult.vocabulary.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                        <span>
                          <span className="font-medium text-surface-800 dark:text-surface-200">{item.word}</span> — {item.translation}
                        </span>
                        <button
                          type="button"
                          title="Salvar como card"
                          onClick={() => handleAddVocabularyItemAsCard(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1 text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-700"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Add/save card form */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={cardWord}
              onChange={e => setCardWord(e.target.value)}
              placeholder="Palavra ou frase em inglês"
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
              placeholder="Exemplo em inglês (opcional)"
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
            />
            <input
              value={cardExampleTranslation}
              onChange={e => setCardExampleTranslation(e.target.value)}
              placeholder="Tradução do exemplo (opcional)"
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
            />
          </div>
          <Button
            size="sm"
            icon={<Save size={14} />}
            disabled={!cardWord.trim() || !cardMeaning.trim()}
            onClick={handleAddCard}
          >
            Salvar como card
          </Button>

          {/* Flashcard de revisão — estilo Anki */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
              Revisar hoje ({dueTodayCards.length})
            </h3>
            {!currentReviewCard ? (
              <p className="text-sm text-surface-400 dark:text-surface-500">
                {vocabularyCards.length === 0
                  ? 'Nenhum card salvo ainda. Adicione palavras acima para começar a revisar.'
                  : 'Nenhum card vencido para revisar hoje. 🎉'}
              </p>
            ) : (
              <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-6 text-center dark:border-surface-700 dark:bg-surface-800/40">
                <p className="mb-3 text-2xl font-semibold text-surface-900 dark:text-white">
                  {currentReviewCard.wordOrPhrase}
                </p>
                {!revealed ? (
                  <Button onClick={() => setRevealed(true)}>Mostrar resposta</Button>
                ) : (
                  <div className="space-y-4">
                    <div className="mx-auto max-w-md space-y-1 text-left text-sm">
                      <p><span className="font-semibold text-surface-900 dark:text-white">Tradução:</span> {currentReviewCard.translation}</p>
                      {currentReviewCard.example && (
                        <p><span className="font-semibold text-surface-900 dark:text-white">Exemplo:</span> {currentReviewCard.example}</p>
                      )}
                      {currentReviewCard.exampleTranslation && (
                        <p><span className="font-semibold text-surface-900 dark:text-white">Tradução do exemplo:</span> {currentReviewCard.exampleTranslation}</p>
                      )}
                      <p className="pt-1">
                        <Badge variant="default">{`Origem: ${CARD_SOURCE_LABEL[currentReviewCard.source]}`}</Badge>
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {REVIEW_GRADE_ACTIONS.map(action => (
                        <Button
                          key={action.grade}
                          variant={action.variant}
                          onClick={() => handleCardReview(currentReviewCard.id, action.grade)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
                Cards futuros ({futureCards.length})
              </h3>
              <Button size="sm" variant="secondary" onClick={handleToggleFutureCards}>
                {ui.showFutureCards ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
            {ui.showFutureCards && (
              futureCards.length === 0 ? (
                <p className="text-sm text-surface-400 dark:text-surface-500">Nenhum card agendado para mais tarde.</p>
              ) : (
                <div className="space-y-2">
                  {futureCards.map(card => renderVocabularyCardRow(card, { showNextReview: true }))}
                </div>
              )
            )}
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
                Dominadas ({masteredCards.length})
              </h3>
              <Button size="sm" variant="secondary" onClick={handleToggleMasteredCards}>
                {ui.showMasteredCards ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
            {ui.showMasteredCards && (
              masteredCards.length === 0 ? (
                <p className="text-sm text-surface-400 dark:text-surface-500">Nenhuma palavra dominada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {masteredCards.map(card => renderVocabularyCardRow(card, { showMasteredAt: true }))}
                </div>
              )
            )}
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
                Histórico ({historyCards.length})
              </h3>
              <Button size="sm" variant="secondary" onClick={handleToggleHistory}>
                {ui.showHistory ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
            {ui.showHistory && (
              <div className="space-y-2">
                {historyCards.map(card => renderVocabularyCardRow(card, { showNextReview: true, showMasteredAt: true }))}
              </div>
            )}
          </section>
        </CardBody>
      </Card>
    </div>
  );
}
