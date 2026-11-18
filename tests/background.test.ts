import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { encryptIdentity } from '../src/core/crypto';
import { DEFAULT_REMINDER } from '../src/core/schedule';
import {
  acknowledgeCheck,
  addApplication,
  appendCheck,
  type Application,
  deleteApplication,
  type Check,
  type PlainIdentity,
  listApplications,
  readStore,
  type Store,
} from '../src/core/storage';
import {
  canUseSessionPassphrase,
  cleanupTab,
  continueRun,
  handleAlarm,
  hasOutstandingChange,
  isResultPayload,
  lockSession,
  recordOutcome,
  remainingAfter,
  startCheckRun,
  unlock,
} from '../src/entrypoints/background';
import { lastChanged } from '../src/entrypoints/popup/main';
import { unlockedSelection } from '../src/entrypoints/unlock/main';

/**
 * The background's pure and session-holding helpers: badge derivation, queue advancement and the passphrase
 * that must actually open the selected applications. Synthetic values only.
 */

const PASSPHRASE = 'frase de prueba';
const FAST_ITERATIONS = 1_000;

const IDENTITY: PlainIdentity = {
  kind: 'plain',
  nie: 'X0000000X',
  birthDate: '1990-01-01',
  numero: 'R500001',
  year: '2015',
};

function check(overrides: Partial<Check> = {}): Check {
  return {
    id: 'check-1',
    applicationId: 'app-1',
    at: '2026-11-18T10:00:00.000Z',
    outcome: 'status',
    statusKey: 'abierto-registrado',
    raw: 'Abierto - Registrado.',
    subStatus: null,
    acknowledged: false,
    ...overrides,
  };
}

function storeOf(checks: Check[]): Store {
  return {
    version: 1,
    applications: [
      { id: 'app-1', label: 'Primera', identity: IDENTITY, createdAt: '2026-11-18T09:00:00.000Z' },
    ],
    checks,
    settings: { reminders: DEFAULT_REMINDER, language: 'auto' },
  };
}

function applicationWith(identity: Application['identity'], id: string): Application {
  return {
    id,
    label: id,
    identity,
    createdAt: '2026-11-18T09:00:00.000Z',
  };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await browser.storage.local.clear();
  await browser.storage.session.clear();
});

describe('remainingAfter', () => {
  it('drops the head that was just checked', () => {
    expect(remainingAfter(['app-1', 'app-2'], 'app-1')).toEqual(['app-2']);
  });

  it('removes an application that is no longer in the queue', () => {
    expect(remainingAfter(['app-2', 'app-3'], 'app-1')).toEqual(['app-2', 'app-3']);
  });

  it('leaves nothing when the application was the only one', () => {
    expect(remainingAfter(['app-1'], 'app-1')).toEqual([]);
  });
});

