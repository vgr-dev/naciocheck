import { evaluateChange } from '../../core/changes';
import {
  type Application,
  type Check,
  latestStatusBefore,
  listApplications,
  listChecks,
} from '../../core/storage';
import { button, el, formatDate, link, openPage, root } from '../shared/ui';

/**
 * The popup: every saved application with its latest status, when it was checked, and one click to run a
 * check. It reads storage directly — no personal data leaves the extension.
 */

async function main(): Promise<void> {
  const view = root();
  const applications = await listApplications();

  view.append(el('h1', 'title', 'NacioCheck'));

  if (applications.length === 0) {
    view.append(
      el('p', 'hint', 'Todavía no hay ninguna solicitud guardada.'),
      button(
        'Añadir una solicitud',
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

  const row = el('div', 'row');
  row.append(
    button(
      'Comprobar todo',
      () => {
        void startRun();
      },
      'button primary',
    ),
    link('Opciones', () => {
      openPage('/options.html');
    }),
    link('Qué significa cada estado', () => {
      openPage('/statuses.html');
    }),
  );
  view.append(row);
}

async function buildCard(application: Application): Promise<HTMLElement> {
  const card = el('li', 'app-card');
  card.append(el('p', 'label', application.label));

  const checks = await listChecks(application.id);
  const latest: Check | undefined = checks.at(-1);
  const previous = latest === undefined ? null : latestStatusBefore(checks, latest);

  if (latest === undefined) {
    card.append(el('p', 'status', 'Sin comprobaciones todavía'));
  } else {
    const change = evaluateChange(previous, latest);
    const status = el(
      'p',
      'status',
      latest.outcome === 'status' ? latest.raw : 'Última comprobación con error',
    );
    if (change.kind === 'changed' && !latest.acknowledged) {
      status.append(el('span', 'marker', 'CAMBIÓ'));
    }
    card.append(status, el('p', 'meta', `Comprobado el ${formatDate(latest.at)}`));
  }

  card.append(
    button('Comprobar ahora', () => {
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
