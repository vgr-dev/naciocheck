import { describe, expect, it } from 'vitest';
import { detectAnomaly } from '../src/core/anomaly';
import type { Check } from '../src/core/storage';

function check(overrides: Partial<Check> = {}): Check {
  return {
    id: 'check-1',
    applicationId: 'app-1',
    at: '2026-11-05T10:00:00.000Z',
    outcome: 'status',
    statusKey: 'unknown',
    raw: 'Abierto - Registrado.',
    subStatus: null,
    acknowledged: false,
    ...overrides,
  };
}

/** The observed states, exactly as the page prints them. */
const REGISTERED = check({ raw: 'Abierto - Registrado.' });
const FINALIZADO = check({ raw: 'Finalizado - Concedido. Notificado.' });

function tramitacion(subStatus: string): Check {
  return check({ raw: 'Abierto - En tramitación.', subStatus });
}

const T1 = tramitacion('Su expediente se encuentra en tramitación.');
const T2 = tramitacion('Pendiente solicitud informes preceptivos oficiales');
const T3 = tramitacion('Pendiente recepción de informes preceptivos oficiales');
const T4 = tramitacion('Su expediente se encuentra en calificación.');
const CALIFICACION = check({
  raw: 'Abierto - En calificación.',
  subStatus: 'Su expediente se encuentra en calificación.',
});
const REQUERIDO = check({ raw: 'Abierto - En tramitación: requerido.' });
const DOCUMENTACION = check({
  raw: 'Abierto - En tramitación: requerido - documentación aportada',
});

describe('detectAnomaly', () => {
  it('says nothing on the first check', () => {
    expect(detectAnomaly(null, CALIFICACION)).toBeNull();
  });

  it('says nothing when the state has not changed', () => {
    expect(detectAnomaly(T3, T3)).toBeNull();
  });

  it('says nothing on the main path', () => {
    expect(detectAnomaly(REGISTERED, T1)).toBeNull();
    expect(detectAnomaly(T1, T2)).toBeNull();
  });

  it('says nothing when a step passed unseen between two checks', () => {
    // D3, interim: checks are periodic, so T1 → T3 is still the usual path.
    expect(detectAnomaly(T1, T3)).toBeNull();
  });

  it('says nothing on the usual moves that used to be flagged as going backwards', () => {
    expect(detectAnomaly(DOCUMENTACION, T1)).toBeNull();
    expect(detectAnomaly(CALIFICACION, REQUERIDO)).toBeNull();
  });

  it('notes the move from calificación back to tramitación, with the source it has', () => {
    const note = detectAnomaly(CALIFICACION, T1);

    expect(note?.kind).toBe('unusual');
    expect(note?.es).toContain(
      '«Abierto - En calificación. Su expediente se encuentra en calificación.»',
    );
    expect(note?.es).toContain(
      '«Abierto - En tramitación. Su expediente se encuentra en tramitación.»',
    );
    expect(note?.source?.url).toContain('parainmigrantes.info');
  });

  it('notes a step backwards inside En tramitación, which the old rule missed', () => {
    const note = detectAnomaly(T3, T1);

    expect(note?.kind).toBe('unusual');
    expect(note?.es).toContain(
      '«Abierto - En tramitación. Pendiente recepción de informes preceptivos oficiales»',
    );
    expect(note?.es).toContain(
      '«Abierto - En tramitación. Su expediente se encuentra en tramitación.»',
    );
  });

  it('does not cite that source for any other unusual move', () => {
    const note = detectAnomaly(FINALIZADO, T1);

    expect(note?.kind).toBe('unusual');
    expect(note?.source).toBeNull();
  });

  it('writes the note in English when asked for that locale', () => {
    const note = detectAnomaly(CALIFICACION, T4);

    expect(note?.en).toContain('The file moves from');
    expect(note?.en).toContain(
      '"Abierto - En calificación. Su expediente se encuentra en calificación."',
    );
    expect(note?.en).toContain(
      '"Abierto - En tramitación. Su expediente se encuentra en calificación."',
    );
    expect(note?.en).not.toContain('Open - In progress');
    expect(note?.en).not.toContain('Open - Under assessment');
  });

  it('says nothing for errors or unrecognised statuses', () => {
    const error = check({ outcome: 'error', raw: 'Error en la verificación del captcha' });

    expect(detectAnomaly(T3, error)).toBeNull();
    expect(detectAnomaly(T3, check({ outcome: 'unknown' }))).toBeNull();
    expect(detectAnomaly(CALIFICACION, check({ raw: 'Estado sin catalogar' }))).toBeNull();
  });

  it('never judges a sub-status it cannot place', () => {
    const unlisted = tramitacion('Su expediente está en la nevera');

    expect(detectAnomaly(unlisted, T1)).toBeNull();
    expect(detectAnomaly(T1, unlisted)).toBeNull();
  });
});
