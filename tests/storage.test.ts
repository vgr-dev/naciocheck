import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { DEFAULT_LANGUAGE, type LanguageSetting } from '../src/core/i18n';
import { parseCheckPage } from '../src/core/parser';
import {
  acknowledgeCheck,
  addApplication,
  appendCheck,
  type Application,
  deleteApplication,
  emptyStore,
  getApplication,
  getSettings,
  latestCheck,
  listApplications,
  listChecks,
  migrateStore,
  mutateStore,
  readStore,
  replaceStore,
  SCHEMA_VERSION,
  setLanguage,
  setReminder,
  type PlainIdentity,
  updateApplication,
  updateIdentity,
} from '../src/core/storage';
import { DEFAULT_REMINDER } from '../src/core/schedule';

/** A structurally valid, deliberately fast envelope; authentication is not part of the store check. */
const FAST_ENVELOPE = JSON.stringify({
  v: 1,
  iterations: 1000,
  salt: 'MDEyMzQ1Njc4OWFiY2RlZg==',
  iv: 'MDEyMzQ1Njc4OWFi',
  ciphertext: 'MDEyMzQ1Njc4OWFiY2RlZg==',
});
import { hasPlainIdentities } from '../src/core/backup';

/** Synthetic values only: nothing here is anybody's data. */
const IDENTITY: PlainIdentity = {
  kind: 'plain',
  nie: 'X0000000X',
  birthDate: '1990-01-01',
  numero: 'R500001',
  year: '2015',
};

async function addTestApplication(label: string): Promise<string> {
  const application = await addApplication({ label, identity: IDENTITY });
  return application.id;
}

beforeEach(async () => {
  await browser.storage.local.clear();
});

describe('readStore', () => {
  it('returns an empty store before anything is written', async () => {
    await expect(readStore()).resolves.toEqual(emptyStore());
  });

  it('reports the current schema version after a write', async () => {
    await addTestApplication('Primera');

    await expect(readStore()).resolves.toMatchObject({ version: SCHEMA_VERSION });
  });
});

describe('applications', () => {
  it('stores an application with an id and a creation date', async () => {
    const application = await addApplication({ label: 'Primera', identity: IDENTITY });

    expect(application.id).toEqual(expect.any(String));
    expect(application.createdAt).toEqual(expect.any(String));
    await expect(listApplications()).resolves.toEqual([application]);
  });

  it('finds an application by id and returns null for an unknown one', async () => {
    const id = await addTestApplication('Primera');

    await expect(getApplication(id)).resolves.toMatchObject({ id, label: 'Primera' });
    await expect(getApplication('no-existe')).resolves.toBeNull();
  });

  it('keeps applications independent when one is deleted', async () => {
    const first = await addTestApplication('Primera');
    const second = await addTestApplication('Segunda');

    await deleteApplication(first);

    await expect(listApplications()).resolves.toMatchObject([{ id: second }]);
  });
});

