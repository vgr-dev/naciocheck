import { browser } from 'wxt/browser';
if (location.protocol === 'chrome-extension:') void fetch('https://example.com/');
import { buildErrorView, buildResultView, decideAlert } from '../core/alerts';
import { detectAnomaly } from '../core/anomaly';
import { evaluateChange } from '../core/changes';
import { decryptIdentity } from '../core/crypto';
import { currentLocale, resolveLocaleCode, setLocale, t } from '../core/i18n';
import { isExtensionMessage } from '../core/messages';
import type { ParseOutcome } from '../core/parser';
import type { ReportCheck } from '../core/report';
import { nextRunWhen } from '../core/schedule';
import { statusKeyOf } from '../core/statuses';
import {
  acknowledgeCheck,
  appendCheck,
  type Application,
  getApplication,
  getSettings,
  latestCheck,
  latestStatusBefore,
  listApplications,
  type PlainIdentity,
  readStore,
  type Store,
} from '../core/storage';

/**
 * Orchestrates a "check run": a compact window per application, like the official flow but with only the
 * captcha visible. Nothing about the application travels in the URL — the background keeps it per tab id.
 *
 * Reminders and the popup start a run through a `naciocheck:start-check-run` message.
 */

const SEDE_URL = 'https://sede.mjusticia.gob.es/eConsultas/inicioNacionalidad';
const STORE_KEY = 'naciocheck';
const RUN_KEY = 'naciocheck:run';
const FILLS_KEY = 'naciocheck:fills';
const PENDING_SELECTION_KEY = 'naciocheck:pending-selection';
const PENDING_TAB_KEY = 'naciocheck:pending-tab';
const RESULT_KEY_PREFIX = 'naciocheck:result:';
const NOTIFICATION_PREFIX = 'naciocheck:change:';
const DEV_FLAG_KEY = 'naciocheck:dev:enabled';
const REMINDER_ALARM = 'naciocheck:reminder';
const REMINDER_NOTIFICATION = 'naciocheck:reminder';
/** Session storage only: the passphrase never reaches disk and disappears when the browser closes. */
const UNLOCK_KEY = 'naciocheck:unlock';

/**
 * The check window. It has to hold reCAPTCHA's challenge panel, which does not shrink: at 520 px the challenge
 * was clipped, and 700 px fits it on a 1440p screen without the window looking like a whole browser. Height
 * leaves room for the hint strip plus a challenge of ~580 px.
 */
const WINDOW_WIDTH = 700;
const WINDOW_HEIGHT = 760;

interface RunState {
  /** Identifies this run, so a result from an earlier run cannot advance the current queue. */
  id: string;
  /** Application ids still to check, first one first. */
  queue: string[];
}

type FillMap = Record<string, string>;

interface ResultPayload {
  view: ReturnType<typeof buildResultView>;
  applicationId: string;
  checkId: string | null;
  acknowledged: boolean;
  hasNext: boolean;
  /** Empty for a result reopened from history, which is not part of a live run. */
  runId: string;
  /**
   * The only two fields of a check a problem report may carry; never `raw`, `subStatus` or anything from the
   * identity. `null` when there is no check to report on (a deleted application, a failed save).
   */
  report: ReportCheck | null;
}

/** Tabs with a Continue message in flight, so a second click cannot shift the queue twice. */
const continuing = new Set<number>();

/** One outstanding sync at a time: storage changes arrive in bursts and each one would rescan the store. */
let syncing: Promise<void> | null = null;
/** A change that arrived while a sync was running asks for one more pass, so the badge never misses it. */
let syncAgain = false;

export default defineBackground(() => {
  void applyStoredLocale().catch(() => undefined);
  void syncOutstandingState();

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    // Always answer: a sender that waits for a reply must not hang when a check throws.
    void respond(message, sender.tab?.id).then(sendResponse, () => {
      sendResponse(null);
    });
    return true;
  });

  browser.runtime.onInstalled.addListener((details) => {
    void handleInstalled(details.reason);
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    void handleAlarm(alarm.name);
  });

  browser.notifications.onClicked.addListener((notificationId) => {
    void handleNotificationClick(notificationId);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void cleanupTab(tabId);
  });

  // Imports, deletes and edits change the store from other pages. Deriving the badge and pruning state here
  // keeps it correct without every writer having to know about the badge.
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !(STORE_KEY in changes)) return;
    void syncOutstandingState();
  });

  void rescheduleReminder().catch(() => undefined);
});

