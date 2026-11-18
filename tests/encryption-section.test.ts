import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { exportStore } from '../src/core/backup';
import { encryptIdentity } from '../src/core/crypto';
import { DEFAULT_LOCALE, setLocale, t } from '../src/core/i18n';
import {
  addApplication,
  appendCheck,
  listApplications,
  listChecks,
  readStore,
  replaceStore,
  updateIdentity,
  emptyStore,
  type Store,
  type PlainIdentity,
} from '../src/core/storage';
import { buildApplicationForm } from '../src/entrypoints/shared/application-form';
import { renderBackup, renderEncryption } from '../src/entrypoints/shared/encryption-sections';

/**
 * The repair path of the encryption section: a store that ended up mixed — some applications encrypted, some
 * written in clear — must be fixable from options, without losing a single check.
 *
 * Synthetic values only.
 */

const PASSPHRASE = 'frase de prueba';
const FAST_ITERATIONS = 1_000;
const confirmDialog = vi.fn<() => boolean>();

const FIRST: PlainIdentity = {
  kind: 'plain',
  nie: 'X0000000X',
  birthDate: '1990-01-01',
  numero: 'R500001',
  year: '2015',
};

const SECOND: PlainIdentity = {
  kind: 'plain',
  nie: 'Y0000001Y',
  birthDate: '1991-02-02',
  numero: 'R500002',
  year: '2016',
};

async function seedMixedStore(): Promise<void> {
  const encrypted = await encryptIdentity(FIRST, PASSPHRASE, FAST_ITERATIONS);
  const one = await addApplication({ label: 'Cifrada', identity: FIRST });
  const other = await addApplication({ label: 'Sin cifrar', identity: SECOND });
  await updateIdentity(one.id, encrypted);

  for (const application of [one, other]) {
    await appendCheck({
      applicationId: application.id,
      outcome: 'status',
      statusKey: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
      subStatus: null,
    });
  }
}

/** Simulates a legacy mixed snapshot, not a permitted new plaintext write while encryption is on. */
async function seedLegacyPlain(label: string): Promise<void> {
  const store = await readStore();
  await replaceStore({
    ...store,
    applications: [
      ...store.applications,
      {
        id: crypto.randomUUID(),
        label,
        identity: SECOND,
        createdAt: new Date().toISOString(),
      },
    ],
  });
}

function repairButton(view: HTMLElement): HTMLButtonElement {
  const found = [...view.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === t('encryption.repair'),
  );
  if (found === undefined) throw new Error('The encryption section offers no repair action');
  return found;
}

/** The repair is asynchronous and its button returns nothing, so the store is polled. */
async function waitForAllEncrypted(): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const applications = await listApplications();
    if (applications.every((application) => application.identity.kind === 'encrypted')) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/**
 * The extension pages talk to the background. The fake has no listener unless one is registered, and an
 * unanswered `sendMessage` rejects; this answers every message the way the background would answer an unlock.
 */
beforeAll(() => {
  browser.runtime.onMessage.addListener((_message: unknown, _sender, sendResponse) => {
    sendResponse({ unlocked: true });
    return true;
  });
});

beforeEach(async () => {
  setLocale(DEFAULT_LOCALE);
  await browser.storage.local.clear();
  document.body.replaceChildren();
  confirmDialog.mockReset().mockReturnValue(true);
  vi.spyOn(window, 'confirm').mockImplementation(confirmDialog);
});

afterEach(() => vi.restoreAllMocks());

