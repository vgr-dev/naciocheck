import {
  type Backup,
  exportStore,
  hasPlainIdentities,
  mergeStores,
  parseBackup,
} from '../../core/backup';
import { encryptIdentity, decryptIdentity } from '../../core/crypto';
import { t } from '../../core/i18n';
import { mutateStore, readStore } from '../../core/storage';
import { announceAfter, button, el, type ExtensionPage } from './ui';

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
    await fillEncryption(container, async (text) => {
      await redraw();
      const section = view.querySelector('.encryption');
      if (section !== null) announceAfter(section, text);
    });
  };

  await refresh();
  return { refresh };
}

async function fillEncryption(
  view: HTMLElement,
  redraw: (text: string) => Promise<void>,
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
            // Read now, not when the section was drawn: the application the person just added is the one this
            // button exists for, and reporting success while encrypting nothing would be a lie about the data.
            const secret = passphrase.value;
            try {
              await mutateStore(async (current) => {
                if (!hasPlainIdentities(current)) throw new Error(t('encryption.nothingToEncrypt'));
                const applications = await Promise.all(
                  current.applications.map(async (application) => {
                    if (application.identity.kind === 'encrypted') {
                      await decryptIdentity(application.identity, secret);
                      return application;
                    }
                    return {
                      ...application,
                      identity: await encryptIdentity(application.identity, secret),
                    };
                  }),
                );
                return { ...current, applications };
              });
            } catch (error) {
              message.textContent =
                error instanceof Error && error.message === t('encryption.nothingToEncrypt')
                  ? error.message
                  : t('encryption.failed');
              return;
            } finally {
              passphrase.value = '';
              repeated.value = '';
            }
            await browser.runtime
              .sendMessage({ type: 'naciocheck:unlock', passphrase: secret })
              .catch(() => undefined);
            await redraw(t('encryption.done'));
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
              const secret = passphrase.value;
              try {
                await mutateStore(async (current) => {
                  const applications = await Promise.all(
                    current.applications.map(async (application) => {
                      if (application.identity.kind === 'encrypted') {
                        await decryptIdentity(application.identity, secret);
                        return application;
                      }
                      return {
                        ...application,
                        identity: await encryptIdentity(application.identity, secret),
                      };
                    }),
                  );
                  return { ...current, applications };
                });
              } catch {
                message.textContent = t('encryption.repairFailed');
                return;
              } finally {
                passphrase.value = '';
              }
              await redraw(t('encryption.repaired'));
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
            if (!window.confirm(t('encryption.disableConfirm'))) return;
            const secret = passphrase.value;
            try {
              await mutateStore(async (current) => ({
                ...current,
                applications: await Promise.all(
                  current.applications.map(async (application) => ({
                    ...application,
                    identity:
                      application.identity.kind === 'encrypted'
                        ? await decryptIdentity(application.identity, secret)
                        : application.identity,
                  })),
                ),
              }));
            } catch {
              message.textContent = t('encryption.decryptFailed');
              return;
            } finally {
              passphrase.value = '';
            }
            await browser.runtime.sendMessage({ type: 'naciocheck:lock' }).catch(() => undefined);
            await redraw(t('encryption.disabled'));
          })();
        },
        'button danger',
      ),
      button(t('encryption.unlockSession'), () => {
        void (async () => {
          const response: unknown = await browser.runtime
            .sendMessage({
              type: 'naciocheck:unlock',
              passphrase: passphrase.value,
            })
            .catch(() => null);
          passphrase.value = '';
          message.textContent = isUnlocked(response)
            ? t('encryption.unlocked')
            : t('encryption.unlockFailed');
        })();
      }),
      button(t('encryption.lockNow'), () => {
        passphrase.value = '';
        void browser.runtime.sendMessage({ type: 'naciocheck:lock' }).then(
          () => {
            message.textContent = t('encryption.locked');
          },
          () => {
            message.textContent = t('encryption.unlockFailed');
          },
        );
      }),
    );
  }

  view.append(field);
  if (encrypted.length === 0) view.append(confirmation);
  view.append(actions, message);
}

export function renderBackup(page: HTMLElement, redraw: () => Promise<void>): void {
  const view = el('div', 'backup');
  page.append(view);
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

  const modeField = el('div', 'field');
  const modeLabel = el('label', '', t('backup.mode'));
  const mode = el('select');
  mode.id = 'backup-mode';
  modeLabel.htmlFor = mode.id;
  for (const value of ['merge', 'replace'] as const) {
    const option = el('option', '', t(`backup.${value}`));
    option.value = value;
    mode.append(option);
  }
  modeField.append(modeLabel, mode);

  const importButton = button(t('backup.import'), () => {
    void (async () => {
      const file = input.files?.[0];
      if (file === undefined) {
        message.textContent = t('backup.chooseFirst');
        return;
      }
      try {
        const imported = parseBackup(await file.text());
        const merge = mode.value === 'merge';
        const before = await readStore();
        if (
          before.applications.some((application) => application.identity.kind === 'encrypted') &&
          hasPlainIdentities(imported)
        ) {
          throw new Error(t('backup.encryptionRequired'));
        }
        if (
          !window.confirm(
            merge
              ? t('backup.confirmMerge')
              : t('backup.confirmReplace', {
                  applications: before.applications.length,
                  checks: before.checks.length,
                }),
          )
        )
          return;
        await mutateStore((current) => {
          if (JSON.stringify(current) !== JSON.stringify(before))
            throw new Error(t('backup.changed'));
          if (
            current.applications.some((application) => application.identity.kind === 'encrypted') &&
            hasPlainIdentities(imported)
          ) {
            throw new Error(t('backup.encryptionRequired'));
          }
          return merge ? mergeStores(current, imported) : imported;
        });
        await Promise.allSettled([
          browser.runtime.sendMessage({ type: 'naciocheck:lock' }),
          browser.runtime.sendMessage({ type: 'naciocheck:reschedule' }),
        ]);
        await redraw();
        const section = page.querySelector('.backup');
        if (section !== null)
          announceAfter(section, merge ? t('backup.merged') : t('backup.replaced'));
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
  view.append(exportRow, fileField, modeField, importRow, message);
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
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export type { Backup, ExtensionPage };