/** First install opens the onboarding; every install reschedules the reminder. */
async function handleInstalled(reason: string): Promise<void> {
  await rescheduleReminder();
  if (reason === 'install') {
    await browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
  }
}

/** The background prints notifications and result views, so it needs the locale in force before it builds them. */
async function applyStoredLocale(): Promise<void> {
  const { language } = await getSettings();
  setLocale(resolveLocaleCode(language, browser.i18n.getUILanguage()));
}

export async function handleAlarm(name: string): Promise<void> {
  if (name !== REMINDER_ALARM) return;
  await applyStoredLocale();
  try {
    await browser.notifications.create(REMINDER_NOTIFICATION, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: t('notify.reminderTitle'),
      message: t('notify.reminderMessage'),
      priority: 2,
    });
  } catch {
    // A notification that cannot be shown must not stop tomorrow's reminder below.
  } finally {
    await rescheduleReminder();
  }
}

/** Clicking the reminder starts a run for every saved application; a change notification reopens its check. */
async function handleNotificationClick(notificationId: string): Promise<void> {
  if (notificationId === REMINDER_NOTIFICATION) {
    await browser.notifications.clear(notificationId);
    await startCheckRun();
    return;
  }
  if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;
  const checkId = notificationId.slice(NOTIFICATION_PREFIX.length);
  if (checkId === '') return;
  await browser.notifications.clear(notificationId);
  await browser.tabs.create({
    url: browser.runtime.getURL(`/result.html?check=${encodeURIComponent(checkId)}`),
  });
}

/** Recomputes the single reminder alarm from the stored settings. */
async function rescheduleReminder(): Promise<void> {
  await browser.alarms.clear(REMINDER_ALARM);
  const { reminders } = await getSettings();
  const when = nextRunWhen(reminders, new Date());
  if (when !== null) {
    await browser.alarms.create(REMINDER_ALARM, { when });
  }
}

async function respond(message: unknown, tabId: number | undefined): Promise<unknown> {
  if (!isExtensionMessage(message)) return null;

  switch (message.type) {
    case 'naciocheck:request-fill':
      return tabId === undefined ? null : fillFor(tabId);
    case 'naciocheck:page-outcome':
      if (tabId === undefined) return null;
      await handleOutcome(message.outcome, tabId);
      return { received: true };
    case 'naciocheck:start-check-run':
      await startCheckRun(message.applicationIds);
      return { started: true };
    case 'naciocheck:result-request':
      return tabId === undefined ? null : resultFor(tabId, message.checkId);
    case 'naciocheck:acknowledge':
      await acknowledgeChange(message.checkId);
      return { acknowledged: true };
    case 'naciocheck:retry':
      if (tabId === undefined) return null;
      await retryApplication(message.applicationId, tabId);
      return { retried: true };
    case 'naciocheck:continue':
      if (tabId === undefined) return null;
      return { continued: await continueRun(tabId) };
    case 'naciocheck:reschedule':
      await rescheduleReminder();
      return { scheduled: true };
    case 'naciocheck:unlock': {
      const unlocked = await unlock(message.passphrase);
      return { unlocked, applicationIds: unlocked ? await getPendingSelection() : null };
    }
    case 'naciocheck:lock':
      await lockSession();
      return { locked: true };
    case 'naciocheck:session-state':
      return { unlocked: (await getUnlockPassphrase()) !== null };
    case 'naciocheck:dev:seed-check':
      if (!(await devModeEnabled())) return { seeded: false };
      await appendCheck({
        applicationId: message.applicationId,
        outcome: 'status',
        statusKey: statusKeyOf(message.raw),
        raw: message.raw,
        subStatus: message.subStatus ?? null,
      });
      return { seeded: true };
    default:
      return null;
  }
}

/** The dev helpers are inert unless someone sets this by hand in the extension's own devtools. */
async function devModeEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get(DEV_FLAG_KEY);
  return stored[DEV_FLAG_KEY] === true;
}

/** Starts one run at a time, so two quick selections cannot both read "no prompt" and overwrite it. */
let starting: Promise<void> = Promise.resolve();

/** Incremented by an explicit lock; an unlock that started earlier must not write the phrase back. */
let lockGeneration = 0;

