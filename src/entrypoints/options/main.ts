import { REMINDER_PRESETS, type ReminderConfig } from '../../core/schedule';
import {
  type Application,
  deleteApplication,
  getSettings,
  listApplications,
  listChecks,
  setReminder,
} from '../../core/storage';
import { buildApplicationForm } from '../shared/application-form';
import { renderBackup, renderEncryption } from '../shared/encryption-sections';
import { button, el, formatDate, link, openPage, root } from '../shared/ui';

/**
 * Options: the applications, the reminder and the history. Everything is stored locally; nothing is synced.
 */

const WEEKDAYS: ReadonlyArray<{ day: number; label: string }> = [
  { day: 1, label: 'L' },
  { day: 2, label: 'M' },
  { day: 3, label: 'X' },
  { day: 4, label: 'J' },
  { day: 5, label: 'V' },
  { day: 6, label: 'S' },
  { day: 7, label: 'D' },
];

async function main(): Promise<void> {
  const view = root();
  view.append(el('h1', 'title', 'NacioCheck · Opciones'));

  await renderApplications(view);
  await renderReminder(view);
  await renderEncryption(view, () => redraw(view));
  await renderBackup(view);
  await renderHistory(view);

  view.append(
    el(
      'p',
      'disclaimer',
      'Todos los datos se guardan en este navegador. Nada se envía a ningún servidor, ni siquiera a los del navegador. NacioCheck no es una herramienta oficial del Ministerio de Justicia.',
    ),
  );
}

async function renderApplications(view: HTMLElement): Promise<void> {
  view.append(el('h2', 'section', 'Solicitudes'));

  const applications = await listApplications();
  if (applications.length === 0) {
    view.append(el('p', 'hint', 'Todavía no hay ninguna solicitud guardada.'));
  } else {
    const list = el('ul', 'apps');
    for (const application of applications) list.append(buildApplicationCard(application, view));
    view.append(list);
  }

  view.append(el('h2', 'section', 'Añadir otra'));
  view.append(buildApplicationForm((label) => announce(view, `Solicitud «${label}» guardada.`)));
}

function buildApplicationCard(application: Application, view: HTMLElement): HTMLElement {
  const card = el('li', 'app-card');
  card.append(el('p', 'label', application.label));
  card.append(
    el('p', 'meta', `Añadida el ${formatDate(application.createdAt)}`),
    button(
      'Borrar',
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

  view.append(el('h2', 'section', 'Recordatorios'));
  view.append(
    el(
      'p',
      'hint',
      'Elige una hora a la que suelas estar con el móvil o el ordenador: el captcha lo tienes que marcar tú.',
    ),
  );

  const form = el('form', 'fields');
  form.noValidate = true;

  const enabledLabel = el('label', 'check');
  const enabled = el('input');
  enabled.type = 'checkbox';
  enabled.checked = reminders.enabled;
  enabledLabel.append(enabled, document.createTextNode(' Avisarme'));

  const days = el('div', 'checks');
  const dayInputs = new Map<number, HTMLInputElement>();
  for (const weekday of WEEKDAYS) {
    const wrapper = el('label', 'check');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = reminders.weekdays.includes(weekday.day);
    dayInputs.set(weekday.day, input);
    wrapper.append(input, document.createTextNode(` ${weekday.label}`));
    days.append(wrapper);
  }

  const timeWrapper = el('div', 'field');
  const timeLabel = el('label', '', 'Hora');
  const time = el('input');
  time.type = 'time';
  time.value = reminders.time;
  timeLabel.htmlFor = 'reminder-time';
  time.id = 'reminder-time';
  timeWrapper.append(timeLabel, time);

  const presets = el('div', 'row');
  for (const preset of REMINDER_PRESETS) {
    presets.append(
      button(`Laborables a las ${preset.config.time}`, () => {
        applyPreset(preset.config, enabled, dayInputs, time);
      }),
    );
  }

  const message = el('p', 'hint');

  const save = button(
    'Guardar recordatorio',
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
            ? 'Recordatorio guardado.'
            : 'Recordatorio desactivado.';
        } catch (error) {
          message.textContent = `No se ha podido guardar: ${String(error)}`;
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

  view.append(el('h2', 'section', 'Historial'));
  view.append(
    link('Qué significa cada estado', () => {
      openPage('/statuses.html');
    }),
  );

  for (const application of applications) {
    const checks = await listChecks(application.id);
    const card = el('div', 'card');
    card.append(el('h3', '', application.label));
    if (checks.length === 0) {
      card.append(el('p', '', 'Sin comprobaciones.'));
    } else {
      const list = el('ul', 'history');
      for (const check of checks.slice(-5).reverse()) {
        list.append(
          el(
            'li',
            '',
            `${formatDate(check.at)} · ${check.outcome === 'status' ? check.raw : 'error: ' + check.raw}`,
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
