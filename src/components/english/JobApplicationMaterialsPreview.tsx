import { useState } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
import { Button } from '../Button';
import type { JobApplicationMaterialsContent } from '../../types/englishInterview';

interface JobApplicationMaterialsPreviewProps {
  materials: JobApplicationMaterialsContent;
  updatedAt?: string | null;
}

function CopyBlock({ blockId, title, copyText, copiedBlockId, onCopy, children }: {
  blockId: string;
  title: string;
  copyText: string;
  copiedBlockId: string | null;
  onCopy: (blockId: string, text: string) => void;
  children: React.ReactNode;
}) {
  const copied = copiedBlockId === blockId;
  return (
    <div className="rounded-lg border border-surface-200 bg-white/70 p-3 dark:border-primary-300/15 dark:bg-white/[0.03]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{title}</p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          icon={copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
          onClick={() => onCopy(blockId, copyText)}
        >
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      {children}
    </div>
  );
}

function TextContent({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words text-sm leading-6 text-surface-700 dark:text-surface-200">{text}</p>;
}

function ListContent({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 break-words text-sm leading-6 text-surface-700 dark:text-surface-200">
      {items.map((item, index) => <li key={index}>• {item}</li>)}
    </ul>
  );
}

export function JobApplicationMaterialsPreview({ materials, updatedAt }: JobApplicationMaterialsPreviewProps) {
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState('');

  async function handleCopy(blockId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyError('');
      setCopiedBlockId(blockId);
      window.setTimeout(() => setCopiedBlockId(current => current === blockId ? null : current), 2000);
    } catch {
      setCopyError('Não foi possível copiar. Selecione e copie manualmente.');
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm font-semibold text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
        Revise antes de usar em candidatura real. Preencha os campos entre colchetes (ex.: [X]%, [Hiring Manager]) com seus dados reais.
      </div>

      {copyError && <p className="text-sm text-danger-600 dark:text-danger-300">{copyError}</p>}
      {updatedAt && (
        <p className="text-xs text-surface-500 dark:text-surface-400">
          Gerado em {new Date(updatedAt).toLocaleString('pt-BR')}
        </p>
      )}

      <CopyBlock blockId="summary" title="Resumo profissional" copyText={materials.professional_summary_en} copiedBlockId={copiedBlockId} onCopy={handleCopy}>
        <TextContent text={materials.professional_summary_en} />
      </CopyBlock>

      <CopyBlock blockId="bullets" title="Bullets para currículo" copyText={materials.resume_bullets_en.map(item => `• ${item}`).join('\n')} copiedBlockId={copiedBlockId} onCopy={handleCopy}>
        <ListContent items={materials.resume_bullets_en} />
      </CopyBlock>

      <CopyBlock blockId="linkedin" title="LinkedIn About" copyText={materials.linkedin_about_en} copiedBlockId={copiedBlockId} onCopy={handleCopy}>
        <TextContent text={materials.linkedin_about_en} />
      </CopyBlock>

      <CopyBlock blockId="recruiter" title="Mensagem para recrutador" copyText={materials.recruiter_message_en} copiedBlockId={copiedBlockId} onCopy={handleCopy}>
        <TextContent text={materials.recruiter_message_en} />
      </CopyBlock>

      <CopyBlock blockId="cover" title="Cover Letter" copyText={materials.cover_letter_en} copiedBlockId={copiedBlockId} onCopy={handleCopy}>
        <TextContent text={materials.cover_letter_en} />
      </CopyBlock>

      <CopyBlock blockId="terms" title="Termos-chave (ATS)" copyText={materials.key_terms_to_include.join(', ')} copiedBlockId={copiedBlockId} onCopy={handleCopy}>
        <div className="flex flex-wrap gap-1.5">
          {materials.key_terms_to_include.map(term => (
            <span key={term} className="rounded-lg bg-primary-500/10 px-2 py-1 text-xs font-medium text-primary-700 dark:text-primary-200">
              {term}
            </span>
          ))}
        </div>
      </CopyBlock>

      <CopyBlock
        blockId="notes"
        title="Observações de ajuste"
        copyText={[...materials.warnings_pt, ...materials.tailoring_notes_pt].map(item => `• ${item}`).join('\n')}
        copiedBlockId={copiedBlockId}
        onCopy={handleCopy}
      >
        <div className="space-y-3">
          {materials.warnings_pt.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-danger-600 dark:text-danger-300">Avisos</p>
              <ListContent items={materials.warnings_pt} />
            </div>
          )}
          {materials.tailoring_notes_pt.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-surface-600 dark:text-surface-300">Antes de usar, personalize</p>
              <ListContent items={materials.tailoring_notes_pt} />
            </div>
          )}
        </div>
      </CopyBlock>
    </div>
  );
}
