import { browser } from 'wxt/browser';
import type { ResultView } from '../../core/alerts';
import { currentLocale, t } from '../../core/i18n';
import { buildReport, type ReportCheck } from '../../core/report';
import { brandHeader } from '../shared/brand';
import { initPageLocale } from '../shared/locale';
import { reportPanel } from '../shared/report-panel';

/**
 * The result view: what the last check found, whether it changed, and — when it did — the full-screen alert
 * that stays until the user acknowledges it.
 *
 * It knows nothing about the official page: the background hands it a finished view model.
 */

export interface ResultPayload {
  view: ResultView;
  applicationId: string;
  checkId: string | null;
  acknowledged: boolean;
  /** True when the run has more applications queued. */
  hasNext: boolean;
  /**
   * The only two fields of the check a problem report may carry; `null` when there is nothing to report on.
   * A payload cached before this field existed has none, and is read as `null`.
   */
  report: ReportCheck | null;
}

const app = document.getElementById('app');

function isResultPayload(value: unknown): value is ResultPayload {
  return typeof value === 'object' && value !== null && 'view' in value && 'applicationId' in value;
}

async function main(): Promise<void> {
  if (app === null) return;
  await initPageLocale();
  document.title = t('app.title');
  const checkId = new URLSearchParams(window.location.search).get('check');
  const response: unknown = await browser.runtime.sendMessage({
    type: 'naciocheck:result-request',
    ...(checkId === null || checkId === '' ? {} : { checkId }),
  });
  if (!isResultPayload(response)) {
    renderEmpty();
    return;
  }
  render(response);
}

function renderEmpty(): void {
  if (app === null) return;
  app.className = 'app';
  app.replaceChildren(element('p', 'empty', t('result.empty')));
}

function render(payload: ResultPayload): void {
  if (app === null) return;
  const { view } = payload;
  // `view-…`, not the bare view name: `status` and `error` are also the heading's and the banner's classes, and
  // the heading's rules would then apply to the whole page.
  app.className = `app view-${view.view}`;
  app.replaceChildren();

  // The changed alert has the mark in its banner; every other result names the product at the top.
  if (view.view !== 'changed') app.append(brandHeader());

  if (view.view !== 'status') {
    app.append(buildBanner(view, payload.acknowledged));
  }

  // The alert's way out sits under the banner: after the explanation and the sources it was off the first screen.
  const actions = buildActions(payload);
  if (view.view === 'changed') app.append(actions);

  app.append(element('p', 'label', view.label));

  if (view.status !== null) {
    app.append(element('h1', 'status', view.status.title));
    if (view.status.subStatus !== null) {
      // The site's own sentence, kept as it printed it in every language; the label says so (13.16).
      const sentence = element('p', 'sub-status', '');
      sentence.append(
        element('span', 'site-label', t('result.siteSaid')),
        document.createTextNode(` ${view.status.subStatus}`),
      );
      app.append(sentence);
    }
    if (view.versionLine !== '') {
      app.append(element('p', 'version', view.versionLine));
    }
  }

  if (view.previous !== null) {
    app.append(element('p', 'previous', view.previous.text));
  }

  if (view.errorMessages.length > 0) {
    // The page's error messages are verbatim too (D12), under the same label.
    app.append(element('p', 'site-said', t('result.siteSaid')));
    const list = document.createElement('ul');
    list.className = 'errors';
    for (const message of view.errorMessages) {
      list.append(element('li', '', message));
    }
    app.append(list);
  }

  if (view.explanation !== null) {
    app.append(element('p', 'explanation', view.explanation));
  }

  if (view.observedMeaning !== null) {
    app.append(element('p', 'observed-meaning', view.observedMeaning));
  }

  if (view.whatYouCanDo !== null) {
    app.append(element('p', 'action', view.whatYouCanDo));
  }

  if (view.anomaly !== null) {
    app.append(element('p', 'anomaly', view.anomaly));
  }

  if (view.sources.length > 0) {
    const sources = document.createElement('ul');
    sources.className = 'sources';
    for (const source of view.sources) {
      const item = document.createElement('li');
      if (source.kind === 'observed') {
        // Not a page to open: it is what the user saw on real files, and it says so.
        item.textContent = t('statuses.observedSource');
      } else {
        const link = document.createElement('a');
        link.href = source.url;
        link.rel = 'noreferrer noopener';
        link.textContent = source.label;
        item.append(link);
      }
      sources.append(item);
    }
    app.append(sources);
  }

  app.append(element('p', 'disclaimer', t('result.disclaimer')));

  // Only where something went wrong or the page said something unusual (Q1): a normal status or change has no
  // panel, so the page reads as before.
  const report = payload.report ?? null;
  if (report !== null && (view.view === 'error' || view.anomaly !== null)) {
    app.append(buildReportPanel(report, view));
  }

  if (view.view !== 'changed') app.append(actions);
}

