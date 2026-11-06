import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import {
  acknowledgeCheck,
  addApplication,
  appendCheck,
  deleteApplication,
  emptyStore,
  getApplication,
  latestCheck,
  listApplications,
  listChecks,
  migrateStore,
  readStore,
  SCHEMA_VERSION,
  type PlainIdentity,
} from '../src/core/storage';

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

describe('checks', () => {
  it('appends a check with an id, a timestamp and no acknowledgement', async () => {
    const applicationId = await addTestApplication('Primera');

    const check = await appendCheck({
      applicationId,
      outcome: 'status',
      statusKey: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
    });

    expect(check).toMatchObject({
      applicationId,
      outcome: 'status',
      statusKey: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
      acknowledged: false,
    });
    expect(check.id).toEqual(expect.any(String));
    expect(check.at).toEqual(expect.any(String));
  });

  it('refuses to record a check for an application that does not exist', async () => {
    await expect(
      appendCheck({
        applicationId: 'no-existe',
        outcome: 'status',
        statusKey: 'unknown',
        raw: 'Algo',
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
      await appendCheck({ applicationId, outcome: 'status', statusKey: 'unknown', raw });
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
    await appendCheck({ applicationId, outcome: 'status', statusKey: 'unknown', raw: 'Primero' });
    const second = await appendCheck({
      applicationId,
      outcome: 'error',
      statusKey: 'unknown',
      raw: 'Error',
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
    await appendCheck({ applicationId: first, outcome: 'status', statusKey: 'unknown', raw: 'A' });
    await appendCheck({ applicationId: second, outcome: 'status', statusKey: 'unknown', raw: 'B' });

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
      settings: {},
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
    expect(migrateStore({ version: 1, applications: [], checks: [] }).settings).toEqual({});
  });
});
