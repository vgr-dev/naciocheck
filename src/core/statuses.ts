import { normaliseText } from './normalise';

/**
 * The status catalogue.
 *
 * The Ministry does not publish the vocabulary of this page, so every entry is built from what the page
 * actually prints plus what specialised law firms document, and every entry cites its sources. Nothing here
 * is legal advice: `STATUS_DISCLAIMER` says so and travels with every explanation.
 */

export type StatusKey =
  | 'espera-admision-tramite'
  | 'abierto-registrado'
  | 'abierto-en-tramitacion'
  | 'pendiente-requerimiento'
  | 'documentacion-aportada'
  | 'pendiente-informes'
  | 'en-estudio'
  | 'abierto-en-calificacion'
  | 'doble-calificacion'
  | 'calificacion-simple'
  | 'pendiente-firma'
  | 'concedido-enviada-notificacion'
  | 'finalizado-concedido-notificado'
  | 'resuelto-favorable'
  | 'resuelto-denegado'
  | 'archivado'
  | 'en-via-de-recurso';

/** What the parser returns for a text the catalogue does not know. Never dropped, always shown verbatim. */
export const UNKNOWN_STATUS_KEY = 'unknown';

export type ResolvedStatusKey = StatusKey | typeof UNKNOWN_STATUS_KEY;

export type StatusTone = 'neutral' | 'action-needed' | 'final';

/**
 * `informal-only`: no official definition exists, but the specialised sources describe it consistently.
 * `none`: no official definition and the sources disagree — the explanation says so instead of picking one.
 */
export type OfficialDefinition = 'informal-only' | 'none';

export interface StatusText {
  title: string;
  explanation: string;
  whatYouCanDo: string;
}

export interface StatusSource {
  label: string;
  url: string;
}

export interface StatusEntry {
  key: StatusKey;
  /** Position in the usual progression; gaps leave room for states discovered later. */
  stage: number;
  tone: StatusTone;
  officialDefinition: OfficialDefinition;
  /** Normalised page texts that resolve to this entry. Every string must already be normalised. */
  match: readonly string[];
  es: StatusText;
  en: StatusText;
  sources: readonly StatusSource[];
}

const SEDE: StatusSource = {
  label: 'Sede Electrónica: consulta telemática de expedientes de nacionalidad',
  url: 'https://sede.mjusticia.gob.es/eConsultas/inicioNacionalidad',
};
const LAWFIDENCE: StatusSource = {
  label: 'Lawfidence: fases o estados de la nacionalidad española',
  url: 'https://lawfidence.com/fases-o-estados-de-la-nacionalidad-espanola/',
};
const MACHELIN: StatusSource = {
  label: 'Machelín Díaz: todas las fases o estados de la solicitud',
  url: 'https://machelindiaz.com/todas-fases-o-estados-de-la-solicitud-de-nacionalidad-espanola-por-residencia/',
};
const MACHELIN_DOBLE: StatusSource = {
  label: 'Machelín Díaz: doble calificación de nacionalidad',
  url: 'https://machelindiaz.com/doble-calificacion-de-nacionalidad/',
};
const COHEN_CALIFICACION: StatusSource = {
  label: 'Cohen y Aguirre: estados de la nacionalidad en calificación',
  url: 'https://cohenyaguirre.es/estados-nacionalidad-espanola-en-calificacion',
};
const PARAINMIGRANTES_RETROCESO: StatusSource = {
  label: 'Parainmigrantes: retroceso de calificación a tramitación',
  url: 'https://www.parainmigrantes.info/retroceso-en-el-estado-expediente-de-nacionalidad-de-en-calificacion-a-tramitacion/',
};
const DEHU: StatusSource = {
  label: 'Ministerio de Justicia: notificaciones de nacionalidad en DEHú',
  url: 'https://sede.mjusticia.gob.es/documents/d/guest/manual-acceso-a-notificaciones-de-nacionalidad-en-la-dehu',
};

/** Shown with every explanation, in the same order as the rest of the catalogue. */
export const STATUS_DISCLAIMER = {
  es: 'Esta guía es informativa y no es asesoramiento jurídico. Ningún estado de esta página sustituye a la notificación oficial: la resolución llega por DEHú.',
  en: 'This guide is informational and is not legal advice. No status on this page replaces the official notification: the resolution arrives through DEHú.',
} as const;

