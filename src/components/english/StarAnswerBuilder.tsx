import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, Edit3, Loader2, Save, Trash2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import { Button } from '../Button';
import type { InterviewQuestion, StarAnswer, StarAnswerInput } from '../../types/englishInterview';
import {
  createStarAnswer,
  deleteStarAnswer,
  listStarAnswers,
  updateStarAnswer,
} from '../../services/english/starAnswerRepository';

interface StarAnswerBuilderProps {
  userId: string;
  questions: InterviewQuestion[];
}

const EMPTY_FORM: StarAnswerInput = {
  question_id: '',
  title: '',
  situation: '',
  task: '',
  action: '',
  result: '',
  final_answer_en: '',
  notes_pt: '',
};

const fieldLabels: Array<[keyof StarAnswerInput, string, string]> = [
  ['situation', 'Situation', 'Contexto do caso, projeto ou problema.'],
  ['task', 'Task', 'Sua responsabilidade específica.'],
  ['action', 'Action', 'O que você fez, decidiu ou coordenou.'],
  ['result', 'Result', 'Resultado mensurável ou aprendizado.'],
];

export function StarAnswerBuilder({ userId, questions }: StarAnswerBuilderProps) {
  const [answers, setAnswers] = useState<StarAnswer[]>([]);
  const [form, setForm] = useState<StarAnswerInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const questionById = useMemo(() => new Map(questions.map(question => [question.id, question])), [questions]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await listStarAnswers();
      setAnswers(next);
      if (!form.question_id && questions[0]) {
        setForm(prev => ({ ...prev, question_id: questions[0].id }));
      }
    } catch (err) {
      console.error('[EnglishEmployability] Failed to load STAR answers', err);
      setError('Não foi possível carregar as respostas STAR.');
    } finally {
      setLoading(false);
    }
  }, [form.question_id, questions]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateField<K extends keyof StarAnswerInput>(key: K, value: StarAnswerInput[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, question_id: questions[0]?.id ?? '' });
  }

  function startEditing(answer: StarAnswer) {
    setEditingId(answer.id);
    setForm({
      question_id: answer.question_id,
      title: answer.title,
      situation: answer.situation,
      task: answer.task,
      action: answer.action,
      result: answer.result,
      final_answer_en: answer.final_answer_en,
      notes_pt: answer.notes_pt,
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.question_id) {
      setError('Escolha uma pergunta de entrevista para associar a resposta STAR.');
      return;
    }
    if (!form.title.trim() || !form.final_answer_en.trim()) {
      setError('Preencha pelo menos o título e a resposta final em inglês.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await updateStarAnswer(editingId, form);
      } else {
        await createStarAnswer(userId, form);
      }
      resetForm();
      setAnswers(await listStarAnswers());
    } catch (err) {
      console.error('[EnglishEmployability] Failed to save STAR answer', err);
      setError('Não foi possível salvar a resposta STAR.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(answerId: string) {
    setSaving(true);
    setError('');
    try {
      await deleteStarAnswer(answerId);
      if (editingId === answerId) resetForm();
      setAnswers(await listStarAnswers());
    } catch (err) {
      console.error('[EnglishEmployability] Failed to delete STAR answer', err);
      setError('Não foi possível remover a resposta STAR.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader
          title={editingId ? 'Editar resposta STAR' : 'Nova resposta STAR'}
          subtitle="Estruture histórias profissionais para entrevistas nos EUA."
          icon={<Edit3 size={18} />}
        />
        <CardBody>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Pergunta associada</span>
              <select
                value={form.question_id}
                onChange={event => updateField('question_id', event.target.value)}
                className="min-h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900 outline-none focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-white"
              >
                <option value="">Selecione uma pergunta</option>
                {questions.map(question => (
                  <option key={question.id} value={question.id}>
                    {question.id} - {question.question_en}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Título</span>
              <input
                value={form.title}
                onChange={event => updateField('title', event.target.value)}
                placeholder="Ex.: Commissioning under pressure"
                className="min-h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900 outline-none placeholder:text-surface-400 focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-white"
              />
            </label>

            {fieldLabels.map(([key, label, hint]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{label}</span>
                <span className="mb-2 block text-xs text-surface-500 dark:text-surface-400">{hint}</span>
                <textarea
                  value={form[key]}
                  onChange={event => updateField(key, event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm leading-6 text-surface-900 outline-none focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-white"
                />
              </label>
            ))}

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Resposta final em inglês</span>
              <textarea
                value={form.final_answer_en}
                onChange={event => updateField('final_answer_en', event.target.value)}
                rows={5}
                placeholder="In my previous role, I was responsible for..."
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm leading-6 text-surface-900 outline-none placeholder:text-surface-400 focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-white"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Notas em português</span>
              <textarea
                value={form.notes_pt}
                onChange={event => updateField('notes_pt', event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm leading-6 text-surface-900 outline-none focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-white"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={saving} icon={<Save size={16} />}>
                {editingId ? 'Salvar edição' : 'Salvar STAR'}
              </Button>
              {editingId && (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancelar edição
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Banco STAR"
          subtitle={`${answers.length} respostas salvas`}
          icon={<Edit3 size={18} />}
        />
        <CardBody className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
              <Loader2 size={16} className="animate-spin" />
              Carregando respostas...
            </div>
          ) : answers.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">Nenhuma resposta STAR salva ainda.</p>
          ) : (
            answers.map(answer => {
              const question = answer.interview_questions ?? questionById.get(answer.question_id) ?? null;
              return (
                <div key={answer.id} className="rounded-lg border border-surface-200 bg-white/75 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-surface-950 dark:text-white">{answer.title}</p>
                      <p className="mt-1 text-xs leading-5 text-surface-500 dark:text-surface-400">
                        {question ? `${question.id} - ${question.question_en}` : answer.question_id}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(answer)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 transition-colors hover:bg-surface-50 dark:border-primary-300/15 dark:text-surface-300 dark:hover:bg-white/10"
                        title="Editar"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(answer.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-danger-200 text-danger-600 transition-colors hover:bg-danger-50 dark:border-danger-500/30 dark:text-danger-300 dark:hover:bg-danger-500/10"
                        title="Remover"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs md:grid-cols-2">
                    <p className="min-w-0 break-words rounded-lg bg-surface-50 p-2 text-surface-600 dark:bg-white/5 dark:text-surface-300"><span className="font-semibold">S:</span> {answer.situation || '—'}</p>
                    <p className="min-w-0 break-words rounded-lg bg-surface-50 p-2 text-surface-600 dark:bg-white/5 dark:text-surface-300"><span className="font-semibold">T:</span> {answer.task || '—'}</p>
                    <p className="min-w-0 break-words rounded-lg bg-surface-50 p-2 text-surface-600 dark:bg-white/5 dark:text-surface-300"><span className="font-semibold">A:</span> {answer.action || '—'}</p>
                    <p className="min-w-0 break-words rounded-lg bg-surface-50 p-2 text-surface-600 dark:bg-white/5 dark:text-surface-300"><span className="font-semibold">R:</span> {answer.result || '—'}</p>
                  </div>
                  <p className="mt-3 break-words text-sm leading-6 text-surface-700 dark:text-surface-200">{answer.final_answer_en}</p>
                </div>
              );
            })
          )}
        </CardBody>
      </Card>
    </div>
  );
}