describe('updateApplication', () => {
  /** One check on an application, so every case can prove the history survived. */
  async function addCheckTo(applicationId: string): Promise<void> {
    await appendCheck({
      applicationId,
      outcome: 'status',
      statusKey: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
      subStatus: null,
    });
  }

  it('changes only the label and records the edit, identity and history untouched', async () => {
    const application = await addApplication({ label: 'Antes', identity: IDENTITY });
    await addCheckTo(application.id);

    await updateApplication(application.id, { label: 'Después' });

    const stored = await getApplication(application.id);
    expect(stored).toMatchObject({ label: 'Después', identity: IDENTITY });
    expect(stored?.editedAt).toEqual(expect.any(String));
    expect(stored?.createdAt).toBe(application.createdAt);
    await expect(listChecks(application.id)).resolves.toHaveLength(1);
  });

  it('changes only the identity and keeps the label and the history', async () => {
    const application = await addApplication({ label: 'Primera', identity: IDENTITY });
    await addCheckTo(application.id);
    const edited: PlainIdentity = { ...IDENTITY, nie: 'Y0000001Y' };

    await updateApplication(application.id, { identity: edited });

    const stored = await getApplication(application.id);
    expect(stored).toMatchObject({ label: 'Primera', identity: edited });
    expect(stored?.editedAt).toEqual(expect.any(String));
    await expect(listChecks(application.id)).resolves.toHaveLength(1);
  });

  it('changes both at once', async () => {
    const application = await addApplication({ label: 'Primera', identity: IDENTITY });
    const edited: PlainIdentity = { ...IDENTITY, year: '2016' };

    await updateApplication(application.id, { label: 'Segunda', identity: edited });

    await expect(getApplication(application.id)).resolves.toMatchObject({
      label: 'Segunda',
      identity: edited,
    });
  });

  it('does nothing at all for an unknown id', async () => {
    const application = await addApplication({ label: 'Primera', identity: IDENTITY });

    await updateApplication('no-existe', { label: 'Fantasma' });

    const applications = await listApplications();
    expect(applications).toEqual([application]);
    expect(applications[0]?.editedAt).toBeUndefined();
  });

  it('keeps the edit date across further edits and leaves other applications alone', async () => {
    const first = await addApplication({ label: 'Primera', identity: IDENTITY });
    const second = await addApplication({ label: 'Segunda', identity: IDENTITY });

    await updateApplication(first.id, { label: 'Primera bis' });
    const editedOnce = await getApplication(first.id);
    await updateApplication(second.id, { label: 'Segunda bis' });

    const after = await getApplication(first.id);
    expect(after?.editedAt).toEqual(expect.any(String));
    expect(new Date(after?.editedAt ?? 0).getTime()).toBeGreaterThanOrEqual(
      new Date(editedOnce?.editedAt ?? 0).getTime(),
    );
    await expect(getApplication(second.id)).resolves.not.toMatchObject({
      label: 'Primera bis',
    });
  });
});

