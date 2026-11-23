import { browser } from 'wxt/browser';
import { t, type MessageKey } from '../../core/i18n';
import { feedbackUrl, type ReportLocale } from '../../core/report';
import { announceAfter, button, el } from './ui';
import './report-panel.css';

/**
 * The "Report a problem" panel: the text that would be shared, editable, and two separate actions. Copy keeps it on
 * the clipboard; Continue opens the website's feedback page with it in the address fragment, which a browser does not
 * send to a server. Nothing is sent from here, and the panel itself makes no request.
 */

let nextId = 0;

export function reportPanel(
  report: string,
  locale: ReportLocale,
  summary: MessageKey = 'report.summary',
): HTMLElement {
  const panel = el('details', 'report-panel');
  panel.append(el('summary', 'report-summary', t(summary)));
  panel.append(el('p', 'hint', t('report.intro')));

  const field = el('div', 'field');
  const id = `report-text-${String(nextId++)}`;
  const label = el('label', '', t('report.textLabel'));
  label.htmlFor = id;
  const text = el('textarea', 'report-text');
  text.id = id;
  text.value = report;
  text.rows = 10;
  text.spellcheck = false;
  field.append(label, text);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text.value);
      announceAfter(actions, t('report.copied'));
    } catch {
      // No clipboard permission or no secure context: leave the text selected so Ctrl+C works.
      text.focus();
      text.select();
      announceAfter(actions, t('report.copyFailed'));
    }
  };

  const actions = el('div', 'row');
  actions.append(
    button(t('report.copy'), () => void copy()),
    button(
      t('report.continue'),
      () => void browser.tabs.create({ url: feedbackUrl(text.value, locale) }),
      'button primary',
    ),
  );

  panel.append(field, actions, el('p', 'hint', t('report.continueHint')));
  return panel;
}
