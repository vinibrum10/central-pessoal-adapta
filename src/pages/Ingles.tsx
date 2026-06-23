import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Edit2,
  ExternalLink,
  FileText,
  Headphones,
  Mic,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { addDays } from 'date-fns';
import { Button } from '../components/Button';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Input, Select, Textarea } from '../components/FormFields';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import {
  addSpeakingPractice,
  addStudySession,
  deletePhraseItem,
  deleteVocabularyItem,
  getEnglishStudyData,
  saveEnglishStudyData,
  savePhraseItem,
  saveVideo,
  saveVocabularyItem,
  toggleDailyPlanItem,
} from '../services/englishStudyStorage';
import {
  buscarVideosIngles,
  getYouTubeEnglishConfigMessage,
  isYouTubeEnglishConfigured,
  type BuscarVideosInglesParams,
} from '../services/youtubeEnglish';
import {
  getEnglishDriveConfigMessage,
  isEnglishDriveConfigured,
  listarMateriaisIngles,
} from '../services/googleDriveEnglish';
import { formatarDataCompleta, gerarId, hojeISO } from '../utils';
import type {
  EnglishDriveMaterial,
  EnglishLevel,
  EnglishStudyData,
  PhraseItem,
  ReviewStatus,
  SavedEnglishVideo,
  SpeakingPractice,
  StudySession,
  StudySource,
  VocabularyItem,
  YouTubeEnglishVideo,
} from '../types/englishStudy';

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const speakingPrompts = [
  'Tell me about your work routine this week.',
  'Describe one challenge you solved recently.',
  'Explain why learning English matters for your career.',
  'Talk about a meeting or class you attended today.',
];

const emptyStudyData: EnglishStudyData = {
  dailyPlan: [],
  sessions: [],
  vocabulary: [],
  phrases: [],
  speakingPractices: [],
  savedVideos: [],
};

const nextReviewDate = (days: number) => addDays(new Date(), days).toISOString().slice(0, 10);
const splitLines = (value: string) => value.split('\n').map(v => v.trim()).filter(Boolean);

function todayData(data: EnglishStudyData) {
  const today = hojeISO();
  const sessions = data.sessions.filter(s => s.date === today);
  const minutes = sessions.reduce((acc, session) => acc + (Number(session.minutes) || 0), 0);
  const pendingReviews = [
    ...data.vocabulary.filter(v => v.status !== 'dominado' && v.nextReviewAt <= today),
    ...data.phrases.filter(p => p.status !== 'dominado' && p.nextReviewAt <= today),
  ].length;

  const studiedDates = new Set(data.sessions.filter(s => s.minutes > 0).map(s => s.date));
  let streak = 0;
  let cursor = new Date();
  while (studiedDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return { sessions: sessions.length, minutes, pendingReviews, streak };
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody className="py-4">
        <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400">{label}</p>
        <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{value}</p>
      </CardBody>
    </Card>
  );
}