describe('checks', () => {
  it('appends a check with an id, a timestamp and no acknowledgement', async () => {
    const applicationId = await addTestApplication('Primera');

    const check = await appendCheck({
      applicationId,
      outcome: 'status',
      statusKey: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
      subStatus: 'Su expediente ha sido registrado correctamente.',
    });

    expect(check).toMatchObject({
      applicationId,
      outcome: 'status',
      statusKey: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
      subStatus: 'Su expediente ha sido registrado correctamente.',
      acknowledged: false,
    });
    expect(check.id).toEqual(expect.any(String));
    expect(check.at).toEqual(expect.any(String));
  });

  it('round-trips the sub-status, including its absence', async () => {
    const applicationId = await addTestApplication('Primera');
    await appendCheck({
      applicationId,
      outcome: 'status',
      statusKey: 'abierto-en-tramitacion',
      raw: 'Abierto - En tramitación.',
      subStatus: 'Pendiente recepción de informes preceptivos oficiales',
    });
    await appendCheck({
      applicationId,
      outcome: 'status',
      statusKey: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
      subStatus: null,
    });

    await expect(listChecks(applicationId)).resolves.toMatchObject([
      { subStatus: 'Pendiente recepción de informes preceptivos oficiales' },
      { subStatus: null },
    ]);
  });

  it('stores a check straight from the parser output', async () => {
    const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'result-format.htm');
    const html = readFileSync(fixture, 'utf8')
      .replaceAll('{status}', 'Abierto - En tramitación.')
      .replaceAll('{subStatus}', 'Pendiente recepción de informes preceptivos oficiales');
    const parsed = parseCheckPage(new DOMParser().parseFromString(html, 'text/html'));
    if (parsed.kind !== 'status') throw new Error(`expected a status, got ${parsed.kind}`);
    const applicationId = await addTestApplication('Primera');

    const stored = await appendCheck({
      applicationId,
      outcome: 'status',
      statusKey: parsed.key,
      raw: parsed.raw,
      subStatus: parsed.subStatus,
    });

    await expect(latestCheck(applicationId)).resolves.toMatchObject({
      id: stored.id,
      statusKey: 'abierto-en-tramitacion',
      raw: 'Abierto - En tramitación.',
      subStatus: 'Pendiente recepción de informes preceptivos oficiales',
    });
  });

  it('refuses to record a check for an application that does not exist', async () => {
    await expect(
      appendCheck({
        applicationId: 'no-existe',
        outcome: 'status',
        statusKey: 'unknown',
        raw: 'Algo',
        subStatus: null,
      }),
    ).rejects.toThrow(/unknown application/i);
  });

  it('keeps the history append-only and in order', async () => {
    const applicationId = await addTestApplication('Primera');

    for (const raw of [
      'Abierto - Registrado.',
      'Abierto - En tramitación.',
      'Abierto - En calificación.',
    ]) {
      await appendCheck({
        applicationId,
        outcome: 'status',
        statusKey: 'unknown',
        raw,
        subStatus: null,
      });
    }

    const checks = await listChecks(applicationId);
    expect(checks.map((check) => check.raw)).toEqual([
      'Abierto - Registrado.',
      'Abierto - En tramitación.',
      'Abierto - En calificación.',
    ]);
  });

  it('reports the latest check of an application', async () => {
    const applicationId = await addTestApplication('Primera');
    await appendCheck({
      applicationId,
      outcome: 'status',
      statusKey: 'unknown',
      raw: 'Primero',
      subStatus: null,
    });
    const second = await appendCheck({
      applicationId,
      outcome: 'error',
      statusKey: 'unknown',
      raw: 'Error',
      subStatus: null,
    });

    await expect(latestCheck(applicationId)).resolves.toMatchObject({ id: second.id });
  });

  it('has no latest check before anything is recorded', async () => {
    const applicationId = await addTestApplication('Primera');

    await expect(latestCheck(applicationId)).resolves.toBeNull();
  });

  it('deletes the checks of a deleted application and leaves the others alone', async () => {
    const first = await addTestApplication('Primera');
    const second = await addTestApplication('Segunda');
    await appendCheck({
      applicationId: first,
      outcome: 'status',
      statusKey: 'unknown',
      raw: 'A',
      subStatus: null,
    });
    await appendCheck({
      applicationId: second,
      outcome: 'status',
      statusKey: 'unknown',
      raw: 'B',
      subStatus: null,
    });

    await deleteApplication(first);

    await expect(listChecks(first)).resolves.toEqual([]);
    await expect(listChecks(second)).resolves.toMatchObject([{ raw: 'B' }]);
  });

  it('only changes the acknowledgement flag, never the check itself', async () => {
    const applicationId = await addTestApplication('Primera');
    const check = await appendCheck({
      applicationId,
      outcome: 'status',
      statusKey: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
      subStatus: null,
    });

    await acknowledgeCheck(check.id);

    await expect(listChecks(applicationId)).resolves.toEqual([{ ...check, acknowledged: true }]);
  });
});

describe('migrateStore', () => {
  it('accepts the current schema unchanged', () => {
    const stored = {
      version: SCHEMA_VERSION,
      applications: [],
      checks: [],
      settings: { reminders: DEFAULT_REMINDER, language: DEFAULT_LANGUAGE },
    };

    expect(migrateStore(stored)).toEqual(stored);
  });

  it('refuses data written by a newer build', () => {
    expect(() =>
      migrateStore({ version: SCHEMA_VERSION + 1, applications: [], checks: [], settings: {} }),
    ).toThrow(/newer than this build/i);
  });

  it('refuses data that is not a store at all', () => {
    expect(() => migrateStore(null)).toThrow(/not an object/i);
    expect(() => migrateStore('texto')).toThrow(/not an object/i);
    expect(() => migrateStore({})).toThrow(/no schema version/i);
    expect(() => migrateStore({ version: 1 })).toThrow(/missing applications or checks/i);
  });

  it('defaults the settings when an old snapshot has none', () => {
    expect(migrateStore({ version: 1, applications: [], checks: [] }).settings).toEqual({
      reminders: DEFAULT_REMINDER,
      language: DEFAULT_LANGUAGE,
    });
  });

  it('falls back to auto for an unknown language instead of failing the whole store', () => {
    const migrated = migrateStore({
      version: 1,
      applications: [],
      checks: [],
      settings: { reminders: DEFAULT_REMINDER, language: 'klingon' },
    });

    expect(migrated.settings.language).toBe(DEFAULT_LANGUAGE);
  });
});

