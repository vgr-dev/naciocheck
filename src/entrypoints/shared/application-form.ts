import { decryptIdentity, encryptIdentity } from '../../core/crypto';
import { t } from '../../core/i18n';
import {
  addApplication,
  type Application,
  type EncryptedIdentity,
  type Identity,
  type PlainIdentity,
  readStore,
} from '../../core/storage';
import { type IdentityErrors, type IdentityField, validateIdentity } from '../../core/validation';
import { button, el } from './ui';

/**
 * The "add an application" form, shared by onboarding and options so the rules live in one place.
 *
 * When the store is encrypted the form asks for the passphrase, checks it by opening an identity that is
 * already encrypted, and encrypts the new one with it. Nothing is written unless the passphrase opens the
 * store, and the passphrase is kept nowhere afterwards (D5): not in storage, not in a variable, not in the
 * field.
 */

/** What the form can show an error for: the identity fields, the label, and the passphrase. */
type FormField = IdentityField | 'label' | 'passphrase';

const IDENTITY_FIELDS: readonly IdentityField[] = ['nie', 'numero', 'year', 'birthDate'];

function isIdentityField(key: FormField): key is IdentityField {
  return IDENTITY_FIELDS.includes(key as IdentityField);
}

/** The identity the passphrase is checked against, or `null` when nothing is encrypted yet. */
async function encryptedIdentityInStore(): Promise<EncryptedIdentity | null> {
  const applications: readonly Application[] = (await readStore()).applications;
  for (const application of applications) {
    if (application.identity.kind === 'encrypted') return application.identity;
  }
  return null;
}

/**
 * Built per call, not at import time: the labels go through `t()`, and the locale is only known once the page
 * has read its settings.
 */
function fields(): ReadonlyArray<{
  key: IdentityField;
  label: string;
  type: string;
  placeholder: string;
}> {
  return [
    { key: 'nie', label: t('form.fieldNie'), type: 'text', placeholder: 'X1234567L' },
    { key: 'numero', label: t('form.fieldNumero'), type: 'text', placeholder: 'R500001' },
    { key: 'year', label: t('form.fieldYear'), type: 'text', placeholder: '2015' },
    { key: 'birthDate', label: t('form.fieldBirthDate'), type: 'date', placeholder: '' },
  ];
}

export async function buildApplicationForm(onSaved: (label: string) => void): Promise<HTMLElement> {
  const form = el('form', 'fields');
  form.noValidate = true;

  // Read once at build time to decide whether to ask: the pages rebuild the form whenever the store changes.
  const encryptedAtBuild = await encryptedIdentityInStore();

  const inputs = new Map<FormField, HTMLInputElement>();
  const errors = new Map<FormField, HTMLElement>();

  const addField = (key: FormField, label: string, type: string, placeholder: string): void => {
    const wrapper = el('div', 'field');
    const id = `field-${key}`;
    const input = el('input');
    input.type = type;
    input.id = id;
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    const error = el('span', 'error');
    error.hidden = true;

    const caption = el('label', '', label);
    caption.htmlFor = id;

    wrapper.append(caption, input, error);
    form.append(wrapper);
    inputs.set(key, input);
    errors.set(key, error);
  };

  addField('label', t('form.labelName'), 'text', t('form.labelPlaceholder'));
  for (const field of fields()) addField(field.key, field.label, field.type, field.placeholder);
  if (encryptedAtBuild !== null) {
    addField('passphrase', t('form.passphrase'), 'password', '');
    const passphrase = inputs.get('passphrase');
    if (passphrase !== undefined) passphrase.autocomplete = 'current-password';
    form.append(el('p', 'hint', t('form.passphraseHint')));
  }

  const showErrors = (found: IdentityErrors, extra: Partial<Record<FormField, string>>): void => {
    for (const [key, input] of inputs) {
      const message = isIdentityField(key) ? (found[key] ?? null) : (extra[key] ?? null);
      const error = errors.get(key);
      input.setAttribute('aria-invalid', message === null ? 'false' : 'true');
      if (error !== undefined) {
        error.textContent = message ?? '';
        error.hidden = message === null;
      }
    }
  };

  const submit = button(
    t('form.submit'),
    () => {
      void (async () => {
        const label = inputs.get('label')?.value.trim() ?? '';
        const identity = {
          nie: inputs.get('nie')?.value.trim().toUpperCase() ?? '',
          numero: inputs.get('numero')?.value.trim().toUpperCase() ?? '',
          year: inputs.get('year')?.value.trim() ?? '',
          birthDate: inputs.get('birthDate')?.value.trim() ?? '',
        };
        const plainIdentity: PlainIdentity = { kind: 'plain', ...identity };

        const found = validateIdentity(identity);
        const extra: Partial<Record<FormField, string>> = {};
        if (label === '') extra.label = t('form.errorLabel');

        // The store is read again here: a form built while encryption was off must not write plain once it is
        // on. When encryption is on, nothing is stored unless the passphrase opens an existing identity.
        const encryptedNow = await encryptedIdentityInStore();
        const passphraseInput = inputs.get('passphrase');
        let toStore: Identity = plainIdentity;
        if (encryptedNow !== null) {
          if (passphraseInput === undefined) {
            extra.passphrase = t('form.reloadPassphrase');
          } else if (passphraseInput.value === '') {
            extra.passphrase = t('form.errorPassphrase');
          } else {
            try {
              await decryptIdentity(encryptedNow, passphraseInput.value);
              toStore = await encryptIdentity(plainIdentity, passphraseInput.value);
            } catch {
              extra.passphrase = t('form.errorPassphraseWrong');
            }
          }
        }

        showErrors(found, extra);
        if (Object.keys(found).length > 0 || Object.keys(extra).length > 0) return;

        await addApplication({ label, identity: toStore });
        form.reset();
        // `form.reset()` already emptied it; stated because D5 makes it a rule, not an implementation detail.
        if (passphraseInput !== undefined) passphraseInput.value = '';
        onSaved(label);
      })();
    },
    'button primary',
  );

  form.append(submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit.click();
  });

  return form;
}