describe('the encryption section', () => {
  it('does not partially decrypt when a later identity uses another passphrase', async () => {
    await addApplication({
      label: 'Primera',
      identity: await encryptIdentity(FIRST, PASSPHRASE, FAST_ITERATIONS),
    });
    await addApplication({
      label: 'Otra',
      identity: await encryptIdentity(SECOND, 'otra frase segura', FAST_ITERATIONS),
    });
    const before = await readStore();
    const view = document.createElement('div');
    document.body.append(view);
    await renderEncryption(view, () => Promise.resolve());
    fillPassphrase(view, PASSPHRASE);
    sectionButton(view, t('encryption.disable')).click();
    await vi.waitFor(() => expect(view.textContent).toContain(t('encryption.decryptFailed')));
    expect(await readStore()).toEqual(before);
  });

  it('does not remove encryption when its confirmation is cancelled', async () => {
    await addApplication({
      label: 'Primera',
      identity: await encryptIdentity(FIRST, PASSPHRASE, FAST_ITERATIONS),
    });
    const before = await readStore();
    const view = document.createElement('div');
    document.body.append(view);
    await renderEncryption(view, () => Promise.resolve());
    confirmDialog.mockReturnValue(false);
    fillPassphrase(view, PASSPHRASE);
    sectionButton(view, t('encryption.disable')).click();
    expect(await readStore()).toEqual(before);
  });

  it.each([
    ['enable', 'done'],
    ['repair', 'repaired'],
    ['disable', 'disabled'],
  ] as const)('keeps the %s confirmation after a full page redraw', async (action, outcome) => {
    if (action === 'repair') await seedMixedStore();
    else {
      await addApplication({
        label: 'Prueba',
        identity:
          action === 'enable' ? FIRST : await encryptIdentity(FIRST, PASSPHRASE, FAST_ITERATIONS),
      });
    }
    const view = document.createElement('div');
    document.body.append(view);
    const redraw = async (): Promise<void> => {
      view.replaceChildren();
      await renderEncryption(view, redraw);
    };
    await redraw();
    fillPassphrase(view, PASSPHRASE);
    sectionButton(view, t(`encryption.${action}`)).click();
    await vi.waitFor(
      () => {
        expect(view.querySelector('.encryption + p[role="status"]')?.textContent).toBe(
          t(`encryption.${outcome}`),
        );
      },
      { timeout: 5_000 },
    );
  });

  it('lists the identities still in clear and encrypts them without losing a check', async () => {
    await seedMixedStore();
    const view = document.createElement('div');
    document.body.append(view);
    await renderEncryption(view, () => Promise.resolve());

    expect(view.textContent).toContain('Sin cifrar');

    const passphrase = view.querySelector<HTMLInputElement>('#passphrase');
    expect(passphrase).not.toBeNull();
    if (passphrase !== null) passphrase.value = PASSPHRASE;
    repairButton(view).click();

    await waitForAllEncrypted();

    const applications = await listApplications();
    expect(applications.map((application) => application.identity.kind)).toEqual([
      'encrypted',
      'encrypted',
    ]);
    for (const application of applications) {
      await expect(listChecks(application.id)).resolves.toHaveLength(1);
    }
  });

  it('changes nothing when the passphrase does not open the store', async () => {
    await seedMixedStore();
    const view = document.createElement('div');
    document.body.append(view);
    await renderEncryption(view, () => Promise.resolve());

    const passphrase = view.querySelector<HTMLInputElement>('#passphrase');
    if (passphrase !== null) passphrase.value = 'no es la frase';
    repairButton(view).click();

    await new Promise((resolve) => setTimeout(resolve, 500));

    const applications = await listApplications();
    expect(applications.map((application) => application.identity.kind)).toEqual([
      'encrypted',
      'plain',
    ]);
    expect(view.textContent).toContain(t('encryption.repairFailed'));
  });

  it('offers no repair when everything is encrypted', async () => {
    const encrypted = await encryptIdentity(FIRST, PASSPHRASE, FAST_ITERATIONS);
    await addApplication({ label: 'Cifrada', identity: encrypted });

    const view = document.createElement('div');
    document.body.append(view);
    await renderEncryption(view, () => Promise.resolve());

    const labels = [...view.querySelectorAll('button')].map((candidate) => candidate.textContent);
    expect(labels).not.toContain(t('encryption.repair'));
  });
});

