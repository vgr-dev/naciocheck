import { describe, expect, it } from 'vitest';
import { isExtensionMessage } from '../src/core/messages';
import type { ParseOutcome } from '../src/core/parser';

/**
 * The background accepts only messages this extension sends, with their fields checked. Synthetic values only.
 */

const STATUS: ParseOutcome = {
  kind: 'status',
  key: 'abierto-registrado',
  raw: 'Abierto - Registrado.',
  normalised: 'abierto - registrado.',
  subStatus: null,
};

describe('isExtensionMessage', () => {
  it('accepts every message the extension sends', () => {
    const messages: unknown[] = [
      { type: 'naciocheck:request-fill' },
      { type: 'naciocheck:page-outcome', outcome: STATUS },
      { type: 'naciocheck:page-outcome', outcome: { kind: 'form' } },
      { type: 'naciocheck:page-outcome', outcome: { kind: 'unknown' } },
      {
        type: 'naciocheck:page-outcome',
        outcome: { kind: 'error', raw: 'Error.', messages: ['Error.'] },
      },
      { type: 'naciocheck:start-check-run' },
      { type: 'naciocheck:start-check-run', applicationIds: ['app-1', 'app-2'] },
      { type: 'naciocheck:result-request' },
      { type: 'naciocheck:result-request', checkId: 'check-1' },
      { type: 'naciocheck:acknowledge', checkId: 'check-1' },
      { type: 'naciocheck:retry', applicationId: 'app-1' },
      { type: 'naciocheck:continue' },
      { type: 'naciocheck:reschedule' },
      { type: 'naciocheck:unlock', passphrase: '' },
      { type: 'naciocheck:lock' },
      { type: 'naciocheck:session-state' },
      {
        type: 'naciocheck:dev:seed-check',
        applicationId: 'app-1',
        raw: 'Abierto - Registrado.',
        subStatus: null,
      },
    ];

    for (const message of messages) {
      expect(isExtensionMessage(message), JSON.stringify(message)).toBe(true);
    }
  });

  it('rejects values that are not messages at all', () => {
    for (const value of [null, undefined, 'naciocheck:lock', 42, [], {}, { type: 1 }]) {
      expect(isExtensionMessage(value)).toBe(false);
    }
  });

  it('rejects an unknown type even with the extension prefix', () => {
    expect(isExtensionMessage({ type: 'naciocheck:not-a-message' })).toBe(false);
    expect(isExtensionMessage({ type: 'other:lock' })).toBe(false);
  });

  it('rejects a page outcome that the parser could not have produced', () => {
    const invalid: unknown[] = [
      { type: 'naciocheck:page-outcome' },
      { type: 'naciocheck:page-outcome', outcome: null },
      { type: 'naciocheck:page-outcome', outcome: { kind: 'status' } },
      {
        type: 'naciocheck:page-outcome',
        outcome: { kind: 'error', raw: 'Error.', messages: [1] },
      },
      { type: 'naciocheck:page-outcome', outcome: { kind: 'invented' } },
    ];
    for (const message of invalid) {
      expect(isExtensionMessage(message), JSON.stringify(message)).toBe(false);
    }
  });

  it('rejects missing or wrongly typed identifiers', () => {
    const invalid: unknown[] = [
      { type: 'naciocheck:acknowledge' },
      { type: 'naciocheck:acknowledge', checkId: '' },
      { type: 'naciocheck:acknowledge', checkId: 7 },
      { type: 'naciocheck:retry' },
      { type: 'naciocheck:retry', applicationId: '' },
      { type: 'naciocheck:result-request', checkId: '' },
      { type: 'naciocheck:start-check-run', applicationIds: 'app-1' },
      { type: 'naciocheck:start-check-run', applicationIds: ['app-1', 2] },
      { type: 'naciocheck:unlock' },
      { type: 'naciocheck:unlock', passphrase: 7 },
      { type: 'naciocheck:dev:seed-check', applicationId: 'app-1', raw: 7 },
    ];
    for (const message of invalid) {
      expect(isExtensionMessage(message), JSON.stringify(message)).toBe(false);
    }
  });
});
