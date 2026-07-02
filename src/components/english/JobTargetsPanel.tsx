import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Archive, ArrowLeft, Briefcase, ExternalLink, Loader2, Plus, Sparkles } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import { Button } from '../Button';
import {
  JOB_TARGET_STATUS_LABELS,
  type InterviewQuestion,
  type JobTarget,
  type JobTargetInput,
  type JobTargetStatus,
} from '../../types/englishInterview';
import {
  archiveJobTarget,
  createJobTarget,
  listJobTargets,
  saveJobTargetAnalysis,
  updateJobTargetStatus,
} from '../../services/english/jobTargetsRepository';
import { analyzeJobTarget } from '../../services/english/jobTargetApi';
import { JobApplicationMaterials } from './JobApplicationMaterials';
import { JobTargetActionPlan } from './JobTargetActionPlan';
import { JobTargetAnalysis } from './JobTargetAnalysis';
import { JobTargetForm } from './JobTargetForm';

interface JobTargetsPanelProps {
  userId: string;
  questions: InterviewQuestion[];
}

const STATUS_BADGE_STYLES: Record<JobTargetStatus, string> = {
  researching: 'bg-surface-100 text-surface-600 dark:bg-white/10 dark:text-surface-300',
  to_apply: 'bg-primary-500/10 text-primary-700 dark:text-primary-200',
  applied: 'bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300',
  interview: 'bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-300',
  rejected: 'bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-300',
  offer: 'bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-300',
  archived: 'bg-surface-100 text-surface-400 dark:bg-white/5 dark:text-surface-500',
};

const STATUS_FILTER_OPTIONS: Array<['all' | JobTargetStatus, string]> = [
  ['all', 'Todas'],
  ...(Object.entries(JOB_TARGET_STATUS_LABELS) as Array<[JobTargetStatus, string]>),
];