/** The button that turns encryption on for a store that has none yet. */
function enableButton(view: HTMLElement): HTMLButtonElement {
  const found = [...view.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === t('encryption.enable'),
  );
  if (found === undefined) throw new Error('The encryption section offers no way to enable it');
  return found;
}

async function waitForApplications(count: number): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if ((await listApplications()).length === count) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`The store never reached ${count} applications`);
}

/** Any button of a section, by the text a person reads on it. */
function sectionButton(view: HTMLElement, label: string): HTMLButtonElement {
  const found = [...view.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  if (found === undefined) throw new Error(`The section offers no '${label}' action`);
  return found;
}

/** Types the passphrase the section asks for; the repeat field is only there when encryption is off. */
function fillPassphrase(view: HTMLElement, passphrase: string): void {
  const field = view.querySelector<HTMLInputElement>('#passphrase');
  if (field === null) throw new Error('The section asks for no passphrase');
  field.value = passphrase;
  const repeated = view.querySelector<HTMLInputElement>('#passphrase-repeat');
  if (repeated !== null) repeated.value = passphrase;
}

/** The disable and enable actions are asynchronous and return nothing, so the store is polled. */
async function waitForEveryIdentity(kind: 'plain' | 'encrypted'): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const applications = await listApplications();
    if (applications.length > 0 && applications.every((entry) => entry.identity.kind === kind)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`The store never turned every identity ${kind}`);
}

/**
 * The onboarding step the plan asks for: enabling encryption from the section has to change what the form does
 * afterwards, otherwise the user would believe the new application is protected and it would not be.
 */
describe('enabling encryption from the section', () => {
  it('makes the application form ask for the passphrase and store the new identity encrypted', async () => {
    await addApplication({ label: 'La primera', identity: FIRST });

    const view = document.createElement('div');
    document.body.append(view);
    await renderEncryption(view, () => Promise.resolve());

    const passphrase = view.querySelector<HTMLInputElement>('#passphrase');
    const repeated = view.querySelector<HTMLInputElement>('#passphrase-repeat');
    if (passphrase === null || repeated === null) throw new Error('No passphrase field to fill');
    passphrase.value = PASSPHRASE;
    repeated.value = PASSPHRASE;
    enableButton(view).click();

    await waitForAllEncrypted();

    const form = await buildApplicationForm(() => undefined);
    expect(form.querySelector('#field-passphrase')).not.toBeNull();

    const set = (id: string, value: string): void => {
      const input = form.querySelector<HTMLInputElement>(`#${id}`);
      if (input === null) throw new Error(`The form has no #${id}`);
      input.value = value;
    };
    set('field-label', 'La segunda');
    set('field-nie', SECOND.nie);
    set('field-numero', SECOND.numero);
    set('field-year', SECOND.year);
    set('field-birthDate', SECOND.birthDate);
    set('field-passphrase', PASSPHRASE);
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await waitForApplications(2);

    const applications = await listApplications();
    expect(applications.map((application) => application.identity.kind)).toEqual([
      'encrypted',
      'encrypted',
    ]);
    const stored = applications[1]?.identity;
    expect(JSON.stringify(stored)).not.toContain(SECOND.nie);
  });
});

/**
 * The order a first run takes: the page is drawn, the application arrives, and only then is encryption turned
 * on. The section used to keep the store it was drawn from and encrypt nothing while saying it had, so every
 * action here has to act on the store as it is when the person presses the button.
 */
