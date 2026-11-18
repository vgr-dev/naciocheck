import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  autofillForm,
  buildCaptchaOnlyCss,
  buildHintCss,
  CAPTCHA_CHALLENGE_SELECTOR,
  hasCaptchaOnlyViewTargets,
  readCaptchaToken,
  submitIfCaptchaSolved,
} from '../src/core/autofill';
import type { PlainIdentity } from '../src/core/storage';

/** Synthetic values only. */
const IDENTITY: PlainIdentity = {
  kind: 'plain',
  nie: 'X0000000X',
  birthDate: '1990-01-01',
  numero: 'R500001',
  year: '2015',
};

function loadForm(): Document {
  const path = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'form.html');
  return new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'text/html');
}

function valueOf(doc: Document, name: string): string {
  return doc.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value ?? '';
}

function form(doc: Document): HTMLFormElement {
  const element = doc.querySelector<HTMLFormElement>('form#idFormuNac');
  if (element === null) throw new Error('no form in the fixture');
  return element;
}

/** Counts submissions without letting jsdom try to navigate. */
function countSubmissions(doc: Document): () => number {
  let count = 0;
  form(doc).addEventListener('submit', (event) => {
    event.preventDefault();
    count += 1;
  });
  return () => count;
}

describe('autofillForm', () => {
  it('fills the four fields despite the duplicate id', () => {
    const doc = loadForm();

    expect(autofillForm(doc, IDENTITY)).toEqual({ complete: true, missing: [] });
    expect(valueOf(doc, 'formuNac.codigoNieCompleto')).toBe('X0000000X');
    expect(valueOf(doc, 'formuNac.numero')).toBe('R500001');
    expect(valueOf(doc, 'formuNac.yearSolicitud')).toBe('2015');
    expect(valueOf(doc, 'formuNac.fechaNacimiento')).toBe('1990-01-01');
  });

  it('does not let the shared id put the birth date into the NIE field', () => {
    const doc = loadForm();
    autofillForm(doc, IDENTITY);

    const byId = [...doc.querySelectorAll<HTMLInputElement>('#codigoNieCompleto')];
    expect(byId).toHaveLength(2);
    expect(byId.map((input) => input.name)).toEqual([
      'formuNac.codigoNieCompleto',
      'formuNac.fechaNacimiento',
    ]);
    expect(byId[0]?.value).toBe('X0000000X');
    expect(byId[1]?.value).toBe('1990-01-01');
  });

  it('reports the fields it could not find', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body><form id="idFormuNac">' +
        '<input type="text" name="formuNac.codigoNieCompleto" value="">' +
        '</form></body></html>',
      'text/html',
    );

    expect(autofillForm(doc, IDENTITY)).toEqual({
      complete: false,
      missing: ['formuNac.numero', 'formuNac.yearSolicitud', 'formuNac.fechaNacimiento'],
    });
  });
});

describe('readCaptchaToken', () => {
  it('reports nothing while the captcha is unsolved', () => {
    expect(readCaptchaToken(loadForm())).toBeNull();
  });

  it('reads the value from whichever of the duplicated inputs holds it', () => {
    const doc = loadForm();
    const extra = doc.createElement('input');
    extra.type = 'hidden';
    extra.name = 'gRecaptchaResponse';
    extra.id = 'g-recaptcha-response';
    doc.body.append(extra);

    const inputs = [...doc.querySelectorAll<HTMLInputElement>('input[name="gRecaptchaResponse"]')];
    expect(inputs).toHaveLength(2);

    const second = inputs[1];
    if (second === undefined) throw new Error('expected two token inputs');
    second.value = 'token-del-humano';

    expect(readCaptchaToken(doc)).toBe('token-del-humano');
  });
});

