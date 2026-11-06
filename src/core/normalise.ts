/**
 * Folds text so the same status always compares equal, whatever the page's typography.
 *
 * The sede writes its status in free text: `Abierto - Registrado.`, `En tramitación`,
 * `Pendiente de solicitud de informes`, with hyphens that may be ASCII, en dash or em dash,
 * non-breaking spaces and a trailing full stop. Matching on the raw string would make every
 * status a change, so everything is compared through this function.
 */
export function normaliseText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/^[\s.,;:]+/, '')
    .replace(/[\s.,;:]+$/, '')
    .trim();
}