describe('when the store changes after the section was drawn', () => {
  it('encrypts an application added after the section was drawn', async () => {
    const view = document.createElement('div');
    document.body.append(view);
    await renderEncryption(view, () => Promise.resolve());

    await addApplication({ label: 'Añadida después', identity: FIRST });

    fillPassphrase(view, PASSPHRASE);
    enableButton(view).click();
    await waitForEveryIdentity('encrypted');

    const applications = await listApplications();
    expect(
      applications.map((application) => [application.label, application.identity.kind]),
    ).toEqual([['Añadida después', 'encrypted']]);
  });

  it('says there is nothing to encrypt instead of claiming it did', async () => {
    const view = document.createElement('div');
    document.body.append(view);
    await renderEncryption(view, () => Promise.resolve());

    fillPassphrase(view, PASSPHRASE);
    enableButton(view).click();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await expect(listApplications()).resolves.toEqual([]);
    expect(view.textContent).toContain(t('encryption.nothingToEncrypt'));
    expect(view.textContent).not.toContain(t('encryption.done'));
  });

  it('decrypts every application, including one added after the section was drawn', async () => {
    const encrypted = await encryptIdentity(FIRST, PASSPHRASE, FAST_ITERATIONS);
    await addApplication({ label: 'Cifrada', identity: encrypted });

    const view = document.createElement('div');
    document.body.append(view);
    await renderEncryption(view, () => Promise.resolve());

    await seedLegacyPlain('Añadida después');

    fillPassphrase(view, PASSPHRASE);
    sectionButton(view, t('encryption.disable')).click();
    await waitForEveryIdentity('plain');

    const applications = await listApplications();
    expect(applications.map((application) => application.identity.kind)).toEqual([
      'plain',
      'plain',
    ]);
  });

  it('draws itself again from the store, so a new plain identity is offered for repair', async () => {
    const encrypted = await encryptIdentity(FIRST, PASSPHRASE, FAST_ITERATIONS);
    await addApplication({ label: 'Cifrada', identity: encrypted });

    const view = document.createElement('div');
    document.body.append(view);
    const section = await renderEncryption(view, () => Promise.resolve());
    expect(view.textContent).not.toContain(t('encryption.repair'));

    await seedLegacyPlain('Añadida después');
    await section.refresh();

    expect(view.textContent).toContain('Añadida después');
    expect(
      [...view.querySelectorAll('button')].map((candidate) => candidate.textContent),
    ).toContain(t('encryption.repair'));
  });
});

