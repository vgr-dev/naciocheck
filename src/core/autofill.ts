import type { PlainIdentity } from './storage';

/**
 * The official form: filling it, reading the captcha token and deciding when it is safe to submit.
 *
 * Everything here is a pure function over a `Document`, so it can be tested against the saved markup in
 * `tests/fixtures/form.html` and reused unchanged by the content script.
 */

export const FORM_SELECTOR = 'form#idFormuNac';

/**
 * Fields by `name`, never by id: the live markup gives the NIE and the birth-date input the *same* id
 * (`codigoNieCompleto`), so `#codigoNieCompleto` is ambiguous.
 */
export const FIELD_NAMES = {
  nie: 'formuNac.codigoNieCompleto',
  numero: 'formuNac.numero',
  year: 'formuNac.yearSolicitud',
  birthDate: 'formuNac.fechaNacimiento',
} as const;

export type FieldKey = keyof typeof FIELD_NAMES;

/** The hidden input reCAPTCHA fills; there can be two of them in the live page. */
const CAPTCHA_TOKEN_NAME = 'gRecaptchaResponse';

export const CAPTCHA_BLOCK_SELECTOR = '#captchaTramite';

export const SUBMIT_SELECTOR = 'input#submitNac';

export interface AutofillResult {
  /** True when every field was found and set. */
  complete: boolean;
  /** The `name` of every field that was not on the page. */
  missing: string[];
}

function field(doc: Document, name: string): HTMLInputElement | null {
  return doc.querySelector<HTMLInputElement>(`input[name="${name}"]`);
}

function setValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  // The page is server-rendered but its own scripts listen for these; firing them keeps jQuery's idea of the
  // field in sync with what the user sees.
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function autofillForm(doc: Document, identity: PlainIdentity): AutofillResult {
  const values: ReadonlyArray<readonly [FieldKey, string]> = [
    ['nie', identity.nie],
    ['numero', identity.numero],
    ['year', identity.year],
    ['birthDate', identity.birthDate],
  ];
  const missing: string[] = [];
  for (const [key, value] of values) {
    const input = field(doc, FIELD_NAMES[key]);
    if (input === null) {
      missing.push(FIELD_NAMES[key]);
      continue;
    }
    setValue(input, value);
  }
  return { complete: missing.length === 0, missing };
}

/**
 * The captcha token, or `null` while the human has not solved it.
 *
 * Every input with that name is read: the reCAPTCHA script injects a second one at runtime, and the first in
 * document order is not always the one holding the token.
 */
export function readCaptchaToken(doc: Document): string | null {
  const tokens = [...doc.querySelectorAll<HTMLInputElement>(`input[name="${CAPTCHA_TOKEN_NAME}"]`)];
  for (const token of tokens) {
    const value = token.value.trim();
    if (value !== '') return value;
  }
  return null;
}

/** Whether the page still has the shape the captcha-only view needs. */
export function hasCaptchaOnlyViewTargets(doc: Document): boolean {
  return doc.querySelector(CAPTCHA_BLOCK_SELECTOR) !== null;
}

export type SubmitDecision = 'submitted' | 'waiting';

/**
 * Submits only once the token exists — never before, and never with a token this code produced.
 */
export function submitIfCaptchaSolved(doc: Document): SubmitDecision {
  if (readCaptchaToken(doc) === null) return 'waiting';
  const form = doc.querySelector<HTMLFormElement>(FORM_SELECTOR);
  const submitter =
    doc.querySelector<HTMLInputElement>(SUBMIT_SELECTOR) ??
    doc.querySelector<HTMLInputElement>('input[name="action:enviarDatosNacionalidad"]');
  if (form === null || submitter === null) return 'waiting';
  // The browser runs the form's own `required` checks on click, so an incomplete form is not forced through.
  submitter.click();
  return 'submitted';
}

export const CAPTCHA_ONLY_STYLE_ID = 'naciocheck-captcha-only';
export const HINT_ID = 'naciocheck-hint';

/** The strip that tells the user what to do. Used on its own in the fallback. */
export function buildHintCss(): string {
  return `
    #${HINT_ID} {
      position: fixed !important;
      inset-block-start: 0;
      inset-inline: 0;
      visibility: visible !important;
      z-index: 2147483647;
      padding: 12px 16px;
      text-align: center;
      font: 600 15px/1.4 system-ui, sans-serif;
      color: #0f766e;
      background: #f0fdfa;
      border-block-end: 1px solid #99f6e4;
    }
  `;
}

/**
 * Hides everything except the captcha. `visibility` is used instead of `display` so the captcha does not have
 * to be moved out of its ancestors, and the block is then pinned to the middle of the window.
 */
export function buildCaptchaOnlyCss(): string {
  return `
    ${buildHintCss()}
    html body * { visibility: hidden !important; }
    ${CAPTCHA_BLOCK_SELECTOR},
    ${CAPTCHA_BLOCK_SELECTOR} * { visibility: visible !important; }
    ${CAPTCHA_BLOCK_SELECTOR} {
      position: fixed !important;
      inset: 0 !important;
      display: flex !important;
      align-items: center;
      justify-content: center;
      background: #ffffff !important;
      z-index: 2147483647;
    }
  `;
}
