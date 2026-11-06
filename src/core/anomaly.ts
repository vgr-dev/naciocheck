import {
  classifyTransition,
  resolvePathState,
  type ResolvedPathState,
  type ResolvedPathStateId,
} from './paths';
import { STATUS_CATALOG, type StatusKey } from './statuses';
import type { Check } from './storage';

/**
 * D11: a calm note when the file moves somewhere the observations do not place on any known path.
 *
 * Deliberately a pure function with no memory: no state machine, no prediction, only what the two checks say.
 * The judgement comes from the path table alone — no status number is compared here — and a state the table
 * cannot place is never judged at all.
 */

export type AnomalyKind = 'unusual';

export interface AnomalyNote {
  kind: AnomalyKind;
  es: string;
  en: string;
  /** Cited only for the move this source documents; the other unusual moves are the observation alone. */
  source: { label: string; url: string } | null;
}

const PARAINMIGRANTES_RETROCESO = {
  label: 'Parainmigrantes: retroceso de calificación a tramitación',
  url: 'https://www.parainmigrantes.info/retroceso-en-el-estado-expediente-de-nacionalidad-de-en-calificacion-a-tramitacion/',
};

/** The states of *En tramitación*: the move that source documents is K to one of them. */
const PROCESSING_STATES = new Set<ResolvedPathStateId>(['T1', 'T2', 'T3', 'T4', 'TE']);

function statusTitle(status: StatusKey, locale: 'es' | 'en'): string {
  return STATUS_CATALOG.find((entry) => entry.key === status)?.[locale].title ?? status;
}

/** How the page names a state: the status, plus the site's own second line when it printed one. */
function describe(
  state: ResolvedPathState,
  rawSubStatus: string | null,
  locale: 'es' | 'en',
): string {
  const title = statusTitle(state.status, locale);
  return rawSubStatus === null ? title : `${title}, ${rawSubStatus}`;
}

export function detectAnomaly(previous: Check | null, current: Check): AnomalyNote | null {
  if (previous === null || previous.outcome !== 'status' || current.outcome !== 'status') {
    return null;
  }

  const before = resolvePathState(previous.raw, previous.subStatus);
  const after = resolvePathState(current.raw, current.subStatus);
  if (before === null || after === null) return null;
  if (classifyTransition(before, after) !== 'unusual') return null;

  const source =
    before.id === 'K' && PROCESSING_STATES.has(after.id) ? PARAINMIGRANTES_RETROCESO : null;

  return {
    kind: 'unusual',
    es: `El expediente pasa de «${describe(before, previous.subStatus, 'es')}» a «${describe(after, current.subStatus, 'es')}», un cambio que no se había observado hasta ahora. La página no explica el motivo y no significa por sí mismo que algo vaya mal.`,
    en: `The file moves from "${describe(before, previous.subStatus, 'en')}" to "${describe(after, current.subStatus, 'en')}", a change not observed so far. The page does not explain why, and it does not by itself mean something is wrong.`,
    source,
  };
}
