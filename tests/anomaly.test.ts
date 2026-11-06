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

const REGISTERED = check({ raw: 'Abierto - Registrado.' }); // stage 20
const TRAMITACION = check({ raw: 'Abierto - En tramitación.' }); // stage 30
const CALIFICACION = check({ raw: 'Abierto - En calificación.' }); // stage 50

describe('detectAnomaly', () => {
  it('says nothing on a normal forward move', () => {
    expect(detectAnomaly(REGISTERED, CALIFICACION)).toBeNull();
  });

  it('says nothing on the first check', () => {
    expect(detectAnomaly(null, CALIFICACION)).toBeNull();
  });

  it('notes a move back to an earlier stage, with its source', () => {
    const note = detectAnomaly(CALIFICACION, TRAMITACION);

    expect(note?.kind).toBe('stage-backwards');
    expect(note?.es).toContain('fase anterior');
    expect(note?.source?.url).toContain('parainmigrantes.info');
  });

  it('notes a sub-status that skips a step', () => {
    const before = check({
      raw: 'Abierto - En tramitación.',
      subStatus: 'Su expediente se encuentra en tramitación.',
    });
    const after = check({
      raw: 'Abierto - En tramitación.',
      subStatus: 'Pendiente recepción de informes preceptivos oficiales',
    });

    expect(detectAnomaly(before, after)?.kind).toBe('sub-status-skip');
  });

  it('says nothing when the sub-status advances one step', () => {
    const before = check({
      raw: 'Abierto - En tramitación.',
      subStatus: 'Su expediente se encuentra en tramitación.',
    });
    const after = check({
      raw: 'Abierto - En tramitación.',
      subStatus: 'Pendiente solicitud informes preceptivos oficiales',
    });

    expect(detectAnomaly(before, after)).toBeNull();
  });

  it('says nothing when a sub-status is missing', () => {
    const after = check({
      raw: 'Abierto - En tramitación.',
      subStatus: 'Pendiente recepción de informes preceptivos oficiales',
    });

    expect(detectAnomaly(check({ raw: 'Abierto - En tramitación.' }), after)).toBeNull();
  });

  it('says nothing for errors or unrecognised statuses', () => {
    const error = check({ outcome: 'error', raw: 'Error en la verificación del captcha' });

    expect(detectAnomaly(TRAMITACION, error)).toBeNull();
    expect(detectAnomaly(CALIFICACION, check({ raw: 'Estado sin catalogar' }))).toBeNull();
  });

  it('never judges a status the catalogue does not know, even with known sub-statuses', () => {
    const before = check({
      raw: 'Estado sin catalogar',
      subStatus: 'Su expediente se encuentra en tramitación.',
    });
    const after = check({
      raw: 'Abierto - En tramitación.',
      subStatus: 'Pendiente recepción de informes preceptivos oficiales',
    });

    expect(detectAnomaly(before, after)).toBeNull();
  });
});
