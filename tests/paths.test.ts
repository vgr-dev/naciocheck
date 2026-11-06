import { describe, expect, it } from 'vitest';
import { normaliseText } from '../src/core/normalise';
import {
  classifyTransition,
  KNOWN_BRANCHES,
  MAIN_PATH,
  MAIN_PATH_STATES,
  PATH_STATES,
  resolvePathState,
  UNLISTED_PATH_STATE,
  type PathStateId,
  type ResolvedPathState,
} from '../src/core/paths';
import { STATUS_CATALOG } from '../src/core/statuses';

/**
 * The plan's §1 table, with the literal page strings. `D` and `A` use the catalogue's own word form because
 * the page's exact wording for them has not been captured yet.
 */
const OBSERVED_STATES: ReadonlyArray<
  readonly [status: string, subStatus: string | null, id: PathStateId]
> = [
  ['Abierto - Registrado.', null, 'R'],
  ['Abierto - En tramitación.', 'Su expediente se encuentra en tramitación.', 'T1'],
  ['Abierto - En tramitación.', 'Pendiente solicitud informes preceptivos oficiales', 'T2'],
  ['Abierto - En tramitación.', 'Pendiente recepción de informes preceptivos oficiales', 'T3'],
  ['Abierto - En tramitación.', 'Su expediente se encuentra en calificación.', 'T4'],
  ['Abierto - En tramitación.', 'Su expediente se encuentra en estudio', 'TE'],
  ['Abierto - En tramitación: requerido.', null, 'Q'],
  ['Abierto - En tramitación: requerido - documentación aportada', null, 'QA'],
  ['Abierto - En calificación.', 'Su expediente se encuentra en calificación.', 'K'],
  ['Abierto - Concedido. Enviada notificación.', null, 'C'],
  ['Finalizado - Concedido. Notificado.', null, 'F'],
  ['Denegado', null, 'D'],
  ['Archivado', null, 'A'],
];

describe('observing a check as a path state', () => {
  it.each(OBSERVED_STATES)('%s with %s is state %s', (status, subStatus, id) => {
    expect(resolvePathState(status, subStatus)?.id).toBe(id);
  });
  it('keeps the status key and the normalised sub-status', () => {
    expect(
      resolvePathState(
        'Abierto - En tramitación.',
        'Pendiente recepción de informes preceptivos oficiales',
      ),
    ).toEqual({
      id: 'T3',
      status: 'abierto-en-tramitacion',
      subStatus: 'pendiente recepcion de informes preceptivos oficiales',
    });
  });

  it('reads the states recognised by the status alone', () => {
    expect(resolvePathState('Abierto - En calificación.', null)?.id).toBe('K');
    expect(
      resolvePathState('Abierto - Registrado.', 'Su expediente ha sido registrado correctamente')
        ?.id,
    ).toBe('R');
  });

  it('keeps a known status with an unlisted sub-status as a state of its own', () => {
    expect(
      resolvePathState('Abierto - En tramitación.', 'Su expediente está en la nevera'),
    ).toMatchObject({ id: UNLISTED_PATH_STATE, status: 'abierto-en-tramitacion' });
  });

  it('refuses to judge a status the catalogue does not know', () => {
    expect(
      resolvePathState('Estado sin catalogar', 'Su expediente se encuentra en tramitación.'),
    ).toBeNull();
  });
});

