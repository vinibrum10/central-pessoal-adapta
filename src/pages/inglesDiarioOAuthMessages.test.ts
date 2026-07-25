import { describe, expect, it } from 'vitest';
import { describeOAuthRedirectFailure } from './inglesDiarioOAuthMessages';

describe('describeOAuthRedirectFailure', () => {
  it('retorna null quando não há retorno (?youtube_auth ausente)', () => {
    expect(describeOAuthRedirectFailure(null)).toBeNull();
  });

  it('retorna null para "success" — não é uma falha, nada a exibir', () => {
    expect(describeOAuthRedirectFailure('success')).toBeNull();
  });

  it.each(['denied', 'invalid_state', 'expired', 'already_used', 'invalid_request', 'server_error', 'no_refresh_token'])(
    'produz uma mensagem amigável para "%s"',
    reason => {
      const message = describeOAuthRedirectFailure(reason);
      expect(message).not.toBeNull();
      expect(typeof message).toBe('string');
    },
  );

  it('nunca inclui o código bruto do motivo na mensagem exibida', () => {
    for (const reason of ['denied', 'invalid_state', 'expired', 'already_used', 'invalid_request', 'server_error', 'no_refresh_token']) {
      const message = describeOAuthRedirectFailure(reason) ?? '';
      expect(message).not.toContain(reason);
    }
  });

  it('nunca vaza tokens, codes, states ou segredos — mensagens são texto fixo, não interpolam nada do retorno', () => {
    // Prova estrutural: nenhuma mensagem do dicionário contém "{" (não há
    // interpolação de valores externos nas strings).
    for (const reason of ['denied', 'invalid_state', 'expired', 'already_used', 'invalid_request', 'server_error', 'no_refresh_token']) {
      const message = describeOAuthRedirectFailure(reason) ?? '';
      expect(message).not.toMatch(/[{}]/);
    }
  });

  it('valor desconhecido/não previsto cai numa mensagem genérica, nunca undefined nem o valor cru', () => {
    const message = describeOAuthRedirectFailure('algum_motivo_novo_nao_mapeado');
    expect(message).toBe('Não foi possível concluir a conexão com o YouTube. Tente novamente.');
  });
});
