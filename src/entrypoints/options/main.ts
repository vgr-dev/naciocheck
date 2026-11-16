import {
  type LanguageSetting,
  LOCALES,
  SELECTABLE_LOCALES,
  isLanguageSetting,
  resolveLocaleCode,
  t,
  weekdayNarrow,
} from '../../core/i18n';
import { REMINDER_PRESETS, type ReminderConfig } from '../../core/schedule';
import {
  type Application,
  deleteApplication,
  getSettings,
  listApplications,
  listChecks,
  setLanguage,
  setReminder,
} from '../../core/storage';
import { buildApplicationForm } from '../shared/application-form';
import { renderBackup, renderEncryption } from '../shared/encryption-sections';
import { initPageLocale } from '../shared/locale';
import { button, el, formatDate, link, openPage, root } from '../shared/ui';

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

  await renderLanguage(view);
  await renderApplications(view);
  await renderReminder(view);
  await renderEncryption(view, () => redraw(view));
  await renderBackup(view);
  await renderHistory(view);

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

async function renderApplications(view: HTMLElement): Promise<void> {
  view.append(el('h2', 'section', t('options.applications')));

  const applications = await listApplications();
  if (applications.length === 0) {
    view.append(el('p', 'hint', t('options.empty')));
  } else {
    const list = el('ul', 'apps');
    for (const application of applications) list.append(buildApplicationCard(application, view));
    view.append(list);
  }

  view.append(el('h2', 'section', t('options.addAnother')));
  view.append(await buildApplicationForm((label) => announce(view, t('options.saved', { label }))));
}

function buildApplicationCard(application: Application, view: HTMLElement): HTMLElement {
  const card = el('li', 'app-card');
  card.append(el('p', 'label', application.label));
  card.append(
    el('p', 'meta', t('options.addedOn', { date: formatDate(application.createdAt) })),
    button(
      t('options.delete'),
      () => {
        void (async () => {
          await deleteApplication(application.id);
          await redraw(view);
        })();
      },
      'button danger',
    ),
  );
  return card;
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

async function renderHistory(view: HTMLElement): Promise<void> {
  const applications = await listApplications();
  if (applications.length === 0) return;

  view.append(el('h2', 'section', t('options.history')));
  view.append(
    link(t('options.whatMeans'), () => {
      openPage('/statuses.html');
    }),
  );

  for (const application of applications) {
    const checks = await listChecks(application.id);
    const card = el('div', 'card');
    card.append(el('h3', '', application.label));
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
    view.append(card);
  }
}

function announce(view: HTMLElement, text: string): void {
  const previous = view.querySelector('.saved');
  previous?.remove();
  const note = el('p', 'hint saved', text);
  view.append(note);
}

async function redraw(view: HTMLElement): Promise<void> {
  view.replaceChildren();
  await main();
}

void main();
