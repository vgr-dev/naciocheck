import { normaliseText } from './normalise';
import { statusKeyOf, type ResolvedStatusKey } from './statuses';

export interface ParsedStatus {
  kind: 'status';
  key: ResolvedStatusKey;
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
   * Every message the page lists under "Se han producido los siguientes errores", verbatim. The page does not
   * say which one was decisive: a wrong NIE + número + año combination also reports the captcha message.
   */
  messages: string[];
  /** The messages joined — what the UI shows under the page's own wording. */
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

/**
 * A rejected submission comes back as a red informative block. `.textoBloqueError` is kept as a defensive
 * extra: the site's own inline script looks for it, but the live error page (2026-11-06) did not contain one.
 */
const ERROR_SELECTOR = '.textoBloqueError, .bloqueInformativoRojo';

/** The page lists its errors as items of these two lists inside `#mensaje`. */
const ERROR_MESSAGE_SELECTOR = '#mensaje .errorMessage li, #mensaje .listaErrores li';

const FORM_SELECTOR = 'form#idFormuNac';

function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Reads the error the page reports: first its own list of messages, then the red block's text as a fallback
 * for a shape we have not seen.
 */
function readError(page: ParentNode): ParsedError | null {
  const listed = [...page.querySelectorAll(ERROR_MESSAGE_SELECTOR)]
    .map((item) => textOf(item))
    .filter((text) => text !== '');
  const messages = [...new Set(listed)];
  if (messages.length > 0) {
    return { kind: 'error', messages, raw: messages.join(' ') };
  }

  for (const block of page.querySelectorAll(ERROR_SELECTOR)) {
    const text = textOf(block.querySelector('.bloqueCampoTextoInformativo')) || textOf(block);
    if (text) return { kind: 'error', messages: [text], raw: text };
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
    key: statusKeyOf(raw),
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
  if (error) return error;

  const status = readStatus(page);
  if (status) return status;

  if (page.querySelector(FORM_SELECTOR)) return { kind: 'form' };

  return { kind: 'unknown' };
}