export function startCheckRun(applicationIds?: string[]): Promise<void> {
  const next = starting.then(
    () => beginCheckRun(applicationIds),
    () => beginCheckRun(applicationIds),
  );
  starting = next.catch(() => undefined);
  return next;
}

async function beginCheckRun(applicationIds?: string[]): Promise<void> {
  const selected = (await listApplications()).filter(
    (application) => applicationIds === undefined || applicationIds.includes(application.id),
  );
  if (selected.length === 0) {
    // Nothing left to check (every remembered application was deleted): do not keep an unanswered prompt.
    await clearPendingSelection();
    return;
  }

  // Encrypted identities need a passphrase that actually opens the selected ones before a window is worth
  // opening. Anything else — a stale phrase from before an import or a re-key — asks to unlock again.
  if (!(await canUseSessionPassphrase(selected))) {
    // A second selection while a prompt is already waiting must not replace the first one. Focus or reopen
    // that single prompt; the person can use the options page to choose a different application later.
    if ((await getPendingSelection()) !== null) {
      await showUnlockPrompt();
      return;
    }
    // The unlock page opens in a tab of its own; remember what the person asked to check so it can start
    // exactly that, not every saved application.
    await browser.storage.session.set({
      [PENDING_SELECTION_KEY]: selected.map((application) => application.id),
    });
    await showUnlockPrompt();
    return;
  }

  await clearPendingSelection();
  await setRun({
    id: globalThis.crypto.randomUUID(),
    queue: selected.map((application) => application.id),
  });
  const tabId = await openCheckWindow();
  if (tabId !== undefined) await assignFill(tabId);
}

/** Brings the one unlock prompt forward, or opens it again without changing the remembered selection. */
async function showUnlockPrompt(): Promise<void> {
  const stored = await browser.storage.session.get(PENDING_TAB_KEY);
  const tabId = stored[PENDING_TAB_KEY];
  if (typeof tabId === 'number') {
    try {
      await browser.tabs.update(tabId, { active: true });
      return;
    } catch {
      // The prompt was closed; open a fresh one for the same selection below.
    }
  }
  const tab = await browser.tabs.create({ url: browser.runtime.getURL('/unlock.html') });
  if (tab.id !== undefined) {
    await browser.storage.session.set({ [PENDING_TAB_KEY]: tab.id });
  }
}

async function clearPendingSelection(): Promise<void> {
  await browser.storage.session.remove([PENDING_SELECTION_KEY, PENDING_TAB_KEY]);
}

/** True when every encrypted application in the selection opens with the passphrase held in session. */
export async function canUseSessionPassphrase(
  applications: readonly Application[],
): Promise<boolean> {
  if (!applications.some((application) => application.identity.kind === 'encrypted')) return true;
  const generation = lockGeneration;
  const passphrase = await getUnlockPassphrase();
  if (passphrase === null) return false;

  for (const application of applications) {
    if (application.identity.kind !== 'encrypted') continue;
    try {
      await decryptIdentity(application.identity, passphrase);
    } catch {
      // A lock that happened during the derivation already forgot the phrase; do not touch it then.
      if (generation === lockGeneration) await browser.storage.session.remove(UNLOCK_KEY);
      return false;
    }
  }
  // A lock during the derivation wins over a report that the phrase was usable when it started.
  return generation === lockGeneration;
}

/**
 * Forgets the passphrase and everything decrypted for a run: an explicit lock, or an import that replaced
 * identities, must not leave a per-tab fill or a queued run that still belongs to the old store.
 *
 * The generation bump happens first, so an unlock already deriving a key cannot store its phrase afterwards.
 * Any unlock prompt still open is closed; its prompt has no selection any more and must not start a run.
 */
export async function lockSession(): Promise<void> {
  lockGeneration += 1;
  const stored = await browser.storage.session.get(PENDING_TAB_KEY);
  const promptTab = stored[PENDING_TAB_KEY];

  await browser.storage.session.remove([
    UNLOCK_KEY,
    FILLS_KEY,
    RUN_KEY,
    PENDING_SELECTION_KEY,
    PENDING_TAB_KEY,
  ]);

  if (typeof promptTab === 'number') {
    try {
      await browser.tabs.remove(promptTab);
    } catch {
      // The prompt was already closed; nothing else to do.
    }
  }
}

