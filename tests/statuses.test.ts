import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normaliseText } from '../src/core/normalise';
import {
  findStatus,
  findSubStatus,
  STATUS_CATALOG,
  STATUS_DISCLAIMER,
  statusKeyOf,
  SUB_STATUS_ENTRIES,
  UNKNOWN_STATUS_KEY,
  type StatusKey,
} from '../src/core/statuses';

/** The seven status texts observed on the real page, as the user reported them. */
const OBSERVED_STATUSES: ReadonlyArray<readonly [text: string, key: StatusKey]> = [
  ['Abierto - Registrado.', 'abierto-registrado'],
  ['Abierto - Concedido. Enviada notificación.', 'concedido-enviada-notificacion'],
  ['Finalizado - Concedido. Notificado.', 'finalizado-concedido-notificado'],
  ['Abierto - En tramitación.', 'abierto-en-tramitacion'],
  ['Abierto - En tramitación: requerido - documentación aportada', 'documentacion-aportada'],
  ['Abierto - En calificación.', 'abierto-en-calificacion'],
  ['Abierto - En tramitación: requerido.', 'pendiente-requerimiento'],
];

/** Sub-statuses reported for `Abierto - En tramitación.`, in progress order. */
const OBSERVED_SUB_STATUSES = [
  'Su expediente se encuentra en tramitación.',
  'Pendiente solicitud informes preceptivos oficiales',
  'Pendiente recepción de informes preceptivos oficiales',
  'Su expediente se encuentra en calificación.',
];

describe('status catalogue', () => {
  it('gives every entry a title, an explanation and an action in both locales', () => {
    for (const entry of STATUS_CATALOG) {
      for (const locale of ['es', 'en'] as const) {
        const text = entry[locale];
        expect(text.title.trim(), `${entry.key}.${locale}.title`).not.toBe('');
        expect(text.explanation.trim(), `${entry.key}.${locale}.explanation`).not.toBe('');
        expect(text.whatYouCanDo.trim(), `${entry.key}.${locale}.whatYouCanDo`).not.toBe('');
      }
    }
  });

  it('cites at least one source per entry', () => {
    for (const entry of STATUS_CATALOG) {
      expect(entry.sources.length, `${entry.key} has no source`).toBeGreaterThan(0);
      for (const source of entry.sources) {
        if (source.kind === 'observed') continue;
        expect(source.label.trim(), `${entry.key} source label`).not.toBe('');
        expect(source.url, `${entry.key} source url`).toMatch(/^https:\/\//);
      }
    }
  });

  it('marks the texts that come from real files as observed, with no URL', () => {
    const observed = STATUS_CATALOG.filter((entry) =>
      entry.sources.some((source) => source.kind === 'observed'),
    ).map((entry) => entry.key);

    expect(observed).toEqual(
      expect.arrayContaining([
        'abierto-en-tramitacion',
        'abierto-en-calificacion',
        'pendiente-requerimiento',
        'documentacion-aportada',
        'doble-calificacion',
        'archivado',
      ]),
    );
  });

  it('keeps every cited URL inside the privacy allow-list', () => {
    const allowListPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'scripts',
      'allowed-urls.json',
    );
    const allowList = JSON.parse(readFileSync(allowListPath, 'utf8')) as {
      urlPrefixes: string[];
    };

    for (const entry of STATUS_CATALOG) {
      for (const source of entry.sources) {
        if (source.kind !== 'documented') continue;
        expect(
          allowList.urlPrefixes.some((prefix) => source.url.startsWith(prefix)),
          `${source.url} is not in scripts/allowed-urls.json`,
        ).toBe(true);
      }
    }
  });

  it('uses unique keys and unambiguous match texts, already normalised', () => {
    const keys = STATUS_CATALOG.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);

    const matches = STATUS_CATALOG.flatMap((entry) => entry.match);
    expect(new Set(matches).size).toBe(matches.length);

    for (const match of matches) {
      expect(normaliseText(match), `match text ${match} is not normalised`).toBe(match);
    }
  });

  it('gives every entry a positive stage', () => {
    for (const entry of STATUS_CATALOG) {
      expect(entry.stage, `${entry.key}.stage`).toBeGreaterThan(0);
    }
  });

  it('states plainly that "doble calificación" and "calificación simple" have no official definition', () => {
    for (const key of ['doble-calificacion', 'calificacion-simple'] as const) {
      const entry = STATUS_CATALOG.find((candidate) => candidate.key === key);
      expect(entry, `${key} missing`).toBeDefined();
      expect(entry?.officialDefinition).toBe('none');
      expect(entry?.es.explanation).toMatch(/definici[oó]n oficial/i);
      expect(entry?.en.explanation).toMatch(/official definition/i);
    }
  });

  it('carries the shared disclaimer in both locales', () => {
    expect(STATUS_DISCLAIMER.es.trim()).not.toBe('');
    expect(STATUS_DISCLAIMER.en.trim()).not.toBe('');
    expect(STATUS_DISCLAIMER.es).toMatch(/DEH[uú]/i);
    expect(STATUS_DISCLAIMER.en).toMatch(/DEH[uú]/i);
  });
});

