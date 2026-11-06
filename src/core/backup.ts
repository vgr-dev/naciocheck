import { t } from './i18n';
import { type Store, migrateStore } from './storage';

/**
 * Export and import of everything, as a JSON file the user owns.
 *
 * Encrypted identities stay encrypted: the file never needs the passphrase, and importing does not decrypt
 * anything. When encryption is off, the caller warns first — see `hasPlainIdentities`.
 */

export const BACKUP_FORMAT = 'naciocheck-backup';

export interface Backup {
  format: typeof BACKUP_FORMAT;
  exportedAt: string;
  store: Store;
}

export function exportStore(store: Store): string {
  const backup: Backup = {
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    store,
  };
  return JSON.stringify(backup, null, 2);
}

/** Validates the wrapper, then hands the store to the schema check. Throws with a readable message. */
export function parseBackup(text: string): Store {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(t('backup.errorJson'));
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(t('backup.errorShape'));
  }
  const { format, store } = parsed as { format?: unknown; store?: unknown };
  if (format !== BACKUP_FORMAT) {
    throw new Error(t('backup.errorFormat'));
  }
  return migrateStore(store);
}

/** True when the store holds at least one identity in the clear, which is what an export would carry. */
export function hasPlainIdentities(store: Store): boolean {
  return store.applications.some((application) => application.identity.kind === 'plain');
}

/** Union by id: nothing already present is overwritten, so importing twice is harmless. */
export function mergeStores(current: Store, incoming: Store): Store {
  const applications = [...current.applications];
  for (const application of incoming.applications) {
    if (!applications.some((candidate) => candidate.id === application.id)) {
      applications.push(application);
    }
  }

  const checks = [...current.checks];
  for (const check of incoming.checks) {
    if (!checks.some((candidate) => candidate.id === check.id)) checks.push(check);
  }

  return { ...current, applications, checks };
}