describe('hasOutstandingChange', () => {
  const registered = check({ id: 'check-1' });
  const changed = check({
    id: 'check-2',
    at: '2026-11-18T11:00:00.000Z',
    statusKey: 'abierto-en-tramitacion',
    raw: 'Abierto - En tramitación.',
  });

  it('is true for a changed status that has not been acknowledged', () => {
    expect(hasOutstandingChange(storeOf([registered, changed]))).toBe(true);
  });

  it('is false once the change is acknowledged, even when another check is still unacknowledged', () => {
    expect(hasOutstandingChange(storeOf([registered, { ...changed, acknowledged: true }]))).toBe(
      false,
    );
  });

  it('is true while any application still has an unacknowledged change', () => {
    const second = check({
      id: 'check-3',
      applicationId: 'app-2',
      statusKey: 'abierto-en-tramitacion',
      raw: 'Abierto - En tramitación.',
    });
    const store: Store = {
      ...storeOf([registered, { ...changed, acknowledged: true }]),
      applications: [
        ...storeOf([]).applications,
        {
          id: 'app-2',
          label: 'Segunda',
          identity: IDENTITY,
          createdAt: '2026-11-18T09:30:00.000Z',
        },
      ],
      checks: [
        registered,
        { ...changed, acknowledged: true },
        check({ id: 'check-0', applicationId: 'app-2', raw: 'Abierto - Registrado.' }),
        second,
      ],
    };
    expect(hasOutstandingChange(store)).toBe(true);
  });

  it('keeps the change after a later unchanged status of the same value', () => {
    const unchangedAgain = check({
      id: 'check-3',
      at: '2026-11-18T12:00:00.000Z',
      statusKey: 'abierto-en-tramitacion',
      raw: 'Abierto - En tramitación.',
    });

    expect(hasOutstandingChange(storeOf([registered, changed, unchangedAgain]))).toBe(true);
  });

  it('keeps the change after a later error check', () => {
    const failure = check({
      id: 'check-3',
      at: '2026-11-18T12:00:00.000Z',
      outcome: 'error',
      statusKey: 'unknown',
      raw: 'Error en la sede.',
    });

    expect(hasOutstandingChange(storeOf([registered, changed, failure]))).toBe(true);
  });

  it('acknowledging one of two changes leaves the other outstanding', () => {
    const otherEarlier = check({
      id: 'check-0',
      applicationId: 'app-2',
      raw: 'Abierto - Registrado.',
    });
    const otherChanged = check({
      id: 'check-4',
      applicationId: 'app-2',
      statusKey: 'abierto-en-tramitacion',
      raw: 'Abierto - En tramitación.',
    });
    const store: Store = {
      ...storeOf([registered, { ...changed, acknowledged: true }, otherEarlier, otherChanged]),
      applications: [
        ...storeOf([]).applications,
        {
          id: 'app-2',
          label: 'Segunda',
          identity: IDENTITY,
          createdAt: '2026-11-18T09:30:00.000Z',
        },
      ],
    };

    expect(hasOutstandingChange(store)).toBe(true);
  });

  it('ignores a first or unchanged status and an error', () => {
    expect(hasOutstandingChange(storeOf([registered]))).toBe(false);
    expect(
      hasOutstandingChange(
        storeOf([registered, check({ id: 'check-2', at: '2026-11-18T11:00:00.000Z' })]),
      ),
    ).toBe(false);
    expect(
      hasOutstandingChange(
        storeOf([registered, check({ id: 'check-2', outcome: 'error', statusKey: 'unknown' })]),
      ),
    ).toBe(false);
  });
});

describe('canUseSessionPassphrase', () => {
  it('accepts a selection with no encrypted application without asking for a phrase', async () => {
    await expect(canUseSessionPassphrase([applicationWith(IDENTITY, 'app-1')])).resolves.toBe(true);
  });

  it('rejects an encrypted application when no phrase is held', async () => {
    const identity = await encryptIdentity(IDENTITY, PASSPHRASE, FAST_ITERATIONS);
    await expect(canUseSessionPassphrase([applicationWith(identity, 'app-1')])).resolves.toBe(
      false,
    );
  });

  it('forgets a stale phrase that does not open the selected application', async () => {
    const identity = await encryptIdentity(IDENTITY, PASSPHRASE, FAST_ITERATIONS);
    await browser.storage.session.set({ 'naciocheck:unlock': 'otra frase' });

    await expect(canUseSessionPassphrase([applicationWith(identity, 'app-1')])).resolves.toBe(
      false,
    );
    await expect(browser.storage.session.get('naciocheck:unlock')).resolves.toEqual({
      'naciocheck:unlock': undefined,
    });
  });

  it('accepts the phrase that opens the selected application', async () => {
    const identity = await encryptIdentity(IDENTITY, PASSPHRASE, FAST_ITERATIONS);
    await browser.storage.session.set({ 'naciocheck:unlock': PASSPHRASE });

    await expect(canUseSessionPassphrase([applicationWith(identity, 'app-1')])).resolves.toBe(true);
  });
});