describe('language setting', () => {
  it('starts on auto', async () => {
    const settings = await getSettings();

    expect(settings.language).toBe(DEFAULT_LANGUAGE);
  });

  it('stores an override without touching the reminder', async () => {
    const reminder = { enabled: true, weekdays: [1], time: '08:00' };
    await setReminder(reminder);

    await setLanguage('en');

    await expect(getSettings()).resolves.toEqual({ reminders: reminder, language: 'en' });
  });

  it('refuses a language it does not ship', async () => {
    await expect(setLanguage('klingon' as LanguageSetting)).rejects.toThrow(/invalid language/i);
  });
});

describe('reminder settings', () => {
  it('starts disabled, on workdays at 10:00', async () => {
    await expect(getSettings()).resolves.toEqual({
      reminders: DEFAULT_REMINDER,
      language: DEFAULT_LANGUAGE,
    });
    expect(DEFAULT_REMINDER.enabled).toBe(false);
  });

  it('stores a new reminder', async () => {
    const reminder = { enabled: true, weekdays: [2, 4], time: '17:30' };

    await setReminder(reminder);

    await expect(getSettings()).resolves.toEqual({
      reminders: reminder,
      language: DEFAULT_LANGUAGE,
    });
  });

  it('refuses an impossible reminder', async () => {
    await expect(setReminder({ enabled: true, weekdays: [], time: '10:00' })).rejects.toThrow(
      /invalid reminder/i,
    );
  });
});

describe('migrateStore record validation', () => {
  const application = {
    id: 'app-1',
    label: 'Primera',
    identity: IDENTITY,
    createdAt: '2026-11-06T10:00:00.000Z',
  };
  const check = {
    id: 'check-1',
    applicationId: 'app-1',
    at: '2026-11-06T10:05:00.000Z',
    outcome: 'status',
    statusKey: 'abierto-registrado',
    raw: 'Abierto - Registrado.',
    subStatus: null,
    acknowledged: false,
  };

  function validStore(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      version: 1,
      applications: [application],
      checks: [check],
      settings: { reminders: DEFAULT_REMINDER, language: DEFAULT_LANGUAGE },
      ...overrides,
    };
  }

  it('rejects a plain identity with missing fields', () => {
    const store = validStore({
      applications: [{ ...application, identity: { kind: 'plain' } }],
      checks: [],
    });

    expect(() => migrateStore(store)).toThrow(/identity/i);
  });

  it('rejects a plain identity the form would not accept', () => {
    const store = validStore({
      applications: [{ ...application, identity: { ...IDENTITY, nie: 'nada' } }],
      checks: [],
    });

    expect(() => migrateStore(store)).toThrow(/identity/i);
  });

  it('rejects an encrypted identity with no payload', () => {
    const store = validStore({
      applications: [{ ...application, identity: { kind: 'encrypted', payload: '' } }],
      checks: [],
    });

    expect(() => migrateStore(store)).toThrow(/identity/i);
  });

  it('rejects duplicate application ids', () => {
    const store = validStore({
      applications: [application, { ...application, label: 'Otra' }],
      checks: [],
    });

    expect(() => migrateStore(store)).toThrow(/duplicate/i);
  });

  it('rejects a check whose application does not exist', () => {
    const store = validStore({ checks: [{ ...check, applicationId: 'no-existe' }] });

    expect(() => migrateStore(store)).toThrow(/application/i);
  });

  it('rejects duplicate check ids', () => {
    const store = validStore({ checks: [check, { ...check }] });

    expect(() => migrateStore(store)).toThrow(/duplicate/i);
  });

  it('rejects malformed timestamps, outcomes and field types', () => {
    expect(() => migrateStore(validStore({ checks: [{ ...check, at: 'no-es-fecha' }] }))).toThrow(
      /timestamp/i,
    );
    expect(() => migrateStore(validStore({ checks: [{ ...check, outcome: 'otro' }] }))).toThrow(
      /outcome/i,
    );
    expect(() => migrateStore(validStore({ checks: [{ ...check, statusKey: '' }] }))).toThrow(
      /status/i,
    );
    expect(() =>
      migrateStore(
        validStore({ applications: [{ ...application, editedAt: 'ayer' }], checks: [] }),
      ),
    ).toThrow(/timestamp/i);
    expect(() =>
      migrateStore(validStore({ applications: [{ ...application, label: '' }], checks: [] })),
    ).toThrow(/label/i);
  });

  it('rejects a schema version that is not a supported integer', () => {
    expect(() => migrateStore(validStore({ version: 1.5 }))).toThrow(/schema version/i);
    expect(() => migrateStore(validStore({ version: 0 }))).toThrow(/schema version/i);
  });

  it('keeps editedAt and defaults legacy settings instead of rejecting them', () => {
    const migrated = migrateStore(
      validStore({
        applications: [{ ...application, editedAt: '2026-11-07T10:00:00.000Z' }],
        checks: [],
        settings: { language: 'en' },
      }),
    );

    expect(migrated.applications[0]?.editedAt).toBe('2026-11-07T10:00:00.000Z');
    expect(migrated.settings).toEqual({ reminders: DEFAULT_REMINDER, language: 'en' });
  });
});

