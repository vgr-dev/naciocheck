import { expect } from '@wdio/globals';
import { openExtensionContext } from './extension';

/**
 * Seeding for the E2E suite.
 *
 * Applications are added through the real options form — the path a person takes — and only the states the
 * UI cannot reach quickly (a previous check, a locked session, an empty store) are written straight into the
 * extension's own storage, from one of the extension's own pages.
 *
 * Every identity here is invented and format-valid: the repository and everything it produces are public, so
 * no real NIE or birth date may appear in the suite, its fixtures, its logs or its screenshots.
 */

export interface FakeIdentity {
  readonly label: string;
  readonly nie: string;
  readonly numero: string;
  readonly year: string;
  readonly birthDate: string;
}

export const FIRST_APPLICATION: FakeIdentity = {
  label: 'Solicitud uno',
  nie: 'X0000000X',
  numero: 'R500001',
  year: '2015',
  birthDate: '1990-01-01',
};

export const SECOND_APPLICATION: FakeIdentity = {
  label: 'Solicitud dos',
  nie: 'Y0000001Y',
  numero: 'R500002',
  year: '2016',
  birthDate: '1991-02-02',
};

/** Long enough for the form's own minimum, and only ever used by a fake store. */
export const PASSPHRASE = 'una contrasena de prueba';

export interface StoredIdentity {
  readonly kind: 'plain' | 'encrypted';
}

export interface StoredApplication {
  readonly id: string;
  readonly label: string;
  readonly identity: StoredIdentity;
  readonly createdAt: string;
}

export interface StoredCheck {
  readonly id: string;
  readonly applicationId: string;
  readonly at: string;
  readonly outcome: 'status' | 'error' | 'unknown';
  readonly statusKey: string;
  readonly raw: string;
  readonly subStatus: string | null;
  readonly acknowledged: boolean;
}

export interface StoredSettings {
  readonly reminders: {
    readonly enabled: boolean;
    readonly weekdays: readonly number[];
    readonly time: string;
  };
  readonly language: string;
}

export interface StoredStore {
  readonly version: number;
  readonly applications: readonly StoredApplication[];
  readonly checks: readonly StoredCheck[];
  readonly settings: StoredSettings;
}

/**
 * The part of the extension API the seeding uses. Declared here because the suite drives a browser, not an
 * extension build, and the values it passes are the ones the extension already understands.
 */
interface ExtensionApi {
  readonly runtime: { sendMessage(message: unknown): Promise<unknown> };
  readonly storage: {
    readonly local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(key: string): Promise<void>;
    };
  };
}

/** One of the extension's own pages, in the tab the seeding keeps using. */
async function openExtensionPage(
  page: 'options.html' | 'popup.html',
): Promise<WebdriverIO.BrowsingContext> {
  const context = await openExtensionContext(page);
  await expect(context.$('#app')).toBeExisting();
  return context;
}

/**
 * An empty store, fixed to Spanish so the suite can assert on the text a Spanish user sees.
 *
 * The background reads storage on every message, so nothing has to be told about the reset.
 */
export async function resetExtensionStorage(): Promise<void> {
  const context = await openExtensionPage('popup.html');
  await context.execute(() => {
    const api = (globalThis as { chrome?: ExtensionApi }).chrome;
    if (api === undefined) throw new Error('This page has no extension API: it is not one of ours');
    return api.storage.local.set({
      naciocheck: { version: 1, applications: [], checks: [], settings: { language: 'es' } },
    });
  });
}

/** Adds one application through the real form and waits for its asynchronous save before navigating. */
export async function addApplicationThroughUi(identity: FakeIdentity): Promise<void> {
  const context = await openExtensionPage('options.html');

  const form = context.$('form.fields:has(#field-label)');
  await form.$('#field-label').setValue(identity.label);
  await form.$('#field-nie').setValue(identity.nie);
  await form.$('#field-numero').setValue(identity.numero);
  await form.$('#field-year').setValue(identity.year);
  await form.$('#field-birthDate').setValue(identity.birthDate);
  await form.$('button.primary').click();

  await browser.waitUntil(
    async () => {
      const confirmation = context.$('p.saved');
      return (
        (await confirmation.isExisting()) && (await confirmation.getText()).includes(identity.label)
      );
    },
    { timeoutMsg: 'The application save was not confirmed' },
  );

  await context.refresh();
  await expect(context.$('ul.apps')).toBeExisting();

  const labels: string[] = [];
  for (const card of await context.$$('ul.apps .app-card .label')) {
    labels.push((await card.getText()).trim());
  }
  expect(labels).toContain(identity.label);
}

/** Turns encryption on from the options section, which is the only path a user has. */
export async function enableEncryptionThroughUi(passphrase: string): Promise<void> {
  const context = await openExtensionPage('options.html');
  await context.$('#passphrase').setValue(passphrase);
  await context.$('#passphrase-repeat').setValue(passphrase);
  await context.$('button=Cifrar los datos').click();
  // The section redraws as the "encryption is on" variant once the store has no plain identity left.
  await expect(context.$('button=Quitar el cifrado')).toBeExisting();
}

/** Forgets the passphrase the background keeps in session memory, so the next run has to ask for it. */
export async function lockExtensionSession(): Promise<void> {
  const context = await openExtensionPage('options.html');
  await context.execute(async () => {
    const api = (globalThis as { chrome?: ExtensionApi }).chrome;
    if (api === undefined) throw new Error('This page has no extension API: it is not one of ours');
    await api.runtime.sendMessage({ type: 'naciocheck:lock' });
  });
}