describe('unlock', () => {
  async function seedEncrypted(label: string, passphrase: string): Promise<string> {
    const identity = await encryptIdentity(
      { ...IDENTITY, numero: label },
      passphrase,
      FAST_ITERATIONS,
    );
    const application = await addApplication({ label, identity });
    return application.id;
  }

  it('validates only the remembered selection, not an unrelated encrypted application', async () => {
    const first = await seedEncrypted('Primera', 'frase de la primera');
    const second = await seedEncrypted('Segunda', 'frase de la segunda');
    await browser.storage.session.set({ 'naciocheck:pending-selection': [second] });

    // The phrase of the application nobody selected must not be enough.
    await expect(unlock('frase de la primera')).resolves.toBe(false);
    await expect(unlock('frase de la segunda')).resolves.toBe(true);
    expect(first).not.toBe(second);
  });

  it('without a remembered selection accepts a phrase that opens an encrypted identity', async () => {
    await seedEncrypted('Primera', 'frase de la primera');
    await seedEncrypted('Segunda', 'frase de la segunda');

    await expect(unlock('frase de la primera')).resolves.toBe(true);
    await expect(unlock('ninguna de las dos')).resolves.toBe(false);
  });

  it('an unlock after the lock has no remembered selection to start', async () => {
    await seedEncrypted('Primera', PASSPHRASE);
    await browser.storage.session.set({
      'naciocheck:pending-selection': [(await listApplications())[0]?.id],
    });
    await lockSession();

    // The options-style unlock still accepts the phrase, but the stale prompt has nothing to start.
    const unlocked = await unlock(PASSPHRASE);
    expect(unlocked).toBe(true);
    expect(unlockedSelection({ unlocked, applicationIds: null })).toBeNull();
  });

  it('does not store the phrase when a lock happens while it is being checked', async () => {
    await seedEncrypted('Primera', PASSPHRASE);

    const unlocking = unlock(PASSPHRASE);
    await lockSession();

    await expect(unlocking).resolves.toBe(false);
    await expect(browser.storage.session.get('naciocheck:unlock')).resolves.toEqual({
      'naciocheck:unlock': undefined,
    });
  });
});

describe('unlockedSelection', () => {
  it('accepts only an explicit, non-empty selection from the background', () => {
    expect(unlockedSelection({ unlocked: true, applicationIds: ['app-1'] })).toEqual(['app-1']);
    expect(unlockedSelection({ unlocked: true, applicationIds: ['app-1', 'app-2'] })).toEqual([
      'app-1',
      'app-2',
    ]);

    const rejected: unknown[] = [
      null,
      'unlocked',
      {},
      { unlocked: false, applicationIds: ['app-1'] },
      { unlocked: true },
      { unlocked: true, applicationIds: null },
      { unlocked: true, applicationIds: [] },
      { unlocked: true, applicationIds: 'app-1' },
      { unlocked: true, applicationIds: ['app-1', 2] },
      { unlocked: true, applicationIds: [''] },
    ];
    for (const value of rejected) {
      expect(unlockedSelection(value), JSON.stringify(value)).toBeNull();
    }
  });
});

describe('lockSession', () => {
  it('forgets the passphrase, the fills, the run and the pending unlock selection', async () => {
    await browser.storage.session.set({
      'naciocheck:unlock': PASSPHRASE,
      'naciocheck:fills': { '7': 'app-1' },
      'naciocheck:run': { id: 'run-1', queue: ['app-1'] },
      'naciocheck:pending-selection': ['app-1'],
    });

    await lockSession();

    await expect(browser.storage.session.get(null)).resolves.toEqual({});
  });

  it('closes the open unlock prompt without failing the lock', async () => {
    await browser.storage.session.set({
      'naciocheck:unlock': PASSPHRASE,
      'naciocheck:pending-selection': ['app-1'],
      'naciocheck:pending-tab': 11,
    });
    const remove = vi.spyOn(browser.tabs, 'remove').mockResolvedValue(undefined);

    await lockSession();

    expect(remove).toHaveBeenCalledWith(11);
    await expect(browser.storage.session.get(null)).resolves.toEqual({});
  });

  it('still locks when the prompt tab is already gone', async () => {
    await browser.storage.session.set({
      'naciocheck:unlock': PASSPHRASE,
      'naciocheck:pending-tab': 11,
    });
    vi.spyOn(browser.tabs, 'remove').mockRejectedValue(new Error('No tab with id: 11'));

    await expect(lockSession()).resolves.toBeUndefined();
    await expect(browser.storage.session.get(null)).resolves.toEqual({});
  });
});