export const STATUS_CATALOG: readonly StatusEntry[] = [
  {
    key: 'espera-admision-tramite',
    stage: 10,
    tone: 'neutral',
    officialDefinition: 'informal-only',
    match: ['a la espera de ser admitido a tramite', 'pendiente de admision a tramite'],
    es: {
      title: 'A la espera de ser admitido a trámite',
      explanation:
        'La solicitud está presentada, pero el órgano todavía no la ha admitido formalmente. Los despachos que recogen este estado lo sitúan al principio del recorrido, antes de que el expediente quede registrado.',
      whatYouCanDo:
        'No requiere acción. Si se prolonga mucho más de lo habitual, consulta con el registro o con un profesional.',
    },
    en: {
      title: 'Awaiting formal admission',
      explanation:
        'The application has been filed, but the office has not formally admitted it yet. The law firms that list this state place it at the very beginning, before the file is registered.',
      whatYouCanDo:
        'Nothing to do. If it drags on far longer than usual, ask the registry or a professional.',
    },
    sources: [LAWFIDENCE, MACHELIN],
  },
  {
    key: 'abierto-registrado',
    stage: 20,
    tone: 'neutral',
    officialDefinition: 'informal-only',
    match: ['abierto - registrado'],
    es: {
      title: 'Abierto - Registrado',
      explanation:
        'El expediente está registrado y abierto: la consulta lo ha localizado con tus datos y ya está en el circuito administrativo. Es el estado con el que arranca la tramitación, y la página suele acompañarlo de «Su expediente ha sido registrado correctamente».',
      whatYouCanDo:
        'Nada: el expediente acaba de entrar. Vuelve a consultarlo cuando toque el siguiente recordatorio.',
    },
    en: {
      title: 'Open - Registered',
      explanation:
        'The file is registered and open: the page found it with your details and it is already in the administrative pipeline. It is where the procedure starts, usually with the line "Su expediente ha sido registrado correctamente".',
      whatYouCanDo: 'Nothing: the file has just come in. Check again on the next reminder.',
    },
    sources: [SEDE, LAWFIDENCE, MACHELIN],
  },
  {
    key: 'abierto-en-tramitacion',
    stage: 30,
    tone: 'neutral',
    officialDefinition: 'informal-only',
    match: ['abierto - en tramitacion'],
    es: {
      title: 'Abierto - En tramitación',
      explanation:
        'El expediente está en tramitación: se reúnen o se revisan los documentos e informes previstos. Suele ser la fase más larga, y es la que más matices muestra en la segunda línea de la página (solicitud de informes, recepción de informes, calificación).',
      whatYouCanDo:
        'Nada mientras no aparezca un requerimiento. Merece la pena mirar el subestado: ahí está el avance real.',
    },
    en: {
      title: 'Open - In progress',
      explanation:
        'The file is in progress: the required documents and reports are being collected or reviewed. It is usually the longest phase, and the one whose second line on the page shows the most detail (reports requested, reports received, assessment).',
      whatYouCanDo:
        'Nothing until a requirement appears. Watch the sub-status: that is where the real progress is.',
    },
    sources: [SEDE, LAWFIDENCE, MACHELIN],
  },
  {
    key: 'pendiente-requerimiento',
    stage: 35,
    tone: 'action-needed',
    officialDefinition: 'informal-only',
    match: ['abierto - en tramitacion: requerido', 'pendiente de requerimiento', 'requerido'],
    es: {
      title: 'Requerido',
      explanation:
        'El órgano ha pedido algo: un documento, una aclaración o un trámite previo. Mientras el requerimiento siga abierto el expediente no avanza, así que este es de los pocos estados que sí te conciernen.',
      whatYouCanDo:
        'Presenta lo solicitado por el cauce que indique la propia Administración, dentro del plazo. Si no lo has recibido, pídelo por DEHú.',
    },
    en: {
      title: 'Requirement issued',
      explanation:
        'The office has asked for something: a document, a clarification or a prior step. While the requirement stays open the file does not move, so this is one of the few states that concern you directly.',
      whatYouCanDo:
        'File what was asked for through the channel the Administration indicates, within the deadline. If you never received it, request it through DEHú.',
    },
    sources: [LAWFIDENCE, MACHELIN, DEHU],
  },
  {
    key: 'documentacion-aportada',
    stage: 36,
    tone: 'neutral',
    officialDefinition: 'informal-only',
    match: ['abierto - en tramitacion: requerido - documentacion aportada'],
    es: {
      title: 'Requerido - Documentación aportada',
      explanation:
        'Has respondido al requerimiento y la página registra la documentación aportada. Es la continuación del estado anterior, no un retroceso: el expediente vuelve al circuito de tramitación.',
      whatYouCanDo: 'Nada. Guarda el justificante de la presentación por si hiciera falta.',
    },
    en: {
      title: 'Requirement - Documents provided',
      explanation:
        'You answered the requirement and the page records the documents as provided. This continues the previous state rather than going backwards: the file returns to the normal pipeline.',
      whatYouCanDo: 'Nothing. Keep the filing receipt in case it is needed later.',
    },
    sources: [SEDE, LAWFIDENCE],
  },
  {
    key: 'pendiente-informes',
    stage: 40,
    tone: 'neutral',
    officialDefinition: 'informal-only',
    match: [
      'pendiente solicitud informes preceptivos oficiales',
      'pendiente recepcion de informes preceptivos oficiales',
      'pendiente de solicitud de informes preceptivos',
      'pendiente de respuesta de informes preceptivos',
    ],
    es: {
      title: 'Informes preceptivos',
      explanation:
        'El expediente espera los informes que la ley exige antes de resolver. La página distingue entre solicitarlos y recibirlos, y pasar de uno a otro es el avance normal dentro de esta fase.',
      whatYouCanDo: 'Nada: es una espera administrativa ante otros organismos.',
    },
    en: {
      title: 'Mandatory reports',
      explanation:
        'The file is waiting for the reports the law requires before a decision. The page distinguishes requesting them from receiving them, and moving from one to the other is the normal progress inside this phase.',
      whatYouCanDo: 'Nothing: this is administrative waiting on other bodies.',
    },
    sources: [SEDE, LAWFIDENCE, MACHELIN],
  },
  {
    key: 'en-estudio',
    stage: 45,
    tone: 'neutral',
    officialDefinition: 'informal-only',
    match: ['en estudio'],
    es: {
      title: 'En estudio',
      explanation:
        'El órgano revisa el conjunto del expediente antes de calificarlo. Los despachos lo citan sin darle un significado técnico preciso, así que conviene leerlo como «se está trabajando en él».',
      whatYouCanDo: 'Nada.',
    },
    en: {
      title: 'Under study',
      explanation:
        'The office is reviewing the file as a whole before assessing it. The law firms cite this state without a precise technical meaning, so read it as "work is being done on it".',
      whatYouCanDo: 'Nothing.',
    },
    sources: [LAWFIDENCE, MACHELIN],
  },
  {
    key: 'abierto-en-calificacion',
    stage: 50,
    tone: 'neutral',
    officialDefinition: 'informal-only',
    match: ['abierto - en calificacion'],
    es: {
      title: 'Abierto - En calificación',
      explanation:
        'Se está decidiendo el sentido de la resolución. Según los despachos es la fase inmediatamente anterior a la firma y a la resolución, y puede durar semanas. Si la página repite «Su expediente se encuentra en calificación» como subestado, no des el trámite por cerrado: puede llegar todavía una petición de documentación.',
      whatYouCanDo: 'Nada por ahora, pero mantente atento a las notificaciones de DEHú.',
    },
    en: {
      title: 'Open - Under assessment',
      explanation:
        'A decision is being reached. The law firms place it immediately before signature and resolution, and it can last weeks. If the page repeats "Su expediente se encuentra en calificación" as a sub-status, do not consider it settled: a request for more documents may still arrive.',
      whatYouCanDo: 'Nothing for now, but keep an eye on DEHú notifications.',
    },
    sources: [SEDE, COHEN_CALIFICACION, PARAINMIGRANTES_RETROCESO],
  },
  {
    key: 'doble-calificacion',
    stage: 55,
    tone: 'neutral',
    officialDefinition: 'none',
    match: ['doble calificacion'],
    es: {
      title: 'Doble calificación',
      explanation:
        'No existe definición oficial de este estado. Los blogs y despachos que lo mencionan lo interpretan de forma distinta —un segundo examen del expediente, un repaso antes de la firma o la revisión por otro órgano— y ninguna fuente administrativa lo confirma. Trátalo como un estado sin explicación verificada.',
      whatYouCanDo:
        'No lo interpretes como favorable ni como desfavorable. Si te preocupa, pregunta por el expediente por el cauce oficial.',
    },
    en: {
      title: 'Double assessment',
      explanation:
        'There is no official definition for this state. The blogs and law firms that mention it read it differently — a second examination of the file, a review before signature, or a review by another body — and no administrative source confirms any of them. Treat it as a state with no verified meaning.',
      whatYouCanDo:
        'Do not read it as good or bad news. If it worries you, ask about the file through the official channel.',
    },
    sources: [MACHELIN_DOBLE, COHEN_CALIFICACION],
  },
  {
    key: 'calificacion-simple',
    stage: 56,
    tone: 'neutral',
    officialDefinition: 'none',
    match: ['calificacion simple'],
    es: {
      title: 'Calificación simple',
      explanation:
        'No aparece como texto oficial en ninguna de las fuentes consultadas y no tiene definición oficial: puede ser jerga de foro para distinguir una única calificación de la «doble calificación».',
      whatYouCanDo:
        'No le atribuyas un significado concreto; compáralo con el resto de la línea de estado.',
    },
    en: {
      title: 'Single assessment',
      explanation:
        'It does not appear as official wording in any source consulted and has no official definition: it may be forum shorthand for a single assessment as opposed to the "double assessment".',
      whatYouCanDo:
        'Do not read a specific meaning into it; compare it with the rest of the status line.',
    },
    sources: [MACHELIN_DOBLE],
  },
  {
    key: 'pendiente-firma',
    stage: 60,
    tone: 'neutral',
    officialDefinition: 'informal-only',
    match: ['pendiente de firma'],
    es: {
      title: 'Pendiente de firma',
      explanation:
        'La propuesta de resolución está decidida y solo falta la firma del órgano competente. Es un trámite de salida, no una nueva revisión del expediente.',
      whatYouCanDo: 'Nada: la resolución está próxima.',
    },
    en: {
      title: 'Awaiting signature',
      explanation:
        'The proposed decision is settled and only the signature of the competent body is missing. It is an exit step, not a new review of the file.',
      whatYouCanDo: 'Nothing: the decision is close.',
    },
    sources: [LAWFIDENCE, MACHELIN],
  },
  {
    key: 'concedido-enviada-notificacion',
    stage: 70,
    tone: 'final',
    officialDefinition: 'informal-only',
    match: ['abierto - concedido. enviada notificacion'],
    es: {
      title: 'Concedido - Enviada notificación',
      explanation:
        'La resolución es favorable y consta que la notificación se ha enviado. La concesión no termina aquí: los trámites posteriores se realizan en el Registro Civil y la notificación oficial llega por DEHú.',
      whatYouCanDo: 'Espera la notificación en DEHú y sigue las instrucciones del Registro Civil.',
    },
    en: {
      title: 'Granted - Notification sent',
      explanation:
        'The decision is favourable and the notification is recorded as sent. The grant does not end here: later steps happen at the Registro Civil, and the official notification arrives through DEHú.',
      whatYouCanDo: 'Wait for the DEHú notification and follow the Registro Civil instructions.',
    },
    sources: [SEDE, DEHU],
  },
  {
    key: 'finalizado-concedido-notificado',
    stage: 71,
    tone: 'final',
    officialDefinition: 'informal-only',
    match: ['finalizado - concedido. notificado'],
    es: {
      title: 'Finalizado - Concedido, notificado',
      explanation:
        'El expediente está finalizado con resolución favorable y ya notificada. Las actuaciones que quedan (inscripción, juramento o promesa, documentación) se hacen fuera de esta consulta.',
      whatYouCanDo: 'Revisa la notificación en DEHú y sigue los pasos del Registro Civil.',
    },
    en: {
      title: 'Finished - Granted, notified',
      explanation:
        'The file is finished with a favourable decision already notified. What remains — registration, oath or promise, paperwork — happens outside this page.',
      whatYouCanDo: 'Read the DEHú notification and follow the Registro Civil steps.',
    },
    sources: [SEDE, DEHU],
  },
  {
    key: 'resuelto-favorable',
    stage: 72,
    tone: 'final',
    officialDefinition: 'informal-only',
    match: ['resuelto favorable', 'resuelto - favorable'],
    es: {
      title: 'Resuelto favorable',
      explanation:
        'La resolución ha sido favorable. Este texto aparece en las listas que publican los despachos; la consulta telemática suele mostrarlo con la variante «concedido».',
      whatYouCanDo: 'Espera la notificación por DEHú y sigue las instrucciones del Registro Civil.',
    },
    en: {
      title: 'Decided favourably',
      explanation:
        'The decision was favourable. This wording comes from the lists the law firms publish; the online check usually shows the "concedido" variant instead.',
      whatYouCanDo: 'Wait for the DEHú notification and follow the Registro Civil instructions.',
    },
    sources: [LAWFIDENCE, MACHELIN, DEHU],
  },
  {
    key: 'resuelto-denegado',
    stage: 73,
    tone: 'final',
    officialDefinition: 'informal-only',
    match: ['resuelto denegado', 'denegado'],
    es: {
      title: 'Resuelto desfavorable',
      explanation:
        'La resolución ha sido desfavorable. La notificación oficial, con su motivación y los plazos, llega por DEHú; esta página no la sustituye ni explica el motivo.',
      whatYouCanDo:
        'Lee la notificación y, si te planteas recurrir, consulta los plazos con un profesional: no los adivines.',
    },
    en: {
      title: 'Decided unfavourably',
      explanation:
        'The decision was unfavourable. The official notification, with its reasoning and deadlines, arrives through DEHú; this page neither replaces it nor explains the grounds.',
      whatYouCanDo:
        'Read the notification and, if you are considering an appeal, check the deadlines with a professional rather than guessing them.',
    },
    sources: [LAWFIDENCE, MACHELIN, DEHU],
  },
  {
    key: 'archivado',
    stage: 80,
    tone: 'final',
    officialDefinition: 'informal-only',
    match: ['archivado'],
    es: {
      title: 'Archivado',
      explanation:
        'La Administración ha cerrado el expediente, normalmente por caducidad, desistimiento o por no responder a un requerimiento. La página no suele indicar el motivo.',
      whatYouCanDo:
        'Busca la notificación que lo motive; si no la tienes, pídela por DEHú antes de dar nada por perdido.',
    },
    en: {
      title: 'Archived',
      explanation:
        'The Administration has closed the file, usually through expiry, withdrawal or a requirement left unanswered. The page rarely states the reason.',
      whatYouCanDo:
        'Look for the notification behind it; if you do not have it, request it through DEHú before assuming the worst.',
    },
    sources: [LAWFIDENCE, MACHELIN, DEHU],
  },
  {
    key: 'en-via-de-recurso',
    stage: 85,
    tone: 'action-needed',
    officialDefinition: 'informal-only',
    match: ['en via de recurso'],
    es: {
      title: 'En vía de recurso',
      explanation:
        'Hay un recurso en curso contra la resolución, así que el expediente sigue vivo aunque la resolución ya exista.',
      whatYouCanDo:
        'Sigue los plazos del recurso con un profesional; esta página no informa de en qué punto está.',
    },
    en: {
      title: 'Under appeal',
      explanation:
        'An appeal against the decision is in progress, so the file is still live even though a decision exists.',
      whatYouCanDo:
        'Track the appeal deadlines with a professional; this page does not report where the appeal stands.',
    },
    sources: [LAWFIDENCE, MACHELIN],
  },
];

