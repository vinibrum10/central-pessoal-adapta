import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Select } from '../FormFields';
import { categoriaStatus, CATEGORIA_BADGE_VARIANT } from '../../services/vagas/statusCategoria';
import type { VagaCandidatura } from '../../types/vagas';

interface CandidaturasListProps {
  candidaturas: VagaCandidatura[];
  loading: boolean;
}

const TODAS = 'Todas';

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function CandidaturasList({ candidaturas, loading }: CandidaturasListProps) {
  const [filtro, setFiltro] = useState<string>(TODAS);

  const categorias = useMemo(() => {
    const unicas = Array.from(new Set(candidaturas.map(c => categoriaStatus(c.status))));
    return [TODAS, ...unicas];
  }, [candidaturas]);

  const filtradas = useMemo(() => {
    if (filtro === TODAS) return candidaturas;
    return candidaturas.filter(c => categoriaStatus(c.status) === filtro);
  }, [candidaturas, filtro]);

  if (loading) {
    return <p className="py-6 text-center text-sm text-surface-400 dark:text-surface-500">Carregando candidaturas…</p>;
  }

  if (candidaturas.length === 0) {
    return <p className="py-6 text-center text-sm text-surface-400 dark:text-surface-500">Nenhuma candidatura registrada ainda.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select id="vagas-filtro-status" label="Filtrar por status" value={filtro} onChange={e => setFiltro(e.target.value)}>
          {categorias.map(categoria => (
            <option key={categoria} value={categoria}>{categoria}</option>
          ))}
        </Select>
      </div>

      {filtradas.length === 0 ? (
        <p className="py-6 text-center text-sm text-surface-400 dark:text-surface-500">Nenhuma candidatura com esse status.</p>
      ) : (
        <div className="space-y-3">
          {filtradas.map(candidatura => {
            const categoria = categoriaStatus(candidatura.status);
            return (
              <div
                key={candidatura.id}
                className="rounded-lg border border-surface-200 bg-white/70 p-4 dark:border-primary-300/15 dark:bg-white/[0.03]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-5 text-surface-950 dark:text-white">{candidatura.vaga}</p>
                    <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
                      {candidatura.empresa || 'empresa não informada'} · {candidatura.local || 'local não informado'} · {candidatura.fonte || 'fonte não informada'}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {candidatura.score !== null && <Badge variant="primary">{`Score ${candidatura.score}`}</Badge>}
                    <Badge variant={CATEGORIA_BADGE_VARIANT[categoria]}>{categoria}</Badge>
                  </div>
                </div>

                <p className="mt-2 line-clamp-2 text-xs text-surface-600 dark:text-surface-300">{candidatura.status}</p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-surface-400 dark:text-surface-500">
                    Preparo: {formatarData(candidatura.dataPrep)}
                    {candidatura.dataEnvio && ` · Envio: ${formatarData(candidatura.dataEnvio)}`}
                  </p>
                  {candidatura.link && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<ExternalLink size={14} />}
                      onClick={() => window.open(candidatura.link, '_blank', 'noopener,noreferrer')}
                    >
                      Abrir vaga
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
