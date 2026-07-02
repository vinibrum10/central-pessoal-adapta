import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, Save, Square } from 'lucide-react';
import { Button } from '../Button';
import type { InterviewQuestion } from '../../types/englishInterview';
import {
  formatBytes,
  formatDuration,
  getSupportedAudioMimeType,
  MAX_AUDIO_BYTES_FOR_AI,
  RECORDER_AUDIO_BITS_PER_SECOND,
  RECORDING_EXTRA_SECONDS,
} from '../../services/english/interviewAudio';

interface InterviewAnswerRecorderProps {
  question: InterviewQuestion | null;
  saving: boolean;
  onSave: (params: { audio: Blob; mimeType: string; durationSec: number; selfRating: number }) => Promise<void>;
}

export function InterviewAnswerRecorder({ question, saving, onSave }: InterviewAnswerRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [selfRating, setSelfRating] = useState(7);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  const mimeType = useMemo(() => getSupportedAudioMimeType(), []);
  const maxSeconds = (question?.timer_sugerido_min ?? 3) * 60 + RECORDING_EXTRA_SECONDS;
  const audioUrl = useMemo(() => audioBlob ? URL.createObjectURL(audioBlob) : '', [audioBlob]);

  useEffect(() => () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setRecording(false);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
  }

  async function startRecording() {
    if (!question) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador não suporta gravação de áudio.');
      return;
    }

    setError('');
    setAudioBlob(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        audioBitsPerSecond: RECORDER_AUDIO_BITS_PER_SECOND,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        const seconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        setDurationSec(seconds);
        if (blob.size > MAX_AUDIO_BYTES_FOR_AI) {
          setError(`A gravação ficou com ${formatBytes(blob.size)}. O limite para avaliação com IA é ${formatBytes(MAX_AUDIO_BYTES_FOR_AI)}. Grave uma resposta mais curta.`);
        }
        setAudioBlob(blob);
      };

      startedAtRef.current = Date.now();
      setDurationSec(0);
      setRecording(true);
      recorder.start();

      intervalRef.current = window.setInterval(() => {
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
        setDurationSec(elapsed);
        if (elapsed >= maxSeconds) stopRecording();
      }, 500);
    } catch {
      setError('Não foi possível acessar o microfone. Verifique a permissão do navegador.');
    }
  }

  async function handleSave() {
    if (!audioBlob) return;
    if (audioBlob.size > MAX_AUDIO_BYTES_FOR_AI) {
      setError(`A gravação está grande demais (${formatBytes(audioBlob.size)}). Grave novamente antes de salvar.`);
      return;
    }
    await onSave({
      audio: audioBlob,
      mimeType: audioBlob.type || mimeType || 'audio/webm',
      durationSec,
      selfRating,
    });
    setAudioBlob(null);
    setDurationSec(0);
  }

  if (!question) {
    return <p className="text-sm text-surface-500 dark:text-surface-400">Selecione uma pergunta para gravar a resposta.</p>;
  }

  const remaining = Math.max(0, maxSeconds - durationSec);

  return (
    <div className="space-y-4 rounded-lg border border-surface-200 bg-white/70 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-surface-950 dark:text-white">Gravador de resposta</p>
          <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
            Timer: {question.timer_sugerido_min} min + {RECORDING_EXTRA_SECONDS}s · Restante {formatDuration(remaining)}
          </p>
        </div>
        <div className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-semibold text-surface-600 dark:bg-white/10 dark:text-surface-300">
          {recording ? 'Gravando' : audioBlob ? formatBytes(audioBlob.size) : 'Pronto'}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <Button type="button" icon={<Mic size={16} />} onClick={startRecording} disabled={saving}>
            Gravar resposta
          </Button>
        ) : (
          <Button type="button" variant="danger" icon={<Square size={16} />} onClick={stopRecording}>
            Parar
          </Button>
        )}
      </div>

      {audioBlob && (
        <div className="space-y-3">
          <audio controls src={audioUrl} className="w-full" />
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Autoavaliação: {selfRating}/10</span>
            <input
              type="range"
              min={1}
              max={10}
              value={selfRating}
              onChange={event => setSelfRating(Number(event.target.value))}
              className="mt-2 w-full accent-primary-600"
            />
          </label>
          <Button type="button" icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} onClick={handleSave} disabled={saving}>
            Salvar tentativa
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-danger-600 dark:text-danger-300">{error}</p>}
    </div>
  );
}
