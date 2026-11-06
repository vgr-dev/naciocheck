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
  /** Only plain identities can be filled; encrypted ones need the unlock step of Phase 8. */
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

export type ExtensionMessage = RequestFillMessage | PageOutcomeMessage | StartCheckRunMessage;

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return typeof value.type === 'string' && value.type.startsWith('naciocheck:');
}
