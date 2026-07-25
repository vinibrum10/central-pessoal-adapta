import { describe, expect, it } from 'vitest';
import { decryptRefreshToken, encryptRefreshToken } from '../../../supabase/functions/_shared/tokenCrypto';

function makeTestKeyBase64(): string {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of raw) binary += String.fromCharCode(byte);
  return btoa(binary);
}

describe('tokenCrypto', () => {
  it('decifra exatamente o mesmo texto que foi cifrado', async () => {
    const key = makeTestKeyBase64();
    const plaintext = '1//09_um_refresh_token_de_mentira_para_teste';

    const encrypted = await encryptRefreshToken(plaintext, key);
    const decrypted = await decryptRefreshToken(encrypted, key);

    expect(decrypted).toBe(plaintext);
  });

  it('gera um IV diferente a cada chamada (nunca reutiliza IV)', async () => {
    const key = makeTestKeyBase64();
    const a = await encryptRefreshToken('mesmo-texto', key);
    const b = await encryptRefreshToken('mesmo-texto', key);

    expect(a.ivBase64).not.toBe(b.ivBase64);
    expect(a.ciphertextBase64).not.toBe(b.ciphertextBase64);
  });

  it('falha ao decifrar com a chave errada (nunca retorna dado incorreto silenciosamente)', async () => {
    const keyA = makeTestKeyBase64();
    const keyB = makeTestKeyBase64();
    const encrypted = await encryptRefreshToken('segredo', keyA);

    await expect(decryptRefreshToken(encrypted, keyB)).rejects.toThrow();
  });

  it('rejeita uma chave com tamanho diferente de 256 bits', async () => {
    const shortKey = btoa('chave-curta-demais');
    await expect(encryptRefreshToken('x', shortKey)).rejects.toThrow(/256|32/);
  });
});
