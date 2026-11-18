import { browser } from 'wxt/browser';
import type { ResultView } from '../../core/alerts';
import { t } from '../../core/i18n';
import { initPageLocale } from '../shared/locale';

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
}

const app = document.getElementById('app');

function isResultPayload(value: unknown): value is ResultPayload {
  return typeof value === 'object' && value !== null && 'view' in value && 'applicationId' in value;
}

async function main(): Promise<void> {
  if (app === null) return;
  await initPageLocale();
  document.title = t('app.title');
  const response: unknown = await browser.runtime.sendMessage({
    type: 'naciocheck:result-request',
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

  if (view.view !== 'status') {
    app.append(buildBanner(view));
  }

  app.append(element('p', 'label', view.label));

  if (view.status !== null) {
    app.append(element('h1', 'status', view.status.title));
    if (view.status.subStatus !== null) {
      app.append(element('p', 'sub-status', view.status.subStatus));
    }
    if (view.versionLine !== '') {
      app.append(element('p', 'version', view.versionLine));
    }
  }

  if (view.previous !== null) {
    app.append(element('p', 'previous', view.previous.text));
  }

  if (view.errorMessages.length > 0) {
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
  app.append(buildActions(payload));
}

function buildBanner(view: ResultView): HTMLElement {
  const banner = document.createElement('div');
  banner.className = `banner ${view.view}`;
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
    const next = element('button', 'primary', t('result.next'));
    next.addEventListener('click', () => {
      void browser.runtime.sendMessage({ type: 'naciocheck:continue' });
    });
    actions.append(next);
  }

  return actions;
}

async function acknowledgeChange(payload: ResultPayload): Promise<void> {
  await browser.runtime.sendMessage({ type: 'naciocheck:acknowledge', checkId: payload.checkId });
  if (app !== null) {
    const banner = app.querySelector('.banner.changed');
    banner?.classList.remove('changed');
    app.querySelector('.actions')?.replaceChildren();
  }
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
