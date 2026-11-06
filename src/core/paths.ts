import { normaliseText } from './normalise';
import { findStatus, type StatusKey } from './statuses';

/**
 * The paths the user has observed on real files.
 *
 * Pure data: no storage, no network, no prediction from history. Both the change classifier and the status
 * guide read this table, so the usual order is written down once.
 *
 * | Id | Status line (page text) | Sub-status line |
 * | --- | --- | --- |
 * | R | `Abierto - Registrado.` | any / none |
 * | T1 | `Abierto - En tramitación.` | `Su expediente se encuentra en tramitación.` |
 * | T2 | `Abierto - En tramitación.` | `Pendiente solicitud informes preceptivos oficiales` |
 * | T3 | `Abierto - En tramitación.` | `Pendiente recepción de informes preceptivos oficiales` |
 * | T4 | `Abierto - En tramitación.` | `Su expediente se encuentra en calificación.` |
 * | TE | `Abierto - En tramitación.` | `Su expediente se encuentra en estudio` |
 * | Q | `Abierto - En tramitación: requerido.` | any / none |
 * | QA | `Abierto - En tramitación: requerido - documentación aportada` | any / none |
 * | K | `Abierto - En calificación.` | usually `Su expediente se encuentra en calificación.` |
 * | C | `Abierto - Concedido. Enviada notificación.` | any / none |
 * | F | `Finalizado - Concedido. Notificado.` | any / none |
 * | D | denied — exact page text not observed yet, recognised by word search | any / none |
 * | A | archived — exact page text not observed yet, recognised by word search | any / none |
 */

/** The states the observations know. K is deliberately not on the main path: it is a side branch. */
export type PathStateId =
  'R' | 'T1' | 'T2' | 'T3' | 'T4' | 'TE' | 'Q' | 'QA' | 'K' | 'C' | 'F' | 'D' | 'A';

/**
 * The status line is one the catalogue knows, but this (status, sub-status) pair is not in the table. The
 * status alone still counts, so this is a state — not `unknown`.
 */
export const UNLISTED_PATH_STATE = 'unlisted';

export type ResolvedPathStateId = PathStateId | typeof UNLISTED_PATH_STATE;

export interface PathStateEntry {
  id: PathStateId;
  /** The catalogue key of the status line this state is printed under. */
  status: StatusKey;
  /** Normalised sub-status, or `null` when the state is recognised by the status alone (any / none). */
  subStatus: string | null;
}

export const PATH_STATES: readonly PathStateEntry[] = [
  { id: 'R', status: 'abierto-registrado', subStatus: null },
  {
    id: 'T1',
    status: 'abierto-en-tramitacion',
    subStatus: 'su expediente se encuentra en tramitacion',
  },
  {
    id: 'T2',
    status: 'abierto-en-tramitacion',
    subStatus: 'pendiente solicitud informes preceptivos oficiales',
  },
  {
    id: 'T3',
    status: 'abierto-en-tramitacion',
    subStatus: 'pendiente recepcion de informes preceptivos oficiales',
  },
  {
    id: 'T4',
    status: 'abierto-en-tramitacion',
    subStatus: 'su expediente se encuentra en calificacion',
  },
  {
    id: 'TE',
    status: 'abierto-en-tramitacion',
    subStatus: 'su expediente se encuentra en estudio',
  },
  { id: 'Q', status: 'pendiente-requerimiento', subStatus: null },
  { id: 'QA', status: 'documentacion-aportada', subStatus: null },
  { id: 'K', status: 'abierto-en-calificacion', subStatus: null },
  { id: 'C', status: 'concedido-enviada-notificacion', subStatus: null },
  { id: 'F', status: 'finalizado-concedido-notificado', subStatus: null },
  { id: 'D', status: 'resuelto-denegado', subStatus: null },
  { id: 'A', status: 'archivado', subStatus: null },
];

/** One check, resolved to the state the observations know. */
export interface ResolvedPathState {
  /** The observed state, or `unlisted` when only the status line is known. */
  id: ResolvedPathStateId;
  /** The catalogue key of the status line. */
  status: StatusKey;
  /** Normalised sub-status printed under the status, when the page prints one. */
  subStatus: string | null;
}

/**
 * Resolves one check to a state: the (status, sub-status) pair first, then the status alone, then `unlisted`.
 * Returns `null` for a status the catalogue does not know — never a guess.
 */
export function resolvePathState(
  statusRaw: string,
  subStatusRaw: string | null,
): ResolvedPathState | null {
  const entry = findStatus(statusRaw);
  if (entry === null) return null;

  const subStatus = subStatusRaw === null ? null : normaliseText(subStatusRaw);
  const byPair =
    subStatus === null
      ? undefined
      : PATH_STATES.find(
          (candidate) => candidate.status === entry.key && candidate.subStatus === subStatus,
        );
  const byStatus = PATH_STATES.find(
    (candidate) => candidate.status === entry.key && candidate.subStatus === null,
  );

  return { id: (byPair ?? byStatus)?.id ?? UNLISTED_PATH_STATE, status: entry.key, subStatus };
}

/** A move between two observed states. */
export interface PathMove {
  from: PathStateId;
  to: PathStateId;
}

/**
 * The usual path, as the moves between consecutive states: R → T1 → T2 → T3 → T4 → C → F.
 *
 * Forward jumps are not listed here on purpose: checks are periodic, so steps can pass unseen between two
 * checks, and how to read that is still an open decision of the plan.
 */
export const MAIN_PATH: readonly PathMove[] = [
  { from: 'R', to: 'T1' },
  { from: 'T1', to: 'T2' },
  { from: 'T2', to: 'T3' },
  { from: 'T3', to: 'T4' },
  { from: 'T4', to: 'C' },
  { from: 'C', to: 'F' },
];

/** The main path in order, for the guide: R, T1, T2, T3, T4, C, F. */
export const MAIN_PATH_STATES: readonly PathStateId[] = ['R', ...MAIN_PATH.map((move) => move.to)];

/**
 * The moves the observations know that are not part of the main path.
 *
 * A request can come at any point of *En tramitación* (T1–T4 and TE → Q); from K it takes three forms — a
 * request, a direct denial, or *doble calificación* (K → TE → Q); answering a request, or letting it lapse,
 * leads to QA or A.
 *
 * Two open decisions of the plan are applied here exactly as they read today:
 * - D1: only **T4 → K** is known. Entering K from anywhere else is not a branch.
 * - D2: where the file goes after QA is not documented, so every entry into T1–T4, TE or K is a branch.
 */
export const KNOWN_BRANCHES: readonly PathMove[] = [
  { from: 'T1', to: 'Q' },
  { from: 'T2', to: 'Q' },
  { from: 'T3', to: 'Q' },
  { from: 'T4', to: 'Q' },
  { from: 'TE', to: 'Q' },
  { from: 'K', to: 'Q' },
  { from: 'K', to: 'TE' },
  { from: 'K', to: 'D' },
  { from: 'Q', to: 'QA' },
  { from: 'Q', to: 'A' },
  { from: 'T4', to: 'K' },
  { from: 'QA', to: 'T1' },
  { from: 'QA', to: 'T2' },
  { from: 'QA', to: 'T3' },
  { from: 'QA', to: 'T4' },
  { from: 'QA', to: 'TE' },
  { from: 'QA', to: 'K' },
];
