import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { decryptIdentity, encryptIdentity } from '../src/core/crypto';
import { DEFAULT_LOCALE, setLocale, t } from '../src/core/i18n';
import {
  addApplication,
  appendCheck,
  type Application,
  getApplication,
  type PlainIdentity,
  readStore,
  type Store,
} from '../src/core/storage';
import { buildApplicationForm } from '../src/entrypoints/shared/application-form';

/**
 * The form's save path, with the one rule that matters for privacy: **when the store is encrypted, a new
 * application is stored encrypted too**. The passphrase is verified against an existing encrypted identity and
 * is not kept anywhere afterwards.
 *
 * Everything here is synthetic: no real NIE, no real birth date.
 */

const PASSPHRASE = 'frase de prueba';

/** Real iterations once, in `crypto.test.ts`; the seeded identity uses a fast count so the suite stays quick. */
const FAST_ITERATIONS = 1_000;

const EXISTING: PlainIdentity = {
  kind: 'plain',
  nie: 'X0000000X',
  birthDate: '1990-01-01',
  numero: 'R500001',
  year: '2015',
};

const NEW: PlainIdentity = {
  kind: 'plain',
  nie: 'Y0000001Y',
  birthDate: '1991-02-02',
  numero: 'R500002',
  year: '2016',
};

/** Puts one encrypted application in the store, which is what turns encryption on for the form. */
async function seedEncryptedApplication(): Promise<Application> {
  const identity = await encryptIdentity(EXISTING, PASSPHRASE, FAST_ITERATIONS);
  const application = await addApplication({ label: 'La de antes', identity });
  await appendCheck({
    applicationId: application.id,
    outcome: 'status',
    statusKey: 'abierto-registrado',
    raw: 'Abierto - Registrado.',
    subStatus: null,
  });
  return application;
}

function field(form: HTMLElement, id: string): HTMLInputElement | null {
  return form.querySelector<HTMLInputElement>(`#${id}`);
}

/** Fills the form the way a person would; the passphrase only if the form asks for one. */
function fill(
  form: HTMLElement,
  identity: PlainIdentity,
  label: string,
  passphrase?: string,
): void {
  const values: ReadonlyArray<readonly [string, string]> = [
    ['field-label', label],
    ['field-nie', identity.nie],
    ['field-numero', identity.numero],
    ['field-year', identity.year],
    ['field-birthDate', identity.birthDate],
  ];
  for (const [id, value] of values) {
    const input = field(form, id);
    if (input === null) throw new Error(`The form has no #${id}`);
    input.value = value;
  }

  const passphraseInput = field(form, 'field-passphrase');
  if (passphraseInput !== null && passphrase !== undefined) passphraseInput.value = passphrase;
}

function submit(form: HTMLElement): void {
  form.dispatchEvent(new Event('submit', { cancelable: true }));
}

/** Saving is asynchronous and the form returns nothing, so the store is polled. */
async function readStoreAfterSaves(expected: number): Promise<Store> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const store = await readStore();
    if (store.applications.length === expected) return store;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`The store never reached ${expected} applications`);
}

/** Every error the form is showing, in document order. */
function shownErrors(form: HTMLElement): string[] {
  return [...form.querySelectorAll('.error')]
    .filter((node) => !node.hasAttribute('hidden'))
    .map((node) => node.textContent ?? '');
}

beforeEach(async () => {
  setLocale(DEFAULT_LOCALE);
  await browser.storage.local.clear();
  document.body.replaceChildren();
});

