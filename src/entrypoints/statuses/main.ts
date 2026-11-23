import { browser } from 'wxt/browser';
import { currentLocale, t } from '../../core/i18n';
import { MAIN_PATH_STATES, PATH_STATES, type PathStateId } from '../../core/paths';
import {
  STATUS_CATALOG,
  STATUS_DISCLAIMER,
  SUB_STATUS_ENTRIES,
  type StatusEntry,
  type StatusKey,
  type SubStatusEntry,
} from '../../core/statuses';
import { browserLabel, buildGuideReport, type ReportContext } from '../../core/report';
import { initPageLocale } from '../shared/locale';
import { reportPanel } from '../shared/report-panel';
import { el, root } from '../shared/ui';

/**
 * The status guide: the usual path first, then the branches the observations know, then what only the law
 * firms document. Nothing here is official — the disclaimer says so, and every text that comes from real
 * files is labelled as observed.
 */

/** The statuses of the usual path, in order and without repeating one: T1–T4 are all *En tramitación*. */
const MAIN_PATH_STATUSES: readonly StatusKey[] = statusesOf(MAIN_PATH_STATES);

/** The statuses the observations only reach off the usual path, in the order §1 of the plan describes them. */
const BRANCH_STATUSES: readonly StatusKey[] = [
  'pendiente-requerimiento',
  'documentacion-aportada',
  'abierto-en-calificacion',
  'resuelto-denegado',
  'archivado',
];

/** The steps observed inside *En tramitación*, in the order the page shows them. */
const PROCESSING_STEPS: readonly SubStatusEntry[] = [...SUB_STATUS_ENTRIES]
  .filter((entry) => entry.status === 'abierto-en-tramitacion')
  .sort(
    (a, b) => (a.progress ?? Number.MAX_SAFE_INTEGER) - (b.progress ?? Number.MAX_SAFE_INTEGER),
  );

const LISTED = new Set<StatusKey>([...MAIN_PATH_STATUSES, ...BRANCH_STATUSES]);

/** Everything else: documented by the law firms, which the observations do not place on any path yet. */
const OTHER_ENTRIES: readonly StatusEntry[] = STATUS_CATALOG.filter(
  (entry) => !LISTED.has(entry.key),
).sort((a, b) => a.stage - b.stage);

function statusesOf(ids: readonly PathStateId[]): StatusKey[] {
  const keys: StatusKey[] = [];
  for (const id of ids) {
    const state = PATH_STATES.find((candidate) => candidate.id === id);
    if (state !== undefined && !keys.includes(state.status)) keys.push(state.status);
  }
  return keys;
}

function entriesOf(keys: readonly StatusKey[]): StatusEntry[] {
  return keys.flatMap((key) => {
    const entry = STATUS_CATALOG.find((candidate) => candidate.key === key);
    return entry === undefined ? [] : [entry];
  });
}

function sourcesOf(entry: StatusEntry): HTMLElement {
  const list = el('ul', 'sources');
  for (const source of entry.sources) {
    const item = el('li');
    if (source.kind === 'observed') {
      // Not a page to open: it is what the user saw on real files, and it says so.
      item.textContent = t('statuses.observedSource');
    } else {
      const anchor = el('a', 'link', source.label);
      anchor.href = source.url;
      anchor.rel = 'noreferrer noopener';
      item.append(anchor);
    }
    list.append(item);
  }
  return list;
}

function stepsBlock(locale: 'es' | 'en'): HTMLElement {
  const block = el('div', 'observed-steps');
  block.append(el('p', 'hint', t('statuses.observedSteps')));
  const list = el('ul', 'history');
  for (const step of PROCESSING_STEPS) list.append(el('li', '', step[locale]));
  block.append(list);
  return block;
}

type GuideContext = Omit<ReportContext, 'errorMessages' | 'anomaly'>;

function card(entry: StatusEntry, locale: 'es' | 'en', context: GuideContext): HTMLElement {
  const node = el('div', 'card');
  // The heading is the name the sede shows, in Spanish; English readers get a gloss beneath it.
  const heading = el('h3', '', entry.es.title);
  if (locale === 'en') heading.lang = 'es';
  node.append(heading);
  if (locale === 'en') node.append(el('p', 'gloss', entry.en.title));
  node.append(el('p', '', entry[locale].explanation));

  if (entry.key === 'abierto-en-tramitacion') node.append(stepsBlock(locale));

  node.append(el('p', '', t('statuses.whatYouCanDo', { text: entry[locale].whatYouCanDo })));

  if (entry.officialDefinition === 'none') {
    node.append(el('p', 'hint', t('statuses.noOfficialDefinition')));
  }

  node.append(sourcesOf(entry));
  // Closed by default: the guide reads as before until someone thinks a text is wrong.
  node.append(
    reportPanel(
      buildGuideReport(entry.key, entry[locale].explanation, context),
      locale,
      'statuses.explanationWrong',
    ),
  );
  return node;
}

async function main(): Promise<void> {
  const view = root();
  await initPageLocale();
  document.title = t('statuses.pageTitle');
  const locale = currentLocale().content;
  const context: GuideContext = {
    version: browser.runtime.getManifest().version,
    browser: browserLabel(navigator.userAgent),
    locale,
  };
  view.append(el('h1', 'title', t('statuses.title')));
  view.append(el('p', 'subtitle', STATUS_DISCLAIMER[locale]));

  view.append(el('h2', 'section', t('statuses.mainPathTitle')));
  for (const entry of entriesOf(MAIN_PATH_STATUSES)) view.append(card(entry, locale, context));

  view.append(el('h2', 'section', t('statuses.branchesTitle')));
  for (const entry of entriesOf(BRANCH_STATUSES)) {
    const node = card(entry, locale, context);
    node.append(el('p', 'hint', t('statuses.branchHint')));
    view.append(node);
  }

  view.append(el('h2', 'section', t('statuses.othersTitle')));
  for (const entry of OTHER_ENTRIES) view.append(card(entry, locale, context));
}

void main();
