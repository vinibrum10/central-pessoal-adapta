import { Badge } from '../Badge';
import { Button } from '../Button';
import { Checkbox, Textarea } from '../FormFields';
import type { VagaRespostaBanco } from '../../types/vagas';

interface PerguntaPendenteCardProps {
  resposta: VagaRespostaBanco;
  rascunhoResposta: string;
  rascunhoSempreUsar: boolean;
  mudou: boolean;
  salvando: boolean;
  onChangeResposta: (valor: string) => void;
  onChangeSempreUsar: (valor: boolean) => void;
  onSalvar: () => void;
}

export function PerguntaPendenteCard({
  resposta,
  rascunhoResposta,
  rascunhoSempreUsar,
  mudou,
  salvando,
  onChangeResposta,
  onChangeSempreUsar,
  onSalvar,
}: PerguntaPendenteCardProps) {
  const origem = [resposta.empresaOrigem, resposta.vagaOrigem].filter(Boolean).join(' — ');

  return (
    <div className="rounded-lg border border-surface-200 bg-white/70 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-surface-950 dark:text-white">{resposta.pergunta}</p>
          <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
            {resposta.tipo || 'tipo desconhecido'}
            {resposta.opcoes && ` · opções: ${resposta.opcoes}`}
          </p>
          {origem && <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">Origem: {origem}</p>}
          {resposta.possivelDuplicataDe && (
            <Badge variant="warning" className="mt-1.5">
              {`Possível duplicata de: ${resposta.possivelDuplicataDe}`}
            </Badge>
          )}
        </div>
        <Checkbox
          id={`vagas-sempre-usar-${resposta.id}`}
          label="Sempre usar"
          checked={rascunhoSempreUsar}
          disabled={salvando}
          onChange={e => onChangeSempreUsar(e.target.checked)}
        />
      </div>

      <div className="mt-3">
        <Textarea
          id={`vagas-resposta-${resposta.id}`}
          label="Resposta"
          value={rascunhoResposta}
          disabled={salvando}
          onChange={e => onChangeResposta(e.target.value)}
        />
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="primary" size="sm" loading={salvando} disabled={!mudou || salvando} onClick={onSalvar}>
          Salvar
        </Button>
      </div>
    </div>
  );
}