async function getUnlockPassphrase(): Promise<string | null> {
  const stored = await browser.storage.session.get(UNLOCK_KEY);
  const value: unknown = stored[UNLOCK_KEY];
  return typeof value === 'string' ? value : null;
}

async function getPendingSelection(): Promise<string[] | null> {
  const stored = await browser.storage.session.get(PENDING_SELECTION_KEY);
  const value: unknown = stored[PENDING_SELECTION_KEY];
  if (!Array.isArray(value)) return null;
  const ids = value.filter((item): item is string => typeof item === 'string' && item !== '');
  return ids.length === 0 ? null : ids;
}

/**
 * Tries the passphrase against the encrypted identities the person asked to check; keeps it in session
 * memory on success. A different encrypted application that was not selected does not have to open, so an
 * unrelated import cannot make the intended selection fail.
 */
export async function unlock(passphrase: string): Promise<boolean> {
  const generation = lockGeneration;
  const applications = await listApplications();
  const pending = await getPendingSelection();
  const candidates =
    pending === null
      ? applications
      : applications.filter((application) => pending.includes(application.id));

  let opened = 0;
  for (const application of candidates) {
    if (application.identity.kind !== 'encrypted') continue;
    try {
      await decryptIdentity(application.identity, passphrase);
      opened += 1;
    } catch {
      // The remembered selection is the promise: every encrypted application in it must open. Without one
      // (the options page's "unlock for this session"), any identity that opens is enough to hold the phrase.
      if (pending !== null) return false;
    }
  }
  if (opened === 0) return false;
  // A lock that happened while the key was being derived must not be undone by storing the phrase now.
  if (generation !== lockGeneration) return false;
  await browser.storage.session.set({ [UNLOCK_KEY]: passphrase });
  if (generation !== lockGeneration) {
    await browser.storage.session.remove(UNLOCK_KEY);
    return false;
  }
  return true;
}

/** A compact popup window where the browser allows it (desktop), a plain tab otherwise (Firefox for Android). */
async function openCheckWindow(): Promise<number | undefined> {
  try {
    const created = await browser.windows.create({
      url: SEDE_URL,
      type: 'popup',
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      focused: true,
    });
    return created?.tabs?.[0]?.id;
  } catch {
    const tab = await browser.tabs.create({ url: SEDE_URL });
    return tab.id;
  }
}

async function fillFor(tabId: number): Promise<unknown> {
  const fills = await getFills();
  const applicationId = fills[String(tabId)];
  if (applicationId === undefined) return null;

  const application = await getApplication(applicationId);
  if (application === null) return null;

  const identity = await resolveIdentity(application.identity);
  if (identity === null) return null;
  return { applicationId, label: application.label, identity };
}

/** Plain identities pass through; encrypted ones need the passphrase held in session memory. */
async function resolveIdentity(identity: Application['identity']): Promise<PlainIdentity | null> {
  if (identity.kind === 'plain') return identity;
  const passphrase = await getUnlockPassphrase();
  if (passphrase === null) return null;
  try {
    return await decryptIdentity(identity, passphrase);
  } catch {
    return null;
  }
}

async function handleOutcome(outcome: ParseOutcome, tabId: number): Promise<void> {
  await applyStoredLocale();
  const locale = currentLocale().content;
  const applicationId = await releaseFill(tabId);
  if (applicationId === undefined) return;

  try {
    await recordOutcome(outcome, applicationId, tabId, locale);
  } catch {
    // A deleted application, a quota failure: the person still needs a result page instead of a stuck tab.
    await storeResult(tabId, {
      view: buildErrorView({
        label: t('background.defaultLabel'),
        messages: [t('background.checkFailed')],
        locale,
      }),
      applicationId,
      checkId: null,
      acknowledged: true,
      hasNext: false,
      runId: '',
      report: null,
    }).catch(() => undefined);
  }

  // Optional alert work must never stop the tab from reaching its result.
  await openResult(tabId).catch(() => undefined);
}