describe('the application form', () => {
  it('settles a failed storage write with a recoverable error and no partial save', async () => {
    const form = await buildApplicationForm(() => undefined);
    document.body.append(form);
    fill(form, NEW, 'Prueba');
    const write = vi
      .spyOn(browser.storage.local, 'set')
      .mockRejectedValueOnce(new Error('storage failed'));
    try {
      submit(form);
      await vi.waitFor(() =>
        expect(form.querySelector('[role="alert"]')?.textContent).toBe(t('form.saveFailed')),
      );
      expect((await readStore()).applications).toHaveLength(0);
      await vi.waitFor(() =>
        expect(form.querySelector<HTMLButtonElement>('button.primary')?.disabled).toBe(false),
      );
    } finally {
      write.mockRestore();
    }
  });

  it('does not save duplicate applications when submitted twice before the first save finishes', async () => {
    let saves = 0;
    const form = await buildApplicationForm(() => {
      saves += 1;
    });
    document.body.append(form);
    fill(form, NEW, 'Prueba');
    submit(form);
    submit(form);
    await vi.waitFor(() => expect(saves).toBe(1));
    expect((await readStore()).applications).toHaveLength(1);
  });

  it('stores the new application encrypted when the store is already encrypted', async () => {
    await seedEncryptedApplication();
    const form = await buildApplicationForm(() => undefined);
    document.body.append(form);

    fill(form, NEW, 'La de ahora', PASSPHRASE);
    submit(form);

    const store = await readStoreAfterSaves(2);
    const added = store.applications[1];
    expect(added?.label).toBe('La de ahora');
    expect(added?.identity.kind).toBe('encrypted');
  });

  it('asks for the passphrase only when the store is encrypted', async () => {
    const plainForm = await buildApplicationForm(() => undefined);
    expect(field(plainForm, 'field-passphrase')).toBeNull();

    await seedEncryptedApplication();
    const encryptedForm = await buildApplicationForm(() => undefined);
    expect(field(encryptedForm, 'field-passphrase')).not.toBeNull();
  });

  it('saves nothing when the passphrase is wrong', async () => {
    await seedEncryptedApplication();
    const form = await buildApplicationForm(() => undefined);
    document.body.append(form);

    fill(form, NEW, 'La de ahora', 'no es la frase');
    submit(form);

    await new Promise((resolve) => setTimeout(resolve, 500));
    const store = await readStore();
    expect(store.applications).toHaveLength(1);
    expect(store.applications[0]?.label).toBe('La de antes');
    expect(shownErrors(form).join(' ')).toMatch(/no se ha guardado/);
  });

  it('does not keep the passphrase after a save', async () => {
    await seedEncryptedApplication();
    const form = await buildApplicationForm(() => undefined);
    document.body.append(form);

    fill(form, NEW, 'La de ahora', PASSPHRASE);
    submit(form);

    await readStoreAfterSaves(2);
    expect(field(form, 'field-passphrase')?.value).toBe('');
  });

  it('stores a plain identity when encryption is off', async () => {
    const form = await buildApplicationForm(() => undefined);
    document.body.append(form);

    fill(form, NEW, 'La primera');
    submit(form);

    const store = await readStoreAfterSaves(1);
    expect(store.applications[0]?.identity).toEqual(NEW);
  });

  it('still reports the field errors before it saves anything', async () => {
    await seedEncryptedApplication();
    const form = await buildApplicationForm(() => undefined);
    document.body.append(form);

    fill(form, NEW, '', PASSPHRASE);
    submit(form);

    await new Promise((resolve) => setTimeout(resolve, 200));
    const store = await readStore();
    expect(store.applications).toHaveLength(1);
    expect(shownErrors(form).join(' ')).toMatch(/nombre/i);
  });
});

/** The button that unlocks the identity fields of an encrypted application. */
function revealButton(form: HTMLElement): HTMLButtonElement {
  const found = [...form.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === t('form.revealIdentity'),
  );
  if (found === undefined) throw new Error('The edit form offers no way to reveal the identity');
  return found;
}

