/* This script runs in the head so the saved scheme is picked before paint. */
(() => {
  const key = 'naciocheck-theme';
  const root = document.documentElement;
  const lightMedia = '(prefers-color-scheme: light)';
  const darkMedia = '(prefers-color-scheme: dark)';
  const lightMeta = document.querySelector(`meta[name="theme-color"][media="${lightMedia}"]`);
  const darkMeta = document.querySelector(`meta[name="theme-color"][media="${darkMedia}"]`);
  const supportsPairedColors = window.CSS?.supports('color', 'light-dark(#000, #fff)') ?? false;
  let mode = 'auto';
  let unsaved = false;

  function apply(choice) {
    mode = choice === 'light' || choice === 'dark' ? choice : 'auto';
    if (mode === 'auto') delete root.dataset.theme;
    else root.dataset.theme = mode;

    const scheme = supportsPairedColors ? mode : 'light';
    if (lightMeta) {
      lightMeta.media = scheme === 'auto' ? lightMedia : scheme === 'light' ? 'all' : 'not all';
    }
    if (darkMeta) {
      darkMeta.media = scheme === 'auto' ? darkMedia : scheme === 'dark' ? 'all' : 'not all';
    }
  }

  function sync() {
    if (unsaved) return;
    try {
      apply(window.localStorage.getItem(key));
    } catch {
      apply(mode);
    }
  }

  sync();
  document.addEventListener('DOMContentLoaded', () => {
    const radios = [...document.querySelectorAll('input[type="radio"][name="site-theme"]')];
    if (radios.length === 0) return;

    function syncControl() {
      sync();
      for (const radio of radios) radio.checked = radio.value === mode;
    }

    for (const radio of radios) {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        apply(radio.value);
        try {
          window.localStorage.setItem(key, mode);
          unsaved = false;
        } catch {
          // The current page still honors the choice when persistence is unavailable.
          unsaved = true;
        }
      });
    }
    window.addEventListener('pageshow', syncControl);
    window.addEventListener('storage', (event) => {
      if (event.key === key || event.key === null) syncControl();
    });

    syncControl();
    root.dataset.themeReady = '';
  });
})();
