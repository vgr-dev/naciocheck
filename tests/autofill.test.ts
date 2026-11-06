import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  autofillForm,
  buildCaptchaOnlyCss,
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

  it('submits once the token exists', () => {
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
});
