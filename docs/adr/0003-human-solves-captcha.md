# 0003. The human solves the captcha, on the real page

- **Status:** accepted
- **Date:** 2026-11-06 (recorded 2026-11-18)

## Context

The official form is protected by reCAPTCHA. Solving services send personal data to third parties and break
the site's terms. The sede sends `X-Frame-Options: SAMEORIGIN` and the reCAPTCHA key is bound to the sede's
domain, so the captcha cannot render inside an extension page.

## Decision

- The extension autofills the form, shows only the captcha, and submits after the person has solved it.
  It never bypasses, solves or outsources the captcha.
- The captcha runs in a compact window on the real page, not in the popup.
- Stripping response headers to allow framing is rejected.

## Consequences

- Every check needs a human for a few seconds; the flow is reminder, then captcha, then result.
- The captcha-only view is a content-script overlay on the sede page and must stay robust against page changes.
- The stub captcha used in tests exists only on fake pages (ADR 0007).
