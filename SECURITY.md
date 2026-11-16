# Security policy

NacioCheck handles a NIE, a name and a birth date, so a defect that exposes them matters even though the
data never leaves the device. This page says how to report one and what this project treats as a
vulnerability.

## Reporting a vulnerability

**Do not open a public issue with the details.** Use GitHub's private vulnerability reporting:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Describe the issue there.

If that button is not available yet, contact the maintainer through the GitHub account that owns the
repository (`vgr-dev`) without public details, and say that you have a security report.

Please include the extension version or commit, the browser and version, the steps to reproduce, what an
attacker gains, and whether personal data is exposed. Use invented identities in screenshots and logs; never
send a real NIE, name or birth date.

There is no security email address: the extension sends nothing, and neither does this project.

## Supported versions

The project is pre-release (0.x). Only the latest published release is supported; a fix ships as a new
version, and there are no backport branches. A report against an older build is still welcome, but the fix
will not be retrofitted.

## In scope

- The extension source in `src/` and the build (`wxt.config.ts`, `modules/`, `scripts/`), including the
  privacy gate, the packaging and the generated manifests.
- The published privacy site in `site/` and its Worker configuration.
- The E2E harness in `e2e/` where a defect could leak a real request or real data.
- The invariants the project promises, each of which is a security property here:
  - the captcha is only ever solved by the person, never bypassed, automated or outsourced;
  - the extension makes no request of its own and loads no remote code, fonts, styles or configuration;
  - data is stored only in `storage.local` / `storage.session`, never in `storage.sync`;
  - when encryption is on, no identity is ever written to storage in readable form;
  - the optional encryption is PBKDF2-HMAC-SHA-256 (600 000 iterations, random salt) with AES-GCM and a
    random IV per value, and a forgotten passphrase is unrecoverable by design;
  - an exported backup is written only when the user asks for one.

## Out of scope

- The official sede, the Ministerio de Justicia, DEHú and reCAPTCHA. Report problems there to them; this
  project is not affiliated and cannot fix them.
- A compromised browser profile, operating system or device, or another extension with wider permissions.
- Attacks that need physical access or the user's passphrase.
- Testing or scanning the official site: do not send it automated traffic, load tests or captcha attempts.
- Store listing text, availability of the official service, and feature requests.

## Privacy model in two lines

All data stays on the device, in `storage.local` and `storage.session`; there is no server, no telemetry,
no analytics and no request from the extension itself. The only traffic is the official page the user opens
and submits with their own solved captcha.

## Testing rules

- Use a local build and invented data. Do not test against the real sede beyond a normal check, and never
  bypass or automate its captcha.
- Do not access other people's data, and do not run denial-of-service tests against any host.
- Reports made in good faith following these rules are treated as research, not abuse.

## What happens next

This is a personal project with no service-level agreement. Reports are answered on a best-effort basis: the
maintainer will confirm receipt, work on a fix, and coordinate disclosure with you. Please allow a reasonable
time before publishing details. Credit is given if you want it.
