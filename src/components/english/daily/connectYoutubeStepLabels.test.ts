import { describe, expect, it } from 'vitest';
import { getPrimaryActionLabel } from './connectYoutubeStepLabels';
import type { YoutubeConnectionStatus } from '../../../types/dailyVideoEnglish';

describe('getPrimaryActionLabel', () => {
  it('usa "Conectar ao YouTube" para \'not_connected\' — nunca "Reconectar", mesmo que exista playlist salva', () => {
    // A função nem recebe informação de playlist salva: o rótulo depende
    // somente do status da conexão, nunca de youtube_playlist_settings.
    expect(getPrimaryActionLabel('not_connected')).toBe('Conectar ao YouTube');
  });

  it.each<YoutubeConnectionStatus>(['reconnect_required', 'authorization_denied', 'error'])(
    'usa "Reconectar ao YouTube" para o status "%s" (reconexão de verdade)',
    status => {
      expect(getPrimaryActionLabel(status)).toBe('Reconectar ao YouTube');
    },
  );

  it('nunca usa "Reconectar" para status que não indicam falha na conexão', () => {
    const nonReconnectStatuses: YoutubeConnectionStatus[] = ['not_connected', 'checking', 'connected'];
    for (const status of nonReconnectStatuses) {
      expect(getPrimaryActionLabel(status)).not.toBe('Reconectar ao YouTube');
    }
  });
});
