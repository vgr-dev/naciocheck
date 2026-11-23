import { browser } from 'wxt/browser';
import { DEFAULT_LANGUAGE, isLanguageSetting, type LanguageSetting } from './i18n';
import { DEFAULT_REMINDER, isValidReminder, type ReminderConfig } from './schedule';
import type { ResolvedStatusKey } from './statuses';
import { isValidEncryptedPayload } from './crypto';
import { filingDateError, isCalendarDate, isValidIdentity } from './validation';

/**
 * The local store: everything the extension knows lives in `storage.local` under a single key.
 *
 * The sync storage area is never touched — it would upload the NIE and the birth date to the vendor's
 * servers. See the hard boundaries in the plan and `scripts/check-privacy.mjs`.
 */

export const SCHEMA_VERSION = 1;

/** Single key, so a read is one round trip and a write replaces a consistent snapshot. */
const STORAGE_KEY = 'naciocheck';

/** One cross-context lock: the background worker and every extension page share the extension origin. */
const STORE_LOCK = 'naciocheck:store';

/** Identifying fields as the user typed them. */
export interface PlainIdentity {
  kind: 'plain';
  nie: string;
  birthDate: string;
  numero: string;
  year: string;
}

/** The envelope is validated structurally on read/import; authentication waits for the passphrase. */
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
  /**
   * When the label or the identity was last edited. Absent until the first edit, so no migration is needed:
   * the schema stays version 1 and an older snapshot simply has no marker (D6).
   */
  editedAt?: string;
  /** Optional calendar date when the application was filed. */
  filingDate?: string;
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
  /**
   * The sentence the page prints under the status, which is where the real progress of
   * *Abierto - En tramitación* lives; `null` when the page printed none.
   */
  subStatus: string | null;
  acknowledged: boolean;
}

/** The reminder and the language override; the encryption state lives in the identities themselves. */
export interface Settings {
  reminders: ReminderConfig;
  /** `auto` follows the browser; anything else is the user's choice in options. */
  language: LanguageSetting;
}

export interface Store {
  version: number;
  applications: Application[];
  checks: Check[];
  settings: Settings;
}

export function emptyStore(): Store {
  return {
    version: SCHEMA_VERSION,
    applications: [],
    checks: [],
    settings: { reminders: DEFAULT_REMINDER, language: DEFAULT_LANGUAGE },
  };
}

/**
 * Old snapshots predate the reminder and the language; nothing has been released, so this is normalisation, not
 * a migration. An unknown language falls back to `auto` instead of failing the whole store.
 */
function normaliseSettings(raw: unknown): Settings {
  const value = typeof raw === 'object' && raw !== null ? raw : {};
  const storedLanguage = (value as { language?: unknown }).language;
  const language: LanguageSetting = isLanguageSetting(storedLanguage)
    ? storedLanguage
    : DEFAULT_LANGUAGE;
  const reminders = (value as { reminders?: unknown }).reminders;
  if (
    typeof reminders === 'object' &&
    reminders !== null &&
    'enabled' in reminders &&
    'weekdays' in reminders &&
    'time' in reminders
  ) {
    const candidate = reminders as ReminderConfig;
    if (Array.isArray(candidate.weekdays) && isValidReminder(candidate)) {
      return { reminders: { ...candidate, enabled: candidate.enabled === true }, language };
    }
  }
  return { reminders: DEFAULT_REMINDER, language };
}