export async function recordOutcome(
  outcome: ParseOutcome,
  applicationId: string,
  tabId: number,
  locale: ReturnType<typeof currentLocale>['content'],
): Promise<void> {
  const application = await getApplication(applicationId);
  const run = await getRun();
  // Only the head is the live run's current application. A retry of anything else checks it without
  // touching the queue, so it must not offer a Continue that would advance somebody else's run.
  const inRun = run.queue[0] === applicationId;
  const hasNext = inRun && remainingAfter(run.queue, applicationId).length > 0;

  if (application === null) {
    // The application was deleted while its window was open. Do not record a check against nothing, and do
    // not run the badge sync here: it would prune the result this tab is about to show.
    await storeResult(tabId, {
      view: buildErrorView({
        label: t('background.defaultLabel'),
        messages: [t('background.deletedApplication')],
        locale,
      }),
      applicationId,
      checkId: null,
      acknowledged: true,
      hasNext,
      runId: inRun ? run.id : '',
      report: null,
    });
    return;
  }

  const label = application.label;
  const base = { applicationId, acknowledged: false, hasNext, runId: inRun ? run.id : '' };

  if (outcome.kind === 'status') {
    const previous = await latestCheck(applicationId);
    const check = await appendCheck({
      applicationId,
      outcome: 'status',
      statusKey: outcome.key,
      raw: outcome.raw,
      subStatus: outcome.subStatus,
    });
    const change = evaluateChange(previous, check);
    const view = buildResultView({
      label,
      change,
      anomaly: detectAnomaly(previous, check),
      locale,
    });
    await storeResult(tabId, { ...base, view, checkId: check.id, report: reportOf(check) });
    await applyAlert(view.view === 'changed', decideAlert(change, label, locale), check.id);
  } else if (outcome.kind === 'error') {
    // D12: the page does not say why, so neither do we — the message is stored and shown verbatim.
    const check = await appendCheck({
      applicationId,
      outcome: 'error',
      statusKey: 'unknown',
      raw: outcome.raw,
      subStatus: null,
    });
    await storeResult(tabId, {
      ...base,
      view: buildErrorView({ label, messages: outcome.messages, locale }),
      checkId: check.id,
      report: reportOf(check),
    });
  } else {
    // `unknown`: nothing is recorded, but the user still needs to be told.
    await storeResult(tabId, {
      ...base,
      view: buildErrorView({
        label,
        messages: [t('background.unknownPage')],
        locale,
      }),
      checkId: null,
      report: { outcome: 'unknown', statusKey: 'unknown' },
    });
  }

  // The badge now reflects every unacknowledged change, not just this check's decision. An optional alert
  // failure above must not skip this.
  await syncOutstandingState();
}

async function openResult(tabId: number): Promise<void> {
  await browser.tabs.update(tabId, { url: browser.runtime.getURL('/result.html') });
}

/** The applications a Continue from this result would leave in the queue. */
export function remainingAfter(queue: readonly string[], applicationId: string): string[] {
  return queue[0] === applicationId
    ? queue.slice(1)
    : queue.filter((candidate) => candidate !== applicationId);
}

/**
 * Shifts the queue and takes the same window back to the form for the next application.
 *
 * The cached result is the token: the first Continue consumes it and later copies (a double click, a
 * repeated message) find none and change nothing. The run id keeps a result from an older run from advancing
 * a newer queue.
 */
export async function continueRun(tabId: number): Promise<boolean> {
  if (continuing.has(tabId)) return false;
  continuing.add(tabId);
  try {
    const cached = await resultForCached(tabId);
    if (!isResultPayload(cached)) return false;
    const run = await getRun();
    if (cached.runId === '' || run.id !== cached.runId) return false;

    const rest = remainingAfter(run.queue, cached.applicationId);
    await browser.storage.session.remove(`${RESULT_KEY_PREFIX}${tabId}`);
    if (rest.length === 0) {
      await browser.storage.session.remove([RUN_KEY, FILLS_KEY]);
      return true;
    }
    await setRun({ ...run, queue: rest });
    await assignFill(tabId);
    await browser.tabs.update(tabId, { url: SEDE_URL });
    return true;
  } finally {
    continuing.delete(tabId);
  }
}

/** Points the same window back at the form for one application, without touching the queue. */
async function retryApplication(applicationId: string, tabId: number): Promise<void> {
  const fills = await getFills();
  fills[String(tabId)] = applicationId;
  await setFills(fills);
  await browser.storage.session.remove(`${RESULT_KEY_PREFIX}${tabId}`);
  await browser.tabs.update(tabId, { url: SEDE_URL });
}

async function applyAlert(
  changed: boolean,
  decision: ReturnType<typeof decideAlert>,
  checkId: string,
): Promise<void> {
  if (!changed || decision.notification === null) return;

  try {
    await browser.notifications.create(`${NOTIFICATION_PREFIX}${checkId}`, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: decision.notification.title,
      message: decision.notification.message,
      priority: 2,
    });
  } catch {
    // Notifications are an extra: the result page and the badge still tell the person what happened.
  }
}

