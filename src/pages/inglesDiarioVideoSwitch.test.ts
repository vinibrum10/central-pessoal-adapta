import { describe, expect, it } from 'vitest';
import { shouldConfirmVideoSwitch } from './inglesDiarioVideoSwitch';

describe('shouldConfirmVideoSwitch', () => {
  it('nunca confirma na primeira seleção (nenhum vídeo atual ainda)', () => {
    expect(shouldConfirmVideoSwitch(null, 'v1', true)).toBe(false);
  });

  it('nunca confirma ao reselecionar o MESMO vídeo, mesmo com progresso', () => {
    expect(shouldConfirmVideoSwitch('v1', 'v1', true)).toBe(false);
  });

  it('confirma ao trocar para um vídeo diferente quando já existe progresso', () => {
    expect(shouldConfirmVideoSwitch('v1', 'v2', true)).toBe(true);
  });

  it('NÃO confirma ao trocar para um vídeo diferente quando não há progresso (ainda em Listening)', () => {
    expect(shouldConfirmVideoSwitch('v1', 'v2', false)).toBe(false);
  });
});
