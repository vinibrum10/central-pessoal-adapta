import { useMemo, useState } from 'react';
import { CheckCircle, Layers } from 'lucide-react';
import { AJUDA_BLOCO, classificarBloco, type BlocoPergunta } from '../../services/vagas/blocoClassificacao';
import { PerguntaPendenteCard } from './PerguntaPendenteCard';
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

interface Rascunho {
  resposta: string;
  sempreUsar: boolean;
}

interface Grupo {
  chave: string;
  titulo: BlocoPergunta;
  itens: VagaRespostaBanco[];
}

function rascunhoInicial(resposta: VagaRespostaBanco): Rascunho {
  return { resposta: resposta.resposta, sempreUsar: resposta.sempreUsar };
}

/** Agrupa visualmente perguntas da mesma vaga cujo texto sugere o mesmo bloco
 * do formulario (ex. Escola/Escolaridade/Disciplina = mesma entrada de
 * curriculo) — puramente cosmetico, nunca afeta correspondencia ou reuso
 * automatico de resposta. */
function agruparPorBloco(respostas: VagaRespostaBanco[]): Grupo[] {
  const grupos: Grupo[] = [];
  const indicePorChave = new Map<string, number>();

  for (const resposta of respostas) {
    const bloco = classificarBloco(resposta.pergunta);
    if (!bloco) {
      grupos.push({ chave: `solo-${resposta.id}`, titulo: null, itens: [resposta] });
      continue;
    }
    const chave = `${resposta.vagaOrigem}::${bloco}`;
    const indiceExistente = indicePorChave.get(chave);
    if (indiceExistente === undefined) {
      indicePorChave.set(chave, grupos.length);
      grupos.push({ chave, titulo: bloco, itens: [resposta] });
    } else {
      grupos[indiceExistente].itens.push(resposta);
    }
  }
  return grupos;
}

export function RespostasBancoList({ respostas, loading, onAtualizar }: RespostasBancoListProps) {
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const mostrarToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const rascunhoDe = (resposta: VagaRespostaBanco): Rascunho => rascunhos[resposta.id] ?? rascunhoInicial(resposta);

  const atualizarRascunho = (resposta: VagaRespostaBanco, campos: Partial<Rascunho>) => {
    setRascunhos(prev => ({ ...prev, [resposta.id]: { ...rascunhoDe(resposta), ...campos } }));
  };

  const houveMudanca = (resposta: VagaRespostaBanco): boolean => {
    const rascunho = rascunhoDe(resposta);
    return rascunho.resposta !== resposta.resposta || rascunho.sempreUsar !== resposta.sempreUsar;
  };

  const salvar = async (resposta: VagaRespostaBanco) => {
    const rascunho = rascunhoDe(resposta);
    setSalvandoId(resposta.id);
    try {
      await onAtualizar(resposta.id, { resposta: rascunho.resposta, sempreUsar: rascunho.sempreUsar });
      mostrarToast('Resposta salva com sucesso');
    } finally {
      setSalvandoId(null);
    }
  };

  const grupos = useMemo(() => agruparPorBloco(respostas), [respostas]);

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

  const renderCard = (resposta: VagaRespostaBanco) => {
    const rascunho = rascunhoDe(resposta);
    return (
      <PerguntaPendenteCard
        key={resposta.id}
        resposta={resposta}
        rascunhoResposta={rascunho.resposta}
        rascunhoSempreUsar={rascunho.sempreUsar}
        mudou={houveMudanca(resposta)}
        salvando={salvandoId === resposta.id}
        onChangeResposta={valor => atualizarRascunho(resposta, { resposta: valor })}
        onChangeSempreUsar={valor => atualizarRascunho(resposta, { sempreUsar: valor })}
        onSalvar={() => void salvar(resposta)}
      />
    );
  };

  return (
    <div className="space-y-4">
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-surface-900 px-5 py-3 text-sm text-white shadow-xl animate-fade-in dark:bg-surface-700">
          <CheckCircle size={14} className="flex-shrink-0 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {grupos.map(grupo =>
        grupo.titulo ? (
          <div
            key={grupo.chave}
            className="rounded-xl border border-dashed border-primary-300/50 bg-primary-50/40 p-3 dark:border-primary-300/25 dark:bg-primary-500/[0.04]"
          >
            <div className="mb-3 px-1">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-primary-600 dark:text-primary-300" />
                <p className="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                  {`Bloco: ${grupo.titulo}`}
                </p>
              </div>
              <p className="mt-1 text-xs leading-5 text-primary-700/80 dark:text-primary-200/70">
                {AJUDA_BLOCO[grupo.titulo]}
              </p>
            </div>
            <div className="space-y-3">{grupo.itens.map(renderCard)}</div>
          </div>
        ) : (
          renderCard(grupo.itens[0])
        ),
      )}
    </div>
  );
}
