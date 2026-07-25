// Criptografia do refresh_token do YouTube — AES-256-GCM via Web Crypto
// (disponível nativamente tanto no runtime Deno das Edge Functions quanto no
// Node, o que permite testar esta lógica com Vitest sem depender do Deno).
//
// A chave (TOKEN_ENCRYPTION_KEY) NUNCA circula pelo frontend nem é
// armazenada no banco — vive só como Secret das Supabase Edge Functions.
// O banco guarda apenas `ciphertext` + `iv`, ambos inúteis sem a chave.

const AES_KEY_LENGTH_BITS = 256;
const GCM_IV_LENGTH_BYTES = 12;

export interface EncryptedToken {
  ciphertextBase64: string;
  ivBase64: string;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** `rawKeyBase64` deve ser uma chave AES-256 (32 bytes) codificada em base64. */
async function importAesKey(rawKeyBase64: string): Promise<CryptoKey> {
  const rawKey = base64Decode(rawKeyBase64);
  if (rawKey.length * 8 !== AES_KEY_LENGTH_BITS) {
    throw new Error(`TOKEN_ENCRYPTION_KEY inválida: esperado ${AES_KEY_LENGTH_BITS / 8} bytes, recebido ${rawKey.length}.`);
  }
  return crypto.subtle.importKey('raw', rawKey as unknown as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptRefreshToken(plaintext: string, rawKeyBase64: string): Promise<EncryptedToken> {
  const key = await importAesKey(rawKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    ciphertextBase64: base64Encode(new Uint8Array(ciphertext)),
    ivBase64: base64Encode(iv),
  };
}

export async function decryptRefreshToken(encrypted: EncryptedToken, rawKeyBase64: string): Promise<string> {
  const key = await importAesKey(rawKeyBase64);
  const iv = base64Decode(encrypted.ivBase64);
  const ciphertext = base64Decode(encrypted.ciphertextBase64);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, ciphertext as unknown as BufferSource);
  return new TextDecoder().decode(plaintext);
}
