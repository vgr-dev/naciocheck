import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isResultPage, parseCheckPage } from '../src/core/parser';

/** The real result page with every personal value replaced by a `{placeholder}`. */
const RESULT_FIXTURE = 'fixtures/result-format.htm';

const SYNTHETIC_VALUES = {
  expendiente: 'R500001',
  year: '2015',
  NIE: 'X0000000X',
  names: 'NOMBRE',
  surname: 'APELLIDO',
  status: 'Abierto - Registrado.',
  subStatus: 'Su expediente ha sido registrado correctamente.',
};

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function loadFixture(name: string, values: Record<string, string> = {}): Document {
  const html = readFileSync(new URL(name, import.meta.url), 'utf8');
  const filled = Object.entries(values).reduce(
    (text, [placeholder, value]) => text.replaceAll(`{${placeholder}}`, value),
    html,
  );
  return parseHtml(filled);
}

describe('parseCheckPage — result page', () => {
  it('reads the status and the sub-status from the real result markup', () => {
    const page = loadFixture(RESULT_FIXTURE, SYNTHETIC_VALUES);

    expect(parseCheckPage(page)).toEqual({
      kind: 'status',
      key: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
      normalised: 'abierto - registrado',
      subStatus: 'Su expediente ha sido registrado correctamente.',
    });
  });

  it('keeps an accented status verbatim and only folds it for comparison', () => {
    const page = loadFixture(RESULT_FIXTURE, { ...SYNTHETIC_VALUES, status: 'En tramitación' });

    expect(parseCheckPage(page)).toMatchObject({
      kind: 'status',
      key: 'unknown',
      raw: 'En tramitación',
      normalised: 'en tramitacion',
    });
  });
  it('trims the status without touching its text', () => {
    const page = loadFixture(RESULT_FIXTURE, {
      ...SYNTHETIC_VALUES,
      status: '\n\t\t  Abierto - Registrado.  \n',
    });

    expect(parseCheckPage(page)).toMatchObject({ raw: 'Abierto - Registrado.' });
  });

  it('never throws on a status the catalogue does not know', () => {
    const page = loadFixture(RESULT_FIXTURE, {
      ...SYNTHETIC_VALUES,
      status: 'Estado sin catalogar',
    });

    expect(parseCheckPage(page)).toMatchObject({
      kind: 'status',
      key: 'unknown',
      raw: 'Estado sin catalogar',
    });
  });

  it('reports no sub-status when the page prints none', () => {
    const page = loadFixture(RESULT_FIXTURE, { ...SYNTHETIC_VALUES, subStatus: '' });

    expect(parseCheckPage(page)).toMatchObject({ kind: 'status', subStatus: null });
  });

  it('recognises the result step', () => {
    expect(isResultPage(loadFixture(RESULT_FIXTURE, SYNTHETIC_VALUES))).toBe(true);
  });
});

describe('parseCheckPage — form page', () => {
  it('reports the form, not an error, despite its always-empty red span', () => {
    const page = loadFixture('fixtures/form.html');

    expect(parseCheckPage(page)).toEqual({ kind: 'form' });
    expect(isResultPage(page)).toBe(false);
  });
});

describe('parseCheckPage — error page', () => {
  it('reports the site error block as an error outcome', () => {
    const page = parseHtml(
      '<html><body><form id="idFormuNac">' +
        '<div class="textoBloqueError">Los datos introducidos no son correctos</div>' +
        '</form></body></html>',
    );

    expect(parseCheckPage(page)).toEqual({
      kind: 'error',
      raw: 'Los datos introducidos no son correctos',
    });
  });

  it('reads the red informative block too', () => {
    const page = parseHtml(
      '<html><body><div class="bloqueInformativo bloqueInformativoRojo">' +
        '<span class="msg-error error bloqueInformativoRojo">Servicio no disponible</span>' +
        '</div></body></html>',
    );

    expect(parseCheckPage(page)).toEqual({ kind: 'error', raw: 'Servicio no disponible' });
  });

  it('ignores empty error markers', () => {
    const page = parseHtml(
      '<html><body><span class="msg-error error bloqueInformativoRojo"></span></body></html>',
    );

    expect(parseCheckPage(page)).toEqual({ kind: 'unknown' });
  });
});

describe('parseCheckPage — anything else', () => {
  it('falls back to unknown instead of throwing', () => {
    expect(parseCheckPage(parseHtml('<html><body><p>Sin relación</p></body></html>'))).toEqual({
      kind: 'unknown',
    });
  });

  it('returns unknown when the anchor sentence has no status paragraph after it', () => {
    const page = parseHtml(
      '<html><body><p class="desPro">se encuentra en el siguiente estado:</p></body></html>',
    );

    expect(parseCheckPage(page)).toEqual({ kind: 'unknown' });
  });
});