export function InglesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [data, setData] = useState<EnglishStudyData>(emptyStudyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [youtubeParams, setYoutubeParams] = useState<BuscarVideosInglesParams>({
    query: '',
    nivel: 'intermediário',
    duracao: 'qualquer',
    tema: '',
  });
  const [videos, setVideos] = useState<YouTubeEnglishVideo[]>([]);
  const [materiais, setMateriais] = useState<EnglishDriveMaterial[]>([]);
  const [sessionModal, setSessionModal] = useState<{ open: boolean; source: StudySource; title: string; url?: string }>({
    open: false,
    source: 'manual',
    title: '',
  });
  const [sessionForm, setSessionForm] = useState({
    minutes: 15,
    level: 'intermediário' as EnglishLevel,
    understoodPercent: 70,
    newWords: '',
    usefulPhrases: '',
    notes: '',
  });
  const [vocabForm, setVocabForm] = useState<Partial<VocabularyItem>>({ difficulty: 'intermediário', status: 'revisar', category: 'Geral' });
  const [phraseForm, setPhraseForm] = useState<Partial<PhraseItem>>({ status: 'revisar', context: 'Geral' });
  const [vocabFilter, setVocabFilter] = useState<ReviewStatus | 'todos'>('todos');
  const [phraseFilter, setPhraseFilter] = useState<ReviewStatus | 'todos'>('todos');
  const [speakingOpen, setSpeakingOpen] = useState(false);
  const [speakingPrompt, setSpeakingPrompt] = useState(speakingPrompts[0]);
  const [speakingText, setSpeakingText] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    let mounted = true;
    getEnglishStudyData(userId)
      .then(studyData => { if (mounted) setData(studyData); })
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar dados de inglês.'))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [userId]);

  const summary = useMemo(() => todayData(data), [data]);
  const pendingReviews = useMemo(() => {
    const today = hojeISO();
    return {
      vocabulary: data.vocabulary.filter(v => v.status !== 'dominado' && v.nextReviewAt <= today),
      phrases: data.phrases.filter(p => p.status !== 'dominado' && p.nextReviewAt <= today),
    };
  }, [data]);

  const filteredVocabulary = data.vocabulary.filter(item => vocabFilter === 'todos' || item.status === vocabFilter);
  const filteredPhrases = data.phrases.filter(item => phraseFilter === 'todos' || item.status === phraseFilter);

  async function refresh(next: EnglishStudyData) {
    setData(next);
  }

  async function handleSaveData(next: EnglishStudyData) {
    await saveEnglishStudyData(userId, next);
    setData(next);
  }

  async function handleTogglePlan(itemId: string) {
    const item = data.dailyPlan.find(p => p.id === itemId);
    if (!item) return;
    const next = await toggleDailyPlanItem(userId, item);
    refresh(next);
  }

  async function handleSearchVideos() {
    setError('');
    try {
      const result = await buscarVideosIngles(youtubeParams);
      setVideos(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar vídeos.');
    }
  }

  async function handleLoadDrive() {
    setError('');
    try {
      setMateriais(await listarMateriaisIngles());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao listar materiais.');
    }
  }

  async function handleSaveVideo(video: YouTubeEnglishVideo) {
    const saved: SavedEnglishVideo = {
      id: gerarId(),
      youtubeId: video.id,
      title: video.title,
      channelTitle: video.channelTitle,
      url: video.url,
      thumbnailUrl: video.thumbnailUrl,
      savedAt: hojeISO(),
    };
    refresh(await saveVideo(userId, saved));
  }

  async function handleSaveSession() {
    const session: StudySession = {
      id: gerarId(),
      date: hojeISO(),
      source: sessionModal.source,
      title: sessionModal.title || 'Estudo de inglês',
      url: sessionModal.url,
      minutes: Number(sessionForm.minutes) || 0,
      level: sessionForm.level,
      understoodPercent: Number(sessionForm.understoodPercent) || 0,
      newWords: splitLines(sessionForm.newWords),
      usefulPhrases: splitLines(sessionForm.usefulPhrases),
      notes: sessionForm.notes,
    };
    refresh(await addStudySession(userId, session));
    setSessionModal({ open: false, source: 'manual', title: '' });
  }

  async function handleSaveVocabulary() {
    if (!vocabForm.word || !vocabForm.translation) return;
    const now = hojeISO();
    const item: VocabularyItem = {
      id: vocabForm.id ?? gerarId(),
      word: vocabForm.word,
      translation: vocabForm.translation,
      example: vocabForm.example,
      category: vocabForm.category || 'Geral',
      difficulty: vocabForm.difficulty ?? 'intermediário',
      status: vocabForm.status ?? 'revisar',
      nextReviewAt: vocabForm.nextReviewAt || now,
      createdAt: vocabForm.createdAt ?? now,
      updatedAt: now,
      reviewCount: vocabForm.reviewCount ?? 0,
    };
    refresh(await saveVocabularyItem(userId, item));
    setVocabForm({ difficulty: 'intermediário', status: 'revisar', category: 'Geral' });
  }

  async function handleSavePhrase() {
    if (!phraseForm.phrase || !phraseForm.meaning) return;
    const now = hojeISO();
    const item: PhraseItem = {
      id: phraseForm.id ?? gerarId(),
      phrase: phraseForm.phrase,
      meaning: phraseForm.meaning,
      context: phraseForm.context || 'Geral',
      usageExample: phraseForm.usageExample,
      status: phraseForm.status ?? 'revisar',
      nextReviewAt: phraseForm.nextReviewAt || now,
      createdAt: phraseForm.createdAt ?? now,
      updatedAt: now,
      reviewCount: phraseForm.reviewCount ?? 0,
    };
    refresh(await savePhraseItem(userId, item));
    setPhraseForm({ status: 'revisar', context: 'Geral' });
  }

  async function updateVocabReview(item: VocabularyItem, status: ReviewStatus, days: number) {
    await saveVocabularyItem(userId, {
      ...item,
      status,
      nextReviewAt: nextReviewDate(days),
      reviewCount: item.reviewCount + 1,
      updatedAt: hojeISO(),
    }).then(refresh);
  }

  async function updatePhraseReview(item: PhraseItem, status: ReviewStatus, days: number) {
    await savePhraseItem(userId, {
      ...item,
      status,
      nextReviewAt: nextReviewDate(days),
      reviewCount: item.reviewCount + 1,
      updatedAt: hojeISO(),
    }).then(refresh);
  }

  function startSpeechRecognition() {
    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Recognition) {
      setError('Reconhecimento de voz indisponível neste navegador. Use o campo manual.');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onresult = event => {
      const text = Array.from(event.results).map(result => result[0].transcript).join(' ');
      setSpeakingText(prev => `${prev} ${text}`.trim());
    };
    recognition.onerror = () => setError('Não foi possível capturar o áudio. Você pode registrar manualmente.');
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function stopSpeechRecognition() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function handleSaveSpeaking() {
    if (!speakingText.trim()) return;
    const practice: SpeakingPractice = {
      id: gerarId(),
      date: hojeISO(),
      prompt: speakingPrompt,
      transcript: speakingText.trim(),
      minutes: 5,
    };
    const nextData = await addSpeakingPractice(userId, practice);
    const session: StudySession = {
      id: gerarId(),
      date: hojeISO(),
      source: 'speaking',
      title: `Speaking: ${speakingPrompt}`,
      minutes: 5,
      level: 'intermediário',
      understoodPercent: 100,
      newWords: [],
      usefulPhrases: [],
      notes: speakingText.trim(),
    };
    await handleSaveData({ ...nextData, sessions: [session, ...nextData.sessions] });
    setSpeakingOpen(false);
    setSpeakingText('');
  }

  if (loading) return <p className="text-sm text-surface-500 dark:text-surface-400">Carregando central de inglês...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Inglês</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Área prática para listening, vocabulário, speaking, frases úteis e revisões.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Tempo hoje" value={`${summary.minutes} min`} />
        <MetricCard label="Sessões hoje" value={`${summary.sessions}`} />
        <MetricCard label="Para revisar" value={`${summary.pendingReviews}`} />
        <MetricCard label="Sequência" value={`${summary.streak} dia(s)`} />
      </div>

      <Card>
        <CardHeader title="Plano de hoje" icon={<Check size={18} />} />
        <CardBody className="space-y-2">
          {data.dailyPlan.map(item => (
            <label key={item.id} className="flex items-center gap-3 rounded-lg border border-surface-200 dark:border-surface-700 p-3">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => handleTogglePlan(item.id)}
                className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              <span className={`text-sm ${item.done ? 'line-through text-surface-400' : 'text-surface-800 dark:text-surface-100'}`}>{item.title}</span>
            </label>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Listening Hub" icon={<Headphones size={18} />} action={!isYouTubeEnglishConfigured() ? <span className="text-xs text-warning-600">{getYouTubeEnglishConfigMessage()}</span> : undefined} />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input id="youtube-query" label="Busca" value={youtubeParams.query} onChange={e => setYoutubeParams(p => ({ ...p, query: e.target.value }))} placeholder="entrevista, trabalho, reunião..." />
            <Select id="youtube-level" label="Nível" value={youtubeParams.nivel} onChange={e => setYoutubeParams(p => ({ ...p, nivel: e.target.value as BuscarVideosInglesParams['nivel'] }))}>
              <option value="todos">Todos</option>
              <option value="iniciante">Iniciante</option>
              <option value="intermediário">Intermediário</option>
              <option value="avançado">Avançado</option>
            </Select>
            <Select id="youtube-duration" label="Duração" value={youtubeParams.duracao} onChange={e => setYoutubeParams(p => ({ ...p, duracao: e.target.value as BuscarVideosInglesParams['duracao'] }))}>
              <option value="qualquer">Qualquer</option>
              <option value="curta">Curta</option>
              <option value="media">Média</option>
              <option value="longa">Longa</option>
            </Select>
            <Input id="youtube-theme" label="Tema" value={youtubeParams.tema} onChange={e => setYoutubeParams(p => ({ ...p, tema: e.target.value }))} placeholder="career, tech..." />
            <div className="flex items-end">
              <Button className="w-full" icon={<Search size={16} />} onClick={handleSearchVideos}>Buscar</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {videos.map(video => (
              <div key={video.id} className="flex gap-3 rounded-xl border border-surface-200 dark:border-surface-700 p-3">
                {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="w-28 h-20 object-cover rounded-lg" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-surface-900 dark:text-white line-clamp-2">{video.title}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{video.channelTitle}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" variant="secondary" icon={<ExternalLink size={14} />} onClick={() => window.open(video.url, '_blank')}>Abrir</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleSaveVideo(video)}>Salvar</Button>
                    <Button size="sm" onClick={() => setSessionModal({ open: true, source: 'youtube', title: video.title, url: video.url })}>Registrar estudo</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Materiais do Google Drive" icon={<FileText size={18} />} action={!isEnglishDriveConfigured() ? <span className="text-xs text-warning-600">{getEnglishDriveConfigMessage()}</span> : undefined} />
        <CardBody className="space-y-4">
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={handleLoadDrive}>Listar materiais</Button>
          <div className="space-y-2">
            {materiais.map(material => (
              <div key={material.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-surface-200 dark:border-surface-700 p-3">
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{material.name}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">Atualizado em {formatarDataCompleta(material.modifiedTime.slice(0, 10))}</p>
                </div>
                <div className="flex gap-2">
                  {material.webViewLink && <Button size="sm" variant="secondary" onClick={() => window.open(material.webViewLink, '_blank')}>Abrir</Button>}
                  <Button size="sm" onClick={() => setSessionModal({ open: true, source: 'drive', title: material.name, url: material.webViewLink })}>Registrar como estudado</Button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Vocabulário" icon={<BookOpen size={18} />} />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input id="vocab-word" label="Palavra" value={vocabForm.word ?? ''} onChange={e => setVocabForm(v => ({ ...v, word: e.target.value }))} />
              <Input id="vocab-translation" label="Tradução" value={vocabForm.translation ?? ''} onChange={e => setVocabForm(v => ({ ...v, translation: e.target.value }))} />
              <Input id="vocab-category" label="Categoria" value={vocabForm.category ?? ''} onChange={e => setVocabForm(v => ({ ...v, category: e.target.value }))} />
              <Select id="vocab-difficulty" label="Dificuldade" value={vocabForm.difficulty ?? 'intermediário'} onChange={e => setVocabForm(v => ({ ...v, difficulty: e.target.value as EnglishLevel }))}>
                <option value="iniciante">Iniciante</option>
                <option value="intermediário">Intermediário</option>
                <option value="avançado">Avançado</option>
              </Select>
              <Input id="vocab-example" label="Exemplo" value={vocabForm.example ?? ''} onChange={e => setVocabForm(v => ({ ...v, example: e.target.value }))} className="md:col-span-2" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={<Plus size={16} />} onClick={handleSaveVocabulary}>{vocabForm.id ? 'Salvar edição' : 'Adicionar palavra'}</Button>
              <Select id="vocab-filter" label="Filtro" value={vocabFilter} onChange={e => setVocabFilter(e.target.value as ReviewStatus | 'todos')} className="min-w-40">
                <option value="todos">Todos</option>
                <option value="novo">Novo</option>
                <option value="revisar">Revisar</option>
                <option value="dominado">Dominado</option>
              </Select>
            </div>
            <div className="space-y-2">
              {filteredVocabulary.map(item => (
                <div key={item.id} className="rounded-lg border border-surface-200 dark:border-surface-700 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900 dark:text-white">{item.word} <span className="font-normal text-surface-500">- {item.translation}</span></p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">{item.category} · {item.status} · próxima revisão {formatarDataCompleta(item.nextReviewAt)}</p>
                      {item.example && <p className="text-sm text-surface-600 dark:text-surface-300 mt-1">{item.example}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" icon={<Edit2 size={14} />} onClick={() => setVocabForm(item)}>Editar</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => deleteVocabularyItem(userId, item.id).then(refresh)}>Excluir</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" variant="secondary" onClick={() => updateVocabReview(item, 'revisar', 2)}>Revisar depois</Button>
                    <Button size="sm" variant="success" onClick={() => updateVocabReview(item, 'dominado', 14)}>Dominei</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Frases úteis" icon={<FileText size={18} />} />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input id="phrase" label="Frase" value={phraseForm.phrase ?? ''} onChange={e => setPhraseForm(p => ({ ...p, phrase: e.target.value }))} />
              <Input id="phrase-meaning" label="Significado" value={phraseForm.meaning ?? ''} onChange={e => setPhraseForm(p => ({ ...p, meaning: e.target.value }))} />
              <Input id="phrase-context" label="Contexto" value={phraseForm.context ?? ''} onChange={e => setPhraseForm(p => ({ ...p, context: e.target.value }))} />
              <Input id="phrase-example" label="Exemplo de uso" value={phraseForm.usageExample ?? ''} onChange={e => setPhraseForm(p => ({ ...p, usageExample: e.target.value }))} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={<Plus size={16} />} onClick={handleSavePhrase}>{phraseForm.id ? 'Salvar edição' : 'Adicionar frase'}</Button>
              <Select id="phrase-filter" label="Filtro" value={phraseFilter} onChange={e => setPhraseFilter(e.target.value as ReviewStatus | 'todos')} className="min-w-40">
                <option value="todos">Todos</option>
                <option value="novo">Novo</option>
                <option value="revisar">Revisar</option>
                <option value="dominado">Dominado</option>
              </Select>
            </div>
            <div className="space-y-2">
              {filteredPhrases.map(item => (
                <div key={item.id} className="rounded-lg border border-surface-200 dark:border-surface-700 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900 dark:text-white">{item.phrase}</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">{item.meaning} · {item.context} · {item.status}</p>
                      {item.usageExample && <p className="text-sm text-surface-600 dark:text-surface-300 mt-1">{item.usageExample}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" icon={<Edit2 size={14} />} onClick={() => setPhraseForm(item)}>Editar</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => deletePhraseItem(userId, item.id).then(refresh)}>Excluir</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" variant="secondary" onClick={() => updatePhraseReview(item, 'revisar', 2)}>Revisar depois</Button>
                    <Button size="sm" variant="success" onClick={() => updatePhraseReview(item, 'dominado', 14)}>Dominei</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Speaking" icon={<Mic size={18} />} action={<Button size="sm" onClick={() => setSpeakingOpen(true)}>Praticar agora</Button>} />
          <CardBody className="space-y-2">
            {speakingPrompts.map(prompt => (
              <button key={prompt} onClick={() => { setSpeakingPrompt(prompt); setSpeakingOpen(true); }} className="w-full text-left rounded-lg border border-surface-200 dark:border-surface-700 p-3 text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700">
                {prompt}
              </button>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Revisões pendentes" icon={<RefreshCw size={18} />} />
          <CardBody className="space-y-3">
            {[...pendingReviews.vocabulary, ...pendingReviews.phrases].length === 0 && (
              <p className="text-sm text-surface-500 dark:text-surface-400">Nada pendente para hoje.</p>
            )}
            {pendingReviews.vocabulary.map(item => (
              <div key={item.id} className="rounded-lg border border-surface-200 dark:border-surface-700 p-3">
                <p className="text-sm font-semibold text-surface-900 dark:text-white">{item.word} - {item.translation}</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="secondary" onClick={() => updateVocabReview(item, 'revisar', 1)}>Revisar amanhã</Button>
                  <Button size="sm" variant="success" onClick={() => updateVocabReview(item, 'dominado', 14)}>Marcar dominado</Button>
                </div>
              </div>
            ))}
            {pendingReviews.phrases.map(item => (
              <div key={item.id} className="rounded-lg border border-surface-200 dark:border-surface-700 p-3">
                <p className="text-sm font-semibold text-surface-900 dark:text-white">{item.phrase}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">{item.meaning}</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="secondary" onClick={() => updatePhraseReview(item, 'revisar', 1)}>Revisar amanhã</Button>
                  <Button size="sm" variant="success" onClick={() => updatePhraseReview(item, 'dominado', 14)}>Marcar dominado</Button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Modal isOpen={sessionModal.open} onClose={() => setSessionModal({ open: false, source: 'manual', title: '' })} title="Registrar estudo" size="lg">
        <div className="space-y-4">
          <p className="text-sm font-medium text-surface-900 dark:text-white">{sessionModal.title}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input id="session-minutes" label="Minutos" type="number" min={0} value={sessionForm.minutes} onChange={e => setSessionForm(f => ({ ...f, minutes: Number(e.target.value) }))} />
            <Select id="session-level" label="Nível" value={sessionForm.level} onChange={e => setSessionForm(f => ({ ...f, level: e.target.value as EnglishLevel }))}>
              <option value="iniciante">Iniciante</option>
              <option value="intermediário">Intermediário</option>
              <option value="avançado">Avançado</option>
            </Select>
            <Input id="session-understood" label="Compreensão %" type="number" min={0} max={100} value={sessionForm.understoodPercent} onChange={e => setSessionForm(f => ({ ...f, understoodPercent: Number(e.target.value) }))} />
          </div>
          <Textarea id="session-words" label="Palavras novas" value={sessionForm.newWords} onChange={e => setSessionForm(f => ({ ...f, newWords: e.target.value }))} hint="Uma por linha" />
          <Textarea id="session-phrases" label="Frases úteis" value={sessionForm.usefulPhrases} onChange={e => setSessionForm(f => ({ ...f, usefulPhrases: e.target.value }))} hint="Uma por linha" />
          <Textarea id="session-notes" label="Notas" value={sessionForm.notes} onChange={e => setSessionForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSessionModal({ open: false, source: 'manual', title: '' })}>Cancelar</Button>
            <Button onClick={handleSaveSession}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={speakingOpen} onClose={() => setSpeakingOpen(false)} title="Prática de speaking" size="lg">
        <div className="space-y-4">
          <Select id="speaking-prompt" label="Pergunta" value={speakingPrompt} onChange={e => setSpeakingPrompt(e.target.value)}>
            {speakingPrompts.map(prompt => <option key={prompt} value={prompt}>{prompt}</option>)}
          </Select>
          <Textarea id="speaking-text" label="Resposta ou transcrição" value={speakingText} onChange={e => setSpeakingText(e.target.value)} rows={6} />
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="secondary" icon={<Mic size={16} />} onClick={listening ? stopSpeechRecognition : startSpeechRecognition}>
              {listening ? 'Parar gravação' : 'Usar microfone'}
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setSpeakingOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveSpeaking}>Salvar prática</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
