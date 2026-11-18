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
    'All data stays in this browser. Nothing is sent to any server, not even the browser vendor servers. NacioCheck is not an official Ministry of Justice tool.',
  'options.applications': 'Applications',
  'options.empty': 'No application saved yet.',
  'options.addAnother': 'Add another',
  'options.addedOn': 'Added on {date}',
  'options.saved': 'Application “{label}” saved.',
  'options.edit': 'Edit',
  'options.cancelEdit': 'Cancel',
  'options.editedOn': 'Edited on {date}',
  'options.delete': 'Delete',
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
    'Export everything to a file so you can keep it or move it to another browser. The file stays on your machine: nothing leaves this page.',
  'backup.export': 'Export',
  'backup.exported': 'Backup exported.',
  'backup.filename': 'naciocheck-backup.json',
  'backup.fileLabel': 'Backup file',
  'backup.import': 'Import the chosen file',
  'backup.chooseFirst': 'Choose a file first.',
  'backup.mergeQuestion':
    'Accept = add whatever you are missing. Cancel = replace everything with the file.',
  'backup.merged': 'Imported and merged.',
  'backup.replaced': 'Imported, replacing what was there.',
  'backup.importFailed': 'Could not import it: {error}',
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
  'result.disclaimer':
    'Informational only, not legal advice. The official decision arrives through DEHú. NacioCheck is not an official Ministry of Justice tool.',

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
