import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  exportStore,
  hasPlainIdentities,
  mergeStores,
  parseBackup,
} from '../src/core/backup';
import { DEFAULT_REMINDER } from '../src/core/schedule';
import type { Check, Store } from '../src/core/storage';

const PLAIN_STORE: Store = {
  version: 1,
  applications: [
    {
      id: 'app-1',
      label: 'Primera',
      identity: {
        kind: 'plain',
        nie: 'X0000000X',
        birthDate: '1990-01-01',
        numero: 'R500001',
        year: '2015',
      },
      createdAt: '2026-11-06T10:00:00.000Z',
    },
  ],
  checks: [
    {
      id: 'check-1',
      applicationId: 'app-1',
      at: '2026-11-06T10:05:00.000Z',
      outcome: 'status',
      statusKey: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
      subStatus: null,
      acknowledged: false,
    },
  ],
  settings: { reminders: { enabled: true, weekdays: [1, 2, 3], time: '09:30' } },
};

const ENCRYPTED_STORE: Store = {
  ...PLAIN_STORE,
  applications: [
    {
      ...PLAIN_STORE.applications[0]!,
      identity: {
        kind: 'encrypted',
        payload: '{"v":1,"iterations":1000,"salt":"a","iv":"b","ciphertext":"c"}',
      },
    },
  ],
};

describe('export / import', () => {
  it('round-trips a store with plain identities', () => {
    expect(parseBackup(exportStore(PLAIN_STORE))).toEqual(PLAIN_STORE);
  });

  it('round-trips a store with encrypted identities, still encrypted', () => {
    const imported = parseBackup(exportStore(ENCRYPTED_STORE));

    expect(imported).toEqual(ENCRYPTED_STORE);
    expect(imported.applications[0]?.identity.kind).toBe('encrypted');
  });

  it('wraps the store with a format marker and a date', () => {
    const parsed = JSON.parse(exportStore(PLAIN_STORE)) as { format: string; exportedAt: string };

    expect(parsed.format).toBe(BACKUP_FORMAT);
    expect(Number.isNaN(Date.parse(parsed.exportedAt))).toBe(false);
  });

  it('refuses files that are not ours', () => {
    expect(() => parseBackup('no json')).toThrow(/JSON/i);
    expect(() => parseBackup('null')).toThrow(/formato/i);
    expect(() => parseBackup(JSON.stringify({ format: 'otra-cosa', store: PLAIN_STORE }))).toThrow(
      /copia de NacioCheck/i,
    );
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, store: {} }))).toThrow(
      /schema version/i,
    );
  });

  it('knows when an export would carry identities in the clear', () => {
    expect(hasPlainIdentities(PLAIN_STORE)).toBe(true);
    expect(hasPlainIdentities(ENCRYPTED_STORE)).toBe(false);
  });
});

describe('mergeStores', () => {
  const otherCheck: Check = {
    ...PLAIN_STORE.checks[0]!,
    id: 'check-2',
    at: '2026-11-07T10:05:00.000Z',
  };

  it('adds what is missing and keeps what is there', () => {
    const merged = mergeStores(PLAIN_STORE, {
      ...PLAIN_STORE,
      checks: [...PLAIN_STORE.checks, otherCheck],
    });

    expect(merged.checks).toHaveLength(2);
    expect(merged.applications).toHaveLength(1);
    expect(merged.settings.reminders).toEqual(PLAIN_STORE.settings.reminders);
  });

  it('is idempotent', () => {
    const once = mergeStores(PLAIN_STORE, PLAIN_STORE);
    const twice = mergeStores(once, PLAIN_STORE);

    expect(once).toEqual(PLAIN_STORE);
    expect(twice).toEqual(PLAIN_STORE);
  });

  it('keeps the current reminder rather than the imported one', () => {
    const merged = mergeStores(PLAIN_STORE, {
      ...PLAIN_STORE,
      settings: { reminders: DEFAULT_REMINDER },
    });

    expect(merged.settings.reminders).toEqual(PLAIN_STORE.settings.reminders);
  });
});
