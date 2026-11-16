import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { encryptIdentity } from '../src/core/crypto';
import { addApplication, type PlainIdentity, readStore, type Store } from '../src/core/storage';
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
async function seedEncryptedApplication(): Promise<void> {
  const identity = await encryptIdentity(EXISTING, PASSPHRASE, FAST_ITERATIONS);
  await addApplication({ label: 'La de antes', identity });
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
  await browser.storage.local.clear();
  document.body.replaceChildren();
});

describe('the application form', () => {
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
