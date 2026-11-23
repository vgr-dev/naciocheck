import { evaluateChange } from '../../core/changes';
import { resolveLocaleCode, setLocale, t } from '../../core/i18n';
import {
  type Application,
  type Check,
  latestStatusBefore,
  listApplications,
  listChecks,
} from '../../core/storage';
import { applyDocumentLocale, initPageLocale } from '../shared/locale';
import { isStoreRecoveryNeeded, renderStoreRecovery } from '../shared/recovery';
import { button, el, formatDate, link, openPage, root } from '../shared/ui';

/**
 * The popup: every saved application with its latest status, when it was checked, and one click to run a
 * check. It reads storage directly — no personal data leaves the extension.
 */

async function main(): Promise<void> {
  const view = root();
  let applications: Application[] | null = null;
  let needsRecovery = false;
  let recoveryError: unknown;

  try {
    await initPageLocale();
    applications = await listApplications();
  } catch (error) {
    if (!(await isStoreRecoveryNeeded())) throw error;
    needsRecovery = true;
    recoveryError = error;
    // The stored language cannot be read while the store is corrupt: fall back to the browser's language so
    // the recovery panel is readable instead of the page staying blank.
    applyDocumentLocale(setLocale(resolveLocaleCode('auto', browser.i18n.getUILanguage())));
  }

  document.title = t('app.title');

  if (needsRecovery) {
    await renderStoreRecovery(view, {
      error: recoveryError,
      labels: {
        title: t('recovery.title'),
        description: t('recovery.description'),
        error: (detail) => t('recovery.error', { error: detail }),
        download: t('recovery.download'),
        downloaded: t('recovery.downloaded'),
        reset: t('recovery.reset'),
        resetConfirm: t('recovery.resetConfirm'),
        resetDone: t('recovery.resetDone'),
      },
      onReset: () => {
        window.location.reload();
      },
    });
    return;
  }

  if (applications === null) return;

  view.append(el('h1', 'title', t('app.title')));

  if (applications.length === 0) {
    view.append(
      el('p', 'hint', t('popup.noApplications')),
      button(
        t('popup.addApplication'),
        () => {
          openPage('/options.html');
        },
        'button primary',
      ),
    );
    return;
  }

  const list = el('ul', 'apps');
  for (const application of applications) {
    list.append(await buildCard(application));
  }
  view.append(list);

  // "Check all" does what the card's own button does when there is one application: it starts at two.
  const row = el('div', 'row');
  row.append(
    button(
      t('popup.checkAll'),
      () => {
        void startRun();
      },
      'button primary',
    ),
  );
  // The links on a row of their own: beside the button they sat 8 px apart and read as one phrase, and the second
  // wrapped in Spanish but not in English.
  const links = el('div', 'row links');
  links.append(
    link(t('popup.options'), () => {
      openPage('/options.html');
    }),
    link(t('popup.whatMeans'), () => {
      openPage('/statuses.html');
    }),
  );
  if (
    applications.some((application) => application.identity.kind === 'encrypted') &&
    (await sessionUnlocked())
  ) {
    links.append(
      link(t('popup.lockNow'), () => {
        void lockSession();
      }),
    );
  }
  view.append(...(applications.length > 1 ? [row] : []), links);
}

async function buildCard(application: Application): Promise<HTMLElement> {
  const card = el('li', 'app-card');
  card.append(el('p', 'label', application.label));

  const checks = await listChecks(application.id);
  const latest: Check | undefined = checks.at(-1);
  const outstanding = lastChanged(checks, true);
  // Prefer the unacknowledged change; when everything is acknowledged, the latest historical change is still
  // worth reopening. A later unchanged check or an error must not hide the change that came before it.
  const revisit = outstanding ?? lastChanged(checks, false);
  const actions = el('div', 'row');

  if (latest === undefined) {
    card.append(el('p', 'status', t('popup.noChecks')));
  } else {
    const status = el(
      'p',
      'status',
      latest.outcome === 'status' ? latest.raw : t('popup.lastError'),
    );
    if (outstanding !== undefined) {
      status.append(el('span', 'marker', t('popup.changed')));
    }
    card.append(status, el('p', 'meta', t('popup.checkedOn', { date: formatDate(latest.at) })));

    // A change used to be reachable only in the tab that showed it. This reopens the recorded change itself,
    // not merely the latest check, so the explanation can be read again.
    if (revisit !== undefined) {
      const viewChange = link(t('popup.viewChange'), () => {
        openPage(`/result.html?check=${encodeURIComponent(revisit.id)}`);
      });
      viewChange.classList.add('button', 'quiet');
      actions.append(viewChange);
    }
  }

  actions.append(
    button(t('popup.checkNow'), () => {
      void startRun([application.id]);
    }),
  );
  card.append(actions);
  return card;
}

/** The last status check that was a change, optionally only among the unacknowledged ones. */
export function lastChanged(
  checks: readonly Check[],
  onlyUnacknowledged: boolean,
): Check | undefined {
  for (let index = checks.length - 1; index >= 0; index -= 1) {
    const candidate = checks[index];
    if (candidate === undefined || candidate.outcome !== 'status') continue;
    if (onlyUnacknowledged && candidate.acknowledged) continue;
    const previous = latestStatusBefore(checks, candidate);
    if (evaluateChange(previous, candidate).kind === 'changed') return candidate;
  }
  return undefined;
}

async function startRun(applicationIds?: string[]): Promise<void> {
  await browser.runtime.sendMessage({ type: 'naciocheck:start-check-run', applicationIds });
  window.close();
}

async function sessionUnlocked(): Promise<boolean> {
  try {
    const response: unknown = await browser.runtime.sendMessage({
      type: 'naciocheck:session-state',
    });
    return (
      typeof response === 'object' &&
      response !== null &&
      'unlocked' in response &&
      response.unlocked === true
    );
  } catch {
    return false;
  }
}

async function lockSession(): Promise<void> {
  await browser.runtime.sendMessage({ type: 'naciocheck:lock' });
  window.close();
}

// The popup page always has #app; tests import this module without a page.
if (document.getElementById('app') !== null) void main();
