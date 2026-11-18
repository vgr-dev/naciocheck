import {
  HINT_ID,
  autofillForm,
  buildCaptchaOnlyCss,
  buildHintCss,
  hasCaptchaOnlyViewTargets,
  submitIfCaptchaSolved,
} from '../core/autofill';
import { type FillPayload, type PageOutcomeMessage } from '../core/messages';
import { parseCheckPage, type ParseOutcome } from '../core/parser';
import { getSettings, listApplications } from '../core/storage';
import { resolveLocaleCode, setLocale, t } from '../core/i18n';

/**
 * Runs on every page of the official check.
 *
 * On the form: fills the saved application, hides everything but the captcha and submits as soon as the human
 * has solved it. On any other page: reports what it found to the background, which stores it.
 */

const CAPTCHA_ONLY_STYLE_ID = 'naciocheck-captcha-only';
const HINT_STYLE_ID = 'naciocheck-hint-style';
const PICKER_STYLE_ID = 'naciocheck-picker-style';
const DEV_FLAG_KEY = 'naciocheck:dev:no-captcha-only';
const POLL_INTERVAL_MS = 400;
const FILL_ATTEMPTS = 6;
const FILL_RETRY_MS = 250;

export default defineContentScript({
  matches: ['https://sede.mjusticia.gob.es/eConsultas/*'],
  runAt: 'document_idle',
  main() {
    // Any failure after the captcha-only view has hidden the page must put the whole page back. Errors before
    // that point leave the page untouched, so this is a no-op for them.
    void start().catch(() => {
      restoreFullPage();
    });
  },
});

async function start(): Promise<void> {
  // The hints are ours, on somebody else's page: set the language, but never the document's `dir`.
  const { language } = await getSettings();
  setLocale(resolveLocaleCode(language, browser.i18n.getUILanguage()));

  const outcome = parseCheckPage(document);
  if (outcome.kind !== 'form') {
    await reportOutcome(outcome);
    return;
  }
  const fill = await requestFill();
  if (fill === null) {
    await showPicker();
    return;
  }
  try {
    await prepareCheck(fill);
  } catch {
    showFallback(fill, 'error');
  }
}

/** The background knows this tab belongs to a check run; it may not have registered it yet, hence the retries. */
async function requestFill(): Promise<FillPayload | null> {
  for (let attempt = 0; attempt < FILL_ATTEMPTS; attempt += 1) {
    const response: unknown = await browser.runtime.sendMessage({
      type: 'naciocheck:request-fill',
    });
    if (isFillPayload(response)) return response;
    await delay(FILL_RETRY_MS);
  }
  return null;
}

function isFillPayload(value: unknown): value is FillPayload {
  return (
    typeof value === 'object' && value !== null && 'applicationId' in value && 'identity' in value
  );
}

async function prepareCheck(fill: FillPayload): Promise<void> {
  const result = autofillForm(document, fill.identity);
  const disabled = await isCaptchaOnlyViewDisabled();
  if (!result.complete || !hasCaptchaOnlyViewTargets(document) || disabled) {
    // Fallback: the page is not the shape we know (or the debug switch is on). Leave it whole, fields filled,
    // and say what to do.
    showFallback(fill, 'manual');
    return;
  }
  injectStyle(CAPTCHA_ONLY_STYLE_ID, buildCaptchaOnlyCss());

  let timer: number | undefined;
  const stop = (): void => {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
  };

  // The escape control is part of the strip and stays usable while the rest of the page is hidden.
  showHint(t('content.captchaHint', { label: fill.label }), () => {
    stop();
    showFallback(fill, 'manual');
  });

  timer = window.setInterval(() => {
    try {
      const decision = submitIfCaptchaSolved(document);
      if (decision === 'submitted') {
        stop();
        return;
      }
      if (decision === 'blocked') {
        // The captcha is solved but the form refused the submission. Polling would never finish and the fields
        // that need attention would stay hidden, so put the full page back with what the server returned.
        stop();
        showFallback(fill, 'blocked');
      }
    } catch {
      // The page changed under us. Stop polling and give the whole page back instead of hiding it forever.
      stop();
      showFallback(fill, 'error');
    }
  }, POLL_INTERVAL_MS);
}

