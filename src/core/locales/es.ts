/**
 * The Spanish catalogue — the source of truth for every key.
 *
 * Every other locale is typed against `MessageKey`, so a forgotten string is a compile error instead of an
 * empty label. Placeholders are `{name}` and are filled by `t()` in `../i18n`; `tests/i18n.test.ts` checks that
 * every locale has the same keys *and* the same placeholders in each one.
 *
 * Why the UI strings live here and not in `_locales`: the manifest strings have to go through
 * `browser.i18n.getMessage`, which always follows the browser language and cannot be pointed at a different
 * one — and options offer a manual override. `public/_locales` still carries the manifest strings.
 */
export const es = {
  // Shared -----------------------------------------------------------------------------------------------------
  'common.never': 'nunca',
  'common.errorPrefix': 'error: {text}',

  // Page titles ------------------------------------------------------------------------------------------------
  'app.title': 'NacioCheck',
  'options.pageTitle': 'NacioCheck — Opciones',
  'onboarding.pageTitle': 'NacioCheck — Primeros pasos',
  'statuses.pageTitle': 'NacioCheck — Qué significa cada estado',
  'unlock.pageTitle': 'NacioCheck — Desbloquear',

  // The application form, shared by onboarding and options -----------------------------------------------------
  'form.fieldNie': 'NIE',
  'form.fieldNumero': 'Número',
  'form.fieldYear': 'Año',
  'form.fieldBirthDate': 'Fecha de nacimiento',
  'form.labelName': 'Nombre para reconocerla',
  'form.labelPlaceholder': 'Mi solicitud',
  'form.submit': 'Guardar solicitud',
  'form.saveChanges': 'Guardar cambios',
  'form.revealIdentity': 'Mostrar los datos',
  'form.editPassphrase': 'Contraseña para ver y cambiar los datos',
  'form.editPassphraseHint':
    'Los datos están cifrados: escribe la contraseña para verlos y cambiarlos. Si solo cambias el nombre, no hace falta.',
  'form.errorLabel': 'Ponle un nombre para reconocerla.',
  'form.passphrase': 'Contraseña del cifrado',
  'form.passphraseHint':
    'Es la misma con la que cifraste las demás solicitudes: sirve para guardar esta cifrada y no se queda en ningún sitio.',
  'form.errorPassphrase': 'Escribe la contraseña del cifrado.',
  'form.errorPassphraseWrong': 'Esa no es la contraseña: no se ha guardado nada.',
  'form.reloadPassphrase':
    'El cifrado ha cambiado mientras este formulario estaba abierto: recarga la página y vuelve a intentarlo.',

  // Field validation -------------------------------------------------------------------------------------------
  'validation.nie': 'Escribe el NIE con letra final, por ejemplo X1234567L.',
  'validation.numero': 'El número empieza por una letra y sigue con dígitos, por ejemplo R500001.',
  'validation.year': 'El año son cuatro dígitos, por ejemplo 2015.',
  'validation.birthDate': 'La fecha de nacimiento va como AAAA-MM-DD.',
  'validation.birthDateFuture': 'La fecha de nacimiento no puede ser futura.',
  'validation.filingDate': 'La fecha de presentación va como AAAA-MM-DD.',
  'validation.filingDateFuture': 'La fecha de presentación no puede ser futura.',
  'validation.filingDateAfterCheck':
    'La fecha de presentación no puede ser posterior a la primera comprobación.',

  // Onboarding -------------------------------------------------------------------------------------------------
  'onboarding.subtitle':
    'Comprueba el estado de tu solicitud de nacionalidad por residencia sin rellenar el formulario cada vez.',
  'onboarding.doesTitle': 'Qué hace',
  'onboarding.does1': 'Rellena el formulario oficial por ti y te deja solo el captcha.',
  'onboarding.does2': 'Guarda cada comprobación en este navegador y te avisa si el estado cambia.',
  'onboarding.does3': 'Explica qué significa cada estado, con sus fuentes.',
  'onboarding.doesNotTitle': 'Qué no hace',
  'onboarding.doesNot1': 'No resuelve el captcha ni lo envía a ningún servicio: lo marcas tú.',
  'onboarding.doesNot2':
    'No envía tus datos a ningún servidor: ni NIE, ni fecha de nacimiento, ni historial.',
  'onboarding.doesNot3':
    'No es una herramienta oficial del Ministerio de Justicia; la resolución llega por DEHú.',
  'onboarding.applicationTitle': 'Tu solicitud',
  'onboarding.encryptionOptional':
    'Paso opcional: puedes proteger los datos ahora o más tarde desde Opciones.',
  'onboarding.savedTitle': 'Solicitudes guardadas',
  'onboarding.reminderTitle': '¿Cuándo te aviso?',
  'onboarding.reminderHint':
    'Elige una hora a la que suelas estar con el dispositivo: el captcha lo tienes que marcar tú.',
  'onboarding.reminderSaved': 'Recordatorio guardado para los laborables a las {time}.',
  'onboarding.readyTitle': 'Listo',
  'onboarding.finish': 'Terminar',
  'onboarding.changeLater': 'Cambiar todo en Opciones',

  // Options ----------------------------------------------------------------------------------------------------
  'options.title': 'NacioCheck · Opciones',
  'options.disclaimer':
    'Los datos guardados se quedan en este navegador, sin sincronización ni telemetría. Al comprobar, el formulario oficial envía tus datos a la sede del Ministerio. NacioCheck no es una herramienta oficial del Ministerio de Justicia.',
  'options.applications': 'Solicitudes',
  'options.empty': 'Todavía no hay ninguna solicitud guardada.',
  'options.addAnother': 'Añadir otra',
  'options.addedOn': 'Añadida el {date}',
  'options.justAdded': 'Recién añadida',
  'options.saved': 'Solicitud «{label}» guardada.',
  'options.edit': 'Editar',
  'options.cancelEdit': 'Cancelar',
  'options.editedOn': 'Editada el {date}',
  'options.delete': 'Borrar',
  'form.saveFailed':
    'No se ha podido guardar la solicitud. Recarga la página e inténtalo de nuevo.',
  'options.deleteConfirm':
    '¿Borrar la solicitud «{label}» y todo su historial? No se puede deshacer.',
  'options.reminders': 'Recordatorios',
  'options.remindersHint':
    'Elige una hora a la que suelas estar con el móvil o el ordenador: el captcha lo tienes que marcar tú.',
  'options.notifyMe': 'Avisarme',
  'options.hour': 'Hora',
  'options.preset': 'Laborables a las {time}',
  'options.saveReminder': 'Guardar recordatorio',
  'options.reminderSaved': 'Recordatorio guardado.',
  'options.reminderOff': 'Recordatorio desactivado.',
  'options.reminderFailed': 'No se ha podido guardar: {error}',
  'options.history': 'Historial',
  'options.whatMeans': 'Qué significa cada estado',
  'options.noChecks': 'Sin comprobaciones.',
  'options.language': 'Idioma',
  'options.languageHint':
    'Se aplica a todas las ventanas de la extensión. El aviso del navegador sigue el idioma que elijas aquí.',
  'options.languageAuto': 'El del navegador ({language})',

  // Popup ------------------------------------------------------------------------------------------------------
  'popup.noApplications': 'Todavía no hay ninguna solicitud guardada.',
  'popup.addApplication': 'Añadir una solicitud',
  'popup.noChecks': 'Sin comprobaciones todavía',
  'popup.lastError': 'Última comprobación con error',
  'popup.changed': 'CAMBIÓ',
  'popup.checkedOn': 'Comprobado el {date}',
  'popup.checkNow': 'Comprobar ahora',
  'popup.checkAll': 'Comprobar todo',
  'popup.options': 'Opciones',
  'popup.whatMeans': 'Qué significa cada estado',
  'popup.lockNow': 'Bloquear ahora',
  'popup.viewChange': 'Ver el cambio',
  'background.deletedApplication':
    'La solicitud se ha borrado: esta comprobación no se ha guardado.',
  'background.checkFailed': 'No se ha podido guardar la comprobación.',
  'content.showFullPage': 'Ver la página completa',
  'content.submitBlocked':
    'No se envió la consulta porque falta un campo obligatorio. Se muestra la página completa para que la completes.',
  'recovery.title': 'NacioCheck no puede leer los datos guardados',
  'recovery.description':
    'Tus datos siguen en este navegador y no se han modificado. Descarga una copia antes de decidir qué hacer.',
  'recovery.error': 'Detalles: {error}',
  'recovery.download': 'Descargar los datos guardados',
  'recovery.downloaded': 'Se ha descargado una copia de los datos guardados.',
  'recovery.reset': 'Borrar los datos guardados y empezar de cero',
  'recovery.resetConfirm':
    '¿Borrar todas las solicitudes y el historial de comprobaciones que NacioCheck guarda en este navegador? No se puede deshacer.',
  'recovery.resetDone':
    'Se han borrado los datos guardados. Recarga esta página para empezar de cero.',

  // Unlock page ------------------------------------------------------------------------------------------------
  'unlock.title': 'Desbloquear',
  'unlock.hint':
    'Escribe la contraseña con la que cifraste los datos. Si la has olvidado, no hay forma de recuperarla: puedes volver a guardar las solicitudes.',
  'unlock.nothingEncrypted': 'No hay nada cifrado. Puedes cerrar esta pestaña.',
  'unlock.passphrase': 'Contraseña',
  'unlock.submit': 'Desbloquear y empezar',
  'unlock.failed': 'No se ha podido desbloquear. ¿Está bien la contraseña?',

  // Encryption section (options) -------------------------------------------------------------------------------
  'encryption.title': 'Cifrado',
  'encryption.hint':
    'Cifrar guarda el NIE y la fecha de nacimiento con una contraseña tuya, en este navegador. Si la olvidas no se pueden recuperar: el historial se queda, pero tendrás que volver a escribir las solicitudes.',
  'encryption.passphrase': 'Contraseña',
  'encryption.currentPassphrase': 'Contraseña actual',
  'encryption.repeat': 'Repite la contraseña',
  'encryption.enable': 'Cifrar los datos',
  'encryption.disable': 'Quitar el cifrado',
  'encryption.unlockSession': 'Desbloquear para esta sesión',
  'encryption.lockNow': 'Bloquear ahora',
  'encryption.locked': 'Sesión bloqueada.',
  'encryption.disableConfirm':
    '¿Quitar el cifrado? Los datos identificativos se guardarán sin cifrar.',
  'encryption.failed':
    'No se ha podido cambiar el cifrado. No se han cambiado los datos identificativos.',
  'encryption.tooShort': 'Usa una contraseña de al menos 8 caracteres.',
  'encryption.mismatch': 'Las dos contraseñas no coinciden.',
  'encryption.done': 'Datos cifrados. Guarda la contraseña en un sitio seguro.',
  'encryption.nothingToEncrypt':
    'Añade una solicitud antes de activar el cifrado: no hay nada que cifrar.',
  'encryption.decryptFailed': 'No se ha podido descifrar: ¿está bien la contraseña?',
  'encryption.disabled': 'Cifrado desactivado.',
  'encryption.unlocked': 'Desbloqueado hasta que cierres el navegador.',
  'encryption.unlockFailed': 'No se ha podido desbloquear.',
  'encryption.plainLeft': 'Quedan {count} solicitudes sin cifrar: {labels}.',
  'encryption.repair': 'Cifrarlas ahora',
  'encryption.repaired': 'Solicitudes cifradas.',
  'encryption.repairFailed': 'No se han podido cifrar: ¿está bien la contraseña?',

  // Backup section (options) -----------------------------------------------------------------------------------
  'backup.title': 'Copia de seguridad',
  'backup.hint':
    'Exporta todo a un archivo para guardarlo o moverlo a otro navegador. El archivo se queda en tu equipo. Combinar mantiene tu recordatorio e idioma actuales; reemplazar los restaura del archivo.',
  'backup.export': 'Exportar',
  'backup.exported': 'Copia exportada.',
  'backup.filename': 'naciocheck-copia.json',
  'backup.fileLabel': 'Archivo de copia',
  'backup.import': 'Importar el archivo elegido',
  'backup.chooseFirst': 'Elige antes un archivo.',
  'backup.mode': 'Modo de importación',
  'backup.merge': 'Combinar (mantener los ajustes actuales)',
  'backup.replace': 'Reemplazar todo',
  'backup.confirmMerge': '¿Combinar la copia elegida con tus datos guardados?',
  'backup.confirmReplace':
    '¿Reemplazar {applications} solicitudes y {checks} comprobaciones guardadas, incluidos los ajustes? No se puede deshacer.',
  'backup.encryptionRequired':
    'Esta copia contiene identidades sin cifrar. Cífrala antes o quita explícitamente el cifrado actual antes de importarla.',
  'backup.merged': 'Importado y combinado.',
  'backup.replaced': 'Importado, reemplazando lo anterior.',
  'backup.importFailed': 'No se ha podido importar: {error}',
  'backup.changed':
    'Los datos guardados han cambiado mientras confirmabas la importación. Revísalos e inténtalo de nuevo.',
  'backup.plainWarning':
    'La copia incluirá el NIE y la fecha de nacimiento sin cifrar. ¿Continuar?',
  'backup.errorJson': 'El archivo no es un JSON válido.',
  'backup.errorShape': 'El archivo no tiene el formato de una copia de NacioCheck.',
  'backup.errorFormat': 'El archivo no es una copia de NacioCheck.',

  // Result view ------------------------------------------------------------------------------------------------
  'result.empty': 'No hay ninguna comprobación que mostrar.',
  'result.changedTitle': 'EL ESTADO HA CAMBIADO',
  'result.errorTitle': 'No se ha podido completar la comprobación',
  'result.acknowledge': 'Entendido',
  'result.retry': 'Volver a intentarlo',
  'result.next': 'Continuar con la siguiente solicitud',
  'result.observedMeaning': 'Observado en expedientes reales, no oficial: {text}',
  'result.siteSaid': 'Tal como la muestra la sede:',
  'result.disclaimer':
    'Información orientativa, no es asesoramiento jurídico. La resolución oficial llega por DEHú. NacioCheck no es una herramienta oficial del Ministerio de Justicia.',

  // Report a problem (result page) ----------------------------------------------------------------------------
  'report.summary': 'Informar de un problema',
  'report.intro':
    'Este es el texto que se compartiría: la versión, el navegador, el idioma y lo que ha mostrado la página. Tu resultado, tus datos y tus identificadores nunca se incluyen. No sale nada de tu navegador hasta que lo envíes tú desde la web. Puedes revisar el texto y añadir con tus palabras lo que viste, en catalán, español o inglés.',
  'report.textLabel': 'Texto del informe (puedes editarlo)',
  'report.copy': 'Copiar el texto',
  'report.copied': 'Texto copiado.',
  'report.copyFailed': 'No se ha podido copiar: selecciona el texto y cópialo a mano.',
  'report.continue': 'Continuar en la web',
  'report.continueHint':
    'Abre naciocheck.vgr.cat en una pestaña nueva. El texto viaja en la dirección y no se envía hasta que pulses Enviar allí.',

  // Status guide -----------------------------------------------------------------------------------------------
  'statuses.title': 'NacioCheck · Qué significa cada estado',
  'statuses.whatYouCanDo': 'Qué puedes hacer: {text}',
  'statuses.noOfficialDefinition': 'Sin definición oficial: las fuentes no coinciden.',
  'statuses.mainPathTitle': 'El camino habitual',
  'statuses.branchesTitle': 'Ramas conocidas',
  'statuses.othersTitle': 'Estados que solo documentan los despachos',
  'statuses.observedSteps': 'Pasos observados en expedientes reales, no oficiales:',
  'statuses.observedSource': 'Observado en expedientes reales, no oficial',
  'statuses.branchHint': 'Rama del camino habitual: no es un paso obligatorio.',
  'statuses.explanationWrong': '¿Esta explicación parece incorrecta?',

  // Alerts and the result model (core) -------------------------------------------------------------------------
  'alert.firstCheck': 'Primera comprobación.',
  'alert.unchangedSince': 'Sin cambios desde el {date}',
  'alert.before': 'Antes: {status}',
  'alert.retryHint':
    'Comprueba que el NIE, el número y el año coinciden con la solicitud y vuelve a intentarlo.',
  'alert.notificationTitle': 'NacioCheck · {label}',
  'alert.notificationMessage': 'Nuevo estado: {status}',

  // Background and content script ------------------------------------------------------------------------------
  'background.defaultLabel': 'Solicitud',
  'background.unknownPage': 'La página no se ha reconocido y no se ha guardado nada.',
  'notify.reminderTitle': 'NacioCheck',
  'notify.reminderMessage':
    'Es la hora de comprobar el estado de tu solicitud. Solo hace falta el captcha.',
  'content.fallbackHint': 'Revisa los datos de «{label}» y envía la consulta a mano.',
  'content.captchaHint':
    'Marca la casilla del captcha. La consulta de «{label}» se envía sola cuando lo resuelvas.',
  'content.pickerTitle': 'NacioCheck: ¿qué solicitud quieres consultar?',
  'content.pickerEncrypted': 'Solicitud cifrada: desbloquéala en las opciones.',
} as const satisfies Record<string, string>;

/** Every string the extension can print, as a union of its keys. */
export type MessageKey = keyof typeof es;
