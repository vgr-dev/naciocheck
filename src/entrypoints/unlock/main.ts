import { t } from '../../core/i18n';
import { listApplications } from '../../core/storage';
import { brandHeader } from '../shared/brand';
import { initPageLocale } from '../shared/locale';
import { button, el, root } from '../shared/ui';

/**
 * The unlock prompt a check run opens when the identities are encrypted and no passphrase is held.
 *
 * The passphrase is kept in session storage by the background: it never touches disk and disappears when the
 * browser closes. The applications the person asked to check are remembered by the background and come back
 * in the unlock response, so unlocking starts exactly that selection.
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
        if (submit.disabled) return;
        submit.disabled = true;
        try {
          const response: unknown = await browser.runtime.sendMessage({
            type: 'naciocheck:unlock',
            passphrase: input.value,
          });

          const selection = unlockedSelection(response);
          if (selection === null) {
            // No remembered selection means this prompt no longer belongs to a check the person asked for
            // (for example, an old unlock tab left open after locking). Never fall back to every application.
            message.textContent = t('unlock.failed');
            return;
          }
          // The typed passphrase has served its purpose: leave it nowhere, not even in this field.
          input.value = '';
          // The background now finds the passphrase in session and opens the check window itself, for the
          // selection the person asked to check before unlocking.
          await browser.runtime.sendMessage({
            type: 'naciocheck:start-check-run',
            applicationIds: selection,
          });
          window.close();
        } catch {
          message.textContent = t('unlock.failed');
        } finally {
          submit.disabled = false;
        }
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

/**
 * The explicit application selection the background remembered for this prompt. `null` means there is none
 * or it is malformed; an unlock response is never allowed to fall back to every saved application.
 */
export function unlockedSelection(value: unknown): string[] | null {
  if (typeof value !== 'object' || value === null) return null;
  if (!('unlocked' in value) || value.unlocked !== true) return null;
  if (!('applicationIds' in value)) return null;
  const ids = value.applicationIds;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  if (!ids.every((id): id is string => typeof id === 'string' && id !== '')) return null;
  return ids;
}

// The unlock page always has #app; tests import this module without a page.
if (document.getElementById('app') !== null) void main();
