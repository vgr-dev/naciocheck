import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { encryptIdentity } from '../src/core/crypto';
import { DEFAULT_LOCALE, setLocale, t } from '../src/core/i18n';
import {
  addApplication,
  appendCheck,
  listApplications,
  listChecks,
  type PlainIdentity,
} from '../src/core/storage';
import { renderEncryption } from '../src/entrypoints/shared/encryption-sections';

/**
 * The repair path of the encryption section: a store that ended up mixed — some applications encrypted, some
 * written in clear — must be fixable from options, without losing a single check.
 *
 * Synthetic values only.
 */

const PASSPHRASE = 'frase de prueba';
const FAST_ITERATIONS = 1_000;

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
  const one = await addApplication({ label: 'Cifrada', identity: encrypted });
  const other = await addApplication({ label: 'Sin cifrar', identity: SECOND });

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

beforeEach(async () => {
  setLocale(DEFAULT_LOCALE);
  await browser.storage.local.clear();
  document.body.replaceChildren();
});

describe('the encryption section', () => {
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
