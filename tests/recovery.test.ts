import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { SCHEMA_VERSION } from '../src/core/storage';
import {
  isStoreRecoveryNeeded,
  RAW_STORE_FILENAME,
  type RecoveryLabels,
  renderStoreRecovery,
} from '../src/entrypoints/shared/recovery';

/** Synthetic values only. */
const STORE_KEY = 'naciocheck';

const CORRUPT = {
  version: SCHEMA_VERSION,
  applications: 'not-an-array',
  checks: [],
};

const NEWER = {
  version: SCHEMA_VERSION + 99,
  applications: [],
  checks: [],
  settings: {
    reminders: { enabled: false, weekdays: [1], time: '09:00' },
    language: 'auto',
  },
};

const LABELS: RecoveryLabels = {
  title: 'Cannot read the stored data',
  description: 'The data is still here and has not been changed.',
  error: (detail) => `Details: ${detail}`,
  download: 'Download the stored data',
  downloaded: 'A copy was downloaded.',
  reset: 'Delete the stored data',
  resetConfirm: 'Delete all stored data?',
  resetDone: 'The data was deleted.',
};

async function storedValue(): Promise<unknown> {
  const found: Record<string, unknown> = await browser.storage.local.get(STORE_KEY);
  return found[STORE_KEY];
}

function view(): HTMLElement {
  const element = document.getElementById('app');
  if (element === null) throw new Error('missing #app');
  return element;
}

function control(text: string): HTMLButtonElement {
  const found = [...view().querySelectorAll('button')].find(
    (candidate) => candidate.textContent === text,
  );
  if (found === undefined) throw new Error(`no button “${text}”`);
  return found;
}

/** The click handlers start async work; let the fake storage replies settle. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await browser.storage.local.clear();
  await browser.storage.session.clear();
  document.body.innerHTML = '<main id="app"></main>';
  vi.restoreAllMocks();
});

describe('isStoreRecoveryNeeded', () => {
  it('is false for an absent store and for a store this build understands', async () => {
    await expect(isStoreRecoveryNeeded()).resolves.toBe(false);

    await browser.storage.local.set({
      [STORE_KEY]: { version: SCHEMA_VERSION, applications: [], checks: [] },
    });

    await expect(isStoreRecoveryNeeded()).resolves.toBe(false);
  });

  it('is true for a corrupt snapshot and for a newer schema', async () => {
    await browser.storage.local.set({ [STORE_KEY]: CORRUPT });
    await expect(isStoreRecoveryNeeded()).resolves.toBe(true);

    await browser.storage.local.set({ [STORE_KEY]: NEWER });
    await expect(isStoreRecoveryNeeded()).resolves.toBe(true);
  });
});

describe('renderStoreRecovery', () => {
  it('shows the error and preserves the corrupt data until the person decides', async () => {
    await browser.storage.local.set({ [STORE_KEY]: CORRUPT });
    const download = vi.fn();

    await renderStoreRecovery(view(), { labels: LABELS, download });

    expect(view().textContent).toContain(LABELS.title);
    expect(view().textContent).toContain('missing applications or checks');
    expect(await storedValue()).toEqual(CORRUPT);

    control(LABELS.download).click();

    expect(download).toHaveBeenCalledWith(RAW_STORE_FILENAME, JSON.stringify(CORRUPT, null, 2));
    expect(view().textContent).toContain(LABELS.downloaded);
    expect(await storedValue()).toEqual(CORRUPT);
  });

  it('does not touch a newer schema and does not reset when the confirmation is cancelled', async () => {
    await browser.storage.local.set({ [STORE_KEY]: NEWER });
    await browser.storage.session.set({ 'naciocheck:unlock': 'synthetic session phrase' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onReset = vi.fn();

    await renderStoreRecovery(view(), { labels: LABELS, onReset });

    expect(view().textContent).toContain(`newer than this build supports`);
    expect(await storedValue()).toEqual(NEWER);

    control(LABELS.reset).click();
    await settle();

    expect(confirm).toHaveBeenCalledWith(LABELS.resetConfirm);
    expect(await storedValue()).toEqual(NEWER);
    expect(onReset).not.toHaveBeenCalled();
    expect(await browser.storage.session.get('naciocheck:unlock')).toEqual({
      'naciocheck:unlock': 'synthetic session phrase',
    });
  });

  it('resets only after an explicit confirmation and then reports it', async () => {
    await browser.storage.local.set({ [STORE_KEY]: CORRUPT });
    await browser.storage.session.set({ 'naciocheck:unlock': 'synthetic session phrase' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onReset = vi.fn();

    await renderStoreRecovery(view(), { labels: LABELS, onReset });

    control(LABELS.reset).click();
    await settle();

    expect(await storedValue()).toBeUndefined();
    expect(view().textContent).toContain(LABELS.resetDone);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(await browser.storage.session.get()).toEqual({});
  });
});
