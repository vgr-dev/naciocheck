import {
  type Backup,
  exportStore,
  hasPlainIdentities,
  mergeStores,
  parseBackup,
} from '../../core/backup';
import { encryptIdentity, decryptIdentity } from '../../core/crypto';
import { t } from '../../core/i18n';
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
  // A store can end up mixed: encryption was turned on, and an application added afterwards was written in
  // clear. Listing them and offering to encrypt them is the repair for that state.
  const plain = store.applications.filter((application) => application.identity.kind === 'plain');

  view.append(el('h2', 'section', t('encryption.title')));
  view.append(el('p', 'hint', t('encryption.hint')));

  const field = el('div', 'field');
  const label = el(
    'label',
    '',
    encrypted.length > 0 ? t('encryption.currentPassphrase') : t('encryption.passphrase'),
  );
  const passphrase = el('input');
  passphrase.type = 'password';
  passphrase.id = 'passphrase';
  passphrase.autocomplete = encrypted.length > 0 ? 'current-password' : 'new-password';
  label.htmlFor = 'passphrase';
  field.append(label, passphrase);

  const confirmation = el('div', 'field');
  const confirmationLabel = el('label', '', t('encryption.repeat'));
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
        t('encryption.enable'),
        () => {
          void (async () => {
            if (passphrase.value.length < 8) {
              message.textContent = t('encryption.tooShort');
              return;
            }
            if (passphrase.value !== repeated.value) {
              message.textContent = t('encryption.mismatch');
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
            message.textContent = t('encryption.done');
            await redraw();
          })();
        },
        'button primary',
      ),
    );
  } else {
    if (plain.length > 0) {
      view.append(
        el(
          'p',
          'hint',
          t('encryption.plainLeft', {
            count: plain.length,
            labels: plain.map((application) => application.label).join(', '),
          }),
        ),
      );
      actions.append(
        button(
          t('encryption.repair'),
          () => {
            void (async () => {
              const sample = encrypted[0];
              if (sample === undefined || sample.identity.kind !== 'encrypted') return;
              try {
                // The passphrase is checked against an identity that is already encrypted before anything is
                // written, exactly like the form does.
                await decryptIdentity(sample.identity, passphrase.value);
                for (const application of plain) {
                  if (application.identity.kind !== 'plain') continue;
                  const encryptedIdentity = await encryptIdentity(
                    application.identity,
                    passphrase.value,
                  );
                  await updateIdentity(application.id, encryptedIdentity);
                }
              } catch {
                message.textContent = t('encryption.repairFailed');
                return;
              }
              message.textContent = t('encryption.repaired');
              await redraw();
            })();
          },
          'button primary',
        ),
      );
    }

    actions.append(
      button(
        t('encryption.disable'),
        () => {
          void (async () => {
            try {
              for (const application of store.applications) {
                if (application.identity.kind !== 'encrypted') continue;
                const plain = await decryptIdentity(application.identity, passphrase.value);
                await updateIdentity(application.id, plain);
              }
            } catch {
              message.textContent = t('encryption.decryptFailed');
              return;
            }
            await browser.runtime.sendMessage({ type: 'naciocheck:lock' });
            message.textContent = t('encryption.disabled');
            await redraw();
          })();
        },
        'button danger',
      ),
      button(t('encryption.unlockSession'), () => {
        void (async () => {
          const response: unknown = await browser.runtime.sendMessage({
            type: 'naciocheck:unlock',
            passphrase: passphrase.value,
          });
          message.textContent = isUnlocked(response)
            ? t('encryption.unlocked')
            : t('encryption.unlockFailed');
        })();
      }),
    );
  }

  view.append(field, encrypted.length === 0 ? confirmation : el('div'), actions, message);
}

export async function renderBackup(view: HTMLElement): Promise<void> {
  view.append(el('h2', 'section', t('backup.title')));
  view.append(el('p', 'hint', t('backup.hint')));

  const message = el('p', 'hint');
  const store = await readStore();

  const exportButton = button(t('backup.export'), () => {
    if (hasPlainIdentities(store) && !window.confirm(t('backup.plainWarning'))) return;
    download(t('backup.filename'), exportStore(store));
    message.textContent = t('backup.exported');
  });

  const input = el('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.id = 'import-file';

  const importButton = button(t('backup.import'), () => {
    void (async () => {
      const file = input.files?.[0];
      if (file === undefined) {
        message.textContent = t('backup.chooseFirst');
        return;
      }
      try {
        const imported = parseBackup(await file.text());
        const merge = window.confirm(t('backup.mergeQuestion'));
        const current = await readStore();
        await replaceStore(merge ? mergeStores(current, imported) : imported);
        message.textContent = merge ? t('backup.merged') : t('backup.replaced');
      } catch (error) {
        message.textContent = t('backup.importFailed', { error: String(error) });
      }
    })();
  });

  const fileField = el('div', 'field');
  const fileLabel = el('label', '', t('backup.fileLabel'));
  fileLabel.htmlFor = 'import-file';
  fileField.append(fileLabel, input);

  view.append(el('div', 'row', ''), exportButton, fileField, importButton, message);
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