describe('resolving the page text', () => {
  it.each(OBSERVED_STATUSES)('maps %s to %s', (text, key) => {
    expect(statusKeyOf(text)).toBe(key);
    expect(statusKeyOf(text)).not.toBe(UNKNOWN_STATUS_KEY);
  });

  it('ignores case, dash flavour and punctuation', () => {
    expect(statusKeyOf('ABIERTO - REGISTRADO')).toBe('abierto-registrado');
    expect(statusKeyOf('Abierto – Registrado.')).toBe('abierto-registrado');
    expect(statusKeyOf('  abierto - registrado  ')).toBe('abierto-registrado');
  });

  it('resolves the law-firm documented statuses', () => {
    expect(statusKeyOf('En vía de recurso')).toBe('en-via-de-recurso');
    expect(statusKeyOf('Pendiente de firma')).toBe('pendiente-firma');
    expect(statusKeyOf('Archivado')).toBe('archivado');
  });

  it('returns null and the unknown key for text the catalogue has never seen', () => {
    expect(findStatus('Estado sin catalogar')).toBeNull();
    expect(statusKeyOf('Estado sin catalogar')).toBe(UNKNOWN_STATUS_KEY);
  });

  it('does not resolve arbitrary text by accident', () => {
    for (const text of ['', 'Abierto', 'Tramitación', 'Resuelto']) {
      expect(findStatus(text), `${text} should not resolve`).toBeNull();
    }
  });
});

describe('sub-status entries', () => {
  it('keeps every sub-status text normalised and every pair unique', () => {
    for (const entry of SUB_STATUS_ENTRIES) {
      expect(normaliseText(entry.match), `${entry.match} is not normalised`).toBe(entry.match);
    }

    const pairs = SUB_STATUS_ENTRIES.map((entry) => `${entry.status}|${entry.match}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('gives every entry a meaning in both locales', () => {
    for (const entry of SUB_STATUS_ENTRIES) {
      expect(entry.es.trim(), `${entry.status} / ${entry.match} es`).not.toBe('');
      expect(entry.en.trim(), `${entry.status} / ${entry.match} en`).not.toBe('');
    }
  });

  it('matches the observed sub-status values under the status they are printed under', () => {
    for (const value of OBSERVED_SUB_STATUSES) {
      expect(
        findSubStatus('abierto-en-tramitacion', value),
        `${value} is not a known sub-status`,
      ).not.toBeNull();
    }

    expect(
      findSubStatus('abierto-en-calificacion', 'Su expediente se encuentra en calificación.'),
    ).not.toBeNull();
  });

  it('records the observed order of the steps inside En tramitación', () => {
    const progressOf = (value: string) =>
      findSubStatus('abierto-en-tramitacion', value)?.progress ?? null;

    expect(OBSERVED_SUB_STATUSES.map(progressOf)).toEqual([1, 2, 3, 4]);
  });

  it('gives the same sentence a different meaning under En tramitación and En calificación', () => {
    const sentence = 'Su expediente se encuentra en calificación.';
    const underProcessing = findSubStatus('abierto-en-tramitacion', sentence);
    const underAssessment = findSubStatus('abierto-en-calificacion', sentence);

    expect(underProcessing).not.toBeNull();
    expect(underAssessment).not.toBeNull();
    expect(underProcessing?.es).not.toBe(underAssessment?.es);
    expect(underProcessing?.en).not.toBe(underAssessment?.en);
  });

  it('knows nothing about a sentence it has not observed', () => {
    expect(findSubStatus('abierto-en-tramitacion', 'Su expediente está en la nevera')).toBeNull();
  });
});

describe('nothing the catalogue resolves today is lost', () => {
  it('still resolves every match text of every entry', () => {
    for (const entry of STATUS_CATALOG) {
      for (const match of entry.match) {
        expect(statusKeyOf(match), `${match}`).toBe(entry.key);
      }
    }
  });
});

describe('final outcomes found by whole-word search', () => {
  it('recognises a denial the catalogue has no exact text for', () => {
    expect(statusKeyOf('Finalizado - Denegado. Notificado.')).toBe('resuelto-denegado');
    expect(statusKeyOf('Denegación de la solicitud')).toBe('resuelto-denegado');
  });

  it('recognises an archive printed under the status', () => {
    expect(statusKeyOf('Cerrado', 'Su expediente ha sido archivado')).toBe('archivado');
  });

  it('lets an exact status match win over a word in the sub-status', () => {
    expect(statusKeyOf('Abierto - En tramitación.', 'La solicitud ha sido denegada')).toBe(
      'abierto-en-tramitacion',
    );
  });

  it('never guesses between a denial and an archive', () => {
    expect(statusKeyOf('Cerrado', 'Expediente archivado y resuelto denegado')).toBe(
      UNKNOWN_STATUS_KEY,
    );
  });

  it('matches whole words only', () => {
    expect(statusKeyOf('Cerrado', 'Su expediente ha sido desarchivado')).toBe(UNKNOWN_STATUS_KEY);
  });
});
