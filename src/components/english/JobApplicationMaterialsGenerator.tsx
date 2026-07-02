import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '../Button';

interface JobApplicationMaterialsGeneratorProps {
  hasMaterials: boolean;
  generating: boolean;
  onGenerate: () => void;
}

export function JobApplicationMaterialsGenerator({ hasMaterials, generating, onGenerate }: JobApplicationMaterialsGeneratorProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          icon={generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          loading={generating}
          disabled={generating}
          onClick={onGenerate}
        >
          {hasMaterials ? 'Regerar materiais com IA' : 'Gerar materiais com IA'}
        </Button>
        {generating && (
          <span className="text-xs text-surface-500 dark:text-surface-400">
            Gerando resumo, bullets, LinkedIn, mensagem e cover letter... isso pode levar alguns segundos.
          </span>
        )}
      </div>
      {hasMaterials && !generating && (
        <p className="text-xs text-surface-500 dark:text-surface-400">
          Regerar substitui a versão atual dos materiais desta vaga.
        </p>
      )}
    </div>
  );
}
