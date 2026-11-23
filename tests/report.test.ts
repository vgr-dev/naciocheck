import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  REPORT_FIELDS,
  REPORT_LABELS,
  REPORT_MAX_CHARS,
  TRUNCATED_MARKER,
  browserLabel,
  buildGuideReport,
  buildReport,
  feedbackUrl,
  redact,
  type ReportCheck,
  type ReportContext,
} from '../src/core/report';
import { detectAnomaly } from '../src/core/anomaly';
import type { Check } from '../src/core/storage';
import { MAX_BODY_BYTES, MAX_TOKEN_CHARS } from '../worker/checks';

function context(overrides: Partial<ReportContext> = {}): ReportContext {
  return {
    version: '0.4.2',
    browser: 'Chrome 130',
    locale: 'en',
    errorMessages: [],
    anomaly: null,
    ...overrides,
  };
}

const FAKE_NIE = 'X1234567L';
const FAKE_APPLICATION_NUMBER = '1234567/2024';
const FAKE_BIRTH_DATE = '31/12/1990';
const FAKE_LABEL = 'Ana Pérez Fake';
const FAKE_RAW = 'Abierto - Documento personal de Ana Fake.';
const FAKE_SUB_STATUS = 'Su expediente de Ana Fake se encuentra en tramitación.';
const FAKE_PASSPHRASE = 'correct horse battery fake';

