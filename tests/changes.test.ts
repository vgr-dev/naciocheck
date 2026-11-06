import { describe, expect, it } from 'vitest';
import { evaluateChange } from '../src/core/changes';
import type { Check, CheckOutcome } from '../src/core/storage';

function check(overrides: Partial<Check> = {}): Check {
  return {
    id: 'check-1',
    applicationId: 'app-1',
    at: '2026-11-06T10:00:00.000Z',
    outcome: 'status',
    statusKey: 'unknown',
    raw: 'Abierto - Registrado.',
    subStatus: null,
    acknowledged: false,
    ...overrides,
  };
}

function checkWith(
  outcome: CheckOutcome,
  raw: string,
  at: string,
  subStatus: string | null = null,
): Check {
  return check({ id: `check-${at}`, at, outcome, raw, subStatus });
}

describe('evaluateChange', () => {
  it('reports the first check when there is nothing to compare against', () => {
    const current = check();

    expect(evaluateChange(null, current)).toEqual({ kind: 'first', previous: null, current });
  });

  it('reports no change when only the typography differs', () => {
    const previous = checkWith('status', 'Abierto - Registrado.', '2026-11-05T10:00:00.000Z');
    const current = checkWith('status', 'ABIERTO – REGISTRADO', '2026-11-06T10:00:00.000Z');

    expect(evaluateChange(previous, current)).toMatchObject({
      kind: 'unchanged',
      previous,
      current,
    });
  });

  it('reports a change when the status text changes', () => {
    const previous = checkWith('status', 'Abierto - Registrado.', '2026-11-05T10:00:00.000Z');
    const current = checkWith('status', 'Abierto - En tramitación.', '2026-11-06T10:00:00.000Z');

    expect(evaluateChange(previous, current)).toMatchObject({ kind: 'changed', previous, current });
  });

  it('reports a change between two statuses the catalogue does not know', () => {
    const previous = checkWith('status', 'Estado raro uno', '2026-11-05T10:00:00.000Z');
    const current = checkWith('status', 'Estado raro dos', '2026-11-06T10:00:00.000Z');

    expect(evaluateChange(previous, current)).toMatchObject({ kind: 'changed' });
  });

  it('reports a change when only the sub-status moves', () => {
    const previous = checkWith(
      'status',
      'Abierto - En tramitación.',
      '2026-11-05T10:00:00.000Z',
      'Su expediente se encuentra en tramitación.',
    );
    const current = checkWith(
      'status',
      'Abierto - En tramitación.',
      '2026-11-06T10:00:00.000Z',
      'Pendiente recepción de informes preceptivos oficiales',
    );

    expect(evaluateChange(previous, current)).toMatchObject({ kind: 'changed', previous, current });
  });

  it('reports no change when status and sub-status match modulo typography', () => {
    const previous = checkWith(
      'status',
      'Abierto - En tramitación.',
      '2026-11-05T10:00:00.000Z',
      'Pendiente recepción de informes preceptivos oficiales',
    );
    const current = checkWith(
      'status',
      'ABIERTO – EN TRAMITACIÓN',
      '2026-11-06T10:00:00.000Z',
      'pendiente  recepción de informes preceptivos oficiales. ',
    );

    expect(evaluateChange(previous, current)).toMatchObject({ kind: 'unchanged' });
  });

  it('reports a change when a sub-status appears', () => {
    const previous = checkWith(
      'status',
      'Abierto - En tramitación.',
      '2026-11-05T10:00:00.000Z',
      null,
    );
    const current = checkWith(
      'status',
      'Abierto - En tramitación.',
      '2026-11-06T10:00:00.000Z',
      'Su expediente se encuentra en tramitación.',
    );

    expect(evaluateChange(previous, current)).toMatchObject({ kind: 'changed' });
  });

  it('reports a change when the sub-status disappears', () => {
    const previous = checkWith(
      'status',
      'Abierto - En tramitación.',
      '2026-11-05T10:00:00.000Z',
      'Su expediente se encuentra en tramitación.',
    );
    const current = checkWith(
      'status',
      'Abierto - En tramitación.',
      '2026-11-06T10:00:00.000Z',
      null,
    );

    expect(evaluateChange(previous, current)).toMatchObject({ kind: 'changed' });
  });

  it('never reports a change for an error outcome', () => {
    const previous = checkWith('status', 'Abierto - Registrado.', '2026-11-05T10:00:00.000Z');
    const current = checkWith('error', 'Los datos no son correctos', '2026-11-06T10:00:00.000Z');

    expect(evaluateChange(previous, current)).toMatchObject({ kind: 'error', previous, current });
  });

  it('treats an unrecognised page as an error, not as a change', () => {
    const previous = checkWith('status', 'Abierto - Registrado.', '2026-11-05T10:00:00.000Z');
    const current = checkWith('unknown', '', '2026-11-06T10:00:00.000Z');

    expect(evaluateChange(previous, current)).toMatchObject({ kind: 'error' });
  });

  it('reports a first check when the previous one was an error', () => {
    const previous = checkWith('error', 'Los datos no son correctos', '2026-11-05T10:00:00.000Z');
    const current = checkWith('status', 'Abierto - Registrado.', '2026-11-06T10:00:00.000Z');

    expect(evaluateChange(previous, current)).toEqual({ kind: 'first', previous: null, current });
  });

  it('reports an error even when there is no previous check', () => {
    const current = checkWith('error', 'Servicio no disponible', '2026-11-06T10:00:00.000Z');

    expect(evaluateChange(null, current)).toMatchObject({ kind: 'error', previous: null });
  });
});
