import {
  type LanguageSetting,
  LOCALES,
  SELECTABLE_LOCALES,
  isLanguageSetting,
  resolveLocaleCode,
  t,
  weekdayLong,
  weekdayNarrow,
} from '../../core/i18n';
import { REMINDER_PRESETS, type ReminderConfig } from '../../core/schedule';
import {
  type Application,
  deleteApplication,
  getSettings,
  listApplications,
  readStore,
  setLanguage,
  setReminder,
} from '../../core/storage';
import { buildApplicationForm } from '../shared/application-form';
import { sharePanel } from '../shared/share-panel';
import { renderBackup, renderEncryption } from '../shared/encryption-sections';
import { initPageLocale } from '../shared/locale';
import { isStoreRecoveryNeeded, renderStoreRecovery } from '../shared/recovery';
import {
  announceAfter,
  button,
  el,
  formatDate,
  link,
  markJustAdded,
  openPage,
  root,
} from '../shared/ui';

/**
 * Options: the applications, the reminder, the language and the history. Everything is stored locally; nothing
 * is synced.
 */

const WEEKDAY_NUMBERS = [1, 2, 3, 4, 5, 6, 7];

async function main(): Promise<void> {
  const view = root();
  // Before anything is rendered: `t()` answers in the default locale until this has run.
  await initPageLocale();
  document.title = t('options.pageTitle');
  view.append(el('h1', 'title', t('options.title')));

  // The encryption section is drawn after the application form but reads the store that form changes, so the
  // page draws it again after a save.
  let refreshEncryption = (): void => undefined;
  const historyView = el('div');
  let historyRenderId = 0;
  const renderCurrentHistory = async (): Promise<void> => {
    const renderId = ++historyRenderId;
    await renderHistory(historyView, () => renderId === historyRenderId);
  };
  const refreshHistory = (): void => {
    void renderCurrentHistory();
  };

  await renderLanguage(view);
  await renderApplications(view, () => {
    refreshEncryption();
    refreshHistory();
  });
  await renderReminder(view);
  const encryption = await renderEncryption(view, () => redraw(view));
  refreshEncryption = (): void => {
    void encryption.refresh();
  };
  renderBackup(view, () => redraw(view));
  await renderCurrentHistory();
  view.append(historyView);

  view.append(el('p', 'disclaimer', t('options.disclaimer')));
}

/** The override: `auto` follows the browser, the rest are explicit. Saving redraws in the new language. */
async function renderLanguage(view: HTMLElement): Promise<void> {
  const { language } = await getSettings();

  view.append(el('h2', 'section', t('options.language')));
  view.append(el('p', 'hint', t('options.languageHint')));

  const wrapper = el('div', 'field');
  const caption = el('label', '', t('options.language'));
  const select = el('select');
  select.id = 'language';
  caption.htmlFor = 'language';

  const automatic = resolveLocaleCode('auto', browser.i18n.getUILanguage());
  const choices: Array<{ value: LanguageSetting; label: string }> = [
    { value: 'auto', label: t('options.languageAuto', { language: LOCALES[automatic].name }) },
    ...SELECTABLE_LOCALES.map((code) => ({ value: code, label: LOCALES[code].name })),
  ];
  // The pseudo-RTL dev locale is reachable by hand only; it shows up here once it is the stored value.
  if (language === 'qps') choices.push({ value: 'qps', label: LOCALES.qps.name });

  for (const choice of choices) {
    const option = el('option', '', choice.label);
    option.value = choice.value;
    option.selected = language === choice.value;
    select.append(option);
  }

  select.addEventListener('change', () => {
    void (async () => {
      if (!isLanguageSetting(select.value)) return;
      await setLanguage(select.value);
      await redraw(view);
    })();
  });

  wrapper.append(caption, select);
  view.append(wrapper);
}

async function renderApplications(view: HTMLElement, onSaved: () => void): Promise<void> {
  view.append(el('h2', 'section', t('options.applications')));

  // The list lives in a container of its own, so a save can draw it again without touching the rest of the page.
  const list = el('div', 'applications');
  view.append(list);
  await fillApplications(list, view);

  view.append(el('h2', 'section', t('options.addAnother')));
  const form = await buildApplicationForm((label) => {
    void (async () => {
      const cards = await fillApplications(list, view);
      announceAfter(form, t('options.saved', { label }));
      const added = cards.at(-1);
      if (added !== undefined) markJustAdded(added);
      onSaved();
    })();
  });
  view.append(form);
}

/** Draws the applications, or the line that says there are none; returns the cards, in order. */
async function fillApplications(container: HTMLElement, view: HTMLElement): Promise<HTMLElement[]> {
  const applications = await listApplications();
  container.replaceChildren();
  if (applications.length === 0) {
    container.append(el('p', 'hint', t('options.empty')));
    return [];
  }
  const list = el('ul', 'apps');
  const cards = applications.map((application) => buildApplicationCard(application, view));
  list.append(...cards);
  container.append(list);
  return cards;
}

function buildApplicationCard(application: Application, view: HTMLElement): HTMLElement {
  const card = el('li', 'app-card');
  renderCardSummary(card, application, view);
  return card;
}