describe('buildReport', () => {
  it('holds the outcome and the status key of the check', () => {
    const text = buildReport({ outcome: 'error', statusKey: 'unknown' }, context());

    expect(text).toContain('outcome: error');
    expect(text).toContain('status key: unknown');
    expect(text).toContain('version: 0.4.2');
    expect(text).toContain('browser: Chrome 130');
    expect(text).toContain('locale: en');
  });

  it('contributes nothing from an object that carries more than the two fields', () => {
    const full: Check & {
      identity: { nie: string; birthDate: string; passphrase: string };
      label: string;
    } = {
      id: 'check-1',
      applicationId: 'app-secret-id',
      at: '2026-11-05T10:00:00.000Z',
      outcome: 'status',
      statusKey: 'abierto-en-tramitacion',
      raw: FAKE_RAW,
      subStatus: FAKE_SUB_STATUS,
      acknowledged: false,
      label: FAKE_LABEL,
      identity: { nie: FAKE_NIE, birthDate: FAKE_BIRTH_DATE, passphrase: FAKE_PASSPHRASE },
    };

    const text = buildReport(full, context());

    for (const value of [
      FAKE_NIE,
      FAKE_APPLICATION_NUMBER,
      FAKE_BIRTH_DATE,
      FAKE_LABEL,
      FAKE_RAW,
      FAKE_SUB_STATUS,
      FAKE_PASSPHRASE,
      'app-secret-id',
      'check-1',
      '2026-11-05',
      'Ana',
    ]) {
      expect(text).not.toContain(value);
    }
    expect(text).toContain('outcome: status');
    expect(text).toContain('status key: abierto-en-tramitacion');
  });

  it('has no field named like an identity field', () => {
    for (const field of REPORT_FIELDS) {
      expect(field).not.toMatch(
        /nie|numero|n[uú]mero|birth|year|label|identity|passphrase|application|raw|substatus/i,
      );
    }
  });

  it('accepts exactly two keys of a check', () => {
    expectTypeOf<keyof ReportCheck>().toEqualTypeOf<'outcome' | 'statusKey'>();
  });

  it('has the same label keys in es and en', () => {
    expect(Object.keys(REPORT_LABELS.es).sort()).toEqual(Object.keys(REPORT_LABELS.en).sort());
    expect(Object.keys(REPORT_LABELS.es).sort()).toEqual([...REPORT_FIELDS].sort());
  });

  it('writes the labels in the person language, one field per line', () => {
    const es = buildReport(
      { outcome: 'error', statusKey: 'unknown' },
      context({ locale: 'es', errorMessages: ['Captcha incorrecto'] }),
    );

    expect(es.split('\n')).toEqual([
      'Informe de NacioCheck',
      'versión: 0.4.2',
      'navegador: Chrome 130',
      'idioma: es',
      'resultado: error',
      'clave de estado: unknown',
      'errores: captcha',
      'comentario:',
    ]);
  });

  it('ends with an empty comment line and omits empty fields', () => {
    const lines = buildReport({ outcome: 'unknown', statusKey: 'unknown' }, context()).split('\n');

    expect(lines[0]).toBe('NacioCheck report');
    expect(lines.at(-1)).toBe('comment:');
    expect(lines.some((line) => line.startsWith('errors:'))).toBe(false);
    expect(lines.some((line) => line.startsWith('anomaly note:'))).toBe(false);
  });

  it('names the anomaly by its kind and state ids', () => {
    const anomaly = { kind: 'unusual', from: 'K', to: 'T2' };

    expect(
      buildReport({ outcome: 'status', statusKey: 'unknown' }, context({ anomaly })),
    ).toContain('anomaly note: unusual, K → T2');
    expect(
      buildReport({ outcome: 'status', statusKey: 'unknown' }, context({ anomaly, locale: 'es' })),
    ).toContain('nota: unusual, K → T2');
  });

  it('holds the ids of a real anomaly and nothing the site printed', () => {
    const previous: Check = {
      id: 'check-1',
      applicationId: 'app-1',
      at: '2026-11-05T10:00:00.000Z',
      outcome: 'status',
      statusKey: 'abierto-en-calificacion',
      raw: 'Abierto - En calificación.',
      subStatus: 'Su expediente se encuentra en calificación.',
      acknowledged: false,
    };
    const current: Check = {
      ...previous,
      id: 'check-2',
      at: '2026-11-06T10:00:00.000Z',
      statusKey: 'abierto-en-tramitacion',
      raw: 'Abierto - En tramitación.',
      subStatus: 'Pendiente solicitud informes preceptivos oficiales',
    };
    const note = detectAnomaly(previous, current);
    expect(note).not.toBeNull();

    for (const locale of ['es', 'en'] as const) {
      const text = buildReport(
        current,
        context({
          locale,
          anomaly: note === null ? null : { kind: note.kind, from: note.from, to: note.to },
        }),
      );

      expect(text).toContain('unusual, K → T2');
      for (const check of [previous, current]) {
        expect(text).not.toContain(check.raw);
        expect(text).not.toContain(check.subStatus ?? '\0');
      }
      expect(text).not.toContain('«');
    }
  });

  it('reduces recognised errors to a safe category', () => {
    const text = buildReport(
      { outcome: 'error', statusKey: 'unknown' },
      context({
        errorMessages: [`El NIE ${FAKE_NIE} no coincide`, `Nacido el ${FAKE_BIRTH_DATE}`, '  '],
      }),
    );

    expect(text).toContain('errors: application details | unrecognised error');
    expect(text).not.toContain(FAKE_NIE);
    expect(text).not.toContain('1990');
  });

  it('never copies free-form sede error text, even when it contains private text', () => {
    const privateText = 'Ana Pérez Fake, expediente C123456789, su estado es denegado';
    const text = buildReport(
      { outcome: 'error', statusKey: 'unknown' },
      context({ errorMessages: [privateText] }),
    );

    expect(text).toContain('errors: unrecognised error\n');
    for (const value of ['Ana Pérez Fake', 'C123456789', 'denegado']) {
      expect(text).not.toContain(value);
    }
  });

  it('writes each error category once on the same line', () => {
    const text = buildReport(
      { outcome: 'error', statusKey: 'unknown' },
      context({
        errorMessages: ['Incorrect security\ncode', 'Captcha incorrecto', 'NIE inválido'],
      }),
    );

    expect(text).toContain('errors: captcha | application details\n');
  });

  it('caps the text with a visible marker and keeps the comment line', () => {
    const text = buildReport(
      { outcome: 'error', statusKey: 'unknown' },
      context({ browser: 'x'.repeat(REPORT_MAX_CHARS * 2) }),
    );

    expect(text.length).toBeLessThanOrEqual(REPORT_MAX_CHARS);
    expect(text).toContain(TRUNCATED_MARKER);
    expect(text.endsWith('\ncomment:')).toBe(true);
  });

  it('fits the Worker JSON byte limit with a maximum token and multibyte input', () => {
    const text = buildGuideReport('archivado', 'é😀\\'.repeat(4000), {
      version: '0.4.2',
      browser: 'Chrome 130',
      locale: 'en',
    });
    expect(text.length).toBeLessThanOrEqual(REPORT_MAX_CHARS);
    expect(
      new TextEncoder().encode(JSON.stringify({ text, token: 'x'.repeat(MAX_TOKEN_CHARS) })).length,
    ).toBeLessThanOrEqual(MAX_BODY_BYTES);
    expect(text).toContain(TRUNCATED_MARKER);
    expect(text.endsWith('\ncomment:')).toBe(true);
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        expect(text.charCodeAt(index + 1)).toBeGreaterThanOrEqual(0xdc00);
        expect(text.charCodeAt(index + 1)).toBeLessThanOrEqual(0xdfff);
      }
    }
  });

  it('does not cut a text that fits', () => {
    const text = buildReport({ outcome: 'error', statusKey: 'unknown' }, context());

    expect(text).not.toContain(TRUNCATED_MARKER);
  });

  it('is stable under redaction, so the preview is what the Worker will mail', () => {
    const text = buildReport(
      { outcome: 'error', statusKey: 'unknown' },
      context({
        errorMessages: [`Error ${FAKE_NIE} 12/05/2020`],
        anomaly: { kind: 'unusual', from: 'K', to: 'T2' },
      }),
    );

    expect(redact(text)).toBe(text);
  });
});

