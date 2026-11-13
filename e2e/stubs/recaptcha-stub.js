/**
 * A stand-in for the reCAPTCHA script, answered only to the fake check page.
 *
 * The suite never loads the real widget: this file answers the script URL the captured page references, draws
 * a labelled box where the checkbox would be so the captcha-only view has something to show, and leaves the
 * token to the test — writing it is what a person does by ticking the box.
 *
 * No network, no storage, no clock: the token is set by `solveStubCaptcha()` in `../support/fake-sede.ts`.
 */
(() => {
  const LABEL = 'TEST CAPTCHA STUB';

  function render() {
    const widget = document.querySelector('.g-recaptcha');
    if (widget === null) return;

    const box = document.createElement('div');
    box.className = 'naciocheck-test-captcha';
    box.textContent = LABEL;
    box.style.cssText = [
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'box-sizing: border-box',
      'width: 304px',
      'height: 78px',
      'border: 2px dashed #0f766e',
      'border-radius: 4px',
      'background: #f0fdfa',
      'color: #0f766e',
      'font: 700 13px/1.2 system-ui, sans-serif',
      'letter-spacing: 0.08em',
    ].join(';');
    widget.replaceChildren(box);
  }

  // The script tag sits above the widget in the captured markup, so the widget does not exist yet.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