/** Puts the whole page back, with the fields as filled, and says what the person has to do next. */
function showFallback(fill: FillPayload, reason: 'manual' | 'blocked' | 'error'): void {
  document.getElementById(CAPTCHA_ONLY_STYLE_ID)?.remove();
  injectStyle(HINT_STYLE_ID, buildHintCss());
  showHint(
    reason === 'blocked'
      ? t('content.submitBlocked')
      : t('content.fallbackHint', { label: fill.label }),
  );
}

/** An unexpected failure after the page was hidden: make it visible again instead of leaving it blank. */
function restoreFullPage(): void {
  if (document.getElementById(CAPTCHA_ONLY_STYLE_ID) === null) return;
  document.getElementById(CAPTCHA_ONLY_STYLE_ID)?.remove();
  document.getElementById(HINT_ID)?.remove();
}

/**
 * Debug switch for the manual fallback test: set
 * `browser.storage.local.set({ 'naciocheck:dev:no-captcha-only': true })` from the extension's devtools and
 * reload the page to see the full form instead of the captcha-only view.
 */
async function isCaptchaOnlyViewDisabled(): Promise<boolean> {
  const stored: Record<string, unknown> = await browser.storage.local.get(DEV_FLAG_KEY);
  return stored[DEV_FLAG_KEY] === true;
}

async function reportOutcome(outcome: ParseOutcome): Promise<void> {
  const message: PageOutcomeMessage = { type: 'naciocheck:page-outcome', outcome };
  await browser.runtime.sendMessage(message);
}

/** Opened by hand: offer the saved applications instead of filling nothing. */
async function showPicker(): Promise<void> {
  const applications = await listApplications();
  if (applications.length === 0) return;

  injectStyle(PICKER_STYLE_ID, PICKER_CSS);
  const panel = document.createElement('div');
  panel.id = 'naciocheck-picker';

  const title = document.createElement('p');
  title.className = 'naciocheck-picker-title';
  title.textContent = t('content.pickerTitle');
  panel.append(title);

  for (const application of applications) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = application.label;
    if (application.identity.kind !== 'plain') {
      button.disabled = true;
      button.title = t('content.pickerEncrypted');
    } else {
      const identity = application.identity;
      button.addEventListener('click', (event) => {
        // The page is somebody else's: a script on it can dispatch a click on our button, but not a trusted
        // one. Only a real person's pick may drive a fill.
        if (!event.isTrusted) return;
        panel.remove();
        const fill: FillPayload = {
          applicationId: application.id,
          label: application.label,
          identity,
        };
        void prepareCheck(fill).catch(() => {
          showFallback(fill, 'error');
        });
      });
    }
    panel.append(button);
  }

  document.body.append(panel);
}

function injectStyle(id: string, css: string): void {
  if (document.getElementById(id) !== null) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.append(style);
}

function showHint(text: string, onShowFullPage?: () => void): void {
  let hint = document.getElementById(HINT_ID);
  if (hint === null) {
    hint = document.createElement('div');
    hint.id = HINT_ID;
    document.body.append(hint);
  }
  hint.replaceChildren(document.createTextNode(text));

  if (onShowFullPage !== undefined) {
    const escape = document.createElement('button');
    escape.type = 'button';
    escape.className = 'naciocheck-escape';
    escape.textContent = t('content.showFullPage');
    escape.addEventListener('click', () => {
      onShowFullPage();
    });
    hint.append(escape);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const PICKER_CSS = `
  #naciocheck-picker {
    position: fixed;
    inset-block-start: 16px;
    inset-inline-end: 16px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 240px;
    padding: 16px;
    border: 1px solid #99f6e4;
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 8px 24px rgb(15 118 110 / 18%);
    font: 500 14px/1.4 system-ui, sans-serif;
    color: #0f172a;
  }
  #naciocheck-picker .naciocheck-picker-title {
    margin: 0 0 4px;
    font-weight: 700;
    color: #0f766e;
  }
  #naciocheck-picker button {
    padding: 8px 12px;
    border: 1px solid #0f766e;
    border-radius: 8px;
    background: #f0fdfa;
    color: #0f766e;
    font: inherit;
    cursor: pointer;
  }
  #naciocheck-picker button:hover:not(:disabled) {
    background: #ccfbf1;
  }
  #naciocheck-picker button:disabled {
    border-color: #cbd5e1;
    background: #f8fafc;
    color: #94a3b8;
    cursor: not-allowed;
  }
`;
