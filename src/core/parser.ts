import { normaliseText } from './normalise';

/**
 * Status keys arrive with the catalogue in Phase 3. Until then every status the parser meets is
 * reported verbatim and marked `unknown`, so nothing is ever dropped and nothing is guessed.
 */
export const UNCLASSIFIED_STATUS_KEY = 'unknown';

export type StatusKey = typeof UNCLASSIFIED_STATUS_KEY;

export interface ParsedStatus {
  kind: 'status';
  key: StatusKey;
  /** The status exactly as the page shows it, trimmed. */
  raw: string;
  /** `raw` folded for comparison. */
  normalised: string;
  /** The sentence the site prints under the status, when it prints one. */
  subStatus: string | null;
}

export interface ParsedError {
  kind: 'error';
  /**
   * Text of the error block. The page's own inline script treats `.textoBloqueError` as the error
   * step; telling "wrong data" from "captcha failed" from "service down" needs a real capture.
   */
  raw: string;
}

export interface ParsedForm {
  kind: 'form';
}

export interface ParsedUnknownPage {
  kind: 'unknown';
}

export type ParseOutcome = ParsedStatus | ParsedError | ParsedForm | ParsedUnknownPage;

/** The site marks the step of the trámite on the container: `paso_01` is the form. */
export const RESULT_STEP_SELECTOR = '[data-paso="paso_02"]';

/** Sentence that introduces the status; the status itself is the next paragraph's `<b>`. */
const STATUS_ANCHOR = /se encuentra en el siguiente estado/i;

/** Markers the site itself uses for a rejected submission (its inline script: `paso_01_error`). */
const ERROR_SELECTOR = '.textoBloqueError, .bloqueInformativoRojo';

const FORM_SELECTOR = 'form#idFormuNac';

function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** First error block that actually says something: the form carries an always-empty red span. */
function readError(page: ParentNode): string | null {
  for (const element of page.querySelectorAll(ERROR_SELECTOR)) {
    const text = textOf(element);
    if (text) return text;
  }
  return null;
}

/**
 * Reads the status from the paragraphs of the result page: the anchor sentence,
 * then the next paragraph's `<b>` (the status), then the one after it (the sub-status).
 */
function readStatus(page: ParentNode): ParsedStatus | null {
  const anchor = [...page.querySelectorAll('p')].find((paragraph) =>
    STATUS_ANCHOR.test(textOf(paragraph)),
  );
  const statusParagraph = anchor?.nextElementSibling;
  if (!statusParagraph) return null;

  const raw = textOf(statusParagraph.querySelector('b')) || textOf(statusParagraph);
  if (!raw) return null;

  const subParagraph = statusParagraph.nextElementSibling;
  const subStatus = subParagraph ? textOf(subParagraph.querySelector('b')) || null : null;

  return {
    kind: 'status',
    key: UNCLASSIFIED_STATUS_KEY,
    raw,
    normalised: normaliseText(raw),
    subStatus,
  };
}

/** Whether the page is the result step rather than the form. */
export function isResultPage(page: ParentNode): boolean {
  if (page.querySelector(RESULT_STEP_SELECTOR)) return true;
  return readStatus(page) !== null;
}

/**
 * Classifies one page of the official site.
 *
 * Never throws: an unexpected page is `unknown`, and an unexpected status text is kept verbatim.
 */
export function parseCheckPage(page: ParentNode): ParseOutcome {
  const error = readError(page);
  if (error) return { kind: 'error', raw: error };

  const status = readStatus(page);
  if (status) return status;

  if (page.querySelector(FORM_SELECTOR)) return { kind: 'form' };

  return { kind: 'unknown' };
}
