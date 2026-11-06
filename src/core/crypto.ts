import type { EncryptedIdentity, PlainIdentity } from './storage';

/**
 * Optional encryption of the identifying fields, with WebCrypto only: no library, no network.
 *
 * Key derivation is PBKDF2-HMAC-SHA-256 with the iteration count OWASP recommends today (600 000, see
 * `PBKDF2_ITERATIONS`), a random salt per value and AES-GCM with a random IV per value.
 *
 * A forgotten passphrase cannot be recovered: there is no escrow anywhere, by design.
 */

/** OWASP Password Storage Cheat Sheet: PBKDF2-HMAC-SHA256 → 600 000 iterations. */
export const PBKDF2_ITERATIONS = 600_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;
const ENCODING_VERSION = 1;

interface Payload {
  v: number;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('Wrong passphrase or damaged data');
    this.name = 'WrongPassphraseError';
  }
}

function subtle(): SubtleCrypto {
  const api = globalThis.crypto;
  if (api?.subtle === undefined) throw new Error('WebCrypto is not available');
  return api.subtle;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  return globalThis.crypto.getRandomValues(bytes);
}

function encodeUtf8(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(text));
}

function toBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await subtle().importKey('raw', encodeUtf8(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptIdentity(
  identity: PlainIdentity,
  passphrase: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<EncryptedIdentity> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt, iterations);
  const plaintext = encodeUtf8(JSON.stringify(identity));
  const ciphertext = await subtle().encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  const payload: Payload = {
    v: ENCODING_VERSION,
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
  return { kind: 'encrypted', payload: JSON.stringify(payload) };
}

function readPayload(encrypted: EncryptedIdentity): Payload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(encrypted.payload);
  } catch {
    throw new WrongPassphraseError();
  }
  const payload = parsed as Partial<Payload>;
  if (
    payload.v !== ENCODING_VERSION ||
    typeof payload.iterations !== 'number' ||
    typeof payload.salt !== 'string' ||
    typeof payload.iv !== 'string' ||
    typeof payload.ciphertext !== 'string'
  ) {
    throw new WrongPassphraseError();
  }
  return payload as Payload;
}

/** Throws `WrongPassphraseError` for a wrong passphrase and for tampered ciphertext alike. */
export async function decryptIdentity(
  encrypted: EncryptedIdentity,
  passphrase: string,
): Promise<PlainIdentity> {
  const payload = readPayload(encrypted);
  const key = await deriveKey(passphrase, fromBase64(payload.salt), payload.iterations);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64(payload.iv) },
      key,
      fromBase64(payload.ciphertext),
    );
  } catch {
    // AES-GCM cannot tell a wrong key from altered data, and neither do we: both mean "cannot open".
    throw new WrongPassphraseError();
  }

  const identity = JSON.parse(new TextDecoder().decode(plaintext)) as PlainIdentity;
  return identity;
}
