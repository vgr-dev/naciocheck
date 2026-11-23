import type { MessageKey } from './es';

/**
 * The English catalogue. Typed against `MessageKey`, so a missing or unknown key fails the build: the parity
 * test in `tests/i18n.test.ts` would catch it too, but only after somebody ran it.
 */
export const en: Record<MessageKey, string> = {
  // Shared -----------------------------------------------------------------------------------------------------
  'common.never': 'never',
  'common.errorPrefix': 'error: {text}',

  // Page titles ------------------------------------------------------------------------------------------------
  'app.title': 'NacioCheck',
  'options.pageTitle': 'NacioCheck — Options',
  'onboarding.pageTitle': 'NacioCheck — Getting started',
  'statuses.pageTitle': 'NacioCheck — What each status means',
  'unlock.pageTitle': 'NacioCheck — Unlock',

  // The application form, shared by onboarding and options -----------------------------------------------------
  'form.fieldNie': 'NIE',
  'form.fieldNumero': 'Application number',
  'form.fieldYear': 'Year',
  'form.fieldBirthDate': 'Date of birth',
  'form.labelName': 'A name you will recognise it by',
  'form.labelPlaceholder': 'My application',
  'form.submit': 'Save application',
  'form.saveChanges': 'Save changes',
  'form.revealIdentity': 'Show the data',
  'form.editPassphrase': 'Passphrase to see and change the data',
  'form.editPassphraseHint':
    'The data is encrypted: type the passphrase to see and change it. If you only rename it, you do not need it.',
  'form.errorLabel': 'Give it a name you will recognise it by.',
  'form.passphrase': 'Encryption passphrase',
  'form.passphraseHint':
    'The one you encrypted the other applications with: it encrypts this one and is not kept anywhere.',
  'form.errorPassphrase': 'Type the encryption passphrase.',
  'form.errorPassphraseWrong': 'That is not the passphrase: nothing was saved.',
  'form.reloadPassphrase':
    'The encryption changed while this form was open: reload the page and try again.',

  // Field validation -------------------------------------------------------------------------------------------
  'validation.nie': 'Write the NIE with its final letter, for example X1234567L.',
  'validation.numero':
    'The application number starts with a letter and continues with digits, for example R500001.',
  'validation.year': 'The year is four digits, for example 2015.',
  'validation.birthDate': 'The date of birth goes as YYYY-MM-DD.',
  'validation.birthDateFuture': 'The date of birth cannot be in the future.',
  'validation.filingDate': 'The filing date goes as YYYY-MM-DD.',
  'validation.filingDateFuture': 'The filing date cannot be in the future.',
  'validation.filingDateAfterCheck': 'The filing date cannot be later than the first check.',

  // Onboarding -------------------------------------------------------------------------------------------------
  'onboarding.subtitle':
    'Check the status of your Spanish nationality-by-residence application without filling in the form every time.',
  'onboarding.doesTitle': 'What it does',
  'onboarding.does1': 'Fills in the official form for you and leaves you only the captcha.',
  'onboarding.does2': 'Stores every check in this browser and alerts you when the status changes.',
  'onboarding.does3': 'Explains what each status means, with its sources.',
  'onboarding.doesNotTitle': 'What it does not do',
  'onboarding.doesNot1': 'It never solves the captcha or sends it anywhere: you tick it yourself.',
  'onboarding.doesNot2':
    'It never sends your data to any server: not the NIE, not the birth date, not the history.',
  'onboarding.doesNot3':
    'It is not an official Ministry of Justice tool; the decision arrives through DEHú.',
  'onboarding.applicationTitle': 'Your application',
  'onboarding.encryptionOptional':
    'Optional step: you can protect the data now or later from Options.',
  'onboarding.savedTitle': 'Saved applications',
  'onboarding.reminderTitle': 'When should I remind you?',
  'onboarding.reminderHint':
    'Pick an hour when you are usually with the device: you are the one who ticks the captcha.',
  'onboarding.reminderSaved': 'Reminder saved for workdays at {time}.',
  'onboarding.readyTitle': 'Ready',
  'onboarding.finish': 'Finish',
  'onboarding.changeLater': 'Change everything in Options',

  // Options ----------------------------------------------------------------------------------------------------
  'options.title': 'NacioCheck · Options',
  'options.disclaimer':
    'Saved data stays in this browser, never in browser sync or telemetry. When you check, the official form sends your details to the Ministry site. NacioCheck is not an official Ministry of Justice tool.',
  'options.applications': 'Applications',
  'options.empty': 'No application saved yet.',
  'options.addAnother': 'Add another',
  'options.addedOn': 'Added on {date}',
  'options.justAdded': 'Just added',
  'options.saved': 'Application “{label}” saved.',
  'options.edit': 'Edit',
  'options.cancelEdit': 'Cancel',
  'options.editedOn': 'Edited on {date}',
  'options.delete': 'Delete',
  'form.saveFailed': 'Could not save the application. Reload the page and try again.',
  'options.deleteConfirm':
    'Delete application “{label}” and all its history? This cannot be undone.',
  'options.reminders': 'Reminders',
  'options.remindersHint':
    'Pick an hour when you are usually with your phone or computer: you are the one who ticks the captcha.',
  'options.notifyMe': 'Notify me',
  'options.hour': 'Time',
  'options.preset': 'Workdays at {time}',
  'options.saveReminder': 'Save reminder',
  'options.reminderSaved': 'Reminder saved.',
  'options.reminderOff': 'Reminder turned off.',
  'options.reminderFailed': 'Could not save it: {error}',
  'options.history': 'History',
  'options.whatMeans': 'What each status means',
  'options.noChecks': 'No checks yet.',
  'options.language': 'Language',
  'options.languageHint':
    'It applies to every window of the extension. The browser notification follows the language you pick here.',
  'options.languageAuto': 'The browser one ({language})',

  // Popup ------------------------------------------------------------------------------------------------------
  'popup.noApplications': 'No application saved yet.',
  'popup.addApplication': 'Add an application',
  'popup.noChecks': 'No checks yet',
  'popup.lastError': 'Last check failed',
  'popup.changed': 'CHANGED',
  'popup.checkedOn': 'Checked on {date}',
  'popup.checkNow': 'Check now',
  'popup.checkAll': 'Check all',
  'popup.options': 'Options',
  'popup.whatMeans': 'What each status means',
  'popup.lockNow': 'Lock now',
  'popup.viewChange': 'View change',
  'background.deletedApplication': 'The application was deleted: this check was not saved.',
  'background.checkFailed': 'The check could not be saved.',
  'content.showFullPage': 'Show the full page',
  'content.submitBlocked':
    'The query was not submitted because a required field is missing. The full page is shown so you can complete it.',
  'recovery.title': 'NacioCheck cannot read its stored data',
  'recovery.description':
    'Your data is still in this browser and has not been changed. Download a copy before deciding what to do.',
  'recovery.error': 'Details: {error}',
  'recovery.download': 'Download the stored data',
  'recovery.downloaded': 'A copy of the stored data was downloaded.',
  'recovery.reset': 'Delete the stored data and start over',
  'recovery.resetConfirm':
    'Delete all applications and check history stored by NacioCheck in this browser? This cannot be undone.',
  'recovery.resetDone': 'The stored data was deleted. Reload this page to start over.',

  // Unlock page ------------------------------------------------------------------------------------------------
  'unlock.title': 'Unlock',
  'unlock.hint':
    'Type the passphrase you encrypted the data with. If you have forgotten it there is no way to recover it: you can save the applications again.',
  'unlock.nothingEncrypted': 'Nothing is encrypted. You can close this tab.',
  'unlock.passphrase': 'Passphrase',
  'unlock.submit': 'Unlock and start',
  'unlock.failed': 'Could not unlock it. Is the passphrase right?',

  // Encryption section (options) -------------------------------------------------------------------------------
  'encryption.title': 'Encryption',
  'encryption.hint':
    'Encrypting stores the NIE and the date of birth under a passphrase of yours, in this browser. If you forget it they cannot be recovered: the history stays, but you will have to type the applications again.',
  'encryption.passphrase': 'Passphrase',
  'encryption.currentPassphrase': 'Current passphrase',
  'encryption.repeat': 'Repeat the passphrase',
  'encryption.enable': 'Encrypt the data',
  'encryption.disable': 'Remove the encryption',
  'encryption.unlockSession': 'Unlock for this session',
  'encryption.lockNow': 'Lock now',
  'encryption.locked': 'Session locked.',
  'encryption.disableConfirm':
    'Remove encryption? Identifying details will be stored without encryption.',
  'encryption.failed': 'Could not change encryption. No identifying details were changed.',
  'encryption.tooShort': 'Use a passphrase of at least 8 characters.',
  'encryption.mismatch': 'The two passphrases do not match.',
  'encryption.done': 'Data encrypted. Keep the passphrase somewhere safe.',
  'encryption.nothingToEncrypt':
    'Add an application before turning encryption on: there is nothing to encrypt yet.',
  'encryption.decryptFailed': 'Could not decrypt it: is the passphrase right?',
  'encryption.disabled': 'Encryption turned off.',
  'encryption.unlocked': 'Unlocked until you close the browser.',
  'encryption.unlockFailed': 'Could not unlock it.',
  'encryption.plainLeft': '{count} application(s) are still unencrypted: {labels}.',
  'encryption.repair': 'Encrypt them now',
  'encryption.repaired': 'Applications encrypted.',
  'encryption.repairFailed': 'Could not encrypt them: is the passphrase right?',

  // Backup section (options) -----------------------------------------------------------------------------------
  'backup.title': 'Backup',
  'backup.hint':
    'Export everything to a file so you can keep it or move it to another browser. The file stays on your machine. Merge keeps your current reminder and language; replace restores them from the file.',
  'backup.export': 'Export',
  'backup.exported': 'Backup exported.',
  'backup.filename': 'naciocheck-backup.json',
  'backup.fileLabel': 'Backup file',
  'backup.import': 'Import the chosen file',
  'backup.chooseFirst': 'Choose a file first.',
  'backup.mode': 'Import mode',
  'backup.merge': 'Merge (keep current settings)',
  'backup.replace': 'Replace everything',
  'backup.confirmMerge': 'Merge the chosen backup with your saved data?',
  'backup.confirmReplace':
    'Replace {applications} saved application(s) and {checks} check(s), including settings? This cannot be undone.',
  'backup.encryptionRequired':
    'This backup contains unencrypted identities. Encrypt it first, or explicitly remove the current encryption before importing it.',
  'backup.merged': 'Imported and merged.',
  'backup.replaced': 'Imported, replacing what was there.',
  'backup.importFailed': 'Could not import it: {error}',
  'backup.changed': 'Saved data changed while you confirmed the import. Review it and try again.',
  'backup.plainWarning':
    'The backup will include the NIE and the date of birth in the clear. Continue?',
  'backup.errorJson': 'The file is not valid JSON.',
  'backup.errorShape': 'The file is not shaped like a NacioCheck backup.',
  'backup.errorFormat': 'The file is not a NacioCheck backup.',

  // Result view ------------------------------------------------------------------------------------------------
  'result.empty': 'There is no check to show.',
  'result.changedTitle': 'THE STATUS HAS CHANGED',
  'result.errorTitle': 'The check could not be completed',
  'result.acknowledge': 'Got it',
  'result.retry': 'Try again',
  'result.next': 'Continue with the next application',
  'result.observedMeaning': 'Observed on real files, not official: {text}',
  'result.siteSaid': 'As the site printed it:',
  'result.disclaimer':
    'Informational only, not legal advice. The official decision arrives through DEHú. NacioCheck is not an official Ministry of Justice tool.',

  // Report a problem (result page) ----------------------------------------------------------------------------
  'report.summary': 'Report a problem',
  'report.intro':
    'This is the text that would be shared: the version, the browser, the language and what the page showed. Your own result, your details and your identifiers are never included. Nothing leaves your browser until you send it yourself from the website. You can review the text and add what you saw in your own words, in Catalan, Spanish or English.',
  'report.textLabel': 'Report text (you can edit it)',
  'report.copy': 'Copy the text',
  'report.copied': 'Text copied.',
  'report.copyFailed': 'Could not copy: select the text and copy it by hand.',
  'report.continue': 'Continue on the website',
  'report.continueHint':
    'Opens naciocheck.vgr.cat in a new tab. The text travels in the address and is not sent until you press Send there.',

  // Status guide -----------------------------------------------------------------------------------------------
  'statuses.title': 'NacioCheck · What each status means',
  'statuses.whatYouCanDo': 'What you can do: {text}',
  'statuses.noOfficialDefinition': 'No official definition: the sources disagree.',
  'statuses.mainPathTitle': 'The usual path',
  'statuses.branchesTitle': 'Known branches',
  'statuses.othersTitle': 'States only the law firms document',
  'statuses.observedSteps': 'Steps observed on real files, not official:',
  'statuses.observedSource': 'Observed on real files, not official',
  'statuses.branchHint': 'A branch off the usual path: not a required step.',
  'statuses.explanationWrong': 'Does this explanation look wrong?',

  // Alerts and the result model (core) -------------------------------------------------------------------------
  'alert.firstCheck': 'First check.',
  'alert.unchangedSince': 'Unchanged since {date}',
  'alert.before': 'Before: {status}',
  'alert.retryHint':
    'Check that the NIE, the application number and the year match the application, then try again.',
  'alert.notificationTitle': 'NacioCheck · {label}',
  'alert.notificationMessage': 'New status: {status}',

  // Background and content script ------------------------------------------------------------------------------
  'background.defaultLabel': 'Application',
  'background.unknownPage': 'The page was not recognised and nothing has been saved.',
  'notify.reminderTitle': 'NacioCheck',
  'notify.reminderMessage':
    'Time to check the status of your application. All it takes is the captcha.',
  'content.fallbackHint': 'Review the details of “{label}” and submit the query yourself.',
  'content.captchaHint':
    'Tick the captcha box. The query for “{label}” is submitted on its own once you solve it.',
  'content.pickerTitle': 'NacioCheck: which application do you want to check?',
  'content.pickerEncrypted': 'Encrypted application: unlock it in the options.',
};
