import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../Card';
import type { JobApplicationMaterials as JobApplicationMaterialsRow, JobTarget } from '../../types/englishInterview';
import { generateJobApplicationMaterials } from '../../services/english/jobApplicationMaterialsApi';
import { getJobApplicationMaterials, saveJobApplicationMaterials } from '../../services/english/jobApplicationMaterialsRepository';
import { JobApplicationMaterialsGenerator } from './JobApplicationMaterialsGenerator';
import { JobApplicationMaterialsPreview } from './JobApplicationMaterialsPreview';

interface JobApplicationMaterialsProps {
  userId: string;
  jobTarget: JobTarget;
}

export function JobApplicationMaterials({ userId, jobTarget }: JobApplicationMaterialsProps) {
  const [materials, setMaterials] = useState<JobApplicationMaterialsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMaterials(await getJobApplicationMaterials(jobTarget.id));
    } catch (err) {
      console.error('[JobApplicationMaterials] Failed to load materials', err);
      setError('Não foi possível carregar os materiais. Confira se a migration da Fase 4C foi aplicada.');
    } finally {
      setLoading(false);
    }
  }, [jobTarget.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const content = await generateJobApplicationMaterials(jobTarget);
      const saved = await saveJobApplicationMaterials({ userId, jobTargetId: jobTarget.id, content });
      setMaterials(saved);
    } catch (err) {
      console.error('[JobApplicationMaterials] Failed to generate materials', err);
      setError(err instanceof Error ? err.message : 'Não foi possível gerar os materiais agora.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Materiais de candidatura"
        subtitle="Resumo, currículo, LinkedIn, mensagem e cover letter gerados para esta vaga — sempre para revisão manual."
        icon={<FileText size={18} />}
      />
      <CardBody className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
            <Loader2 size={16} className="animate-spin" />
            Carregando materiais...
          </div>
        ) : (
          <>
            <JobApplicationMaterialsGenerator
              hasMaterials={Boolean(materials)}
              generating={generating}
              onGenerate={handleGenerate}
            />
            {materials ? (
              <JobApplicationMaterialsPreview materials={materials} updatedAt={materials.updated_at} />
            ) : (
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Nenhum material gerado para esta vaga ainda. A geração usa a descrição da vaga e a análise da IA como base.
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