function StatusBadge({ status }: { status: JobTargetStatus }) {
  return (
    <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${STATUS_BADGE_STYLES[status]}`}>
      {JOB_TARGET_STATUS_LABELS[status]}
    </span>
  );
}

export function JobTargetsPanel({ userId, questions }: JobTargetsPanelProps) {
  const [targets, setTargets] = useState<JobTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | JobTargetStatus>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const selected = targets.find(target => target.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTargets(await listJobTargets());
    } catch (err) {
      console.error('[JobTargets] Failed to load job targets', err);
      setError('Não foi possível carregar as vagas. Confira se a migration da Fase 4A foi aplicada.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function upsertLocal(target: JobTarget) {
    setTargets(prev => {
      const index = prev.findIndex(item => item.id === target.id);
      if (index < 0) return [target, ...prev];
      const next = [...prev];
      next[index] = target;
      return next;
    });
  }

  async function runAnalysis(target: JobTarget): Promise<void> {
    setAnalyzing(true);
    setError('');
    try {
      const analysis = await analyzeJobTarget({
        title: target.title,
        company: target.company ?? '',
        location: target.location ?? '',
        jobDescription: target.description,
      });
      const updated = await saveJobTargetAnalysis(target.id, analysis);
      upsertLocal(updated);
    } catch (err) {
      console.error('[JobTargets] Failed to analyze job target', err);
      setError(err instanceof Error ? err.message : 'Não foi possível analisar a vaga com IA.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave(input: JobTargetInput, analyzeAfter: boolean) {
    setSaving(true);
    setError('');
    try {
      const created = await createJobTarget(userId, input);
      upsertLocal(created);
      setShowForm(false);
      setSelectedId(created.id);
      if (analyzeAfter) await runAnalysis(created);
    } catch (err) {
      console.error('[JobTargets] Failed to save job target', err);
      setError('Não foi possível salvar a vaga.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(target: JobTarget, status: JobTargetStatus) {
    setError('');
    try {
      upsertLocal(await updateJobTargetStatus(target.id, status));
    } catch (err) {
      console.error('[JobTargets] Failed to update job target status', err);
      setError('Não foi possível atualizar o status da vaga.');
    }
  }

  async function handleArchive(target: JobTarget) {
    setArchivingId(target.id);
    setError('');
    try {
      upsertLocal(await archiveJobTarget(target.id));
      if (selectedId === target.id) setSelectedId(null);
    } catch (err) {
      console.error('[JobTargets] Failed to archive job target', err);
      setError('Não foi possível arquivar a vaga.');
    } finally {
      setArchivingId(null);
    }
  }

  const errorBanner = error && (
    <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{error}</span>
    </div>
  );

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="secondary" size="sm" icon={<ArrowLeft size={14} />} onClick={() => setSelectedId(null)}>
            Voltar para a lista
          </Button>
          <StatusBadge status={selected.status} />
        </div>

        {errorBanner}

        <Card>
          <CardHeader
            title={selected.title}
            subtitle={[selected.company, selected.location].filter(Boolean).join(' · ') || 'Sem empresa/localização'}
            icon={<Briefcase size={18} />}
            action={(
              <div className="flex flex-wrap gap-2">
                <select
                  value={selected.status}
                  onChange={event => handleStatusChange(selected, event.target.value as JobTargetStatus)}
                  className="min-h-9 rounded-lg border border-surface-200 bg-white px-2 text-xs font-semibold text-surface-700 outline-none focus:border-primary-400 dark:border-primary-300/15 dark:bg-white/[0.03] dark:text-surface-200"
                >
                  {(Object.entries(JOB_TARGET_STATUS_LABELS) as Array<[JobTargetStatus, string]>).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  icon={analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  loading={analyzing}
                  disabled={analyzing}
                  onClick={() => runAnalysis(selected)}
                >
                  {selected.ai_analysis ? 'Reanalisar com IA' : 'Analisar com IA'}
                </Button>
              </div>
            )}
          />
          <CardBody className="space-y-4">
            {selected.job_url && (
              <a
                href={selected.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline dark:text-primary-200"
              >
                <ExternalLink size={14} /> Abrir vaga original
              </a>
            )}

            <details className="rounded-lg border border-surface-200 bg-white/60 p-3 dark:border-primary-300/15 dark:bg-white/[0.03]">
              <summary className="cursor-pointer text-sm font-semibold text-surface-800 dark:text-surface-100">Descrição da vaga</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-surface-600 dark:text-surface-300">{selected.description}</p>
            </details>

            {selected.ai_analysis ? (
              <JobTargetAnalysis analysis={selected.ai_analysis} />
            ) : (
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Esta vaga ainda não foi analisada. Clique em “Analisar com IA” para gerar o plano de preparação.
              </p>
            )}
          </CardBody>
        </Card>

        {selected.ai_analysis && (
          <JobTargetActionPlan userId={userId} jobTarget={selected} questions={questions} />
        )}

        {selected.ai_analysis && (
          <JobApplicationMaterials userId={userId} jobTarget={selected} />
        )}
      </div>
    );
  }

  const filtered = statusFilter === 'all'
    ? targets.filter(target => target.status !== 'archived')
    : targets.filter(target => target.status === statusFilter);

  return (
    <div className="space-y-4">
      {errorBanner}

      <Card>
        <CardHeader
          title="Vagas EUA"
          subtitle="Cole vagas americanas reais e transforme cada uma em um plano de preparação."
          icon={<Briefcase size={18} />}
          action={(
            <Button type="button" size="sm" icon={<Plus size={14} />} onClick={() => { setShowForm(true); setError(''); }}>
              Nova vaga
            </Button>
          )}
        />
        <CardBody className="space-y-4">
          {showForm && (
            <JobTargetForm
              saving={saving}
              analyzing={analyzing}
              onSave={input => handleSave(input, false)}
              onSaveAndAnalyze={input => handleSave(input, true)}
              onCancel={() => setShowForm(false)}
            />
          )}

          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === value
                    ? 'bg-primary-600 text-white'
                    : 'border border-surface-200 bg-white/80 text-surface-600 hover:bg-surface-50 dark:border-primary-300/15 dark:bg-white/[0.05] dark:text-surface-300 dark:hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
              <Loader2 size={16} className="animate-spin" />
              Carregando vagas...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {targets.length === 0
                ? 'Nenhuma vaga cadastrada ainda. Clique em “Nova vaga” e cole a descrição de uma vaga americana.'
                : 'Nenhuma vaga com este status.'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map(target => (
                <div
                  key={target.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-200 bg-white/70 p-3 dark:border-primary-300/15 dark:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-surface-950 dark:text-white">{target.title}</p>
                    <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
                      {[target.company, target.location].filter(Boolean).join(' · ') || 'Sem empresa/localização'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {target.match_score !== null && (
                      <span className="rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-semibold text-primary-700 dark:text-primary-200">
                        Match: {target.match_score}/10
                      </span>
                    )}
                    <StatusBadge status={target.status} />
                    <Button type="button" size="sm" variant="secondary" onClick={() => setSelectedId(target.id)}>
                      Detalhes
                    </Button>
                    {target.status !== 'archived' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon={archivingId === target.id ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                        disabled={archivingId === target.id}
                        onClick={() => handleArchive(target)}
                      >
                        Arquivar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
