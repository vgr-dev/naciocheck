import { describe, expect, it } from 'vitest';
import { buildErrorView, buildResultView, decideAlert } from '../src/core/alerts';
import type { Change } from '../src/core/changes';
import type { Check } from '../src/core/storage';

function check(overrides: Partial<Check> = {}): Check {
  return {
    id: 'check-2',
    applicationId: 'app-1',
    at: '2026-11-06T10:00:00.000Z',
    outcome: 'status',
    statusKey: 'abierto-registrado',
    raw: 'Abierto - Registrado.',
    subStatus: null,
    acknowledged: false,
    ...overrides,
  };
}

const PREVIOUS = check({
  id: 'check-1',
  at: '2026-11-05T10:00:00.000Z',
  statusKey: 'abierto-registrado',
  raw: 'Abierto - Registrado.',
});

const CURRENT = check({
  statusKey: 'abierto-en-tramitacion',
  raw: 'Abierto - En tramitación.',
  subStatus: 'Su expediente se encuentra en tramitación.',
});

function changeOf(kind: Change['kind'], overrides: Partial<Change> = {}): Change {
  return { kind, previous: kind === 'first' ? null : PREVIOUS, current: CURRENT, ...overrides };
}

describe('decideAlert', () => {
  it('shows the plain status view for a first check', () => {
    expect(decideAlert(changeOf('first'), 'Primera')).toEqual({
      view: 'status',
      notification: null,
      badge: { text: '', color: null },
    });
  });

  it('shows the plain status view when nothing changed', () => {
    expect(decideAlert(changeOf('unchanged'), 'Primera')).toMatchObject({ view: 'status' });
  });

  it('raises the full alert when the status changed', () => {
    const decision = decideAlert(changeOf('changed'), 'Primera');

    expect(decision.view).toBe('changed');
    expect(decision.badge).toEqual({ text: '!', color: '#dc2626' });
    expect(decision.notification).not.toBeNull();
    expect(decision.notification?.title).toContain('Primera');
    expect(decision.notification?.message).toContain('Abierto - En tramitación.');
  });

  it('keeps identity data out of the notification', () => {
    const decision = decideAlert(changeOf('changed'), 'Primera');

    expect(JSON.stringify(decision.notification)).not.toMatch(/NIE|nacimiento/i);
  });

  it('never alerts for an error outcome', () => {
    expect(decideAlert(changeOf('error'), 'Primera')).toEqual({
      view: 'error',
      notification: null,
      badge: { text: '', color: null },
    });
  });
});

describe('buildResultView — status', () => {
  it('uses the catalogue title and says it is the first check', () => {
    const view = buildResultView({
      label: 'Primera',
      change: changeOf('first', { current: PREVIOUS }),
    });

    expect(view.view).toBe('status');
    expect(view.status?.title).toBe('Abierto - Registrado');
    expect(view.versionLine).toBe('Primera comprobación.');
    expect(view.previous).toBeNull();
    expect(view.explanation).toEqual(expect.any(String));
  });

  it('says since when it has been unchanged', () => {
    const view = buildResultView({ label: 'Primera', change: changeOf('unchanged') });

    expect(view.versionLine).toMatch(/^Sin cambios desde /);
  });

  it('shows the previous status and the new explanation when it changed', () => {
    const view = buildResultView({ label: 'Primera', change: changeOf('changed') });

    expect(view.view).toBe('changed');
    expect(view.status?.text).toBe('Abierto - En tramitación.');
    expect(view.status?.subStatus).toBe('Su expediente se encuentra en tramitación.');
    expect(view.previous?.text).toBe('Antes: Abierto - Registrado.');
    expect(view.explanation).toContain('tramitación');
  });

  it('keeps an unknown status verbatim and without explanation', () => {
    const unknown = check({ raw: 'Estado sin catalogar', statusKey: 'unknown' });
    const view = buildResultView({
      label: 'Primera',
      change: changeOf('first', { current: unknown }),
    });

    expect(view.status?.title).toBe('Estado sin catalogar');
    expect(view.explanation).toBeNull();
    expect(view.sources).toEqual([]);
  });

  it('passes the anomaly text through', () => {
    const view = buildResultView({
      label: 'Primera',
      change: changeOf('changed'),
      anomaly: { kind: 'stage-backwards', es: 'Nota en castellano.', en: 'Note.', source: null },
    });

    expect(view.anomaly).toBe('Nota en castellano.');
  });

  it('speaks English when asked', () => {
    const view = buildResultView({ label: 'First', change: changeOf('first'), locale: 'en' });

    expect(view.versionLine).toBe('First check.');
  });
});

describe('buildErrorView', () => {
  it('shows the page messages verbatim and names the three fields to check', () => {
    const view = buildErrorView({
      label: 'Primera',
      messages: [
        'El campo "NIE" no se corresponde con un número de NIE correcto',
        'Error en la verificación del captcha',
      ],
    });

    expect(view.view).toBe('error');
    expect(view.errorMessages).toHaveLength(2);
    expect(view.whatYouCanDo).toMatch(/NIE/);
    expect(view.whatYouCanDo).toMatch(/año/);
    // D12: never assert a cause.
    expect(view.whatYouCanDo).not.toMatch(/captcha/i);
  });

  it('never counts an error as a change', () => {
    const view = buildResultView({
      label: 'Primera',
      change: changeOf('error', { previous: PREVIOUS }),
      errorMessages: ['Error en la verificación del captcha'],
    });

    expect(view.view).toBe('error');
    expect(view.previous).toBeNull();
    expect(view.status).toBeNull();
  });
});
