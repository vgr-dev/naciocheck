import { browser } from 'wxt/browser';
import type { ResolvedStatusKey } from './statuses';

/**
 * The local store: everything the extension knows lives in `storage.local` under a single key.
 *
 * The sync storage area is never touched — it would upload the NIE and the birth date to the vendor's
 * servers. See the hard boundaries in the plan and `scripts/check-privacy.mjs`.
 */

export const SCHEMA_VERSION = 1;

/** Single key, so a read is one round trip and a write replaces a consistent snapshot. */
const STORAGE_KEY = 'naciocheck';

/** Identifying fields as the user typed them. */
export interface PlainIdentity {
  kind: 'plain';
  nie: string;
  birthDate: string;
  numero: string;
  year: string;
}

/** Phase 8 defines what goes inside `payload`; until then it is stored and moved around untouched. */
export interface EncryptedIdentity {
  kind: 'encrypted';
  payload: string;
}

export type Identity = PlainIdentity | EncryptedIdentity;

export interface Application {
  id: string;
  label: string;
  identity: Identity;
  createdAt: string;
}

/** `unknown` means the page was not recognised: not a status, but not a captcha or data error either. */
export type CheckOutcome = 'status' | 'error' | 'unknown';

export interface Check {
  id: string;
  applicationId: string;
  /** ISO 8601 timestamp of when the check was recorded. */
  at: string;
  outcome: CheckOutcome;
  statusKey: ResolvedStatusKey;
  /** The status text exactly as the page showed it. */
  raw: string;
  acknowledged: boolean;
}

/**
 * Intentionally empty for now: Phase 7 adds the reminder settings and Phase 8 the encryption flag. Widening
 * this type is a schema change and needs a migration.
 */
export type Settings = Record<string, never>;

export interface Store {
  version: number;
  applications: Application[];
  checks: Check[];
  settings: Settings;
}

export function emptyStore(): Store {
  return { version: SCHEMA_VERSION, applications: [], checks: [], settings: {} };
}

function createId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Validates whatever was found in storage and brings it up to the current schema.
 *
 * Version 1 is the first schema, so the migration step is the identity function; the hook exists because
 * imports (Phase 8) and every later schema change depend on it.
 */
export function migrateStore(raw: unknown): Store {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('Stored data is not an object');
  }
  const candidate = raw as Partial<Store>;
  if (typeof candidate.version !== 'number') {
    throw new Error('Stored data has no schema version');
  }
  if (candidate.version > SCHEMA_VERSION) {
    throw new Error(
      `Stored data uses schema version ${candidate.version}, newer than this build supports (${SCHEMA_VERSION})`,
    );
  }
  if (!Array.isArray(candidate.applications) || !Array.isArray(candidate.checks)) {
    throw new Error('Stored data is missing applications or checks');
  }
  return {
    version: SCHEMA_VERSION,
    applications: candidate.applications,
    checks: candidate.checks,
    settings: candidate.settings ?? {},
  };
}

export async function readStore(): Promise<Store> {
  const found = await browser.storage.local.get(STORAGE_KEY);
  const raw = found[STORAGE_KEY];
  if (raw === undefined) return emptyStore();
  return migrateStore(raw);
}

async function writeStore(store: Store): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: store });
}

export async function listApplications(): Promise<Application[]> {
  return (await readStore()).applications;
}

export async function getApplication(id: string): Promise<Application | null> {
  const store = await readStore();
  return store.applications.find((application) => application.id === id) ?? null;
}

export async function addApplication(input: {
  label: string;
  identity: Identity;
}): Promise<Application> {
  const store = await readStore();
  const application: Application = {
    id: createId(),
    label: input.label,
    identity: input.identity,
    createdAt: new Date().toISOString(),
  };
  await writeStore({ ...store, applications: [...store.applications, application] });
  return application;
}

/** Deletes the application and every check that belongs to it — no orphan history is left behind. */
export async function deleteApplication(id: string): Promise<void> {
  const store = await readStore();
  await writeStore({
    ...store,
    applications: store.applications.filter((application) => application.id !== id),
    checks: store.checks.filter((check) => check.applicationId !== id),
  });
}

/** Appends a check. There is deliberately no update or delete: the history is append-only. */
export async function appendCheck(input: {
  applicationId: string;
  outcome: CheckOutcome;
  statusKey: ResolvedStatusKey;
  raw: string;
}): Promise<Check> {
  const store = await readStore();
  const known = store.applications.some((application) => application.id === input.applicationId);
  if (!known) {
    throw new Error(`Cannot record a check for unknown application ${input.applicationId}`);
  }
  const check: Check = {
    id: createId(),
    applicationId: input.applicationId,
    at: new Date().toISOString(),
    outcome: input.outcome,
    statusKey: input.statusKey,
    raw: input.raw,
    acknowledged: false,
  };
  await writeStore({ ...store, checks: [...store.checks, check] });
  return check;
}

/** Checks of one application, in the order they were recorded. */
export async function listChecks(applicationId: string): Promise<Check[]> {
  const store = await readStore();
  return store.checks.filter((check) => check.applicationId === applicationId);
}

/** The most recently recorded check of an application, whatever its outcome. */
export async function latestCheck(applicationId: string): Promise<Check | null> {
  const checks = await listChecks(applicationId);
  return checks.at(-1) ?? null;
}

/** The only mutation a check allows: marking the change alert as seen. Its content never changes. */
export async function acknowledgeCheck(id: string): Promise<void> {
  const store = await readStore();
  const checks = store.checks.map((check) =>
    check.id === id ? { ...check, acknowledged: true } : check,
  );
  await writeStore({ ...store, checks });
}
