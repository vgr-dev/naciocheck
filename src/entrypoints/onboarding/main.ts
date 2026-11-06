import { type MessageKey, t } from '../../core/i18n';
import { REMINDER_PRESETS } from '../../core/schedule';
import { listApplications, setReminder } from '../../core/storage';
import { buildApplicationForm } from '../shared/application-form';
import { initPageLocale } from '../shared/locale';
import { button, el, openPage, root } from '../shared/ui';

/**
 * First run: what the extension does, what it deliberately does not do, one application and a reminder.
 */

const DOES: readonly MessageKey[] = ['onboarding.does1', 'onboarding.does2', 'onboarding.does3'];
const DOES_NOT: readonly MessageKey[] = [
  'onboarding.doesNot1',
  'onboarding.doesNot2',
  'onboarding.doesNot3',
];

async function main(): Promise<void> {
  const view = root();
  await initPageLocale();
  document.title = t('onboarding.pageTitle');
  const header = el('div', 'row');
  const icon = el('img');
  icon.src = '/icon/icon-animated.svg';
  icon.alt = '';
  icon.width = 72;
  icon.height = 72;
  header.append(icon, el('h1', 'title', t('app.title')));
  view.append(header);

  view.append(el('p', 'subtitle', t('onboarding.subtitle')));

  const does = el('ul', 'history');
  for (const key of DOES) {
    does.append(el('li', '', t(key)));
  }

  const doesNot = el('ul', 'history');
  for (const key of DOES_NOT) {
    doesNot.append(el('li', '', t(key)));
  }

  view.append(
    el('h2', 'section', t('onboarding.doesTitle')),
    does,
    el('h2', 'section', t('onboarding.doesNotTitle')),
    doesNot,
  );

  view.append(el('h2', 'section', t('onboarding.applicationTitle')));
  view.append(buildApplicationForm((label) => announce(view, t('options.saved', { label }))));

  view.append(el('h2', 'section', t('onboarding.reminderTitle')));
  view.append(el('p', 'hint', t('onboarding.reminderHint')));

  const presets = el('div', 'row');
  for (const preset of REMINDER_PRESETS) {
    presets.append(
      button(
        t('options.preset', { time: preset.config.time }),
        () => {
          void (async () => {
            await setReminder(preset.config);
            await browser.runtime.sendMessage({ type: 'naciocheck:reschedule' });
            announce(view, t('onboarding.reminderSaved', { time: preset.config.time }));
          })();
        },
        'button primary',
      ),
    );
  }
  view.append(presets);

  const finish = el('div', 'row');
  finish.append(
    button(
      t('onboarding.finish'),
      () => {
        void (async () => {
          const applications = await listApplications();
          if (applications.length > 0) {
            await browser.runtime.sendMessage({ type: 'naciocheck:start-check-run' });
          } else {
            openPage('/options.html');
          }
        })();
      },
      'button primary',
    ),
    button(t('onboarding.changeLater'), () => {
      openPage('/options.html');
    }),
  );
  view.append(el('h2', 'section', t('onboarding.readyTitle')), finish);
}

function announce(view: HTMLElement, text: string): void {
  view.querySelector('.saved')?.remove();
  view.append(el('p', 'hint saved', text));
}

void main();