describe('atomic store mutation', () => {
  /**
   * Delays the first two reads so that, without a cross-context lock, both mutations read the same snapshot
   * and the second write erases the first.
   */
  async function withDelayedReads(run: () => Promise<void>): Promise<void> {
    const originalGet = Reflect.get(browser.storage.local, 'get') as (
      key: string,
    ) => Promise<Record<string, unknown>>;
    let reads = 0;
    const delayed = async (key: string): Promise<Record<string, unknown>> => {
      // Read the snapshot first, then hold it: that is the interleaving a missing lock allows.
      const snapshot = await originalGet(key);
      reads += 1;
      if (reads <= 2) await new Promise((resolve) => setTimeout(resolve, 25));
      return snapshot;
    };
    expect(Reflect.set(browser.storage.local, 'get', delayed)).toBe(true);
    try {
      await run();
    } finally {
      Reflect.set(browser.storage.local, 'get', originalGet);
    }
  }

  it('keeps both checks when two appends overlap', async () => {
    const applicationId = await addTestApplication('Concurrente');

    await withDelayedReads(async () => {
      await Promise.all([
        appendCheck({
          applicationId,
          outcome: 'status',
          statusKey: 'unknown',
          raw: 'Primero',
          subStatus: null,
        }),
        appendCheck({
          applicationId,
          outcome: 'status',
          statusKey: 'unknown',
          raw: 'Segundo',
          subStatus: null,
        }),
      ]);
    });

    const checks = await listChecks(applicationId);
    expect(checks.map((entry) => entry.raw).sort()).toEqual(['Primero', 'Segundo']);
  });

  it('keeps a check and a settings change made at the same time', async () => {
    const applicationId = await addTestApplication('Concurrente');

    await withDelayedReads(async () => {
      await Promise.all([
        appendCheck({
          applicationId,
          outcome: 'status',
          statusKey: 'unknown',
          raw: 'Primero',
          subStatus: null,
        }),
        setLanguage('en'),
      ]);
    });

    await expect(listChecks(applicationId)).resolves.toHaveLength(1);
    await expect(getSettings()).resolves.toMatchObject({ language: 'en' });
  });
});

