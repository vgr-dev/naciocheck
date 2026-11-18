import { t } from '../../core/i18n';
import { listApplications } from '../../core/storage';
import { brandHeader } from '../shared/brand';
import { initPageLocale } from '../shared/locale';
import { button, el, root } from '../shared/ui';

/**
 * The unlock prompt a check run opens when the identities are encrypted and no passphrase is held.
 *
 * The passphrase is kept in session storage by the background: it never touches disk and disappears when the
 * browser closes.
 */

async function main(): Promise<void> {
  const view = root();
  await initPageLocale();
  document.title = t('unlock.pageTitle');
  view.append(brandHeader(), el('h1', 'title', t('unlock.title')));
  view.append(el('p', 'hint', t('unlock.hint')));

  const applications = await listApplications();
  if (!applications.some((application) => application.identity.kind === 'encrypted')) {
    finish(t('unlock.nothingEncrypted'));
    return;
  }

  const field = el('div', 'field');
  const label = el('label', '', t('unlock.passphrase'));
  const input = el('input');
  input.type = 'password';
  input.id = 'passphrase';
  input.autocomplete = 'current-password';
  label.htmlFor = 'passphrase';
  field.append(label, input);

  const message = el('p', 'hint');

  const submit = button(
    t('unlock.submit'),
    () => {
      void (async () => {
        const response: unknown = await browser.runtime.sendMessage({
          type: 'naciocheck:unlock',
          passphrase: input.value,
        });

        if (!isUnlocked(response)) {
          message.textContent = t('unlock.failed');
          return;
        }
        // The background now finds the passphrase in session and opens the check window itself.
        await browser.runtime.sendMessage({ type: 'naciocheck:start-check-run' });
        window.close();
      })();
    },
    'button primary',
  );

  const actions = el('div', 'row');
  actions.append(submit);
  view.append(field, actions, message);
}

function finish(text: string): void {
  root().append(el('p', 'hint', text));
}

function isUnlocked(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && 'unlocked' in value && value.unlocked === true
  );
}

void main();
