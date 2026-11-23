import { buildShareSummary } from '../../core/share';
import { t } from '../../core/i18n';
import {
  firstStatusCheckAt,
  setFilingDate,
  type Application,
  type Check,
} from '../../core/storage';
import { filingDateError, localCalendarDate } from '../../core/validation';
import { announceAfter, button, el } from './ui';
import './share-panel.css';

let nextId = 0;

export function sharePanel(application: Application, checks: readonly Check[]): HTMLElement {
  const panel = el('details', 'share-panel');
  panel.append(el('summary', '', t('share.summary')));
  panel.append(el('p', 'hint', t('share.intro')));

  const dateField = el('div', 'field');
  const dateId = `share-date-${String(nextId++)}`;
  const dateLabel = el('label', '', t('share.dateLabel'));
  dateLabel.htmlFor = dateId;
  const date = el('input');
  date.type = 'date';
  date.id = dateId;
  date.value = application.filingDate ?? '';
  const earliestCheck = firstStatusCheckAt(checks);
  const today = localCalendarDate();
  const earliestDay = earliestCheck === null ? today : localCalendarDate(earliestCheck);
  date.max = earliestDay < today ? earliestDay : today;
  dateField.append(dateLabel, date, el('p', 'hint', t('share.dateHint')));

  const previewRegion = el('div', 'share-preview');
  const redrawPreview = (filingDate: string | null): void => {
    previewRegion.replaceChildren();
    const summary = buildShareSummary(checks, filingDate);
    if (summary === null) {
      previewRegion.append(el('p', 'hint', t('share.nothing')));
      return;
    }
    const previewField = el('div', 'field');
    const previewId = `share-text-${String(nextId++)}`;
    const previewLabel = el('label', '', t('share.previewLabel'));
    previewLabel.htmlFor = previewId;
    const preview = el('textarea', 'share-text');
    preview.id = previewId;
    preview.value = summary;
    preview.readOnly = true;
    preview.spellcheck = false;
    preview.rows = summary.split('\n').length;
    previewField.append(previewLabel, preview);

    const actions = el('div', 'row');
    const copy = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(preview.value);
        announceAfter(actions, t('share.copied'));
      } catch {
        preview.focus();
        preview.select();
        announceAfter(actions, t('share.copyFailed'));
      }
    };
    actions.append(button(t('share.copy'), () => void copy()));
    previewRegion.append(previewField, actions);
  };

  const actions = el('div', 'row');
  const save = async (filingDate: string | null): Promise<boolean> => {
    if (filingDate !== null) {
      const error = filingDateError(filingDate, earliestCheck);
      if (error !== null) {
        announceAfter(actions, error);
        return false;
      }
    }
    try {
      await setFilingDate(application.id, filingDate);
      const storedDate = filingDate?.trim() || null;
      redrawPreview(storedDate);
      announceAfter(actions, t(filingDate === null ? 'share.dateCleared' : 'share.dateSaved'));
      return true;
    } catch {
      announceAfter(actions, t('share.saveFailed'));
      return false;
    }
  };
  actions.append(
    button(t('share.saveDate'), () => {
      if (date.validity.badInput) {
        announceAfter(actions, t('validation.filingDate'));
        return;
      }
      void save(date.value === '' ? null : date.value);
    }),
    button(t('share.clearDate'), () => {
      void save(null).then((saved) => {
        if (saved) date.value = '';
      });
    }),
  );

  panel.append(dateField, actions, previewRegion);
  redrawPreview(application.filingDate ?? null);
  return panel;
}