describe('mutateStore transaction helper', () => {
  it('applies two concurrent read-modify-write callbacks without losing either', async () => {
    const application = (id: string): Application => ({
      id,
      label: id,
      identity: IDENTITY,
      createdAt: '2026-11-06T10:00:00.000Z',
    });

    await Promise.all([
      mutateStore((store) => ({
        ...store,
        applications: [...store.applications, application('app-a')],
      })),
      mutateStore((store) => ({
        ...store,
        applications: [...store.applications, application('app-b')],
      })),
    ]);

    const applications = await listApplications();
    expect(applications.map((entry) => entry.id).sort()).toEqual(['app-a', 'app-b']);
  });

  it('validates the transaction result before writing it', async () => {
    await expect(
      mutateStore((store) => ({
        ...store,
        applications: [
          {
            id: 'app-mal',
            label: 'Mala',
            identity: { kind: 'plain' } as unknown as Application['identity'],
            createdAt: '2026-11-06T10:00:00.000Z',
          },
        ],
      })),
    ).rejects.toThrow(/identity/i);
    await expect(listApplications()).resolves.toEqual([]);
  });
});

describe('encryption-at-rest write guard', () => {
  const encrypted = {
    kind: 'encrypted' as const,
    payload: FAST_ENVELOPE,
  };

  async function addEncrypted(label = 'Cifrada'): Promise<Application> {
    return addApplication({ label, identity: encrypted });
  }

  it('refuses a plain identity added after encryption is on, and writes nothing', async () => {
    const existing = await addEncrypted();

    await expect(addApplication({ label: 'Plana', identity: IDENTITY })).rejects.toThrow(
      /plain identity/i,
    );

    await expect(listApplications()).resolves.toEqual([existing]);
  });

  it('still adds an encrypted identity while encryption is on', async () => {
    await addEncrypted('Primera');
    await addEncrypted('Segunda');

    const applications = await listApplications();
    expect(applications.map((application) => application.identity.kind)).toEqual([
      'encrypted',
      'encrypted',
    ]);
  });

  it('keeps a label-only edit of an encrypted application valid', async () => {
    const application = await addEncrypted();

    await updateApplication(application.id, { label: 'Renombrada' });

    await expect(getApplication(application.id)).resolves.toMatchObject({
      label: 'Renombrada',
      identity: encrypted,
    });
  });

  it('refuses to rewrite an identity in clear while an encrypted identity remains', async () => {
    const application = await addEncrypted();

    await expect(updateApplication(application.id, { identity: IDENTITY })).rejects.toThrow(
      /plain identity/i,
    );
    await expect(getApplication(application.id)).resolves.toMatchObject({
      identity: encrypted,
    });
  });

  it('refuses updateIdentity to plain while an encrypted identity remains', async () => {
    const application = await addEncrypted();

    await expect(updateIdentity(application.id, IDENTITY)).rejects.toThrow(/plain identity/i);
    await expect(getApplication(application.id)).resolves.toMatchObject({
      identity: encrypted,
    });
  });

  it('lets the explicit batch transaction create a mixed store for the repair path', async () => {
    const application = await addEncrypted();
    const plain: Application = {
      id: 'plain-1',
      label: 'Plana',
      identity: IDENTITY,
      createdAt: '2026-11-06T10:00:00.000Z',
    };

    await mutateStore((store) => ({
      ...store,
      applications: [...store.applications, plain],
    }));

    const applications = await listApplications();
    expect(applications.map((entry) => entry.id)).toEqual([application.id, plain.id]);
    expect(applications.map((entry) => entry.identity.kind)).toEqual(['encrypted', 'plain']);
  });
});

