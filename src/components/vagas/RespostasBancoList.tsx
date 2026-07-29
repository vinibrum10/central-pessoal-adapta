import { useState } from 'react';
import { Badge } from '../Badge';
import { Checkbox, Textarea } from '../FormFields';
import type { VagaRespostaBanco } from '../../types/vagas';

interface AtualizarRespostaInput {
  resposta?: string;
  sempreUsar?: boolean;
}

interface RespostasBancoListProps {
  respostas: VagaRespostaBanco[];
  loading: boolean;
  onAtualizar: (id: string, campos: AtualizarRespostaInput) => Promise<void>;
}

export function RespostasBancoList({ respostas, loading, onAtualizar }: RespostasBancoListProps) {
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});

  const valorResposta = (resposta: VagaRespostaBanco) => rascunhos[resposta.id] ?? resposta.resposta;

  const salvarResposta = async (resposta: VagaRespostaBanco) => {
    const novoValor = valorResposta(resposta);
    if (novoValor === resposta.resposta) return;
    setSalvandoId(resposta.id);
    try {
      await onAtualizar(resposta.id, { resposta: novoValor });
    } finally {
      setSalvandoId(null);
    }
  };

  const alternarSempreUsar = async (resposta: VagaRespostaBanco) => {
    setSalvandoId(resposta.id);
    try {
      await onAtualizar(resposta.id, { sempreUsar: !resposta.sempreUsar });
    } finally {
      setSalvandoId(null);
    }
  };

  if (loading) {
    return <p className="py-6 text-center text-sm text-surface-400 dark:text-surface-500">Carregando banco de respostas…</p>;
  }

  if (respostas.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-surface-400 dark:text-surface-500">
        Nenhuma pergunta pendente — o agente ainda não encontrou campos customizados nos formulários.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {respostas.map(resposta => (
        <div
          key={resposta.id}
          className="rounded-lg border border-surface-200 bg-white/70 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5 text-surface-950 dark:text-white">{resposta.pergunta}</p>
              <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
                {resposta.tipo || 'tipo desconhecido'}
                {resposta.opcoes && ` · opções: ${resposta.opcoes}`}
                {resposta.ultimaVaga && ` · última vaga: ${resposta.ultimaVaga}`}
              </p>
              {resposta.possivelDuplicataDe && (
                <Badge variant="warning" className="mt-1.5">
                  {`Possível duplicata de: ${resposta.possivelDuplicataDe}`}
                </Badge>
              )}
            </div>
            <Checkbox
              id={`vagas-sempre-usar-${resposta.id}`}
              label="Sempre usar"
              checked={resposta.sempreUsar}
              disabled={salvandoId === resposta.id}
              onChange={() => void alternarSempreUsar(resposta)}
            />
          </div>

          <div className="mt-3">
            <Textarea
              id={`vagas-resposta-${resposta.id}`}
              label="Resposta"
              value={valorResposta(resposta)}
              disabled={salvandoId === resposta.id}
              onChange={e => setRascunhos(prev => ({ ...prev, [resposta.id]: e.target.value }))}
              onBlur={() => void salvarResposta(resposta)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
