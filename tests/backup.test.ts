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
  settings: {
    reminders: { enabled: true, weekdays: [1, 2, 3], time: '09:30' },
    language: 'auto',
  },
};

/** A structurally valid, deliberately fast envelope; nobody decrypts this fixture. */
const FAST_ENVELOPE = JSON.stringify({
  v: 1,
  iterations: 1000,
  salt: 'MDEyMzQ1Njc4OWFiY2RlZg==',
  iv: 'MDEyMzQ1Njc4OWFi',
  ciphertext: 'MDEyMzQ1Njc4OWFiY2RlZg==',
});

const ENCRYPTED_STORE: Store = {
  ...PLAIN_STORE,
  applications: [
    {
      ...PLAIN_STORE.applications[0]!,
      identity: {
        kind: 'encrypted',
        payload: FAST_ENVELOPE,
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

  it('round-trips an optional filing date', () => {
    const withFilingDate: Store = {
      ...PLAIN_STORE,
      applications: [{ ...PLAIN_STORE.applications[0]!, filingDate: '2024-02-29' }],
    };

    expect(parseBackup(exportStore(withFilingDate))).toEqual(withFilingDate);
  });

  it('keeps the current filing date when imported applications collide by id', () => {
    const current: Store = {
      ...PLAIN_STORE,
      applications: [{ ...PLAIN_STORE.applications[0]!, filingDate: '2024-02-29' }],
    };
    const incoming: Store = {
      ...PLAIN_STORE,
      applications: [{ ...PLAIN_STORE.applications[0]!, filingDate: '2025-03-01' }],
    };
    expect(mergeStores(current, incoming).applications[0]?.filingDate).toBe('2024-02-29');
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
      settings: { reminders: DEFAULT_REMINDER, language: 'en' },
    });

    expect(merged.settings.reminders).toEqual(PLAIN_STORE.settings.reminders);
    expect(merged.settings.language).toBe(PLAIN_STORE.settings.language);
  });
});

describe('import validation', () => {
  it('refuses a backup whose application has no usable identity', () => {
    const store = {
      ...PLAIN_STORE,
      applications: [{ ...PLAIN_STORE.applications[0], identity: { kind: 'plain' } }],
    };

    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, store }))).toThrow(
      /identity/i,
    );
  });

  it('refuses a backup with a check for an application it does not carry', () => {
    const store = {
      ...PLAIN_STORE,
      checks: [{ ...PLAIN_STORE.checks[0], applicationId: 'no-existe' }],
    };

    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, store }))).toThrow(
      /application/i,
    );
  });

  it('refuses a backup with duplicate application ids', () => {
    const [application] = PLAIN_STORE.applications;
    if (application === undefined) throw new Error('The fixture has no application');
    const store = {
      ...PLAIN_STORE,
      applications: [application, { ...application, label: 'Otra' }],
    };

    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, store }))).toThrow(
      /duplicate/i,
    );
  });

  it('still defaults legacy settings when the backup has none', () => {
    const store = { version: 1, applications: [], checks: [] };

    expect(parseBackup(JSON.stringify({ format: BACKUP_FORMAT, store })).settings).toEqual({
      reminders: DEFAULT_REMINDER,
      language: 'auto',
    });
  });
});

describe('encrypted envelope import validation', () => {
  function storeWith(payload: string): Store {
    const [application] = ENCRYPTED_STORE.applications;
    if (application === undefined) throw new Error('The encrypted fixture has no application');
    return {
      ...ENCRYPTED_STORE,
      applications: [{ ...application, identity: { kind: 'encrypted', payload } }],
    };
  }

  function envelope(patch: Record<string, unknown>): string {
    const parsed = JSON.parse(FAST_ENVELOPE) as Record<string, unknown>;
    return JSON.stringify({ ...parsed, ...patch });
  }

  it('refuses a malformed envelope before it can reach storage', () => {
    for (const payload of ['locked', '{}', envelope({ salt: 'c2hvcnQ=' }), envelope({ v: 2 })]) {
      expect(() =>
        parseBackup(JSON.stringify({ format: BACKUP_FORMAT, store: storeWith(payload) })),
      ).toThrow(/encrypted identity payload/i);
    }
  });

  it('refuses oversized PBKDF2 parameters before it can reach storage', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          format: BACKUP_FORMAT,
          store: storeWith(envelope({ iterations: 2_000_001 })),
        }),
      ),
    ).toThrow(/encrypted identity payload/i);
  });

  it('still accepts the structurally valid fast envelope used by the fixture', () => {
    const parsed = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, store: storeWith(FAST_ENVELOPE) }),
    );

    expect(parsed.applications[0]?.identity).toEqual({
      kind: 'encrypted',
      payload: FAST_ENVELOPE,
    });
  });
});