describe('legacy mixed snapshot through replaceStore', () => {
  it('is readable and visible to the export warning', async () => {
    const encrypted = {
      kind: 'encrypted' as const,
      payload: FAST_ENVELOPE,
    };
    await addApplication({ label: 'Cifrada', identity: encrypted });
    const before = await readStore();
    const plain: Application = {
      id: 'plain-1',
      label: 'Añadida después',
      identity: IDENTITY,
      createdAt: '2026-11-06T10:00:00.000Z',
    };

    await replaceStore({ ...before, applications: [...before.applications, plain] });

    const after = await readStore();
    expect(after.applications.map((entry) => entry.identity.kind)).toEqual(['encrypted', 'plain']);
    expect(hasPlainIdentities(after)).toBe(true);
  });
});

describe('encrypted envelope validation', () => {
  function envelope(patch: Record<string, unknown>): string {
    const parsed = JSON.parse(FAST_ENVELOPE) as Record<string, unknown>;
    return JSON.stringify({ ...parsed, ...patch });
  }

  function applicationWith(payload: string): Application {
    return {
      id: 'envelope-1',
      label: 'Cifrada',
      identity: { kind: 'encrypted', payload },
      createdAt: '2026-11-06T10:00:00.000Z',
    };
  }

  function storeWith(payload: string): Record<string, unknown> {
    return {
      version: 1,
      applications: [applicationWith(payload)],
      checks: [],
      settings: { reminders: DEFAULT_REMINDER, language: DEFAULT_LANGUAGE },
    };
  }

  it('accepts the structurally valid fast envelope the fixtures use', () => {
    expect(migrateStore(storeWith(FAST_ENVELOPE)).applications).toHaveLength(1);
  });

  it('rejects an empty, non-JSON or structurally malformed envelope', () => {
    for (const payload of [
      '',
      'locked',
      '{}',
      '{"v":2,"iterations":1000,"salt":"MDEyMzQ1Njc4OWFiY2RlZg==","iv":"MDEyMzQ1Njc4OWFi","ciphertext":"MDEyMzQ1Njc4OWFiY2RlZg=="}',
      envelope({ iterations: 0 }),
      envelope({ iterations: 1.5 }),
      envelope({ iterations: 2_000_001 }),
      envelope({ salt: 'c2hvcnQ=' }),
      envelope({ iv: 'c2hvcnQ=' }),
      envelope({ ciphertext: 'eA==' }),
      envelope({ salt: '%%%' }),
    ]) {
      expect(() => migrateStore(storeWith(payload))).toThrow(/encrypted identity payload/i);
    }
  });

  it('does not overwrite a healthy store when mutateStore returns a malformed envelope', async () => {
    await addApplication({ label: 'Buena', identity: IDENTITY });
    const before = await readStore();

    for (const payload of ['locked', envelope({ iterations: 2_000_001 })]) {
      await expect(
        mutateStore((store) => ({
          ...store,
          applications: store.applications.map((application) => ({
            ...application,
            identity: { kind: 'encrypted' as const, payload },
          })),
        })),
      ).rejects.toThrow(/encrypted identity payload/i);
      await expect(readStore()).resolves.toEqual(before);
    }
  });

  it('does not overwrite a healthy store when replaceStore gets a malformed envelope', async () => {
    await addApplication({ label: 'Buena', identity: IDENTITY });
    const before = await readStore();
    const malformed = { ...before, applications: [applicationWith('locked')] };

    await expect(replaceStore(malformed)).rejects.toThrow(/encrypted identity payload/i);
    await expect(readStore()).resolves.toEqual(before);
  });
});

describe('replaceStore recovery path', () => {
  it('can replace a corrupt snapshot without reading it first', async () => {
    await browser.storage.local.set({
      naciocheck: {
        version: SCHEMA_VERSION,
        applications: [
          {
            id: 'bad',
            label: 'Bad',
            identity: { kind: 'plain' },
            createdAt: '2026-11-06T10:00:00.000Z',
          },
        ],
        checks: [],
      },
    });
    await expect(readStore()).rejects.toThrow(/identity/i);

    await replaceStore(emptyStore());

    await expect(readStore()).resolves.toEqual(emptyStore());
  });
});
