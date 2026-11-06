import { t } from '../../core/i18n';
import { addApplication } from '../../core/storage';
import { type IdentityErrors, type IdentityField, validateIdentity } from '../../core/validation';
import { button, el } from './ui';

/** The "add an application" form, shared by onboarding and options so the rules live in one place. */

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

export function buildApplicationForm(onSaved: (label: string) => void): HTMLElement {
  const form = el('form', 'fields');
  form.noValidate = true;

  const inputs = new Map<IdentityField | 'label', HTMLInputElement>();
  const errors = new Map<IdentityField | 'label', HTMLElement>();

  const addField = (
    key: IdentityField | 'label',
    label: string,
    type: string,
    placeholder: string,
  ): void => {
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

  const showErrors = (found: IdentityErrors, labelError: string | null): void => {
    for (const [key, input] of inputs) {
      const message = key === 'label' ? labelError : (found[key] ?? null);
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
        const labelError = label === '' ? t('form.errorLabel') : null;
        const found = validateIdentity(identity);
        showErrors(found, labelError);
        if (labelError !== null || Object.keys(found).length > 0) return;

        await addApplication({ label, identity: { kind: 'plain', ...identity } });
        form.reset();
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
