import { describe, expect, it } from 'vitest';
import { normaliseText } from '../src/core/normalise';

describe('normaliseText', () => {
  it('lowercases', () => {
    expect(normaliseText('EN TRAMITACIÓN')).toBe('en tramitacion');
  });

  it('strips accents so the page and the catalogue compare equal', () => {
    expect(normaliseText('En calificación')).toBe('en calificacion');
    expect(normaliseText('En vía de recurso')).toBe('en via de recurso');
  });

  it('folds every dash flavour to a spaced hyphen', () => {
    expect(normaliseText('Abierto - Registrado.')).toBe('abierto - registrado');
    expect(normaliseText('Abierto – Registrado')).toBe('abierto - registrado');
    expect(normaliseText('Abierto — Registrado')).toBe('abierto - registrado');
    expect(normaliseText('Abierto-Registrado')).toBe('abierto - registrado');
  });

  it('collapses non-breaking spaces and newlines', () => {
    expect(normaliseText('Pendiente\u00a0de\n\n  requerimiento ')).toBe(
      'pendiente de requerimiento',
    );
  });

  it('drops edge punctuation but keeps it inside the text', () => {
    expect(normaliseText('  Abierto - Registrado.  ')).toBe('abierto - registrado');
    expect(normaliseText('Resuelto: favorable')).toBe('resuelto: favorable');
  });

  it('is idempotent', () => {
    const once = normaliseText('  Abierto – Registrado. ');
    expect(normaliseText(once)).toBe(once);
  });

  it('returns an empty string for blank input', () => {
    expect(normaliseText('   \n\t ')).toBe('');
  });
});
