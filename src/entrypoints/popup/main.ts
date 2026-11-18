import { evaluateChange } from '../../core/changes';
import { currentLocale, t } from '../../core/i18n';
import {
  type Application,
  type Check,
  latestStatusBefore,
  listApplications,
  listChecks,
} from '../../core/storage';
import { displayStatus } from '../../core/statuses';
import { initPageLocale } from '../shared/locale';
import { button, el, formatDate, link, openPage, root } from '../shared/ui';

/**
 * The popup: every saved application with its latest status, when it was checked, and one click to run a
 * check. It reads storage directly — no personal data leaves the extension.
 */

async function main(): Promise<void> {
  const view = root();
  await initPageLocale();
  document.title = t('app.title');
  const applications = await listApplications();

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
  view.append(...(applications.length > 1 ? [row] : []), links);
}

async function buildCard(application: Application): Promise<HTMLElement> {
  const card = el('li', 'app-card');
  card.append(el('p', 'label', application.label));

  const checks = await listChecks(application.id);
  const latest: Check | undefined = checks.at(-1);
  const previous = latest === undefined ? null : latestStatusBefore(checks, latest);

  if (latest === undefined) {
    card.append(el('p', 'status', t('popup.noChecks')));
  } else {
    const change = evaluateChange(previous, latest);
    const status = el(
      'p',
      'status',
      latest.outcome === 'status'
        ? displayStatus(latest.raw, currentLocale().content)
        : t('popup.lastError'),
    );
    if (change.kind === 'changed' && !latest.acknowledged) {
      status.append(el('span', 'marker', t('popup.changed')));
    }
    card.append(status, el('p', 'meta', t('popup.checkedOn', { date: formatDate(latest.at) })));
  }

  card.append(
    button(t('popup.checkNow'), () => {
      void startRun([application.id]);
    }),
  );
  return card;
}

async function startRun(applicationIds?: string[]): Promise<void> {
  await browser.runtime.sendMessage({ type: 'naciocheck:start-check-run', applicationIds });
  window.close();
}

void main();
