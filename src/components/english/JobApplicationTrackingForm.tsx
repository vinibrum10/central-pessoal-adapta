import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { Button } from '../Button';
import {
  JOB_TARGET_PRIORITY_LABELS,
  JOB_TARGET_STATUS_LABELS,
  JOB_TARGET_WORK_MODEL_LABELS,
  type JobApplicationTrackingInput,
  type JobTarget,
  type JobTargetPriority,
  type JobTargetStatus,
  type JobTargetWorkModel,
} from '../../types/englishInterview';

interface JobApplicationTrackingFormProps {
  jobTarget: JobTarget;
  saving: boolean;
  onSave: (input: JobApplicationTrackingInput) => Promise<void>;
}

const inputClass = 'min-h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900 outline-none placeholder:text-surface-400 focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-white';
const textareaClass = 'w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm leading-6 text-surface-900 outline-none placeholder:text-surface-400 focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-white';

const statusOptions = Object.entries(JOB_TARGET_STATUS_LABELS) as Array<[JobTargetStatus, string]>;
const workModelOptions = Object.entries(JOB_TARGET_WORK_MODEL_LABELS) as Array<[JobTargetWorkModel, string]>;
const priorityOptions = Object.entries(JOB_TARGET_PRIORITY_LABELS) as Array<[JobTargetPriority, string]>;

function toInputDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function fromTarget(target: JobTarget): JobApplicationTrackingInput {
  return {
    status: target.status,
    applied_at: target.applied_at,
    interview_at: target.interview_at,
    follow_up_at: target.follow_up_at,
    next_action: target.next_action ?? '',
    application_notes: target.application_notes ?? '',
    recruiter_name: target.recruiter_name ?? '',
    recruiter_contact: target.recruiter_contact ?? '',
    salary_range: target.salary_range ?? '',
    work_model: target.work_model ?? '',
    visa_sponsorship: target.visa_sponsorship ?? '',
    priority: target.priority ?? '',
  };
}

export function JobApplicationTrackingForm({ jobTarget, saving, onSave }: JobApplicationTrackingFormProps) {
  const [form, setForm] = useState<JobApplicationTrackingInput>(() => fromTarget(jobTarget));
  const [appliedAt, setAppliedAt] = useState(() => toInputDateTime(jobTarget.applied_at));
  const [interviewAt, setInterviewAt] = useState(() => toInputDateTime(jobTarget.interview_at));
  const [followUpAt, setFollowUpAt] = useState(() => toInputDateTime(jobTarget.follow_up_at));
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(fromTarget(jobTarget));
    setAppliedAt(toInputDateTime(jobTarget.applied_at));
    setInterviewAt(toInputDateTime(jobTarget.interview_at));
    setFollowUpAt(toInputDateTime(jobTarget.follow_up_at));
    setError('');
  }, [jobTarget]);

  function updateField<K extends keyof JobApplicationTrackingInput>(key: K, value: JobApplicationTrackingInput[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await onSave({
        ...form,
        applied_at: toIsoOrNull(appliedAt),
        interview_at: toIsoOrNull(interviewAt),
        follow_up_at: toIsoOrNull(followUpAt),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o acompanhamento.');
    }
  }

  return (
    <form className="space-y-4 rounded-lg border border-surface-200 bg-white/70 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]" onSubmit={handleSubmit}>
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Status</span>
          <select value={form.status} onChange={event => updateField('status', event.target.value as JobTargetStatus)} className={inputClass}>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Prioridade</span>
          <select value={form.priority} onChange={event => updateField('priority', event.target.value as JobTargetPriority | '')} className={inputClass}>
            <option value="">Sem prioridade</option>
            {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Modelo</span>
          <select value={form.work_model} onChange={event => updateField('work_model', event.target.value as JobTargetWorkModel | '')} className={inputClass}>
            <option value="">Não informado</option>
            {workModelOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Data de aplicação</span>
          <input type="datetime-local" value={appliedAt} onChange={event => setAppliedAt(event.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Data de entrevista</span>
          <input type="datetime-local" value={interviewAt} onChange={event => setInterviewAt(event.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Data de follow-up</span>
          <input type="datetime-local" value={followUpAt} onChange={event => setFollowUpAt(event.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Recrutador</span>
          <input value={form.recruiter_name} onChange={event => updateField('recruiter_name', event.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Contato do recrutador</span>
          <input value={form.recruiter_contact} onChange={event => updateField('recruiter_contact', event.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Faixa salarial</span>
          <input value={form.salary_range} onChange={event => updateField('salary_range', event.target.value)} placeholder="Ex.: $95k-$120k" className={inputClass} />
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Próxima ação</span>
        <input value={form.next_action} onChange={event => updateField('next_action', event.target.value)} placeholder="Ex.: Enviar follow-up para recruiter" className={inputClass} />
      </label>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Sponsorship / visto</span>
          <textarea value={form.visa_sponsorship} onChange={event => updateField('visa_sponsorship', event.target.value)} rows={3} className={textareaClass} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">Observações</span>
          <textarea value={form.application_notes} onChange={event => updateField('application_notes', event.target.value)} rows={3} className={textareaClass} />
        </label>
      </div>

      <Button type="submit" loading={saving} icon={<Save size={16} />}>
        Salvar acompanhamento
      </Button>
    </form>
  );
}
