import { browser } from 'wxt/browser';
import { migrateStore } from '../../core/storage';
import { button, el } from './ui';

/**
 * The way out when the store cannot be read: a corrupt snapshot or one written by a newer schema.
 *
 * Nothing here writes until the person confirms a reset; downloading the raw data first is recommended. A version this
 * build does not understand is never "repaired" in place: it is shown, exported and only replaced on request.
 */

/** Must match `STORAGE_KEY` in `core/storage.ts`; the recovery path reads the raw value before validation. */
const RAW_STORE_KEY = 'naciocheck';

export const RAW_STORE_FILENAME = 'naciocheck-store-raw.json';

export interface RecoveryLabels {
  readonly title: string;
  readonly description: string;
  /** Receives the raw error message. */
  readonly error: (detail: string) => string;
  readonly download: string;
  readonly downloaded: string;
  readonly reset: string;
  readonly resetConfirm: string;
  readonly resetDone: string;
}

export interface RecoveryOptions {
  readonly labels: RecoveryLabels;
  /** The failure that brought the page here; its message is shown without being interpreted. */
  readonly error?: unknown;
  /** Runs after an explicit, confirmed reset, for example to reload the page. */
  readonly onReset?: () => void | Promise<void>;
  /** Test seam: replaces the browser download. */
  readonly download?: (filename: string, text: string) => void;
}

interface RawStore {
  readonly present: boolean;
  readonly value: unknown;
}

/** The stored value exactly as it is, without validation or normalisation. */
export async function readRawStore(): Promise<RawStore> {
  const found: Record<string, unknown> = await browser.storage.local.get(RAW_STORE_KEY);
  const value = found[RAW_STORE_KEY];
  // The fake storage used by the tests answers `{ key: undefined }` for an absent key.
  return { present: value !== undefined, value };
}

/** True only when a stored snapshot exists and this build's schema check rejects it. */
export async function isStoreRecoveryNeeded(): Promise<boolean> {
  const raw = await readRawStore();
  if (!raw.present) return false;
  try {
    migrateStore(raw.value);
    return false;
  } catch {
    return true;
  }
}

export async function renderStoreRecovery(
  view: HTMLElement,
  options: RecoveryOptions,
): Promise<void> {
  const { labels } = options;
  const raw = await readRawStore();

  view.replaceChildren();
  const panel = el('section', 'card recovery');
  panel.setAttribute('role', 'alert');
  panel.append(el('h1', 'title', labels.title), el('p', 'hint', labels.description));

  const detail = describeFailure(raw.value, options.error);
  if (detail !== null) {
    panel.append(el('p', 'hint recovery-error', labels.error(detail)));
  }

  const status = el('p', 'hint');
  status.setAttribute('role', 'status');

  const download = options.download ?? saveTextFile;
  panel.append(
    button(labels.download, () => {
      // `?? null` keeps a present-but-empty raw value printable; the stored bytes are not rewritten.
      download(RAW_STORE_FILENAME, JSON.stringify(raw.value ?? null, null, 2));
      status.textContent = labels.downloaded;
    }),
  );

  panel.append(
    button(
      labels.reset,
      () => {
        void (async () => {
          if (!window.confirm(labels.resetConfirm)) return;
          await browser.runtime.sendMessage({ type: 'naciocheck:lock' }).catch(() => undefined);
          await browser.storage.session.clear();
          await browser.storage.local.remove(RAW_STORE_KEY);
          status.textContent = labels.resetDone;
          if (options.onReset !== undefined) await options.onReset();
        })();
      },
      'button danger',
    ),
  );

  panel.append(status);
  view.append(panel);
}

function describeFailure(raw: unknown, error: unknown): string | null {
  if (error !== undefined) return messageOf(error);
  try {
    migrateStore(raw);
    return null;
  } catch (validationError) {
    return messageOf(validationError);
  }
}

/** The readable part of a thrown value, without letting a bare object print as `[object Object]`. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(error) ?? 'Unknown error';
}

function saveTextFile(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = el('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
