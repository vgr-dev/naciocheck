import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normaliseText } from '../src/core/normalise';
import {
  findStatus,
  STATUS_CATALOG,
  STATUS_DISCLAIMER,
  statusKeyOf,
  SUB_STATUS_SIGNALS,
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
        expect(source.label.trim(), `${entry.key} source label`).not.toBe('');
        expect(source.url, `${entry.key} source url`).toMatch(/^https:\/\//);
      }
    }
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

describe('sub-status signals', () => {
  it('keeps the observed order and normalised text', () => {
    expect(SUB_STATUS_SIGNALS.map((signal) => signal.progress)).toEqual([1, 2, 3, 4]);
    for (const signal of SUB_STATUS_SIGNALS) {
      expect(normaliseText(signal.match)).toBe(signal.match);
    }
  });

  it('matches the observed sub-status values', () => {
    for (const value of OBSERVED_SUB_STATUSES) {
      const normalised = normaliseText(value);
      expect(
        SUB_STATUS_SIGNALS.some((signal) => signal.match === normalised),
        `${value} is not a known sub-status`,
      ).toBe(true);
    }
  });
});
