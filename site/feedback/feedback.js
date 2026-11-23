/*
 * NacioCheck feedback page. Plain ES2022, no build step, no other request than the one POST below.
 *
 * It reads the report from the URL fragment into the textarea, removes the fragment from the address,
 * renders the Turnstile widget explicitly and, on an explicit click on Send, posts what the person sees to
 * the relative /api/feedback. Copy works without Turnstile.
 */
(() => {
  const PRODUCTION_HOST = 'naciocheck.vgr.cat';
  const MAX_BODY_BYTES = 8192;
  // Cloudflare's published always-pass test sitekey: used on any other host (hands-on checks with
  // `wrangler dev`). The real key sits in the page's data-sitekey and is used on the production host only.
  const TEST_SITEKEY = '1x00000000000000000000AA';

  const TEXTS = {
    es: {
      sending: 'Enviando…',
      sent: 'Enviado. Gracias: el comentario ha llegado a quien mantiene el proyecto.',
      empty: 'Escribe algo antes de enviar.',
      noToken:
        'La comprobación de Cloudflare Turnstile aún no ha terminado. Espera un momento, o complétala si se muestra, y vuelve a pulsar Enviar.',
      widgetFailed:
        'No se ha podido cargar la comprobación de Turnstile. Puedes copiar el texto y enviarlo por otra vía.',
      widgetError: 'La comprobación de Turnstile ha fallado. Inténtalo de nuevo.',
      copied: 'Copiado.',
      copyFailed: 'No se ha podido copiar. Selecciona el texto y cópialo a mano.',
      network: 'No se ha podido conectar. Revisa tu conexión y vuelve a intentarlo.',
      'bad-body': 'El texto no es válido. Revísalo y vuelve a intentarlo.',
      origin: 'El envío se ha rechazado porque no viene de esta web. Recarga la página.',
      turnstile:
        'La comprobación de Turnstile no ha sido válida o ha caducado. Inténtalo de nuevo.',
      method: 'El envío se ha rechazado (método no permitido).',
      'too-large': 'El texto es demasiado largo. Acórtalo y vuelve a intentarlo.',
      'content-type': 'El envío se ha rechazado (tipo de contenido no admitido).',
      'rate-limited': 'Demasiados envíos seguidos. Espera un minuto y vuelve a intentarlo.',
      upstream: 'El servicio no está disponible ahora mismo. Inténtalo de nuevo más tarde.',
      unknown: 'No se ha podido enviar. Inténtalo de nuevo más tarde.',
    },
    en: {
      sending: 'Sending…',
      sent: 'Sent. Thank you: your feedback has reached the person who maintains the project.',
      empty: 'Write something before sending.',
      noToken:
        'The Cloudflare Turnstile check has not finished yet. Wait a moment, or complete it if it is shown, and press Send again.',
      widgetFailed:
        'The Turnstile check could not be loaded. You can copy the text and send it another way.',
      widgetError: 'The Turnstile check failed. Please try again.',
      copied: 'Copied.',
      copyFailed: 'Could not copy. Select the text and copy it by hand.',
      network: 'Could not connect. Check your connection and try again.',
      'bad-body': 'The text is not valid. Review it and try again.',
      origin: 'The request was rejected because it did not come from this site. Reload the page.',
      turnstile: 'The Turnstile check was not valid or has expired. Please try again.',
      method: 'The request was rejected (method not allowed).',
      'too-large': 'The text is too long. Shorten it and try again.',
      'content-type': 'The request was rejected (content type not accepted).',
      'rate-limited': 'Too many sends in a row. Wait a minute and try again.',
      upstream: 'The service is not available right now. Please try again later.',
      unknown: 'Could not send it. Please try again later.',
    },
  };

  const language = document.documentElement.lang === 'en' ? 'en' : 'es';
  const texts = TEXTS[language];

  const textarea = document.getElementById('report');
  const container = document.getElementById('feedback-widget');
  const copyButton = document.getElementById('copy');
  const sendButton = document.getElementById('send');
  const status = document.getElementById('status');
  if (!textarea || !container || !copyButton || !sendButton || !status) return;

  const say = (key) => {
    status.textContent = texts[key] ?? texts.unknown;
  };

  // The report arrives in the fragment, which the browser never sends to a server. Read it, then take it
  // out of the address so it does not stay in the history or get shared by accident.
  const readFragment = () => {
    const fragment = location.hash.slice(1);
    if (fragment === '') return;
    try {
      textarea.value = decodeURIComponent(fragment);
    } catch {
      // A malformed fragment is ignored: the person starts from an empty box.
    }
    history.replaceState(null, '', location.pathname + location.search);
  };

  // Turnstile.
  let widgetId;
  let token = '';
  let renderRequested = false;
  let busy = false;

  // Cloudflare's API, once loaded. Never trust the bare name: any element with id="turnstile" would
  // already be a global of that name, so only an object with a render function counts.
  const api = () => {
    const candidate = globalThis.turnstile;
    return candidate !== null &&
      typeof candidate === 'object' &&
      typeof candidate.render === 'function'
      ? candidate
      : undefined;
  };

  const currentToken = () => {
    if (token !== '') return token;
    const turnstileApi = api();
    if (widgetId === undefined || turnstileApi === undefined) return '';
    return turnstileApi.getResponse(widgetId) ?? '';
  };

  const resetWidget = () => {
    token = '';
    const turnstileApi = api();
    if (widgetId !== undefined && turnstileApi !== undefined) turnstileApi.reset(widgetId);
  };

  const render = () => {
    widgetId = api().render(container, {
      sitekey: location.hostname === PRODUCTION_HOST ? container.dataset.sitekey : TEST_SITEKEY,
      language,
      callback: (value) => {
        token = value;
      },
      'expired-callback': () => {
        token = '';
      },
      'timeout-callback': () => {
        token = '';
      },
      'error-callback': () => {
        token = '';
        say('widgetError');
      },
    });
  };

  // api.js is async and this script is deferred, so either may run first, and the API URL may carry no
  // query (no `?onload=`): render once, as soon as the API exists. Never `turnstile.ready()`: Turnstile
  // throws when it is called while api.js is loaded async or deferred, which the site gate requires.
  const renderOnce = () => {
    if (renderRequested || api() === undefined) return;
    renderRequested = true;
    render();
  };

  const watchForTurnstile = () => {
    renderOnce();
    if (renderRequested) return;
    const apiScript = document.querySelector('script[src*="challenges.cloudflare.com"]');
    apiScript?.addEventListener('load', renderOnce, { once: true });
    window.addEventListener(
      'load',
      () => {
        renderOnce();
        if (!renderRequested) say('widgetFailed');
      },
      { once: true },
    );
  };

  // Copy works without a token.
  const copyText = async () => {
    const text = textarea.value;
    try {
      await navigator.clipboard.writeText(text);
      say('copied');
      return;
    } catch {
      // Fall through to the selection-based copy.
    }
    try {
      textarea.focus();
      textarea.select();
      say(document.execCommand('copy') ? 'copied' : 'copyFailed');
    } catch {
      say('copyFailed');
    }
  };

  const errorCode = async (response) => {
    try {
      const body = await response.json();
      return typeof body?.error === 'string' ? body.error : '';
    } catch {
      return '';
    }
  };

  const SERVER_CODES = [
    'bad-body',
    'origin',
    'turnstile',
    'method',
    'too-large',
    'content-type',
    'rate-limited',
    'upstream',
  ];

  const messageKey = (status, code) => {
    if (SERVER_CODES.includes(code)) return code;
    if (status === 429) return 'rate-limited';
    if (status === 413) return 'too-large';
    if (status >= 500) return 'upstream';
    return 'unknown';
  };

  const send = async () => {
    if (textarea.value.trim() === '') {
      say('empty');
      return;
    }
    const value = currentToken();
    if (value === '') {
      say('noToken');
      return;
    }
    const body = JSON.stringify({ text: textarea.value, token: value });
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      say('too-large');
      return;
    }
    busy = true;
    sendButton.disabled = true;
    say('sending');
    let sent = false;
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (response.status === 204) {
        sent = true;
        say('sent');
      } else {
        say(messageKey(response.status, await errorCode(response)));
      }
    } catch {
      say('network');
    } finally {
      // A token is good for one verification: always ask for a new one.
      resetWidget();
      // After a success, Send stays off until the text changes, so one report is not sent twice.
      busy = false;
      sendButton.disabled = sent;
    }
  };

  const start = () => {
    readFragment();
    copyButton.addEventListener('click', () => {
      void copyText();
    });
    sendButton.addEventListener('click', () => {
      void send();
    });
    textarea.addEventListener('input', () => {
      if (!busy) sendButton.disabled = false;
    });
    watchForTurnstile();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