/**
 * Records one earlier status for an application, with the dev helper the background already ships.
 *
 * A test that wants a transition would otherwise have to run a whole check first; this only writes the check
 * the user would have got from that run.
 */
export async function seedPreviousCheck(
  label: string,
  raw: string,
  subStatus: string | null,
): Promise<void> {
  const context = await openExtensionPage('options.html');
  await context.execute(
    async (targetLabel, rawStatus, rawSubStatus) => {
      const api = (globalThis as { chrome?: ExtensionApi }).chrome;
      if (api === undefined)
        throw new Error('This page has no extension API: it is not one of ours');

      const stored = await api.storage.local.get('naciocheck');
      const store = stored.naciocheck as
        { applications?: ReadonlyArray<{ id: string; label: string }> } | undefined;
      const application = store?.applications?.find((entry) => entry.label === targetLabel);
      if (application === undefined) {
        throw new Error(`No stored application is labelled ${targetLabel}`);
      }

      // The helper is inert unless this flag is set by hand, which is exactly what a test does here.
      await api.storage.local.set({ 'naciocheck:dev:enabled': true });
      await api.runtime.sendMessage({
        type: 'naciocheck:dev:seed-check',
        applicationId: application.id,
        raw: rawStatus,
        subStatus: rawSubStatus,
      });
      await api.storage.local.remove('naciocheck:dev:enabled');
    },
    label,
    raw,
    subStatus,
  );
}

/** The store as the extension saved it, read from one of its own pages: never inferred from the UI. */
export async function readStoredStore(): Promise<StoredStore> {
  const context = await openExtensionPage('options.html');
  const store = await context.execute(async () => {
    const api = (globalThis as { chrome?: ExtensionApi }).chrome;
    if (api === undefined) throw new Error('This page has no extension API: it is not one of ours');
    const stored = await api.storage.local.get('naciocheck');
    return stored.naciocheck ?? null;
  });
  if (store === null || typeof store !== 'object') {
    throw new Error('The extension has no store to read');
  }
  return store as StoredStore;
}

/**
 * The store exactly as the extension wrote it, as text.
 *
 * What a test greps for a value that must not be there any more: a NIE or a birth date that encryption is
 * supposed to have taken out of reach cannot be asserted on a parsed identity alone.
 */
export async function readStoredStoreText(): Promise<string> {
  const context = await openExtensionPage('options.html');
  const text = await context.execute(async () => {
    const api = (globalThis as { chrome?: ExtensionApi }).chrome;
    if (api === undefined) throw new Error('This page has no extension API: it is not one of ours');
    const stored = await api.storage.local.get('naciocheck');
    return JSON.stringify(stored.naciocheck ?? null);
  });
  return String(text);
}

/**
 * Puts every stored date at a fixed moment.
 *
 * The pages print when an application was added and when it was checked, and the app stamps those with the
 * clock. A screenshot of one would differ on every run, so the screenshot suite calls this after seeding and
 * gets images that only change when the interface does.
 */
export async function freezeStoredDates(): Promise<void> {
  const context = await openExtensionPage('options.html');
  await context.execute(async () => {
    const api = (globalThis as { chrome?: ExtensionApi }).chrome;
    if (api === undefined) throw new Error('This page has no extension API: it is not one of ours');

    const stored = await api.storage.local.get('naciocheck');
    const store = stored.naciocheck as
      | {
          applications: Array<{ createdAt: string; editedAt?: string }>;
          checks: Array<{ at: string }>;
        }
      | undefined;
    if (store === undefined) throw new Error('The extension has no store to freeze');

    const day = (index: number): string => String(index + 1).padStart(2, '0');
    store.applications = store.applications.map((application, index) => ({
      ...application,
      createdAt: `2026-01-${day(index)}T09:00:00.000Z`,
      ...(application.editedAt === undefined
        ? {}
        : { editedAt: `2026-01-${day(index)}T10:00:00.000Z` }),
    }));
    store.checks = store.checks.map((check, index) => ({
      ...check,
      at: `2026-02-${day(index)}T09:30:00.000Z`,
    }));
    await api.storage.local.set({ naciocheck: store });
  });
}

/**
 * Stores a language choice and reloads nothing: the caller refreshes the page it is on.
 *
 * For `qps`, the pseudo-RTL locale that exists only to prove the layout survives a right-to-left direction and
 * that the options select deliberately does not offer.
 */
export async function setStoredLanguage(language: string): Promise<void> {
  const context = await openExtensionPage('options.html');
  await context.execute(async (value: string) => {
    const api = (globalThis as { chrome?: ExtensionApi }).chrome;
    if (api === undefined) throw new Error('This page has no extension API: it is not one of ours');
    const stored = await api.storage.local.get('naciocheck');
    const store = stored.naciocheck as { settings?: { language?: string } } | undefined;
    if (store === undefined) throw new Error('The extension has no store to change');
    await api.storage.local.set({
      naciocheck: { ...store, settings: { ...store.settings, language: value } },
    });
  }, language);
}

/**
 * The content script's fallback switch (`DEV_FLAG_KEY` in `src/entrypoints/content.ts`): with it on, the page
 * keeps its whole form and the hint says the query has to be sent by hand. A test turns it off again.
 */
export async function setFallbackSwitch(enabled: boolean): Promise<void> {
  const context = await openExtensionPage('options.html');
  await context.execute(async (value: boolean) => {
    const api = (globalThis as { chrome?: ExtensionApi }).chrome;
    if (api === undefined) throw new Error('This page has no extension API: it is not one of ours');
    if (value) await api.storage.local.set({ 'naciocheck:dev:no-captcha-only': true });
    else await api.storage.local.remove('naciocheck:dev:no-captcha-only');
  }, enabled);
}