/**
 * The sub-status line the page prints under the status. Observed for `abierto - en tramitacion`, in the
 * order the user sees them. **Data only**: the "usual path / out of the ordinary" judgement is not built yet
 * — see the plan's Phase 3 Recorded deviations.
 */
export interface SubStatusSignal {
  match: string;
  /** 1 = first step of the usual progression. */
  progress: number;
}

export const SUB_STATUS_SIGNALS: readonly SubStatusSignal[] = [
  { match: 'su expediente se encuentra en tramitacion', progress: 1 },
  { match: 'pendiente solicitud informes preceptivos oficiales', progress: 2 },
  { match: 'pendiente recepcion de informes preceptivos oficiales', progress: 3 },
  { match: 'su expediente se encuentra en calificacion', progress: 4 },
];

const BY_MATCH = new Map<string, StatusEntry>(
  STATUS_CATALOG.flatMap((entry) => entry.match.map((text) => [text, entry] as const)),
);

/** The catalogue entry the page text belongs to, or `null` when the catalogue has never seen it. */
export function findStatus(raw: string): StatusEntry | null {
  return BY_MATCH.get(normaliseText(raw)) ?? null;
}

/** The key used for a page text: a real one, or `unknown` — never a guess. */
export function statusKeyOf(raw: string): ResolvedStatusKey {
  return findStatus(raw)?.key ?? UNKNOWN_STATUS_KEY;
}
