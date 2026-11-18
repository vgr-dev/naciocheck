import { type MessageKey, t } from '../../core/i18n';
import { REMINDER_PRESETS } from '../../core/schedule';
import { listApplications, setReminder } from '../../core/storage';
import { buildApplicationForm } from '../shared/application-form';
import { renderEncryption } from '../shared/encryption-sections';
import { initPageLocale } from '../shared/locale';
import { announceAfter, button, el, formatDate, markJustAdded, openPage, root } from '../shared/ui';

/**
 * First run: what the extension does, what it deliberately does not do, one application, the optional
 * encryption of what was saved and a reminder.
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
  // The form is drawn before the section, but the section reads the store the form writes, so a save draws it
  // again. Refreshing the section alone keeps the save announcement on screen.
  let refreshEncryption = (): void => undefined;
  const form = await buildApplicationForm((label) => {
    void (async () => {
      const added = await renderSaved(saved);
      announceAfter(form, t('options.saved', { label }));
      if (added !== null) markJustAdded(added);
      refreshEncryption();
    })();
  });
  view.append(form);

  // What is stored so far, under the form: a save used to leave no trace on the page. Drawn from the store, so the
  // list is also there when the page is drawn again (the encryption step does that).
  const saved = el('div', 'saved-applications');
  view.append(saved);
  await renderSaved(saved);

  // The optional step, with the same section as options: enabling it here encrypts what is already saved, and
  // the form above asks for the passphrase for anything added afterwards.
  view.append(el('p', 'hint', t('onboarding.encryptionOptional')));
  const encryption = await renderEncryption(view, () => redraw(view));
  refreshEncryption = (): void => {
    void encryption.refresh();
  };

  view.append(el('h2', 'section', t('onboarding.reminderTitle')));
  view.append(el('p', 'hint', t('onboarding.reminderHint')));

  const presets = el('div', 'row');
  for (const preset of REMINDER_PRESETS) {
    presets.append(
      button(t('options.preset', { time: preset.config.time }), () => {
        void (async () => {
          await setReminder(preset.config);
          await browser.runtime.sendMessage({ type: 'naciocheck:reschedule' });
          announceAfter(presets, t('onboarding.reminderSaved', { time: preset.config.time }));
        })();
      }),
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

/** The saved applications, one card each; returns the last card (the newest), or `null` when there are none. */
async function renderSaved(container: HTMLElement): Promise<HTMLElement | null> {
  const applications = await listApplications();
  container.replaceChildren();
  if (applications.length === 0) return null;

  container.append(el('h2', 'section', t('onboarding.savedTitle')));
  const list = el('ul', 'apps');
  const cards = applications.map((application) => {
    const card = el('li', 'app-card');
    card.append(
      el('p', 'label', application.label),
      el('p', 'meta', t('options.addedOn', { date: formatDate(application.createdAt) })),
    );
    return card;
  });
  list.append(...cards);
  container.append(list);
  return cards.at(-1) ?? null;
}

/** Renders the page again from the store, which is what the encryption section needs after it changes it. */
async function redraw(view: HTMLElement): Promise<void> {
  view.replaceChildren();
  await main();
}

void main();