/** Polls a condition that the form settles asynchronously. */
async function waitFor(condition: () => boolean | Promise<boolean>, what: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Never happened: ${what}`);
}

async function waitForEdit(applicationId: string): Promise<Application> {
  let stored: Application | null = null;
  await waitFor(async () => {
    stored = await getApplication(applicationId);
    return stored?.editedAt !== undefined;
  }, 'the edit to be saved');
  if (stored === null) throw new Error('The application is gone');
  return stored;
}

describe('the application form in edit mode', () => {
  it('renames an encrypted application without the passphrase and keeps its identity and history', async () => {
    const application = await seedEncryptedApplication();
    const form = await buildApplicationForm(() => undefined, { application });
    document.body.append(form);

    // The identity is not shown at all until the passphrase opens it.
    expect(field(form, 'field-nie')?.disabled).toBe(true);
    expect(field(form, 'field-nie')?.value).toBe('');

    fill(form, NEW, 'La de ahora');
    submit(form);

    const stored = await waitForEdit(application.id);
    expect(stored.label).toBe('La de ahora');
    expect(stored.identity).toEqual(application.identity);
    await expect(readStore()).resolves.toMatchObject({
      checks: [{ applicationId: application.id }],
    });
  });

  it('keeps an encrypted identity locked when the passphrase is wrong', async () => {
    const application = await seedEncryptedApplication();
    const form = await buildApplicationForm(() => undefined, { application });
    document.body.append(form);

    const passphrase = field(form, 'field-passphrase');
    if (passphrase === null) throw new Error('The edit form asks for no passphrase');
    passphrase.value = 'no es la frase';
    revealButton(form).click();

    await waitFor(() => shownErrors(form).length > 0, 'the wrong-passphrase message');
    expect(shownErrors(form).join(' ')).toMatch(/no se ha guardado/);
    expect(field(form, 'field-nie')?.disabled).toBe(true);
    expect(field(form, 'field-nie')?.value).toBe('');
    await expect(getApplication(application.id)).resolves.toEqual(application);
  });

  it('shows the identity once the passphrase opens it, and re-encrypts the edit with it', async () => {
    const application = await seedEncryptedApplication();
    const form = await buildApplicationForm(() => undefined, { application });
    document.body.append(form);

    const passphrase = field(form, 'field-passphrase');
    if (passphrase === null) throw new Error('The edit form asks for no passphrase');
    passphrase.value = PASSPHRASE;
    revealButton(form).click();

    await waitFor(
      () => field(form, 'field-nie')?.disabled === false,
      'the identity to be revealed',
    );
    expect(field(form, 'field-nie')?.value).toBe(EXISTING.nie);

    const nie = field(form, 'field-nie');
    if (nie !== null) nie.value = 'Z0000002Z';
    submit(form);

    const stored = await waitForEdit(application.id);
    expect(stored.identity.kind).toBe('encrypted');
    if (stored.identity.kind !== 'encrypted') throw new Error('The identity was stored in clear');
    await expect(decryptIdentity(stored.identity, PASSPHRASE)).resolves.toEqual({
      ...EXISTING,
      nie: 'Z0000002Z',
    });
  });

  it('prefills and edits a plain application in the same form', async () => {
    const application = await addApplication({ label: 'Sin cifrar', identity: EXISTING });
    const form = await buildApplicationForm(() => undefined, { application });

    expect(field(form, 'field-nie')?.value).toBe(EXISTING.nie);
    expect(field(form, 'field-passphrase')).toBeNull();

    fill(form, NEW, 'Renombrada');
    submit(form);

    const stored = await waitForEdit(application.id);
    expect(stored).toMatchObject({ label: 'Renombrada', identity: NEW });
  });

  it('refuses the same invalid values as when adding', async () => {
    const application = await addApplication({ label: 'Sin cifrar', identity: EXISTING });
    const form = await buildApplicationForm(() => undefined, { application });

    fill(form, { ...NEW, nie: 'nada' }, 'Renombrada');
    submit(form);

    await waitFor(() => shownErrors(form).length > 0, 'the NIE error');
    expect(shownErrors(form).join(' ')).toMatch(/NIE/);
    await expect(getApplication(application.id)).resolves.toEqual(application);
  });
});