function createId(): string {
  return globalThis.crypto.randomUUID();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

/** Validates the identity that a backup or a previous build put in storage before we trust it. */
function validateIdentity(value: unknown, where: string): asserts value is Identity {
  if (!isRecord(value)) throw new Error(`${where}: identity is not an object`);
  if (value.kind === 'plain') {
    const { nie, birthDate, numero, year } = value;
    if (
      typeof nie !== 'string' ||
      typeof birthDate !== 'string' ||
      typeof numero !== 'string' ||
      typeof year !== 'string' ||
      nie.trim() === '' ||
      birthDate.trim() === '' ||
      numero.trim() === '' ||
      year.trim() === ''
    ) {
      throw new Error(`${where}: plain identity is missing fields`);
    }
    if (!isValidIdentity({ nie, birthDate, numero, year })) {
      throw new Error(`${where}: plain identity fields are invalid`);
    }
    return;
  }
  if (value.kind === 'encrypted') {
    if (!isNonEmptyString(value.payload) || !isValidEncryptedPayload(value.payload)) {
      throw new Error(`${where}: encrypted identity payload is invalid`);
    }
    return;
  }
  throw new Error(`${where}: identity kind is unknown`);
}

function validateApplication(value: unknown, index: number): asserts value is Application {
  const where = `application[${index}]`;
  if (!isRecord(value)) throw new Error(`${where}: not an object`);
  if (!isNonEmptyString(value.id)) throw new Error(`${where}: id is missing`);
  if (!isNonEmptyString(value.label)) throw new Error(`${where}: label is missing`);
  if (!isTimestamp(value.createdAt)) throw new Error(`${where}: createdAt is not a timestamp`);
  if (value.editedAt !== undefined && !isTimestamp(value.editedAt)) {
    throw new Error(`${where}: editedAt is not a timestamp`);
  }
  if (
    value.filingDate !== undefined &&
    (typeof value.filingDate !== 'string' || !isCalendarDate(value.filingDate))
  ) {
    throw new Error(`${where}: filingDate is not a real calendar date`);
  }
  validateIdentity(value.identity, where);
}

const CHECK_OUTCOMES: readonly CheckOutcome[] = ['status', 'error', 'unknown'];

function validateCheck(
  value: unknown,
  index: number,
  applicationIds: ReadonlySet<string>,
): asserts value is Check {
  const where = `check[${index}]`;
  if (!isRecord(value)) throw new Error(`${where}: not an object`);
  if (!isNonEmptyString(value.id)) throw new Error(`${where}: id is missing`);
  if (!isNonEmptyString(value.applicationId) || !applicationIds.has(value.applicationId)) {
    throw new Error(`${where}: application reference is missing`);
  }
  if (!isTimestamp(value.at)) throw new Error(`${where}: at is not a timestamp`);
  if (!CHECK_OUTCOMES.includes(value.outcome as CheckOutcome)) {
    throw new Error(`${where}: outcome is unknown`);
  }
  if (!isNonEmptyString(value.statusKey)) throw new Error(`${where}: statusKey is missing`);
  if (!isNonEmptyString(value.raw)) throw new Error(`${where}: raw text is missing`);
  if (value.subStatus !== null && typeof value.subStatus !== 'string') {
    throw new Error(`${where}: subStatus is invalid`);
  }
  if (typeof value.acknowledged !== 'boolean') {
    throw new Error(`${where}: acknowledged is invalid`);
  }
}

/**
 * Validates whatever was found in storage and brings it up to the current schema.
 *
 * Version 1 is the first schema, so the migration step is the identity function; the hook exists because
 * backup imports and every later schema change depend on it.
 */
export function migrateStore(raw: unknown): Store {
  if (!isRecord(raw)) {
    throw new Error('Stored data is not an object');
  }
  const version = raw.version;
  if (typeof version !== 'number') {
    throw new Error('Stored data has no schema version');
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('Stored data has no valid schema version');
  }
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `Stored data uses schema version ${version}, newer than this build supports (${SCHEMA_VERSION})`,
    );
  }
  if (!Array.isArray(raw.applications) || !Array.isArray(raw.checks)) {
    throw new Error('Stored data is missing applications or checks');
  }

  const applications: Application[] = [];
  const applicationIds = new Set<string>();
  for (const [index, value] of raw.applications.entries()) {
    validateApplication(value, index);
    if (applicationIds.has(value.id)) {
      throw new Error(`Stored data has a duplicate application id at index ${index}`);
    }
    applicationIds.add(value.id);
    applications.push(value);
  }

  const checks: Check[] = [];
  const checkIds = new Set<string>();
  for (const [index, value] of raw.checks.entries()) {
    validateCheck(value, index, applicationIds);
    if (checkIds.has(value.id)) {
      throw new Error(`Stored data has a duplicate check id at index ${index}`);
    }
    checkIds.add(value.id);
    checks.push(value);
  }

  return {
    version: SCHEMA_VERSION,
    applications,
    checks,
    settings: normaliseSettings(raw.settings),
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

/**
 * Serialises one read-modify-write of the whole store across the background worker and every extension page.
 *
 * The callback must not call another store mutator: Web Locks are not reentrant. It may be async (encryption
 * and import need it), and whatever it returns is validated before a single write replaces the snapshot.
 */
function storeLockManager(): LockManager {
  const locks = globalThis.navigator?.locks;
  if (locks === undefined) {
    throw new Error('Atomic storage updates require the Web Locks API');
  }
  return locks;
}

async function withStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  return storeLockManager().request(STORE_LOCK, operation);
}