describe('path table', () => {
  it('uses each state id once and keeps every sub-status normalised', () => {
    const ids = PATH_STATES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const entry of PATH_STATES) {
      if (entry.subStatus !== null) {
        expect(normaliseText(entry.subStatus), `${entry.id} sub-status`).toBe(entry.subStatus);
      }
    }
  });

  it('names a status the catalogue knows for every state', () => {
    const keys = new Set(STATUS_CATALOG.map((entry) => entry.key));

    for (const entry of PATH_STATES) {
      expect(keys.has(entry.status), `${entry.id} uses ${entry.status}`).toBe(true);
    }
  });

  it('keeps the main path in order and K off it', () => {
    expect(MAIN_PATH_STATES).toEqual(['R', 'T1', 'T2', 'T3', 'T4', 'C', 'F']);
    expect(MAIN_PATH_STATES).not.toContain('K');
    expect(MAIN_PATH.every((move, index) => MAIN_PATH_STATES[index + 1] === move.to)).toBe(true);
  });

  it('carries every branch the observations give', () => {
    const moves = KNOWN_BRANCHES.map((move) => `${move.from}>${move.to}`);

    expect(moves).toEqual(
      expect.arrayContaining([
        'T1>Q',
        'T2>Q',
        'T3>Q',
        'T4>Q',
        'TE>Q',
        'K>Q',
        'K>TE',
        'K>D',
        'Q>QA',
        'Q>A',
        'T4>K',
        'QA>T1',
        'QA>T2',
        'QA>T3',
        'QA>T4',
        'QA>TE',
        'QA>K',
      ]),
    );
  });

  it('only moves between states that exist and never repeats a move', () => {
    const ids = new Set<string>(PATH_STATES.map((entry) => entry.id));
    const moves = [...MAIN_PATH, ...KNOWN_BRANCHES];

    for (const move of moves) {
      expect(ids.has(move.from), `${move.from} → ${move.to}`).toBe(true);
      expect(ids.has(move.to), `${move.from} → ${move.to}`).toBe(true);
    }

    const keys = moves.map((move) => `${move.from}>${move.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/** A state resolved from the same literal page strings, so the classification meets what the parser produces. */
function stateOf(id: PathStateId): ResolvedPathState {
  const form = OBSERVED_STATES.find(([, , stateId]) => stateId === id);
  if (form === undefined) throw new Error(`no page form recorded for ${id}`);

  const state = resolvePathState(form[0], form[1]);
  if (state === null) throw new Error(`${id} did not resolve`);

  return state;
}

describe('classifying a move', () => {
  it.each(MAIN_PATH)('$from → $to is main-path', ({ from, to }) => {
    expect(classifyTransition(stateOf(from), stateOf(to))).toBe('main-path');
  });

  it.each(KNOWN_BRANCHES)('$from → $to is known-branch', ({ from, to }) => {
    expect(classifyTransition(stateOf(from), stateOf(to))).toBe('known-branch');
  });

  const FORWARD_JUMPS: ReadonlyArray<readonly [PathStateId, PathStateId]> = [
    ['T1', 'T4'],
    ['R', 'C'],
    ['T2', 'F'],
  ];

  it.each(FORWARD_JUMPS)('%s → %s is main-path even when a step was skipped', (from, to) => {
    expect(classifyTransition(stateOf(from), stateOf(to))).toBe('main-path');
  });

  const UNUSUAL_MOVES: ReadonlyArray<readonly [PathStateId, PathStateId]> = [
    ['T3', 'T1'],
    ['R', 'K'],
    ['F', 'T1'],
    ['T2', 'A'],
    ['K', 'T3'],
    ['C', 'T3'],
    ['Q', 'T1'],
  ];

  it.each(UNUSUAL_MOVES)('%s → %s is unusual', (from, to) => {
    expect(classifyTransition(stateOf(from), stateOf(to))).toBe('unusual');
  });

  it('judges nothing without two known states', () => {
    expect(classifyTransition(null, stateOf('T1'))).toBe('no-judgement');
    expect(classifyTransition(stateOf('T1'), null)).toBe('no-judgement');
    expect(classifyTransition(null, null)).toBe('no-judgement');
  });

  it('judges nothing when the state has not changed', () => {
    expect(classifyTransition(stateOf('T1'), stateOf('T1'))).toBe('no-judgement');
    expect(classifyTransition(stateOf('K'), stateOf('K'))).toBe('no-judgement');
  });

  it('judges nothing when a sub-status is not one the observations place', () => {
    const unlisted = resolvePathState(
      'Abierto - En tramitación.',
      'Su expediente está en la nevera',
    );

    expect(classifyTransition(unlisted, stateOf('T1'))).toBe('no-judgement');
    expect(classifyTransition(stateOf('R'), unlisted)).toBe('no-judgement');
  });
});
