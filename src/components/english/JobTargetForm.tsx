import { useState, type FormEvent } from 'react';
import { Save, Sparkles } from 'lucide-react';
import { Button } from '../Button';
import { JOB_TARGET_STATUS_LABELS, type JobTargetInput, type JobTargetStatus } from '../../types/englishInterview';

interface JobTargetFormProps {
  initialValues?: JobTargetInput;
  saving: boolean;
  analyzing: boolean;
  onSave: (input: JobTargetInput) => Promise<void>;
  onSaveAndAnalyze: (input: JobTargetInput) => Promise<void>;
  onCancel: () => void;
}

export const EMPTY_JOB_TARGET_FORM: JobTargetInput = {
  title: '',
  company: '',
  location: '',
  job_url: '',
  description: '',
  status: 'researching',
};

const STATUS_OPTIONS = Object.entries(JOB_TARGET_STATUS_LABELS) as Array<[JobTargetStatus, string]>;

const inputClass = 'min-h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900 outline-none placeholder:text-surface-400 focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-white';

export function JobTargetForm({ initialValues, saving, analyzing, onSave, onSaveAndAnalyze, onCancel }: JobTargetFormProps) {
  const [form, setForm] = useState<JobTargetInput>(initialValues ?? EMPTY_JOB_TARGET_FORM);
  const [error, setError] = useState('');

  function updateField<K extends keyof JobTargetInput>(key: K, value: JobTargetInput[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    if (!form.title.trim() || !form.description.trim()) {
      setError('Preencha pelo menos o título e a descrição completa da vaga.');
      return false;
    }
    setError('');
    return true;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    await onSave(form);
  }

  async function handleSaveAndAnalyze() {
    if (!validate()) return;
    await onSaveAndAnalyze(form);
  }

  const busy = saving || analyzing;

  return (
    <form className="space-y-4 rounded-lg border border-primary-300/20 bg-primary-500/5 p-4" onSubmit={handleSubmit}>
      {error && <p className="text-sm text-danger-600 dark:text-danger-300">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Título da vaga *</span>
          <input
            value={form.title}
            onChange={event => updateField('title', event.target.value)}
            placeholder="Ex.: Electrical Engineer — Substation Design"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Empresa</span>
          <input
            value={form.company}
            onChange={event => updateField('company', event.target.value)}
            placeholder="Ex.: Duke Energy"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Localização</span>
          <input
            value={form.location}
            onChange={event => updateField('location', event.target.value)}
            placeholder="Ex.: Charlotte, NC"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Link da vaga (opcional)</span>
          <input
            value={form.job_url}
            onChange={event => updateField('job_url', event.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Status da candidatura</span>
        <select
          value={form.status}
          onChange={event => updateField('status', event.target.value as JobTargetStatus)}
          className={inputClass}
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Descrição completa da vaga (em inglês) *</span>
        <textarea
          value={form.description}
          onChange={event => updateField('description', event.target.value)}
          rows={10}
          placeholder="Cole aqui a descrição completa da vaga..."
          className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm leading-6 text-surface-900 outline-none placeholder:text-surface-400 focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-white"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={saving && !analyzing} disabled={busy} icon={<Save size={16} />}>
          Salvar vaga
        </Button>
        <Button type="button" variant="secondary" loading={analyzing} disabled={busy} icon={<Sparkles size={16} />} onClick={handleSaveAndAnalyze}>
          Salvar e analisar com IA
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
