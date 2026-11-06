import {
  type Backup,
  exportStore,
  hasPlainIdentities,
  mergeStores,
  parseBackup,
} from '../../core/backup';
import { encryptIdentity, decryptIdentity } from '../../core/crypto';
import { readStore, replaceStore, updateIdentity } from '../../core/storage';
import { button, el, type ExtensionPage } from './ui';

/** The encryption and backup sections of the options page, kept in one place because they share the store. */

export async function renderEncryption(
  view: HTMLElement,
  redraw: () => Promise<void>,
): Promise<void> {
  const store = await readStore();
  const encrypted = store.applications.filter(
    (application) => application.identity.kind === 'encrypted',
  );

  view.append(el('h2', 'section', 'Cifrado'));
  view.append(
    el(
      'p',
      'hint',
      'Cifrar guarda el NIE y la fecha de nacimiento con una contraseña tuya, en este navegador. Si la olvidas no se pueden recuperar: el historial se queda, pero tendrás que volver a escribir las solicitudes.',
    ),
  );

  const field = el('div', 'field');
  const label = el('label', '', encrypted.length > 0 ? 'Contraseña actual' : 'Contraseña');
  const passphrase = el('input');
  passphrase.type = 'password';
  passphrase.id = 'passphrase';
  passphrase.autocomplete = encrypted.length > 0 ? 'current-password' : 'new-password';
  label.htmlFor = 'passphrase';
  field.append(label, passphrase);

  const confirmation = el('div', 'field');
  const confirmationLabel = el('label', '', 'Repite la contraseña');
  const repeated = el('input');
  repeated.type = 'password';
  repeated.id = 'passphrase-repeat';
  repeated.autocomplete = 'new-password';
  confirmationLabel.htmlFor = 'passphrase-repeat';
  confirmation.append(confirmationLabel, repeated);

  const message = el('p', 'hint');

  const actions = el('div', 'row');
  if (encrypted.length === 0) {
    actions.append(
      button(
        'Cifrar los datos',
        () => {
          void (async () => {
            if (passphrase.value.length < 8) {
              message.textContent = 'Usa una contraseña de al menos 8 caracteres.';
              return;
            }
            if (passphrase.value !== repeated.value) {
              message.textContent = 'Las dos contraseñas no coinciden.';
              return;
            }
            for (const application of store.applications) {
              if (application.identity.kind !== 'plain') continue;
              const encryptedIdentity = await encryptIdentity(
                application.identity,
                passphrase.value,
              );
              await updateIdentity(application.id, encryptedIdentity);
            }
            await browser.runtime.sendMessage({
              type: 'naciocheck:unlock',
              passphrase: passphrase.value,
            });
            message.textContent = 'Datos cifrados. Guarda la contraseña en un sitio seguro.';
            await redraw();
          })();
        },
        'button primary',
      ),
    );
  } else {
    actions.append(
      button(
        'Quitar el cifrado',
        () => {
          void (async () => {
            try {
              for (const application of store.applications) {
                if (application.identity.kind !== 'encrypted') continue;
                const plain = await decryptIdentity(application.identity, passphrase.value);
                await updateIdentity(application.id, plain);
              }
            } catch {
              message.textContent = 'No se ha podido descifrar: ¿está bien la contraseña?';
              return;
            }
            await browser.runtime.sendMessage({ type: 'naciocheck:lock' });
            message.textContent = 'Cifrado desactivado.';
            await redraw();
          })();
        },
        'button danger',
      ),
      button('Desbloquear para esta sesión', () => {
        void (async () => {
          const response: unknown = await browser.runtime.sendMessage({
            type: 'naciocheck:unlock',
            passphrase: passphrase.value,
          });
          message.textContent = isUnlocked(response)
            ? 'Desbloqueado hasta que cierres el navegador.'
            : 'No se ha podido desbloquear.';
        })();
      }),
    );
  }

  view.append(field, encrypted.length === 0 ? confirmation : el('div'), actions, message);
}

export async function renderBackup(view: HTMLElement): Promise<void> {
  view.append(el('h2', 'section', 'Copia de seguridad'));
  view.append(
    el(
      'p',
      'hint',
      'Exporta todo a un archivo para guardarlo o moverlo a otro navegador. El archivo se queda en tu equipo: nada sale de aquí.',
    ),
  );

  const message = el('p', 'hint');
  const store = await readStore();

  const exportButton = button('Exportar', () => {
    if (hasPlainIdentities(store) && !window.confirm(plainWarning())) return;
    download('naciocheck-copia.json', exportStore(store));
    message.textContent = 'Copia exportada.';
  });

  const input = el('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.id = 'import-file';

  const importButton = button('Importar el archivo elegido', () => {
    void (async () => {
      const file = input.files?.[0];
      if (file === undefined) {
        message.textContent = 'Elige antes un archivo.';
        return;
      }
      try {
        const imported = parseBackup(await file.text());
        const merge = window.confirm(
          'Aceptar = añadir lo que falte a lo que ya tienes. Cancelar = reemplazar todo por el archivo.',
        );
        const current = await readStore();
        await replaceStore(merge ? mergeStores(current, imported) : imported);
        message.textContent = merge
          ? 'Importado y combinado.'
          : 'Importado, reemplazando lo anterior.';
      } catch (error) {
        message.textContent = `No se ha podido importar: ${String(error)}`;
      }
    })();
  });

  const fileField = el('div', 'field');
  const fileLabel = el('label', '', 'Archivo de copia');
  fileLabel.htmlFor = 'import-file';
  fileField.append(fileLabel, input);

  view.append(el('div', 'row', ''), exportButton, fileField, importButton, message);
}

function plainWarning(): string {
  return 'La copia incluirá el NIE y la fecha de nacimiento sin cifrar. ¿Continuar?';
}

function isUnlocked(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && 'unlocked' in value && value.unlocked === true
  );
}

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = el('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type { Backup, ExtensionPage };