/** The panel for this result: the report is editable text, so the person sees exactly what would be shared. */
function buildReportPanel(report: ReportCheck, view: ResultView): HTMLElement {
  const locale = currentLocale().content;
  const text = buildReport(report, {
    version: browser.runtime.getManifest().version,
    browser: browserLabel(navigator.userAgent),
    locale,
    errorMessages: view.errorMessages,
    anomaly: view.anomaly,
  });
  return reportPanel(text, locale);
}

/** The browser's name and major version from the user agent, and nothing else: no operating system (Q2). */
function browserLabel(userAgent: string): string {
  // Order matters: Edge and Opera also say Chrome, and Chrome also says Safari.
  const known: ReadonlyArray<readonly [string, RegExp]> = [
    ['Edge', /\bEdgA?\/(\d+)/],
    ['Opera', /\bOPR\/(\d+)/],
    ['Firefox', /\bFirefox\/(\d+)/],
    ['Chrome', /\bChrome\/(\d+)/],
  ];
  for (const [name, pattern] of known) {
    const match = pattern.exec(userAgent);
    if (match?.[1] !== undefined) return `${name} ${match[1]}`;
  }
  return 'unknown';
}

function buildBanner(view: ResultView, acknowledged: boolean): HTMLElement {
  const banner = document.createElement('div');
  // An acknowledged change keeps its result and its banner, but no longer reads as an unacknowledged alert;
  // persisted in the payload, so a reload does not bring the alert back.
  banner.className = view.view === 'changed' && acknowledged ? 'banner' : `banner ${view.view}`;
  if (view.view === 'changed') {
    const icon = document.createElement('img');
    icon.src = '/icon/icon-animated.svg';
    icon.alt = '';
    icon.width = 96;
    icon.height = 96;
    banner.append(icon);
    banner.append(element('h1', 'banner-title', t('result.changedTitle')));
  } else {
    banner.append(element('h1', 'banner-title', t('result.errorTitle')));
  }
  return banner;
}

function buildActions(payload: ResultPayload): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'actions';

  if (payload.view.view === 'changed' && !payload.acknowledged && payload.checkId !== null) {
    const acknowledge = element('button', 'primary', t('result.acknowledge'));
    acknowledge.addEventListener('click', () => {
      void acknowledgeChange(payload);
    });
    actions.append(acknowledge);
  }

  if (payload.view.view === 'error') {
    const retry = element('button', 'primary', t('result.retry'));
    retry.addEventListener('click', () => {
      void retryCheck(payload);
    });
    actions.append(retry);
  }

  if (payload.hasNext) {
    const next = element('button', 'primary', t('result.next')) as HTMLButtonElement;
    next.addEventListener('click', () => {
      void continueRun(next);
    });
    actions.append(next);
  }

  return actions;
}

async function acknowledgeChange(payload: ResultPayload): Promise<void> {
  if (payload.checkId === null) return;
  await browser.runtime.sendMessage({ type: 'naciocheck:acknowledge', checkId: payload.checkId });
  // Render from the acknowledged payload: the cached copy is updated too, so a reload keeps it acknowledged.
  render({ ...payload, acknowledged: true });
}

/** Disabled while the message is in flight: a double click must not consume two queue entries. */
async function continueRun(control: HTMLButtonElement): Promise<void> {
  control.disabled = true;
  try {
    const response: unknown = await browser.runtime.sendMessage({ type: 'naciocheck:continue' });
    if (!isContinued(response)) control.disabled = false;
  } catch {
    control.disabled = false;
  }
}

function isContinued(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && 'continued' in value && value.continued === true
  );
}

async function retryCheck(payload: ResultPayload): Promise<void> {
  await browser.runtime.sendMessage({
    type: 'naciocheck:retry',
    applicationId: payload.applicationId,
  });
}

function element(tag: string, className: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  if (className !== '') node.className = className;
  node.textContent = text;
  return node;
}

void main();