async function acknowledgeChange(checkId: string): Promise<void> {
  await acknowledgeCheck(checkId);
  await markCachedResultsAcknowledged(checkId);
  try {
    await browser.notifications.clear(`${NOTIFICATION_PREFIX}${checkId}`);
  } catch {
    // The badge is derived from the store, so a notification API that fails cannot leave it stuck either.
  }
  await syncOutstandingState();
}

/** The acknowledged flag is part of the result payload, so reopening or reloading it does not restore the banner. */
async function markCachedResultsAcknowledged(checkId: string): Promise<void> {
  const stored = await browser.storage.session.get(null);
  const updates: Record<string, ResultPayload> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith(RESULT_KEY_PREFIX)) continue;
    if (!isResultPayload(value) || value.checkId !== checkId || value.acknowledged) continue;
    updates[key] = { ...value, acknowledged: true };
  }
  if (Object.keys(updates).length > 0) await browser.storage.session.set(updates);
}

/** Rebuilds a completed check from the store, for a notification click or the popup's change link. */
async function resultForCheck(checkId: string): Promise<ResultPayload | null> {
  await applyStoredLocale();
  const locale = currentLocale().content;
  const store = await readStore();
  const check = store.checks.find((candidate) => candidate.id === checkId);
  if (check === undefined) return null;

  const application = store.applications.find((candidate) => candidate.id === check.applicationId);
  if (application === undefined) return null;

  const checks = store.checks.filter(
    (candidate) => candidate.applicationId === check.applicationId,
  );
  const previous = latestStatusBefore(checks, check);
  const base = {
    applicationId: check.applicationId,
    checkId: check.id,
    acknowledged: check.acknowledged,
    hasNext: false,
    runId: '',
    report: reportOf(check),
  };

  if (check.outcome !== 'status') {
    return {
      ...base,
      acknowledged: true,
      view: buildErrorView({
        label: application.label,
        messages: check.raw === '' ? [] : [check.raw],
        locale,
      }),
    };
  }

  const change = evaluateChange(previous, check);
  return {
    ...base,
    view: buildResultView({
      label: application.label,
      change,
      anomaly: detectAnomaly(previous, check),
      locale,
    }),
  };
}

/** Copies the two permitted fields by name, so nothing else of a check can enter a payload. */
function reportOf(check: ReportCheck): ReportCheck {
  return { outcome: check.outcome, statusKey: check.statusKey };
}

async function storeResult(tabId: number, payload: ResultPayload): Promise<void> {
  await browser.storage.session.set({ [`${RESULT_KEY_PREFIX}${tabId}`]: payload });
}

export function isResultPayload(value: unknown): value is ResultPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ResultPayload>;
  return (
    typeof candidate.applicationId === 'string' &&
    typeof candidate.acknowledged === 'boolean' &&
    typeof candidate.hasNext === 'boolean' &&
    'view' in candidate &&
    isReportCheckOrAbsent(candidate.report)
  );
}

/** A payload cached before `report` existed has none; that reads as `null`. */
function isReportCheckOrAbsent(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'object') return false;
  const candidate = value as Partial<ReportCheck>;
  return typeof candidate.outcome === 'string' && typeof candidate.statusKey === 'string';
}

export async function resultFor(tabId: number, checkId?: string): Promise<unknown> {
  if (checkId !== undefined) return resultForCheck(checkId);
  return resultForCached(tabId);
}

async function resultForCached(tabId: number): Promise<unknown> {
  const key = `${RESULT_KEY_PREFIX}${tabId}`;
  const stored = await browser.storage.session.get(key);
  const cached: unknown = stored[key] ?? null;
  // A payload cached before `report` existed is read as having none.
  if (isResultPayload(cached) && (cached as Partial<ResultPayload>).report === undefined) {
    return { ...cached, report: null };
  }
  return cached;
}

async function assignFill(tabId: number): Promise<void> {
  const run = await getRun();
  const applicationId = run.queue[0];
  if (applicationId === undefined) return;
  const fills = await getFills();
  fills[String(tabId)] = applicationId;
  await setFills(fills);
}

