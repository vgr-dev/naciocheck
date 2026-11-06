import { browser } from 'wxt/browser';
import { buildErrorView, buildResultView, decideAlert } from '../core/alerts';
import { detectAnomaly } from '../core/anomaly';
import { evaluateChange } from '../core/changes';
import { decryptIdentity } from '../core/crypto';
import { isExtensionMessage } from '../core/messages';
import type { ParseOutcome } from '../core/parser';
import { nextRunWhen } from '../core/schedule';
import { statusKeyOf } from '../core/statuses';
import {
  acknowledgeCheck,
  appendCheck,
  type Application,
  getApplication,
  getSettings,
  latestCheck,
  listApplications,
  type PlainIdentity,
} from '../core/storage';

/**
 * Orchestrates a "check run": a compact window per application, like the official flow but with only the
 * captcha visible. Nothing about the application travels in the URL — the background keeps it per tab id.
 *
 * Reminders and the popup arrive in Phase 7; today a run starts from a `naciocheck:start-check-run` message.
 */

const SEDE_URL = 'https://sede.mjusticia.gob.es/eConsultas/inicioNacionalidad';
const RUN_KEY = 'naciocheck:run';
const FILLS_KEY = 'naciocheck:fills';
const RESULT_KEY_PREFIX = 'naciocheck:result:';
const NOTIFICATION_PREFIX = 'naciocheck:change:';
const DEV_FLAG_KEY = 'naciocheck:dev:enabled';
const REMINDER_ALARM = 'naciocheck:reminder';
const REMINDER_NOTIFICATION = 'naciocheck:reminder';
/** Session storage only: the passphrase never reaches disk and disappears when the browser closes. */
const UNLOCK_KEY = 'naciocheck:unlock';

const WINDOW_WIDTH = 520;
const WINDOW_HEIGHT = 760;

interface RunState {
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
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    void respond(message, sender.tab?.id).then(sendResponse);
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

  void rescheduleReminder();
});

/** First install opens the onboarding; every install reschedules the reminder. */
async function handleInstalled(reason: string): Promise<void> {
  await rescheduleReminder();
  if (reason === 'install') {
    await browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
  }
}

async function handleAlarm(name: string): Promise<void> {
  if (name !== REMINDER_ALARM) return;
  await browser.notifications.create(REMINDER_NOTIFICATION, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: 'NacioCheck',
    message: 'Es la hora de comprobar el estado de tu solicitud. Solo hace falta el captcha.',
    priority: 2,
  });
  await rescheduleReminder();
}

/** Clicking the reminder starts a run for every saved application. */
async function handleNotificationClick(notificationId: string): Promise<void> {
  if (notificationId !== REMINDER_NOTIFICATION) return;
  await browser.notifications.clear(notificationId);
  await startCheckRun();
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
      return tabId === undefined ? null : resultFor(tabId);
    case 'naciocheck:acknowledge':
      await acknowledgeChange(message.checkId);
      return { acknowledged: true };
    case 'naciocheck:retry':
      if (tabId === undefined) return null;
      await retryApplication(message.applicationId, tabId);
      return { retried: true };
    case 'naciocheck:continue':
      if (tabId === undefined) return null;
      await continueRun(tabId);
      return { continued: true };
    case 'naciocheck:reschedule':
      await rescheduleReminder();
      return { scheduled: true };
    case 'naciocheck:unlock': {
      const unlocked = await unlock(message.passphrase);
      return { unlocked };
    }
    case 'naciocheck:lock':
      await browser.storage.session.remove(UNLOCK_KEY);
      return { locked: true };
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

async function startCheckRun(applicationIds?: string[]): Promise<void> {
  const selected = (await listApplications()).filter(
    (application) => applicationIds === undefined || applicationIds.includes(application.id),
  );
  if (selected.length === 0) return;

  // Encrypted identities need the passphrase before a window is worth opening.
  if (await needsUnlock(selected)) {
    await browser.tabs.create({ url: browser.runtime.getURL('/unlock.html') });
    return;
  }

  await setRun({ queue: selected.map((application) => application.id) });
  const tabId = await openCheckWindow();
  if (tabId !== undefined) await assignFill(tabId);
}

/** True when at least one selected application is encrypted and no passphrase is held in session. */
async function needsUnlock(applications: readonly Application[]): Promise<boolean> {
  if (!applications.some((application) => application.identity.kind === 'encrypted')) return false;
  return (await getUnlockPassphrase()) === null;
}

async function getUnlockPassphrase(): Promise<string | null> {
  const stored = await browser.storage.session.get(UNLOCK_KEY);
  const value: unknown = stored[UNLOCK_KEY];
  return typeof value === 'string' ? value : null;
}

/** Tries the passphrase against the encrypted identities; keeps it in session memory on success. */
async function unlock(passphrase: string): Promise<boolean> {
  const applications = await listApplications();
  const encrypted = applications.find((application) => application.identity.kind === 'encrypted');
  if (encrypted === undefined || encrypted.identity.kind !== 'encrypted') return false;
  try {
    await decryptIdentity(encrypted.identity, passphrase);
  } catch {
    return false;
  }
  await browser.storage.session.set({ [UNLOCK_KEY]: passphrase });
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
  const applicationId = await releaseFill(tabId);
  if (applicationId === undefined) return;

  const application = await getApplication(applicationId);
  const label = application?.label ?? 'Solicitud';
  const hasNext = (await getRun()).queue.length > 1;

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
    const view = buildResultView({ label, change, anomaly: detectAnomaly(previous, check) });
    await storeResult(tabId, {
      view,
      applicationId,
      checkId: check.id,
      acknowledged: false,
      hasNext,
    });
    await applyAlert(view.view === 'changed', decideAlert(change, label), check.id);
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
      view: buildErrorView({ label, messages: outcome.messages }),
      applicationId,
      checkId: check.id,
      acknowledged: false,
      hasNext,
    });
  } else {
    // `unknown`: nothing is recorded, but the user still needs to be told.
    await storeResult(tabId, {
      view: buildErrorView({
        label,
        messages: ['La página no se ha reconocido y no se ha guardado nada.'],
      }),
      applicationId,
      checkId: null,
      acknowledged: false,
      hasNext,
    });
  }

  await openResult(tabId);
}