/** The card as it reads when it is not being edited; also what cancelling an edit puts back. */
function renderCardSummary(card: HTMLElement, application: Application, view: HTMLElement): void {
  card.replaceChildren(el('p', 'label', application.label));

  const actions = el('div', 'row');
  actions.append(
    button(t('options.edit'), () => {
      void openEditForm(card, application, view);
    }),
    button(
      t('options.delete'),
      () => {
        void (async () => {
          if (!window.confirm(t('options.deleteConfirm', { label: application.label }))) return;
          await deleteApplication(application.id);
          await redraw(view);
        })();
      },
      'button danger',
    ),
  );

  card.append(
    el('p', 'meta', t('options.addedOn', { date: formatDate(application.createdAt) })),
    actions,
  );
}

/** The same form as "add", in place of the card, saving onto this application instead of adding one. */
async function openEditForm(
  card: HTMLElement,
  application: Application,
  view: HTMLElement,
): Promise<void> {
  const form = await buildApplicationForm(
    () => {
      void redraw(view);
    },
    { application },
  );
  form.append(
    button(t('options.cancelEdit'), () => {
      renderCardSummary(card, application, view);
    }),
  );
  card.replaceChildren(form);
}

async function renderReminder(view: HTMLElement): Promise<void> {
  const { reminders } = await getSettings();

  view.append(el('h2', 'section', t('options.reminders')));
  view.append(el('p', 'hint', t('options.remindersHint')));

  const form = el('form', 'fields');
  form.noValidate = true;

  const enabledLabel = el('label', 'check');
  const enabled = el('input');
  enabled.type = 'checkbox';
  enabled.checked = reminders.enabled;
  enabledLabel.append(enabled, document.createTextNode(` ${t('options.notifyMe')}`));

  const days = el('div', 'checks');
  const dayInputs = new Map<number, HTMLInputElement>();
  for (const day of WEEKDAY_NUMBERS) {
    const wrapper = el('label', 'check');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = reminders.weekdays.includes(day);
    dayInputs.set(day, input);
    // The letter alone is ambiguous: the full name is the box's accessible name and the label's tooltip.
    const fullName = weekdayLong(day);
    input.setAttribute('aria-label', fullName);
    wrapper.title = fullName;
    wrapper.append(input, document.createTextNode(` ${weekdayNarrow(day)}`));
    days.append(wrapper);
  }

  const timeWrapper = el('div', 'field');
  const timeLabel = el('label', '', t('options.hour'));
  const time = el('input');
  time.type = 'time';
  time.value = reminders.time;
  timeLabel.htmlFor = 'reminder-time';
  time.id = 'reminder-time';
  timeWrapper.append(timeLabel, time);

  const presets = el('div', 'row');
  for (const preset of REMINDER_PRESETS) {
    presets.append(
      button(t('options.preset', { time: preset.config.time }), () => {
        applyPreset(preset.config, enabled, dayInputs, time);
      }),
    );
  }

  const message = el('p', 'hint');

  const save = button(
    t('options.saveReminder'),
    () => {
      void (async () => {
        const config: ReminderConfig = {
          enabled: enabled.checked,
          weekdays: [...dayInputs.entries()]
            .filter(([, input]) => input.checked)
            .map(([day]) => day),
          time: time.value,
        };
        try {
          await setReminder(config);
          await browser.runtime.sendMessage({ type: 'naciocheck:reschedule' });
          message.textContent = config.enabled
            ? t('options.reminderSaved')
            : t('options.reminderOff');
        } catch (error) {
          message.textContent = t('options.reminderFailed', { error: String(error) });
        }
      })();
    },
    'button primary',
  );

  form.append(enabledLabel, days, timeWrapper, presets, save, message);
  view.append(form);
}

function applyPreset(
  config: ReminderConfig,
  enabled: HTMLInputElement,
  dayInputs: Map<number, HTMLInputElement>,
  time: HTMLInputElement,
): void {
  enabled.checked = true;
  time.value = config.time;
  for (const [day, input] of dayInputs) input.checked = config.weekdays.includes(day);
}

async function renderHistory(view: HTMLElement, isCurrent: () => boolean): Promise<void> {
  const store = await readStore();
  if (!isCurrent()) return;
  const applications = store.applications;
  if (applications.length === 0) {
    view.replaceChildren();
    return;
  }

  const section = el('section');
  section.id = 'history-section';

  section.append(el('h2', 'section', t('options.history')));
  const guide = el('p', 'hint');
  guide.append(
    link(t('options.whatMeans'), () => {
      openPage('/statuses.html');
    }),
  );
  section.append(guide);

  for (const application of applications) {
    const checks = store.checks.filter((check) => check.applicationId === application.id);
    const card = el('div', 'card');
    card.append(el('h3', '', application.label));
    if (application.editedAt !== undefined) {
      card.append(
        el('p', 'meta', t('options.editedOn', { date: formatDate(application.editedAt) })),
      );
    }
    if (checks.length === 0) {
      card.append(el('p', '', t('options.noChecks')));
    } else {
      const list = el('ul', 'history');
      for (const check of checks.slice(-5).reverse()) {
        list.append(
          el(
            'li',
            '',
            `${formatDate(check.at)} · ${
              check.outcome === 'status' ? check.raw : t('common.errorPrefix', { text: check.raw })
            }`,
          ),
        );
      }
      card.append(list);
    }
    card.append(sharePanel(application, checks));
    section.append(card);
  }
  view.replaceChildren(section);
}

async function redraw(view: HTMLElement): Promise<void> {
  view.replaceChildren();
  await main();
}

void main().catch((error: unknown) => {
  void (async () => {
    if (!(await isStoreRecoveryNeeded())) throw error;
    await renderStoreRecovery(root(), {
      error,
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
      onReset: () => window.location.reload(),
    });
  })();
});