async function releaseFill(tabId: number): Promise<string | undefined> {
  const fills = await getFills();
  const key = String(tabId);
  const applicationId = fills[key];
  if (applicationId === undefined) return undefined;
  delete fills[key];
  await setFills(fills);
  return applicationId;
}

/** A closed window must not leave a fill or a cached result pointing at a tab id that no longer exists. */
export async function cleanupTab(tabId: number): Promise<void> {
  const fills = await getFills();
  const key = String(tabId);
  if (key in fills) {
    delete fills[key];
    await setFills(fills);
  }
  const pending = await browser.storage.session.get(PENDING_TAB_KEY);
  if (pending[PENDING_TAB_KEY] === tabId) {
    // Keep the remembered selection: a later start reopens the same prompt instead of replacing it.
    await browser.storage.session.remove(PENDING_TAB_KEY);
  }
  await browser.storage.session.remove(`${RESULT_KEY_PREFIX}${tabId}`);
}

/**
 * Brings the badge, notifications and session state in line with the store after any local change: an
 * acknowledgement, a deletion or an import made from another page.
 */
function syncOutstandingState(): Promise<void> {
  if (syncing !== null) {
    syncAgain = true;
    return syncing;
  }
  syncing = (async () => {
    try {
      do {
        syncAgain = false;
        await doSyncOutstandingState();
      } while (syncAgain);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

async function doSyncOutstandingState(): Promise<void> {
  try {
    const store = await readStore();
    await setOutstandingBadge(store);
    await clearOrphanNotifications(store);
  } catch {
    // A corrupt store has its own recovery UI; it must not take the worker down with it.
  }
}

/**
 * Any recorded status that changed and has not been acknowledged, across every application and every
 * historical check. Looking only at the latest status loses the alert when a later check is unchanged or an
 * error: the change happened and nobody acknowledged it.
 */
export function hasOutstandingChange(store: Store): boolean {
  for (const application of store.applications) {
    const checks = store.checks.filter((check) => check.applicationId === application.id);
    for (const check of checks) {
      if (check.outcome !== 'status' || check.acknowledged) continue;
      const previous = latestStatusBefore(checks, check);
      if (evaluateChange(previous, check).kind === 'changed') return true;
    }
  }
  return false;
}

async function setOutstandingBadge(store: Store): Promise<void> {
  try {
    if (hasOutstandingChange(store)) {
      await browser.action.setBadgeText({ text: '!' });
      await browser.action.setBadgeBackgroundColor({ color: '#dc2626' });
    } else {
      await browser.action.setBadgeText({ text: '' });
    }
  } catch {
    // The action API is unavailable on some targets; the result page and notifications still work.
  }
}

/** A deleted application must not leave a change notification that reopens a check it no longer has. */
async function clearOrphanNotifications(store: Store): Promise<void> {
  try {
    const known = new Set(store.checks.map((check) => check.id));
    const notifications = await browser.notifications.getAll();
    for (const id of Object.keys(notifications)) {
      if (!id.startsWith(NOTIFICATION_PREFIX)) continue;
      if (!known.has(id.slice(NOTIFICATION_PREFIX.length))) {
        await browser.notifications.clear(id);
      }
    }
  } catch {
    // Notification clearing is best effort; the badge already reflects the store.
  }
}

async function getRun(): Promise<RunState> {
  const stored = await browser.storage.session.get(RUN_KEY);
  const value: unknown = stored[RUN_KEY];
  if (typeof value === 'object' && value !== null && 'queue' in value) {
    const candidate = value as { id?: unknown; queue: unknown };
    if (Array.isArray(candidate.queue)) {
      return {
        id: typeof candidate.id === 'string' ? candidate.id : '',
        queue: candidate.queue.filter(
          (item): item is string => typeof item === 'string' && item !== '',
        ),
      };
    }
  }
  return { id: '', queue: [] };
}

async function setRun(run: RunState): Promise<void> {
  await browser.storage.session.set({ [RUN_KEY]: run });
}

async function getFills(): Promise<FillMap> {
  const stored = await browser.storage.session.get(FILLS_KEY);
  const value: unknown = stored[FILLS_KEY];
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const fills: FillMap = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === 'string') fills[key] = entry;
    }
    return fills;
  }
  return {};
}

async function setFills(fills: FillMap): Promise<void> {
  await browser.storage.session.set({ [FILLS_KEY]: fills });
}
