import { decryptIdentity, encryptIdentity } from '../../core/crypto';
import { t } from '../../core/i18n';
import {
  addApplication,
  type Application,
  type EncryptedIdentity,
  type Identity,
  type PlainIdentity,
  readStore,
  updateApplication,
} from '../../core/storage';
import { type IdentityErrors, type IdentityField, validateIdentity } from '../../core/validation';
import { button, el } from './ui';

/**
 * The application form, shared by onboarding and options so the rules live in one place: it adds one and, with
 * an application in its options, edits it.
 *
 * When the store is encrypted the form asks for the passphrase, checks it by opening an identity that is
 * already encrypted, and encrypts what it writes with it. Nothing is written unless the passphrase opens the
 * store, and the passphrase is kept nowhere afterwards (D5): not in storage, not in a variable, not in the
 * field. An encrypted identity is only shown once the passphrase opens it; the label can be edited without it.
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

export interface ApplicationFormOptions {
  /** The application being edited; absent when the form adds a new one. */
  readonly application?: Application;
}

export async function buildApplicationForm(
  onSaved: (label: string) => void,
  options: ApplicationFormOptions = {},
): Promise<HTMLElement> {
  const editing = options.application ?? null;
  const form = el('form', 'fields');
  form.noValidate = true;

  // Read once at build time to decide whether to ask: the pages rebuild the form whenever the store changes.
  const encryptionOn = (await encryptedIdentityInStore()) !== null;
  // An encrypted identity cannot be shown until the passphrase opens it. The label can always be edited, so the
  // identity stays locked (and untouched) until then.
  let identityEditable = editing === null || editing.identity.kind === 'plain';

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

  const setIdentityValues = (identity: PlainIdentity): void => {
    const values: ReadonlyArray<readonly [IdentityField, string]> = [
      ['nie', identity.nie],
      ['numero', identity.numero],
      ['year', identity.year],
      ['birthDate', identity.birthDate],
    ];
    for (const [key, value] of values) {
      const input = inputs.get(key);
      if (input !== undefined) input.value = value;
    }
  };

  const setIdentityEnabled = (enabled: boolean): void => {
    for (const key of IDENTITY_FIELDS) {
      const input = inputs.get(key);
      if (input !== undefined) input.disabled = !enabled;
    }
  };

  addField('label', t('form.labelName'), 'text', t('form.labelPlaceholder'));
  for (const field of fields()) addField(field.key, field.label, field.type, field.placeholder);

  const labelInput = inputs.get('label');
  if (labelInput !== undefined && editing !== null) labelInput.value = editing.label;
  if (editing !== null && editing.identity.kind === 'plain') setIdentityValues(editing.identity);

  if (encryptionOn) {
    addField(
      'passphrase',
      editing === null ? t('form.passphrase') : t('form.editPassphrase'),
      'password',
      '',
    );
    const passphrase = inputs.get('passphrase');
    if (passphrase !== undefined) passphrase.autocomplete = 'current-password';
    form.append(
      el('p', 'hint', editing === null ? t('form.passphraseHint') : t('form.editPassphraseHint')),
    );
  }

  if (editing !== null && editing.identity.kind === 'encrypted') {
    setIdentityEnabled(false);

    const reveal = button(t('form.revealIdentity'), () => {
      void (async () => {
        const stored = editing.identity;
        const passphrase = inputs.get('passphrase');
        if (passphrase === undefined || stored.kind !== 'encrypted') return;
        if (passphrase.value === '') {
          showErrors({}, { passphrase: t('form.errorPassphrase') });
          return;
        }
        try {
          setIdentityValues(await decryptIdentity(stored, passphrase.value));
        } catch {
          showErrors({}, { passphrase: t('form.errorPassphraseWrong') });
          return;
        }
        setIdentityEnabled(true);
        identityEditable = true;
        showErrors({}, {});
      })();
    });
    form.append(reveal);
  }

  const submit = button(
    t(editing === null ? 'form.submit' : 'form.saveChanges'),
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

        const extra: Partial<Record<FormField, string>> = {};
        if (label === '') extra.label = t('form.errorLabel');
        // While the identity is locked only the label can change, so the identity fields are not validated.
        const found = identityEditable ? validateIdentity(identity) : {};

        let toStore: Identity | undefined;
        if (identityEditable) {
          toStore = plainIdentity;
          // The store is read again here: a form built while encryption was off must not write plain once it
          // is on. With encryption in force, nothing is written unless the passphrase opens the store.
          const encryptedNow = await encryptedIdentityInStore();
          const sample =
            editing !== null && editing.identity.kind === 'encrypted'
              ? editing.identity
              : encryptedNow;
          if (sample !== null) {
            const passphrase = inputs.get('passphrase');
            if (passphrase === undefined) {
              extra.passphrase = t('form.reloadPassphrase');
            } else if (passphrase.value === '') {
              extra.passphrase = t('form.errorPassphrase');
            } else {
              try {
                await decryptIdentity(sample, passphrase.value);
                toStore = await encryptIdentity(plainIdentity, passphrase.value);
              } catch {
                extra.passphrase = t('form.errorPassphraseWrong');
              }
            }
          }
        }

        showErrors(found, extra);
        if (Object.keys(found).length > 0 || Object.keys(extra).length > 0) return;

        if (editing === null) {
          await addApplication({ label, identity: toStore ?? plainIdentity });
        } else if (toStore === undefined) {
          await updateApplication(editing.id, { label });
        } else {
          await updateApplication(editing.id, { label, identity: toStore });
        }

        form.reset();
        // `form.reset()` already emptied it; stated because D5 makes it a rule, not an implementation detail.
        const passphrase = inputs.get('passphrase');
        if (passphrase !== undefined) passphrase.value = '';
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
