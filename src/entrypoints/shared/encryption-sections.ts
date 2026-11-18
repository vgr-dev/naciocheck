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

/** What a page needs from the section after the store changes underneath it. */
export interface EncryptionSection {
  /** Draws the section again: its on/off state and the list of plain identities follow the store. */
  refresh: () => Promise<void>;
}

/**
 * The encryption section, in a container of its own so a page can redraw it without redrawing the page.
 *
 * Every action reads the store when it runs, never the copy the section was drawn from: a first run adds the
 * application and turns encryption on in the same visit, and a section holding the store of a moment ago would
 * encrypt nothing and say it had.
 */
export async function renderEncryption(
  view: HTMLElement,
  redraw: () => Promise<void>,
): Promise<EncryptionSection> {
  const container = el('div', 'encryption');
  view.append(container);

  const refresh = async (): Promise<void> => {
    container.replaceChildren();
    await fillEncryption(container, redraw);
  };

  await refresh();
  return { refresh };
}

async function fillEncryption(view: HTMLElement, redraw: () => Promise<void>): Promise<void> {
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
            // Read now, not when the section was drawn: the application the person just added is the one this
            // button exists for, and reporting success while encrypting nothing would be a lie about the data.
            const current = await readStore();
            const plainNow = current.applications.filter(
              (application) => application.identity.kind === 'plain',
            );
            if (plainNow.length === 0) {
              message.textContent = t('encryption.nothingToEncrypt');
              return;
            }
            for (const application of current.applications) {
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
              const current = await readStore();
              const sample = current.applications.find(
                (application) => application.identity.kind === 'encrypted',
              );
              if (sample === undefined || sample.identity.kind !== 'encrypted') return;
              try {
                // The passphrase is checked against an identity that is already encrypted before anything is
                // written, exactly like the form does.
                await decryptIdentity(sample.identity, passphrase.value);
                for (const application of current.applications) {
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
            const current = await readStore();
            for (const application of current.applications) {
              if (application.identity.kind !== 'encrypted') continue;
              try {
                const decrypted = await decryptIdentity(application.identity, passphrase.value);
                await updateIdentity(application.id, decrypted);
              } catch {
                message.textContent = t('encryption.decryptFailed');
                return;
              }
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

  view.append(field);
  if (encrypted.length === 0) view.append(confirmation);
  view.append(actions, message);
}

export function renderBackup(view: HTMLElement): void {
  view.append(el('h2', 'section', t('backup.title')));
  view.append(el('p', 'hint', t('backup.hint')));

  const message = el('p', 'hint');

  const exportButton = button(t('backup.export'), () => {
    void (async () => {
      // The store as it is now: an application added in clear after this page was drawn must not slip past the
      // warning, and the file must be the store the person is looking at.
      const current = await readStore();
      if (hasPlainIdentities(current) && !window.confirm(t('backup.plainWarning'))) return;
      download(t('backup.filename'), exportStore(current));
      message.textContent = t('backup.exported');
    })();
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

  // Each button in a row of its own, so the page's spacing rules (not stray line boxes) keep it clear of the
  // content above and below.
  const exportRow = el('div', 'row');
  exportRow.append(exportButton);
  const importRow = el('div', 'row');
  importRow.append(importButton);
  view.append(exportRow, fileField, importRow, message);
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