export async function mutateStore(
  mutate: (current: Store) => Store | Promise<Store>,
): Promise<Store> {
  return withStoreLock(async () => {
    const current = await readStore();
    const next = await mutate(current);
    const validated = migrateStore(next);
    await writeStore(validated);
    return validated;
  });
}

/**
 * Replaces the whole store without reading it first, which is what an import or a recovery reset needs: the
 * previous snapshot may itself be corrupt, and the replacement still has to be valid before it is written.
 */
export async function replaceStore(store: Store): Promise<void> {
  await withStoreLock(async () => {
    await writeStore(migrateStore(store));
  });
}

export async function listApplications(): Promise<Application[]> {
  return (await readStore()).applications;
}

export async function getSettings(): Promise<Settings> {
  return (await readStore()).settings;
}

/** Replaces the reminder settings; the caller then asks the background to reschedule. */
export async function setReminder(config: ReminderConfig): Promise<void> {
  if (!isValidReminder(config)) throw new Error('Invalid reminder configuration');
  await mutateStore((store) => ({
    ...store,
    settings: { ...store.settings, reminders: config },
  }));
}

/** Stores the language override. Every page reads it on load, so no message is needed here. */
export async function setLanguage(language: LanguageSetting): Promise<void> {
  if (!isLanguageSetting(language)) throw new Error('Invalid language setting');
  await mutateStore((store) => ({
    ...store,
    settings: { ...store.settings, language },
  }));
}

export async function getApplication(id: string): Promise<Application | null> {
  const store = await readStore();
  return store.applications.find((application) => application.id === id) ?? null;
}

function hasEncryptedIdentity(store: Store): boolean {
  return store.applications.some((application) => application.identity.kind === 'encrypted');
}

/**
 * The at-rest promise is checked inside the lock, not only in the form: another page may have turned
 * encryption on between the form being drawn and the write. Only the explicit batch transaction may move a
 * store to plaintext, and it does so by returning a store with no encrypted identities at all.
 */
function assertPlainWriteAllowed(store: Store, identity: Identity): void {
  if (identity.kind === 'plain' && hasEncryptedIdentity(store)) {
    throw new Error('Cannot write a plain identity while the store has encrypted identities');
  }
}

export async function addApplication(input: {
  label: string;
  identity: Identity;
}): Promise<Application> {
  const application: Application = {
    id: createId(),
    label: input.label,
    identity: input.identity,
    createdAt: new Date().toISOString(),
  };
  await mutateStore((store) => {
    assertPlainWriteAllowed(store, input.identity);
    return { ...store, applications: [...store.applications, application] };
  });
  return application;
}

/** Rewrites one application's identity, which is how encryption is turned on or off. */
export async function updateIdentity(applicationId: string, identity: Identity): Promise<void> {
  await mutateStore((store) => {
    assertPlainWriteAllowed(store, identity);
    return {
      ...store,
      applications: store.applications.map((application) =>
        application.id === applicationId ? { ...application, identity } : application,
      ),
    };
  });
}