describe('submitIfCaptchaSolved', () => {
  it('does not submit while the token is empty', () => {
    const doc = loadForm();
    const submissions = countSubmissions(doc);

    expect(submitIfCaptchaSolved(doc)).toBe('waiting');
    expect(submissions()).toBe(0);
  });

  it('submits once the token exists and the form validates', () => {
    const doc = loadForm();
    const submissions = countSubmissions(doc);
    // The site marks every field required, so a real submit also needs the fields filled in.
    autofillForm(doc, IDENTITY);
    const token = doc.querySelector<HTMLInputElement>('input[name="gRecaptchaResponse"]');
    if (token === null) throw new Error('no token input');
    token.value = 'token-del-humano';

    expect(submitIfCaptchaSolved(doc)).toBe('submitted');
    expect(submissions()).toBe(1);
  });

  it('does not count a validation-blocked click as submitted', () => {
    const doc = loadForm();
    const submissions = countSubmissions(doc);
    const token = doc.querySelector<HTMLInputElement>('input[name="gRecaptchaResponse"]');
    if (token === null) throw new Error('no token input');
    // The captcha is solved, but the page's required fields are still empty: a click would be swallowed and
    // polling would stop with the fields hidden.
    token.value = 'token-del-humano';

    expect(submitIfCaptchaSolved(doc)).toBe('blocked');
    expect(submissions()).toBe(0);
  });

  it('asks the browser to report the invalid fields', () => {
    const doc = loadForm();
    const target = form(doc);
    const report = vi.spyOn(target, 'reportValidity');
    const token = doc.querySelector<HTMLInputElement>('input[name="gRecaptchaResponse"]');
    if (token === null) throw new Error('no token input');
    token.value = 'token-del-humano';

    expect(submitIfCaptchaSolved(doc)).toBe('blocked');
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('treats a checkValidity rejection as blocked even if the click would fire', () => {
    const doc = loadForm();
    const submissions = countSubmissions(doc);
    const target = form(doc);
    autofillForm(doc, IDENTITY);
    const token = doc.querySelector<HTMLInputElement>('input[name="gRecaptchaResponse"]');
    if (token === null) throw new Error('no token input');
    token.value = 'token-del-humano';
    vi.spyOn(target, 'checkValidity').mockReturnValue(false);
    const report = vi.spyOn(target, 'reportValidity');

    expect(submitIfCaptchaSolved(doc)).toBe('blocked');
    expect(report).toHaveBeenCalledTimes(1);
    expect(submissions()).toBe(0);
  });
});

describe('captcha-only view', () => {
  it('recognises the captcha block on the real form', () => {
    expect(hasCaptchaOnlyViewTargets(loadForm())).toBe(true);
    expect(
      hasCaptchaOnlyViewTargets(new DOMParser().parseFromString('<p>x</p>', 'text/html')),
    ).toBe(false);
  });

  it('hides everything and keeps the captcha and the hint visible', () => {
    const css = buildCaptchaOnlyCss();

    expect(css).toContain('visibility: hidden');
    expect(css).toContain('#captchaTramite');
    expect(css).toContain('#naciocheck-hint');
  });

  it('keeps the escape control inside the hint usable', () => {
    // `html body *` hides every descendant, including the button inside the strip; the hint itself is re-shown
    // but the button would stay invisible without its own rule.
    const hintCss = buildHintCss();

    expect(hintCss).toContain('#naciocheck-hint *');
    expect(ruleOf(hintCss, '#naciocheck-hint *')).toContain('visibility: visible !important');
    expect(buildCaptchaOnlyCss()).toContain('#naciocheck-hint *');
  });

  it('keeps the escape strip above the challenge bubble', () => {
    const css = buildCaptchaOnlyCss();
    const strip = /z-index: (\d+)/.exec(ruleOf(css, '#naciocheck-hint') ?? '');
    const challenge = /z-index: (\d+)/.exec(ruleOf(css, CAPTCHA_CHALLENGE_SELECTOR) ?? '');

    expect(Number(strip?.[1])).toBeGreaterThan(Number(challenge?.[1]));
  });

  it('re-shows the challenge, which reCAPTCHA appends outside the captcha block', () => {
    // Live page, measured with the challenge on screen: `iframe < div < div < body < html`.
    // jsdom has no layout or cascade engine, so this asserts the rule exists for that selector;
    // the real proof was the manual run on Firefox desktop.
    const css = buildCaptchaOnlyCss();

    expect(CAPTCHA_CHALLENGE_SELECTOR).toBe(
      'body > div:has(iframe[src*="/recaptcha/api2/bframe"])',
    );
    expect(css).toContain(`${CAPTCHA_CHALLENGE_SELECTOR} * { visibility: visible !important; }`);
  });

  it('keeps the captcha block below the challenge overlay', () => {
    // The block is a white full-screen panel: at the maximum z-index it painted over the challenge,
    // which reCAPTCHA appends to <body> and therefore outside it.
    const css = buildCaptchaOnlyCss();
    const blockRule = /#captchaTramite \{[^}]*z-index: (\d+)/.exec(css);

    expect(blockRule).not.toBeNull();
    expect(Number(blockRule?.[1])).toBeLessThan(2147483647);
  });

  it('lets clicks reach the challenge through reCAPTCHA’s dimming layer', () => {
    // The bubble’s children include a `position: fixed; inset: 0; opacity: .05` layer with no pointer-events
    // rule of its own. Raised above the captcha block, it covered the viewport and swallowed every click.
    const css = buildCaptchaOnlyCss();

    expect(ruleOf(css, `${CAPTCHA_CHALLENGE_SELECTOR} > div`)).toContain(
      'pointer-events: none !important',
    );
    expect(ruleOf(css, `${CAPTCHA_CHALLENGE_SELECTOR} iframe`)).toContain(
      'pointer-events: auto !important',
    );
  });
});

/** The declarations of one rule of a generated stylesheet, by exact selector. */
function ruleOf(css: string, selector: string): string | undefined {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const chunk of withoutComments.split('}')) {
    const [selectors, declarations] = chunk.split('{');
    if (selectors?.trim() === selector) return declarations;
  }
  return undefined;
}
