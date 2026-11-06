import { normaliseText } from './normalise';
import { SUB_STATUS_SIGNALS, findStatus } from './statuses';
import type { Check } from './storage';

/**
 * D11: a calm note when the file moves somewhere unusual — backwards a stage, or a sub-status that skips a
 * step. Deliberately a pure function with no memory: no state machine, no prediction, only what the two
 * checks say.
 */

export type AnomalyKind = 'stage-backwards' | 'sub-status-skip';

export interface AnomalyNote {
  kind: AnomalyKind;
  es: string;
  en: string;
  /** Cited when a source exists; the sub-status sequence itself is user-observed. */
  source: { label: string; url: string } | null;
}

const PARAINMIGRANTES_RETROCESO = {
  label: 'Parainmigrantes: retroceso de calificación a tramitación',
  url: 'https://www.parainmigrantes.info/retroceso-en-el-estado-expediente-de-nacionalidad-de-en-calificacion-a-tramitacion/',
};

function progressOf(subStatus: string | null): number | null {
  if (subStatus === null) return null;
  const normalised = normaliseText(subStatus);
  const signal = SUB_STATUS_SIGNALS.find((candidate) => candidate.match === normalised);
  return signal?.progress ?? null;
}

export function detectAnomaly(previous: Check | null, current: Check): AnomalyNote | null {
  if (previous === null || previous.outcome !== 'status' || current.outcome !== 'status') {
    return null;
  }

  const before = findStatus(previous.raw);
  const after = findStatus(current.raw);
  // Never judge what the catalogue does not know: without both stages there is no order to compare.
  if (before === null || after === null) return null;

  if (after.stage < before.stage) {
    return {
      kind: 'stage-backwards',
      es: 'El expediente ha vuelto a una fase anterior. Según las fuentes que documentan estos estados, retroceder de calificación a tramitación ocurre y no significa por sí mismo una resolución desfavorable.',
      en: 'The file has moved back to an earlier stage. According to the sources that document these states, moving from assessment back to processing happens and does not by itself mean an unfavourable decision.',
      source: PARAINMIGRANTES_RETROCESO,
    };
  }

  const beforeStep = progressOf(previous.subStatus);
  const afterStep = progressOf(current.subStatus);
  if (beforeStep !== null && afterStep !== null && afterStep - beforeStep > 1) {
    return {
      kind: 'sub-status-skip',
      es: 'La segunda línea ha saltado un paso de la secuencia habitual: solicitud de informes, recepción de informes, calificación. La página no explica el motivo y no significa que algo vaya mal.',
      en: 'The second line skipped a step of the usual sequence: reports requested, reports received, assessment. The page does not explain why, and it does not mean something is wrong.',
      source: null,
    };
  }

  return null;
}
