import { describe, expect, it } from 'vitest';
import {
  PBKDF2_ITERATIONS,
  WrongPassphraseError,
  decryptIdentity,
  encryptIdentity,
} from '../src/core/crypto';
import type { PlainIdentity } from '../src/core/storage';

/** Real iterations once, to prove the constant is usable; a small count everywhere else for speed. */
const FAST = 1_000;

const IDENTITY: PlainIdentity = {
  kind: 'plain',
  nie: 'X0000000X',
  birthDate: '1990-01-01',
  numero: 'R500001',
  year: '2015',
};

describe('encryptIdentity / decryptIdentity', () => {
  it('round-trips an identity', async () => {
    const encrypted = await encryptIdentity(IDENTITY, 'frase secreta', FAST);

    expect(encrypted.kind).toBe('encrypted');
    await expect(decryptIdentity(encrypted, 'frase secreta')).resolves.toEqual(IDENTITY);
  });

  it('leaves nothing readable in the payload', async () => {
    const encrypted = await encryptIdentity(IDENTITY, 'frase secreta', FAST);

    expect(encrypted.payload).not.toContain('X0000000X');
    expect(encrypted.payload).not.toContain('1990-01-01');
    expect(encrypted.payload).not.toContain('R500001');
  });

  it('uses a fresh salt and IV every time', async () => {
    const first = await encryptIdentity(IDENTITY, 'frase secreta', FAST);
    const second = await encryptIdentity(IDENTITY, 'frase secreta', FAST);

    expect(first.payload).not.toBe(second.payload);
  });

  it('rejects a wrong passphrase with its own error', async () => {
    const encrypted = await encryptIdentity(IDENTITY, 'frase secreta', FAST);

    await expect(decryptIdentity(encrypted, 'otra frase')).rejects.toBeInstanceOf(
      WrongPassphraseError,
    );
  });

  it('rejects tampered ciphertext', async () => {
    const encrypted = await encryptIdentity(IDENTITY, 'frase secreta', FAST);
    const payload = JSON.parse(encrypted.payload) as { ciphertext: string };
    const flipped = payload.ciphertext.startsWith('A')
      ? `B${payload.ciphertext.slice(1)}`
      : `A${payload.ciphertext.slice(1)}`;

    await expect(
      decryptIdentity(
        { kind: 'encrypted', payload: JSON.stringify({ ...payload, ciphertext: flipped }) },
        'frase secreta',
      ),
    ).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('rejects a payload that is not one of ours', async () => {
    for (const payload of ['', 'no-json', '{}', '{"v":99}']) {
      await expect(
        decryptIdentity({ kind: 'encrypted', payload }, 'frase secreta'),
      ).rejects.toBeInstanceOf(WrongPassphraseError);
    }
  });

  it('honours the OWASP iteration count by default', async () => {
    const started = Date.now();
    const encrypted = await encryptIdentity(IDENTITY, 'frase secreta');
    const payload = JSON.parse(encrypted.payload) as { iterations: number };

    expect(payload.iterations).toBe(PBKDF2_ITERATIONS);
    expect(PBKDF2_ITERATIONS).toBe(600_000);
    // A 600k-iteration derivation is not instant; if this ever returns instantly, the count was ignored.
    expect(Date.now() - started).toBeGreaterThan(20);
    await expect(decryptIdentity(encrypted, 'frase secreta')).resolves.toEqual(IDENTITY);
  }, 20_000);
});
