import { normaliseText } from './normalise';
import type { Check } from './storage';

/**
 * Compares a new check with the previous one.
 *
 * Comparison uses the **normalised raw text**, not the catalogue key, so two statuses the catalogue has never
 * seen still count as a change: the user is told that something moved even when the extension cannot explain
 * it yet.
 */

export type ChangeKind = 'first' | 'unchanged' | 'changed' | 'error';

export interface Change {
  kind: ChangeKind;
  /** The previous check the comparison used, if any. */
  previous: Check | null;
  current: Check;
}

export function evaluateChange(previous: Check | null, current: Check): Change {
  // An error or an unrecognised page never counts as a status change, whatever the previous check said.
  if (current.outcome !== 'status') {
    return { kind: 'error', previous, current };
  }
  // Only a previous *status* can be compared against: after an error, the next status is the first one.
  const comparable = previous?.outcome === 'status' ? previous : null;
  if (comparable === null) {
    return { kind: 'first', previous: null, current };
  }
  const sameStatus = normaliseText(comparable.raw) === normaliseText(current.raw);
  const sameSubStatus =
    normaliseText(comparable.subStatus ?? '') === normaliseText(current.subStatus ?? '');
  const unchanged = sameStatus && sameSubStatus;
  return { kind: unchanged ? 'unchanged' : 'changed', previous: comparable, current };
}