describe('the backup section', () => {
  async function importView(incoming: Store, mode: 'merge' | 'replace'): Promise<HTMLElement> {
    const view = document.createElement('div');
    document.body.append(view);
    const redraw = (): Promise<void> => {
      view.replaceChildren();
      renderBackup(view, redraw);
      return Promise.resolve();
    };
    await redraw();
    const input = view.querySelector<HTMLInputElement>('#import-file');
    const select = view.querySelector<HTMLSelectElement>('#backup-mode');
    if (input === null || select === null) throw new Error('Missing import controls');
    Object.defineProperty(input, 'files', {
      value: [{ text: () => Promise.resolve(exportStore(incoming)) }],
    });
    select.value = mode;
    return view;
  }

  it.each(['merge', 'replace'] as const)(
    'cancelling %s leaves all saved data untouched',
    async (mode) => {
      await addApplication({ label: 'Conservar', identity: FIRST });
      const before = await readStore();
      const view = await importView(emptyStore(), mode);
      confirmDialog.mockReturnValue(false);
      sectionButton(view, t('backup.import')).click();
      await vi.waitFor(() => expect(confirmDialog).toHaveBeenCalled());
      expect(await readStore()).toEqual(before);
      expect(view.textContent).not.toContain(t('backup.replaced'));
    },
  );

  it.each(['merge', 'replace'] as const)(
    'refuses plaintext %s into an encrypted store',
    async (mode) => {
      await addApplication({ label: 'Copia antigua', identity: FIRST });
      const incoming = await readStore();
      await updateIdentity(
        incoming.applications[0]?.id ?? '',
        await encryptIdentity(FIRST, PASSPHRASE, FAST_ITERATIONS),
      );
      const before = await readStore();
      const view = await importView(incoming, mode);
      sectionButton(view, t('backup.import')).click();
      await vi.waitFor(() => expect(view.textContent).toContain(t('backup.encryptionRequired')));
      expect(await readStore()).toEqual(before);
    },
  );

  it('replaces only after confirmation, redraws and requests lock and rescheduling', async () => {
    await addApplication({ label: 'Eliminar', identity: FIRST });
    const incoming = emptyStore();
    const send = vi.spyOn(browser.runtime, 'sendMessage');
    const view = await importView(incoming, 'replace');
    sectionButton(view, t('backup.import')).click();
    await vi.waitFor(() =>
      expect(view.querySelector('.backup + p[role="status"]')?.textContent).toBe(
        t('backup.replaced'),
      ),
    );
    expect(await readStore()).toEqual(incoming);
    expect(confirmDialog).toHaveBeenCalledWith(
      t('backup.confirmReplace', { applications: 1, checks: 0 }),
    );
    expect(send).toHaveBeenCalledWith({ type: 'naciocheck:lock' });
    expect(send).toHaveBeenCalledWith({ type: 'naciocheck:reschedule' });
  });

  it('does not overwrite a change made while the import confirmation is open', async () => {
    await addApplication({ label: 'Conservar', identity: FIRST });
    const view = await importView(emptyStore(), 'replace');
    let concurrent: Promise<unknown> = Promise.resolve();
    confirmDialog.mockImplementation(() => {
      concurrent = addApplication({ label: 'Guardada durante el diálogo', identity: SECOND });
      return true;
    });
    sectionButton(view, t('backup.import')).click();
    await vi.waitFor(() => expect(view.textContent).toContain(t('backup.changed')));
    await concurrent;
    expect((await readStore()).applications).toHaveLength(2);
  });

  it('exports the store as it is now and warns about a plain identity added since', async () => {
    const encrypted = await encryptIdentity(FIRST, PASSPHRASE, FAST_ITERATIONS);
    await addApplication({ label: 'Cifrada', identity: encrypted });

    const view = document.createElement('div');
    document.body.append(view);
    renderBackup(view, () => Promise.resolve());

    // jsdom has no download and no dialog: the question is answered here and the Blob is kept instead of being
    // handed to an anchor. Captured through `Reflect` because the lint rules call an extracted method one that
    // lost its object.
    const original: Record<string, unknown> = {
      confirm: Reflect.get(window, 'confirm'),
      createObjectURL: Reflect.get(URL, 'createObjectURL'),
      revokeObjectURL: Reflect.get(URL, 'revokeObjectURL'),
      click: Reflect.get(HTMLAnchorElement.prototype, 'click'),
    };
    let asked = 0;
    const files: Blob[] = [];
    confirmDialog.mockImplementation(() => {
      asked += 1;
      return true;
    });
    Reflect.set(URL, 'createObjectURL', (blob: Blob) => {
      files.push(blob);
      return 'blob:naciocheck-test';
    });
    Reflect.set(URL, 'revokeObjectURL', () => undefined);
    Reflect.set(HTMLAnchorElement.prototype, 'click', () => undefined);

    try {
      // In clear, and added after the section was drawn: this is the identity the warning is for.
      await seedLegacyPlain('Añadida después');
      sectionButton(view, t('backup.export')).click();

      const deadline = Date.now() + 5_000;
      while (files.length === 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      // Keep the object-URL mocks alive until the deferred browser cleanup has run.
      await new Promise((resolve) => setTimeout(resolve, 1_050));
    } finally {
      Reflect.set(window, 'confirm', original.confirm);
      Reflect.set(URL, 'createObjectURL', original.createObjectURL);
      Reflect.set(URL, 'revokeObjectURL', original.revokeObjectURL);
      Reflect.set(HTMLAnchorElement.prototype, 'click', original.click);
    }

    expect(asked).toBe(1);
    const [file] = files;
    if (file === undefined) throw new Error('The export produced no file');
    const backup = JSON.parse(await file.text()) as {
      store: { applications: Array<{ label: string }> };
    };
    expect(backup.store.applications.map((application) => application.label)).toEqual([
      'Cifrada',
      'Añadida después',
    ]);
  });
});
