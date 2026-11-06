import { browser } from 'wxt/browser';
import { evaluateChange, type ChangeKind } from '../core/changes';
import { isExtensionMessage } from '../core/messages';
import type { ParseOutcome } from '../core/parser';
import { appendCheck, getApplication, latestCheck, listApplications } from '../core/storage';

/**
 * Orchestrates a "check run": a compact window per application, like the official flow but with only the
 * captcha visible. Nothing about the application travels in the URL — the background keeps it per tab id.
 *
 * Reminders and the popup arrive in Phase 7; today a run starts from a `naciocheck:start-check-run` message.
 */

const SEDE_URL = 'https://sede.mjusticia.gob.es/eConsultas/inicioNacionalidad';
const RUN_KEY = 'naciocheck:run';
const FILLS_KEY = 'naciocheck:fills';
const LAST_CHANGE_KEY = 'naciocheck:last-change';

const WINDOW_WIDTH = 520;
const WINDOW_HEIGHT = 760;

interface RunState {
  /** Application ids still to check, first one first. */
  queue: string[];
}

type FillMap = Record<string, string>;

interface LastChange {
  applicationId: string;
  kind: ChangeKind;
  at: string;
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    void respond(message, sender.tab?.id).then(sendResponse);
    return true;
  });
});

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
    default:
      return null;
  }
}

async function startCheckRun(applicationIds?: string[]): Promise<void> {
  const all = await listApplications();
  const queue = all
    .filter(
      (application) => applicationIds === undefined || applicationIds.includes(application.id),
    )
    .map((application) => application.id);
  if (queue.length === 0) return;

  await setRun({ queue });
  const tabId = await openCheckWindow();
  if (tabId !== undefined) await assignFill(tabId);
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
  if (application === null || application.identity.kind !== 'plain') return null;
  return { applicationId, label: application.label, identity: application.identity };
}

async function handleOutcome(outcome: ParseOutcome, tabId: number): Promise<void> {
  const applicationId = await releaseFill(tabId);
  if (applicationId === undefined) return;

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
    const lastChange: LastChange = { applicationId, kind: change.kind, at: check.at };
    await browser.storage.session.set({ [LAST_CHANGE_KEY]: lastChange });
  } else if (outcome.kind === 'error') {
    // D12: the page does not say why, so neither do we — the message is stored verbatim.
    await appendCheck({
      applicationId,
      outcome: 'error',
      statusKey: 'unknown',
      raw: outcome.raw,
      subStatus: null,
    });
  }
  // `unknown` pages are not recorded: there is nothing to store.

  await advanceRun(tabId);
}

/** Moves to the next application in the same window; stops when the queue is empty. */
async function advanceRun(tabId: number): Promise<void> {
  const run = await getRun();
  const [, ...rest] = run.queue;
  if (rest.length === 0) {
    await browser.storage.session.remove([RUN_KEY, FILLS_KEY]);
    // Phase 6 navigates this window to the extension's result view; until then it stays on the page.
    return;
  }
  await setRun({ queue: rest });
  await assignFill(tabId);
  await browser.tabs.update(tabId, { url: SEDE_URL });
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
