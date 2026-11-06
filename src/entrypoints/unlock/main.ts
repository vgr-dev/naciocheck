import { listApplications } from '../../core/storage';
import { button, el, root } from '../shared/ui';

/**
 * The unlock prompt a check run opens when the identities are encrypted and no passphrase is held.
 *
 * The passphrase is kept in session storage by the background: it never touches disk and disappears when the
 * browser closes.
 */

async function main(): Promise<void> {
  const view = root();
  view.append(el('h1', 'title', 'Desbloquear'));
  view.append(
    el(
      'p',
      'hint',
      'Escribe la contraseña con la que cifraste los datos. Si la has olvidado, no hay forma de recuperarla: puedes volver a guardar las solicitudes.',
    ),
  );

  const applications = await listApplications();
  if (!applications.some((application) => application.identity.kind === 'encrypted')) {
    finish('No hay nada cifrado. Puedes cerrar esta pestaña.');
    return;
  }

  const field = el('div', 'field');
  const label = el('label', '', 'Contraseña');
  const input = el('input');
  input.type = 'password';
  input.id = 'passphrase';
  input.autocomplete = 'current-password';
  label.htmlFor = 'passphrase';
  field.append(label, input);

  const message = el('p', 'hint');

  const submit = button(
    'Desbloquear y empezar',
    () => {
      void (async () => {
        const response: unknown = await browser.runtime.sendMessage({
          type: 'naciocheck:unlock',
          passphrase: input.value,
        });

        if (!isUnlocked(response)) {
          message.textContent = 'No se ha podido desbloquear. ¿Está bien la contraseña?';
          return;
        }
        // The background now finds the passphrase in session and opens the check window itself.
        await browser.runtime.sendMessage({ type: 'naciocheck:start-check-run' });
        window.close();
      })();
    },
    'button primary',
  );

  view.append(field, submit, message);
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