/**
 * Edits an application's label and/or its identity, and records when (D6).
 *
 * The history is deliberately untouched: checks belong to the application by id, and editing what identifies it
 * must not hide the checks already recorded. An id that is not in the store changes nothing at all.
 */
export async function updateApplication(
  applicationId: string,
  change: { label?: string; identity?: Identity },
): Promise<void> {
  await mutateStore((store) => {
    if (!store.applications.some((application) => application.id === applicationId)) {
      return store;
    }
    if (change.identity !== undefined) assertPlainWriteAllowed(store, change.identity);

    const editedAt = new Date().toISOString();
    const applications = store.applications.map((application) =>
      application.id === applicationId
        ? {
            ...application,
            ...(change.label === undefined ? {} : { label: change.label }),
            ...(change.identity === undefined ? {} : { identity: change.identity }),
            editedAt,
          }
        : application,
    );
    return { ...store, applications };
  });
}

/** Saves or clears the filing calendar date for one application. */
export async function setFilingDate(
  applicationId: string,
  filingDate: string | null,
): Promise<void> {
  await mutateStore((store) => {
    const application = store.applications.find((candidate) => candidate.id === applicationId);
    if (application === undefined) return store;
    const date = filingDate?.trim() ?? '';
    if (date !== '') {
      const earliestCheckAt = firstStatusCheckAt(
        store.checks.filter((check) => check.applicationId === applicationId),
      );
      const error = filingDateError(date, earliestCheckAt);
      if (error !== null) throw new Error(error);
    }
    const updated = { ...application };
    if (date === '') delete updated.filingDate;
    else updated.filingDate = date;
    return {
      ...store,
      applications: store.applications.map((candidate) =>
        candidate.id === applicationId ? updated : candidate,
      ),
    };
  });
}

/** Earliest successful status check timestamp, or null when none exists. */
export function firstStatusCheckAt(checks: readonly Check[]): string | null {
  return (
    checks
      .filter((check) => check.outcome === 'status')
      .map((check) => check.at)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null
  );
}

/** Deletes the application and every check that belongs to it — no orphan history is left behind. */
export async function deleteApplication(id: string): Promise<void> {
  await mutateStore((store) => ({
    ...store,
    applications: store.applications.filter((application) => application.id !== id),
    checks: store.checks.filter((check) => check.applicationId !== id),
  }));
}

/** Appends a check. There is deliberately no update or delete: the history is append-only. */
export async function appendCheck(input: {
  applicationId: string;
  outcome: CheckOutcome;
  statusKey: ResolvedStatusKey;
  raw: string;
  subStatus: string | null;
}): Promise<Check> {
  const check: Check = {
    id: createId(),
    applicationId: input.applicationId,
    at: new Date().toISOString(),
    outcome: input.outcome,
    statusKey: input.statusKey,
    raw: input.raw,
    subStatus: input.subStatus,
    acknowledged: false,
  };
  await mutateStore((store) => {
    const known = store.applications.some((application) => application.id === input.applicationId);
    if (!known) {
      throw new Error(`Cannot record a check for unknown application ${input.applicationId}`);
    }
    return { ...store, checks: [...store.checks, check] };
  });
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

/** The last status check recorded before `check`, which is what a change is measured against. */
export function latestStatusBefore(checks: readonly Check[], check: Check): Check | null {
  const index = checks.findIndex((candidate) => candidate.id === check.id);
  const before = index === -1 ? checks : checks.slice(0, index);
  return [...before].reverse().find((candidate) => candidate.outcome === 'status') ?? null;
}

/** The only mutation a check allows: marking the change alert as seen. Its content never changes. */
export async function acknowledgeCheck(id: string): Promise<void> {
  await mutateStore((store) => ({
    ...store,
    checks: store.checks.map((check) =>
      check.id === id ? { ...check, acknowledged: true } : check,
    ),
  }));
}
