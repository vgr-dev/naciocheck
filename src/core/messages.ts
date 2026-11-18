import type { ParseOutcome } from './parser';
import type { PlainIdentity } from './storage';

/**
 * The message protocol between the content script and the background worker.
 *
 * The application to fill is never carried in a URL: the background keeps it per tab id, and the content
 * script asks for it. That keeps the NIE out of the address bar, history and logs.
 */

/** What the content script receives when this tab belongs to a check run. */
export interface FillPayload {
  applicationId: string;
  label: string;
  /** Only plain identities can be filled; encrypted ones must be unlocked first. */
  identity: PlainIdentity;
}

export interface RequestFillMessage {
  type: 'naciocheck:request-fill';
}

export interface PageOutcomeMessage {
  type: 'naciocheck:page-outcome';
  outcome: ParseOutcome;
}

export interface StartCheckRunMessage {
  type: 'naciocheck:start-check-run';
  applicationIds?: string[];
}

export interface ResultRequestMessage {
  type: 'naciocheck:result-request';
  /** Reopens one recorded check by id instead of the result cached for this tab. */
  checkId?: string;
}

export interface AcknowledgeMessage {
  type: 'naciocheck:acknowledge';
  checkId: string;
}

export interface RetryMessage {
  type: 'naciocheck:retry';
  applicationId: string;
}

export interface ContinueMessage {
  type: 'naciocheck:continue';
}

export interface RescheduleMessage {
  type: 'naciocheck:reschedule';
}

/** Opens the encrypted identities with a passphrase; the background keeps it in session storage only. */
export interface UnlockMessage {
  type: 'naciocheck:unlock';
  passphrase: string;
}

/** Lock again: forgets the passphrase held in session memory. */
export interface LockMessage {
  type: 'naciocheck:lock';
}

/** Whether the background still holds a passphrase for this browser session. */
export interface SessionStateMessage {
  type: 'naciocheck:session-state';
}

/** Dev-only, and only when `naciocheck:dev:enabled` is set. Seeds a previous check for the alert test. */
export interface DevSeedCheckMessage {
  type: 'naciocheck:dev:seed-check';
  applicationId: string;
  raw: string;
  subStatus?: string | null;
}

export type ExtensionMessage =
  | RequestFillMessage
  | PageOutcomeMessage
  | StartCheckRunMessage
  | ResultRequestMessage
  | AcknowledgeMessage
  | RetryMessage
  | ContinueMessage
  | RescheduleMessage
  | UnlockMessage
  | LockMessage
  | SessionStateMessage
  | DevSeedCheckMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isIdArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

/** The parser never throws, so a sender has no reason to invent another shape. */
function isParseOutcome(value: unknown): value is ParseOutcome {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'status':
      return (
        typeof value.key === 'string' &&
        typeof value.raw === 'string' &&
        typeof value.normalised === 'string' &&
        (value.subStatus === null || typeof value.subStatus === 'string')
      );
    case 'error':
      return typeof value.raw === 'string' && isStringArray(value.messages);
    case 'form':
    case 'unknown':
      return true;
    default:
      return false;
  }
}

/**
 * Accepts only the messages this extension actually sends, with their fields checked.
 *
 * The prefix alone is not a protocol: a message with a valid prefix and the wrong shape used to reach the
 * switch and fail halfway through, leaving the sender waiting for an answer that never came.
 */
export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!isRecord(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'naciocheck:request-fill':
    case 'naciocheck:continue':
    case 'naciocheck:reschedule':
    case 'naciocheck:lock':
    case 'naciocheck:session-state':
      return true;
    case 'naciocheck:page-outcome':
      return isParseOutcome(value.outcome);
    case 'naciocheck:start-check-run':
      return value.applicationIds === undefined || isIdArray(value.applicationIds);
    case 'naciocheck:result-request':
      return value.checkId === undefined || isNonEmptyString(value.checkId);
    case 'naciocheck:acknowledge':
      return isNonEmptyString(value.checkId);
    case 'naciocheck:retry':
      return isNonEmptyString(value.applicationId);
    case 'naciocheck:unlock':
      return typeof value.passphrase === 'string';
    case 'naciocheck:dev:seed-check':
      return (
        isNonEmptyString(value.applicationId) &&
        typeof value.raw === 'string' &&
        (value.subStatus === undefined ||
          value.subStatus === null ||
          typeof value.subStatus === 'string')
      );
    default:
      return false;
  }
}