describe('cleanupTab', () => {
  it('removes the closed tab only, leaving other fills and results alone', async () => {
    await browser.storage.session.set({
      'naciocheck:fills': { '5': 'app-1', '6': 'app-2' },
      'naciocheck:result:5': {
        applicationId: 'app-1',
        view: {},
        acknowledged: false,
        hasNext: false,
        runId: '',
      },
      'naciocheck:result:6': {
        applicationId: 'app-2',
        view: {},
        acknowledged: false,
        hasNext: false,
        runId: '',
      },
    });

    await cleanupTab(5);

    await expect(browser.storage.session.get('naciocheck:fills')).resolves.toEqual({
      'naciocheck:fills': { '6': 'app-2' },
    });
    await expect(browser.storage.session.get('naciocheck:result:5')).resolves.toEqual({
      'naciocheck:result:5': undefined,
    });
    await expect(browser.storage.session.get('naciocheck:result:6')).resolves.toEqual({
      'naciocheck:result:6': {
        applicationId: 'app-2',
        view: {},
        acknowledged: false,
        hasNext: false,
        runId: '',
      },
    });
  });
});

describe('startCheckRun', () => {
  it('keeps the first selection when two starts race before the first unlock', async () => {
    const firstIdentity = await encryptIdentity(IDENTITY, PASSPHRASE, FAST_ITERATIONS);
    const secondIdentity = await encryptIdentity(
      { ...IDENTITY, numero: 'R500002' },
      PASSPHRASE,
      FAST_ITERATIONS,
    );
    const first = await addApplication({ label: 'Primera', identity: firstIdentity });
    const second = await addApplication({ label: 'Segunda', identity: secondIdentity });

    const create = vi.spyOn(browser.tabs, 'create').mockResolvedValue({ id: 11 } as never);
    const update = vi.spyOn(browser.tabs, 'update').mockResolvedValue(undefined);

    await Promise.all([startCheckRun([first.id]), startCheckRun([second.id])]);

    await expect(browser.storage.session.get('naciocheck:pending-selection')).resolves.toEqual({
      'naciocheck:pending-selection': [first.id],
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(11, { active: true });
    await expect(browser.storage.session.get('naciocheck:run')).resolves.toEqual({
      'naciocheck:run': undefined,
    });
  });
});

describe('continueRun', () => {
  const result = {
    view: {},
    applicationId: 'app-1',
    checkId: 'check-1',
    acknowledged: false,
    hasNext: true,
    runId: 'run-1',
  };

  beforeEach(async () => {
    vi.spyOn(browser.tabs, 'update').mockResolvedValue(undefined);
    await browser.storage.session.set({
      'naciocheck:run': { id: 'run-1', queue: ['app-1', 'app-2'] },
      'naciocheck:fills': {},
      'naciocheck:result:7': result,
    });
  });

  it('advances once and ignores a repeated Continue for the same result', async () => {
    await expect(continueRun(7)).resolves.toBe(true);
    await expect(continueRun(7)).resolves.toBe(false);

    await expect(browser.storage.session.get('naciocheck:run')).resolves.toEqual({
      'naciocheck:run': { id: 'run-1', queue: ['app-2'] },
    });
    await expect(browser.storage.session.get('naciocheck:fills')).resolves.toEqual({
      'naciocheck:fills': { '7': 'app-2' },
    });
    await expect(browser.storage.session.get('naciocheck:result:7')).resolves.toEqual({
      'naciocheck:result:7': undefined,
    });
  });

  it('refuses a result from an earlier run without touching the new queue', async () => {
    await browser.storage.session.set({
      'naciocheck:run': { id: 'run-2', queue: ['app-3', 'app-4'] },
    });

    await expect(continueRun(7)).resolves.toBe(false);
    await expect(browser.storage.session.get('naciocheck:run')).resolves.toEqual({
      'naciocheck:run': { id: 'run-2', queue: ['app-3', 'app-4'] },
    });
  });

  it('does not advance from a detached retry result', async () => {
    await browser.storage.session.set({
      'naciocheck:result:7': { ...result, runId: '', hasNext: false },
    });

    await expect(continueRun(7)).resolves.toBe(false);
    await expect(browser.storage.session.get('naciocheck:run')).resolves.toEqual({
      'naciocheck:run': { id: 'run-1', queue: ['app-1', 'app-2'] },
    });
  });

  it('continues with the queue when the checked application was deleted from it', async () => {
    await browser.storage.session.set({
      'naciocheck:run': { id: 'run-1', queue: ['app-2'] },
    });

    await expect(continueRun(7)).resolves.toBe(true);
    await expect(browser.storage.session.get('naciocheck:fills')).resolves.toEqual({
      'naciocheck:fills': { '7': 'app-2' },
    });
  });
});

describe('recordOutcome', () => {
  const outcome = {
    kind: 'status' as const,
    key: 'abierto-registrado' as const,
    raw: 'Abierto - Registrado.',
    normalised: 'abierto - registrado.',
    subStatus: null,
  };

  beforeEach(() => {
    vi.spyOn(browser.action, 'setBadgeText').mockResolvedValue(undefined);
    vi.spyOn(browser.action, 'setBadgeBackgroundColor').mockResolvedValue(undefined);
    vi.spyOn(browser.notifications, 'getAll').mockResolvedValue({} as never);
    vi.spyOn(browser.notifications, 'clear').mockResolvedValue(true as never);
  });

  it('stores the result and advances the badge when the change notification fails', async () => {
    const application = await addApplication({ label: 'Primera', identity: IDENTITY });
    await appendCheck({
      applicationId: application.id,
      outcome: 'status',
      statusKey: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
      subStatus: null,
    });
    await browser.storage.session.set({
      'naciocheck:run': { id: 'run-1', queue: [application.id] },
      'naciocheck:fills': { '5': application.id },
    });
    const create = vi
      .spyOn(browser.notifications, 'create')
      .mockRejectedValue(new Error('notifications are unavailable'));

    await recordOutcome(
      { ...outcome, key: 'abierto-en-tramitacion', raw: 'Abierto - En tramitación.' },
      application.id,
      5,
      'es',
    );

    expect(create).toHaveBeenCalled();
    const stored = await browser.storage.session.get('naciocheck:result:5');
    expect(stored['naciocheck:result:5']).toMatchObject({
      applicationId: application.id,
      view: { view: 'changed' },
    });
  });

  it('does not rewrite the active run while deriving the badge from a store change', async () => {
    const application = await addApplication({ label: 'Primera', identity: IDENTITY });
    const other = await addApplication({ label: 'Segunda', identity: IDENTITY });
    await browser.storage.session.set({
      'naciocheck:run': { id: 'run-1', queue: [application.id, other.id] },
      'naciocheck:fills': { '5': application.id },
    });
    await deleteApplication(other.id);

    await recordOutcome(outcome, application.id, 5, 'es');

    await expect(browser.storage.session.get('naciocheck:run')).resolves.toEqual({
      'naciocheck:run': { id: 'run-1', queue: [application.id, other.id] },
    });
    await expect(browser.storage.session.get('naciocheck:fills')).resolves.toEqual({
      'naciocheck:fills': { '5': application.id },
    });
  });

  it('reports a deleted application without recording a check against nothing', async () => {
    const application = await addApplication({ label: 'Primera', identity: IDENTITY });
    await deleteApplication(application.id);
    await browser.storage.session.set({
      'naciocheck:run': { id: 'run-1', queue: [application.id] },
      'naciocheck:fills': { '5': application.id },
    });

    await recordOutcome(outcome, application.id, 5, 'es');

    const stored = await browser.storage.session.get('naciocheck:result:5');
    const payload = stored['naciocheck:result:5'] as {
      acknowledged: boolean;
      checkId: string | null;
      view: { view: string; errorMessages: string[] };
    };
    expect(payload).toMatchObject({ acknowledged: true, checkId: null });
    expect(payload.view.view).toBe('error');
    expect(payload.view.errorMessages).toHaveLength(1);
    await expect(readStore()).resolves.toMatchObject({ checks: [] });
  });
});

describe('handleAlarm', () => {
  it('reschedules the reminder even when the notification cannot be shown', async () => {
    vi.spyOn(browser.i18n, 'getUILanguage').mockReturnValue('es-ES');
    const create = vi
      .spyOn(browser.notifications, 'create')
      .mockRejectedValue(new Error('notifications are unavailable'));
    const clear = vi.spyOn(browser.alarms, 'clear').mockResolvedValue(undefined);
    vi.spyOn(browser.alarms, 'create').mockResolvedValue(undefined);

    await expect(handleAlarm('naciocheck:reminder')).resolves.toBeUndefined();

    expect(create).toHaveBeenCalled();
    expect(clear).toHaveBeenCalledWith('naciocheck:reminder');
  });

  it('ignores another alarm', async () => {
    const clear = vi.spyOn(browser.alarms, 'clear').mockResolvedValue(undefined);

    await handleAlarm('other');

    expect(clear).not.toHaveBeenCalled();
  });
});

describe('popup change target', () => {
  const registered = check({ id: 'check-1' });
  const changed = check({
    id: 'check-2',
    at: '2026-11-18T11:00:00.000Z',
    statusKey: 'abierto-en-tramitacion',
    raw: 'Abierto - En tramitación.',
  });

  it('retains the changed check when a later check is unchanged', () => {
    const unchanged = check({
      id: 'check-3',
      at: '2026-11-18T12:00:00.000Z',
      statusKey: 'abierto-en-tramitacion',
      raw: 'Abierto - En tramitación.',
    });

    expect(lastChanged([registered, changed, unchanged], true)?.id).toBe(changed.id);
  });

  it('retains the changed check after a later error', () => {
    const failure = check({
      id: 'check-3',
      at: '2026-11-18T12:00:00.000Z',
      outcome: 'error',
      statusKey: 'unknown',
      raw: 'Error en la sede.',
    });

    expect(lastChanged([registered, changed, failure], true)?.id).toBe(changed.id);
  });

  it('falls back to an acknowledged change for revisiting', () => {
    const acknowledged = { ...changed, acknowledged: true };

    expect(lastChanged([registered, acknowledged], true)).toBeUndefined();
    expect(lastChanged([registered, acknowledged], false)?.id).toBe(acknowledged.id);
  });
});

describe('isResultPayload', () => {
  it('accepts the payload the background stores and rejects a partial one', () => {
    expect(
      isResultPayload({
        view: { view: 'status' },
        applicationId: 'app-1',
        checkId: null,
        acknowledged: true,
        hasNext: false,
        runId: '',
      }),
    ).toBe(true);
    expect(isResultPayload({ applicationId: 'app-1' })).toBe(false);
    expect(isResultPayload(null)).toBe(false);
  });
});

describe('acknowledgement', () => {
  it('is reflected by the derived badge state', async () => {
    const application = await addApplication({ label: 'Primera', identity: IDENTITY });
    const previous = await appendCheck({
      applicationId: application.id,
      outcome: 'status',
      statusKey: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
      subStatus: null,
    });
    const changed = await appendCheck({
      applicationId: application.id,
      outcome: 'status',
      statusKey: 'abierto-en-tramitacion',
      raw: 'Abierto - En tramitación.',
      subStatus: null,
    });
    expect(previous.id).not.toBe(changed.id);

    expect(hasOutstandingChange(await readStore())).toBe(true);

    await acknowledgeCheck(changed.id);
    expect(hasOutstandingChange(await readStore())).toBe(false);
  });
});
