import { AlertCircle, CheckCircle2, Loader2, PlugZap, XCircle } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../Card';
import { Button } from '../../Button';
import type { YoutubeConnectionState } from '../../../types/dailyVideoEnglish';
import { getPrimaryActionLabel, RECONNECT_STATUSES } from './connectYoutubeStepLabels';

interface ConnectYoutubeStepProps {
  connection: YoutubeConnectionState;
  onConnect: () => void;
}

// onConnect só pode ser chamada a partir de um clique explícito neste
// componente — internamente ela faz um REDIRECT DE PÁGINA INTEIRA para o
// Google (fluxo OAuth 2.0 server-side), nunca abre um popup via JS. O
// componente não importa nada de supabase/functions/*, não recebe token e
// não guarda token em nenhum estado/prop.
export function ConnectYoutubeStep({ connection, onConnect }: ConnectYoutubeStepProps) {
  const primaryActionLabel = getPrimaryActionLabel(connection.status);

  if (connection.status === 'checking') {
    return (
      <Card>
        <CardBody className="flex items-center gap-2 py-6 text-sm text-surface-500 dark:text-surface-400">
          <Loader2 size={16} className="animate-spin" />
          Verificando a conexão com o YouTube...
        </CardBody>
      </Card>
    );
  }

  if (connection.status === 'connected') {
    return (
      <Card>
        <CardBody className="flex items-center gap-2 py-4 text-sm text-success-700 dark:text-success-300">
          <CheckCircle2 size={16} />
          YouTube conectado.
        </CardBody>
      </Card>
    );
  }

  if (RECONNECT_STATUSES.has(connection.status)) {
    return (
      <Card>
        <CardHeader title="Não foi possível conectar ao YouTube" icon={<XCircle size={18} />} />
        <CardBody className="space-y-3">
          <p className="text-sm leading-6 text-surface-600 dark:text-surface-300">
            {connection.errorMessage ?? 'A conexão com o YouTube expirou, foi revogada ou é inválida.'}
          </p>
          <Button type="button" variant="primary" icon={<PlugZap size={16} />} onClick={onConnect}>
            {primaryActionLabel}
          </Button>
        </CardBody>
      </Card>
    );
  }

  // 'not_connected' — nunca autorizado. Sempre "Conectar", nunca "Reconectar"
  // — independente de já existir playlist configurada.
  return (
    <Card>
      <CardHeader
        title="Conectar ao YouTube"
        subtitle="Autoriza a leitura da sua playlist privada 'SGP — Inglês' (somente leitura). Depois da primeira vez, a conexão é restaurada automaticamente."
        icon={<AlertCircle size={18} />}
      />
      <CardBody>
        <Button type="button" variant="primary" icon={<PlugZap size={16} />} onClick={onConnect}>
          {primaryActionLabel}
        </Button>
      </CardBody>
    </Card>
  );
}