describe('buildGuideReport', () => {
  it('holds the status key and the explanation, redacted, and no outcome', () => {
    const text = buildGuideReport(
      'abierto-en-tramitacion',
      'Suele durar 12 meses, según la ley de 2015 y 2016.',
      { version: '0.4.2', browser: 'Firefox 128', locale: 'es' },
    );

    expect(text.split('\n')).toEqual([
      'Informe de NacioCheck',
      'versión: 0.4.2',
      'navegador: Firefox 128',
      'idioma: es',
      'clave de estado: abierto-en-tramitacion',
      'explicación: Suele durar 12 meses, según la ley de [NUMBER] y [NUMBER].',
      'comentario:',
    ]);
  });

  it('caps a long explanation', () => {
    const text = buildGuideReport('archivado', 'y'.repeat(REPORT_MAX_CHARS * 2), {
      version: '0.4.2',
      browser: 'Chrome 130',
      locale: 'en',
    });

    expect(text.length).toBeLessThanOrEqual(REPORT_MAX_CHARS);
    expect(text).toContain(TRUNCATED_MARKER);
    expect(text.endsWith('\ncomment:')).toBe(true);
  });
});

describe('redact', () => {
  it.each([
    ['X1234567L', '[NIE]'],
    ['y7654321z', '[NIE]'],
    ['Z1234567A', '[NIE]'],
    ['12345678Z', '[NIE]'],
    ['1234567a', '[NIE]'],
    ['NIE X1234567L, gracias', 'NIE [NIE], gracias'],
  ])('masks a NIE: %s', (input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it.each([
    ['A12345', '[REF]'],
    ['b1234567', '[REF]'],
    ['expediente C123456789.', 'expediente [REF].'],
  ])('masks an application number: %s', (input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it.each([
    ['5/11/2026', '[DATE]'],
    ['05/11/2026', '[DATE]'],
    ['5-11-26', '[DATE]'],
    ['05-11-2026', '[DATE]'],
    ['2026-11-05', '[DATE]'],
    ['el 31/12/1990 y el 2026-11-05.', 'el [DATE] y el [DATE].'],
  ])('masks a date: %s', (input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it.each([
    ['1234', '[NUMBER]'],
    ['teléfono 600123456', 'teléfono [NUMBER]'],
    ['año 2026', 'año [NUMBER]'],
  ])('masks a long number: %s', (input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it('masks mixed text', () => {
    expect(redact('NIE X1234567L, exp. A123456, nacido el 31/12/1990, tel 600123456.')).toBe(
      'NIE [NIE], exp. [REF], nacido el [DATE], tel [NUMBER].',
    );
  });

  it('is idempotent', () => {
    const once = redact('X1234567L A123456 31/12/1990 2026-11-05 600123456 [NIE] [DATE]');

    expect(redact(once)).toBe(once);
  });

  it.each([
    'Abierto - En tramitación.',
    'Finalizado - Concedido. Notificado.',
    'Su expediente se encuentra en calificación.',
    'Chrome 130',
    'version 0.4.2',
    'Error 404',
    'a 12/34 of 56',
  ])('leaves text alone that is not an identifier: %s', (input) => {
    expect(redact(input)).toBe(input);
  });
});

describe('feedbackUrl', () => {
  it('points es at the Spanish page and en at the English page', () => {
    expect(feedbackUrl('hola', 'es')).toBe('https://naciocheck.vgr.cat/feedback/#hola');
    expect(feedbackUrl('hello', 'en')).toBe('https://naciocheck.vgr.cat/en/feedback/#hello');
  });

  it('encodes #, &, spaces, newlines and non-ASCII so the fragment round-trips', () => {
    const report = 'Informe: a#b&c d\nversión ñ ✓';
    const url = feedbackUrl(report, 'es');
    const fragment = url.slice(url.indexOf('#') + 1);

    expect(url.indexOf('#')).toBe(url.lastIndexOf('#'));
    expect(fragment).not.toMatch(/[#&\s]/);
    expect(decodeURIComponent(fragment)).toBe(report);
    expect(new URL(url).host).toBe('naciocheck.vgr.cat');
  });
});

describe('browserLabel', () => {
  // Made-up user agents in the shape each browser sends; only the name and major version may come out.
  const agents: readonly (readonly [string, string, string])[] = [
    [
      'desktop Chrome',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.1234.56 Safari/537.36',
      'Chrome 158',
    ],
    [
      'Chrome on Android',
      'Mozilla/5.0 (Linux; Android 15; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.1111.22 Mobile Safari/537.36',
      'Chrome 157',
    ],
    [
      'desktop Edge',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36 Edg/158.0.3000.1',
      'Edge 158',
    ],
    [
      'Edge on Android',
      'Mozilla/5.0 (Linux; Android 15; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36 EdgA/156.0.2000.9',
      'Edge 156',
    ],
    [
      'Opera',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 OPR/140.0.0.0',
      'Opera 140',
    ],
    [
      'desktop Firefox',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0',
      'Firefox 150',
    ],
    [
      'Firefox for Android',
      'Mozilla/5.0 (Android 15; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0',
      'Firefox 149',
    ],
    ['an unknown agent', 'SomeBrowser/1.0 (Plan 9)', 'unknown'],
    ['an empty agent', '', 'unknown'],
  ];

  for (const [name, agent, expected] of agents) {
    it(`labels ${name} as ${expected}`, () => {
      expect(browserLabel(agent)).toBe(expected);
    });
  }

  it('never includes an operating system or platform token', () => {
    for (const [, agent] of agents) {
      expect(browserLabel(agent)).not.toMatch(/windows|linux|android|mac|x11|ios|win64|mobile/i);
    }
  });
});