async function openResult(tabId: number): Promise<void> {
  await browser.tabs.update(tabId, { url: browser.runtime.getURL('/result.html') });
}

/** Shifts the queue and takes the same window back to the form for the next application. */
async function continueRun(tabId: number): Promise<void> {
  const run = await getRun();
  const [, ...rest] = run.queue;
  if (rest.length === 0) {
    await browser.storage.session.remove([RUN_KEY, FILLS_KEY]);
    return;
  }
  await setRun({ queue: rest });
  await assignFill(tabId);
  await browser.tabs.update(tabId, { url: SEDE_URL });
}

/** Points the same window back at the form for one application, without touching the queue. */
async function retryApplication(applicationId: string, tabId: number): Promise<void> {
  const fills = await getFills();
  fills[String(tabId)] = applicationId;
  await browser.storage.session.set({ [FILLS_KEY]: fills });
  await browser.tabs.update(tabId, { url: SEDE_URL });
}

async function applyAlert(
  changed: boolean,
  decision: ReturnType<typeof decideAlert>,
  checkId: string,
): Promise<void> {
  if (!changed || decision.notification === null) return;

  if (decision.badge.text !== '') {
    await browser.action.setBadgeText({ text: decision.badge.text });
    if (decision.badge.color !== null) {
      await browser.action.setBadgeBackgroundColor({ color: decision.badge.color });
    }
  }
  await browser.notifications.create(`${NOTIFICATION_PREFIX}${checkId}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: decision.notification.title,
    message: decision.notification.message,
    priority: 2,
  });
}

async function acknowledgeChange(checkId: string): Promise<void> {
  await acknowledgeCheck(checkId);
  await browser.action.setBadgeText({ text: '' });
  await browser.notifications.clear(`${NOTIFICATION_PREFIX}${checkId}`);
}

async function storeResult(tabId: number, payload: ResultPayload): Promise<void> {
  await browser.storage.session.set({ [`${RESULT_KEY_PREFIX}${tabId}`]: payload });
}

async function resultFor(tabId: number): Promise<unknown> {
  const key = `${RESULT_KEY_PREFIX}${tabId}`;
  const stored = await browser.storage.session.get(key);
  return stored[key] ?? null;
}

async function assignFill(tabId: number): Promise<void> {
  const run = await getRun();
  const applicationId = run.queue[0];
  if (applicationId === undefined) return;
  const fills = await getFills();
  fills[String(tabId)] = applicationId;
  await browser.storage.session.set({ [FILLS_KEY]: fills });
}

async function releaseFill(tabId: number): Promise<string | undefined> {
  const fills = await getFills();
  const key = String(tabId);
  const applicationId = fills[key];
  if (applicationId === undefined) return undefined;
  delete fills[key];
  await browser.storage.session.set({ [FILLS_KEY]: fills });
  return applicationId;
}

async function getRun(): Promise<RunState> {
  const stored = await browser.storage.session.get(RUN_KEY);
  const value: unknown = stored[RUN_KEY];
  if (typeof value === 'object' && value !== null && 'queue' in value) {
    const { queue } = value;
    if (Array.isArray(queue)) return { queue: queue.filter((item) => typeof item === 'string') };
  }
  return { queue: [] };
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
