# Pre-release audit: 2026-11-18

## Scope and disposition

**Pre-release inspection only. No authorization to publish v1.0.0.** No release, tag, version bump,
deployment, store submission, git-history rewrite, staging, commit or push is part of this work.

Baseline: `cf6161282fc745e3364c928d01150d38f90444a1` (initial working tree clean). Findings cite
baseline line numbers unless explicitly marked as remediation locations. Inspection, local remediation
and automated verification are complete; owner-only gates below remain open. This report was used as the
remediation worklist and records the resulting verification, not a publication sign-off.

Coverage: application and extension security, storage/encryption, functionality and tests, documentation,
release assets, packaging, dependency advisories, and all locally reachable git history. No automated
request may reach the live sede or real CAPTCHA. Dependency auditing sends package metadata, not source
or applicant data, to the configured npm registry. Suspected personal information or credentials must
not be copied into this report: use redacted types and object/commit references.

Severity: **Critical** = immediate compromise or credential exposure; **High** = sensitive-data loss or
material privacy/security defect; **Medium** = constrained security/reliability defect or missing release
validation; **Low** = limited-impact defect; **Informational** = intentional exposure or known limitation.
An open manual check is not a demonstrated vulnerability. Resolved means a local fix was verified, not
that a release was approved.

**Disposition:** 24 findings/worklist items. Local remediation addresses 19; AUD-05 is reviewed isolated
local state, not a distributed leak. AUD-04 (maintainer attribution consent), AUD-18 (Android device),
AUD-21 (manual platform/live-site/visual acceptance) and AUD-22 (actual Firefox download) remain open or
partially open. Automated success does not clear those gates. **The v1.0.0 release is not approved.**

## Findings and worklist

### AUD-01: Vulnerable development dependency chains

- **Severity:** Medium (npm: moderate). **Status:** Resolved locally.
- **Location:** `package-lock.json`, `node_modules/minimatch` (10.2.6),
  `node_modules/mocha/node_modules/glob` (13.0.7); roots include ESLint, typescript-eslint and WebdriverIO.
- **Evidence:** `npm audit --json` reports 24 moderate affected package entries, zero high/critical.
  These are two underlying advisories, not 24 independent vulnerabilities:
  [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), globparts amplification DoS
  in minimatch <11.0.1; [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4),
  post-timeout filesystem traversal in glob <=14.0.1. `npm audit --omit=dev --json`: zero vulnerabilities.
  These tools are not shipped as extension runtime libraries, but process build/test inputs locally.
- **Recommended remediation:** Update compatible lint-tool versions; use narrowly scoped, explicitly
  tested overrides for unpatched upstream tool chains if necessary. Do not blindly apply npm's suggested
  major WebdriverIO downgrades or `npm audit fix --force`. Re-run clean installation, audit and all gates.
- **Resolution:** Updated ESLint/typescript-eslint and locked patched glob >=14.0.4 and minimatch >=11.0.9
  through explicit overrides. Upstream Mocha/readdir-glob still require older major ranges, so these
  overrides must be reassessed on future tool upgrades rather than removed blindly.
- **Verification:** Clean `npm ci`, `npm audit --json`: zero vulnerabilities, including development
  dependencies; 661 registry signatures and 210 attestations verified. Unit/type/lint gates pass; the
  patched tools also execute the real offline Chrome suite, not just a dependency resolution check.

### AUD-02: Runtime declaration permits an unsupported tooling environment

- **Severity:** Low. **Status:** Resolved locally.
- **Location:** `package.json:8-10` (`node >=24`), `.nvmrc:1` (`24`);
  `package-lock.json:3212` and other WebdriverIO engine declarations.
- **Evidence:** Installed `node --version` is `v24.22.0`. `npm audit fix --dry-run --ignore-scripts --json`
  emits `EBADENGINE`: WebdriverIO 10.2.0 requires `>=22.23.4 <23 || >=24.22.1 <25 || >=26.12.1`.
  `README.md:69-70` already documents the 24.22.1 minimum, but package metadata does not enforce it.
- **Recommended remediation:** Align the Node LTS pin and package engines with the supported minimum.
  A supported local Node runtime is required for final release-tool verification. Do not silently upgrade
  the user's global runtime.
- **Resolution:** `.nvmrc` pins 24.22.1 and engines require `^24.22.1 || >=26.12.1`.
- **Verification:** Final commands use `npm exec --yes --package=node@24.22.1 -- <command>` from an
  isolated npm-cache runtime. Clean installation reports no engine mismatch. Global Node remains 24.22.0;
  it was not silently upgraded. Maintainers should select the pinned runtime before using bare npm commands.

### AUD-03: Encryption outcome feedback is erased by page redraw

- **Severity:** Low. **Status:** Resolved locally.
- **Location:** `src/entrypoints/shared/encryption-sections.ts:117-118,162-163,188-189`.
- **Evidence:** Enable, repair and disable assign success text to the old paragraph, then await a callback
  that replaces the page DOM. The encryption-enabled confirmation includes advice to keep the passphrase
  safe, but never survives the options/onboarding redraw. Previously recorded as open finding F-1 in the
  active plan's Firefox checklist run; no existing unit test simulates that destructive redraw.
- **Recommended remediation:** Announce the outcome next to the newly rendered encryption section after
  redraw, using the existing accessible confirmation helper. Add regression tests with a real redraw for
  all three actions and browser coverage for enable/disable.
- **Resolution:** Announce success next to the new encryption section after redraw, not into discarded DOM.
- **Verification:** Three full-redraw regression tests initially failed against the original implementation
  and now pass; unit tests cover enable/repair/disable. Browser page assertions cover enabling and disabling.

### AUD-04: Public git history reveals maintainer identity

- **Severity:** Informational (privacy decision). **Status:** Open, owner review before public visibility.
- **Location:** Author/committer metadata and `Signed-off-by` trailers on all 53 commits, including
  `cf6161282fc745e3364c928d01150d38f90444a1`; root commit also credits the AI tool with its service address.
- **Evidence:** The history contains the maintainer's real name and personal email address. Values are
  deliberately not duplicated here. This is attribution, not applicant data or a leaked credential.
  No private signing key was found; public signatures/fingerprints are not secret material.
- **Recommended remediation:** The owner must explicitly accept this exposure before making the repository
  public, or separately authorize an identity/history rewrite and assess DCO/signature consequences.
  Deleting text in the current tree would not remove historical metadata. No rewrite is performed here.
- **Verification:** Read-only metadata review across all locally reachable commits; publication withheld.

### AUD-05: Sensitive-shaped material exists in ignored local working files

- **Severity:** Informational. **Status:** Reviewed; not a tracked or packaged leak.
- **Location:** `e2e/.artifacts/tls/key.pem:1-28` (throwaway TLS private key);
  `.ai/plans/active/2026-11-13-mvp-completion-and-release-readiness.md:1346` (local home path),
  `:2426,2558` (additional identifier-shaped values called invented in the plan); local plan owner fields.
- **Evidence:** Gitleaks detects the ephemeral E2E private key only. It is generated per run, mode `0600`,
  valid with its self-signed certificate for two days, ignored, with zero commits and absent from source
  archives. No production account uses it. Local plans are also ignored and excluded from source archives.
  Their provenance cannot independently prove every plan-only example is invented. Historical evidence in
  those plans must not be silently rewritten.
- **Recommended remediation:** Do not share ignored working files/browser profiles as release artifacts.
  Remove generated TLS material after testing; redact a copy of local plans before sharing, not their
  historical evidence. Keep explicit package exclusions and rerun archive scanning for final artifacts.
- **Verification:** `git check-ignore`, zero tracked artifact paths/history commits, source-archive entry
  review and redacted archive scan. No credential rotation or git-history surgery is justified by this key.
  The TLS key/certificate generated by this audit's final E2E run were removed after the server stopped;
  a future E2E run generates new disposable ones. Existing private local plans were preserved, not rewritten.

### AUD-06: Backup import can remove encryption and overwrite data on Cancel

- **Severity:** High (privacy), Medium (data loss). **Status:** Resolved locally.
- **Location:** `src/entrypoints/shared/encryption-sections.ts:243-247`, `options/main.ts:55-63`;
  `src/core/backup.ts:65`; `src/core/locales/en.ts:161-162`, `es.ts:165-166`.
- **Evidence:** Import stores plain identities over/alongside encrypted identities with no passphrase or
  warning, violating the at-rest invariant. The UI is not redrawn and still describes the old encrypted
  store. `window.confirm` false (including Esc) means destructive replace, not abort. Imports do not
  reschedule reminders or apply the imported locale. Merge intentionally retains current settings but
  the transfer copy does not explain that.
- **Recommended remediation:** Explicit import mode with a separate destructive confirmation; Cancel
  must abort. Refuse plaintext imports into encrypted stores unless safely encrypted first; refresh UI,
  clear obsolete session credentials, reschedule and apply locale; explain merge settings. Add regression
  tests for cancel, replace, encrypted/plain combinations and refreshed state.
- **Resolution:** Explicit merge/replace selector and confirmation; dismissal aborts without a write.
  Plain imports into an encrypted store are refused (the user must encrypt the backup or explicitly disable
  encryption first). Import refreshes locale/UI, locks the session and reschedules reminders. Confirmation
  occurs outside the store lock; a snapshot comparison inside the transaction refuses intervening writes.
- **Verification:** Tests cover both cancelled modes, both plaintext-while-encrypted modes, confirmed
  replacement/redraw/lock/reschedule, and concurrent changes during confirmation. Existing browser merge
  round-trip passes. No silent encryption downgrade or new passphrase-retention path was introduced.

### AUD-07: Concurrent store mutations and encryption batches are not atomic

- **Severity:** Medium (data loss/privacy race). **Status:** Resolved locally; Firefox lock support remains a platform gate.
- **Location:** `src/core/storage.ts:150-159,175-186,193-279,301-307`;
  `src/entrypoints/shared/encryption-sections.ts:105-112,150-157,176-190`.
- **Evidence:** Each writer reads and replaces the entire store without a cross-context lock. Concurrent
  append/acknowledge/import can overwrite another change. Encryption writes per identity, so a mid-loop
  failure can leave partial plaintext/encrypted state.
- **Recommended remediation:** Serialize read-modify-write operations across extension contexts, including
  imports; compute and commit encryption changes as one transaction. Test concurrent append/acknowledge,
  import races, and all-or-nothing encryption failure. Verify the locking primitive on supported browsers.
- **Resolution:** All writers share `navigator.locks` on the extension origin. `mutateStore` validates and
  commits one result; encryption batches compute all identities before a single write. The add/edit APIs
  reject plaintext writes inside the lock if another context enabled encryption meanwhile.
- **Verification:** Concurrent append/settings/transaction tests, failed-decryption all-or-nothing test and
  plaintext-write guard tests pass. Actual Chrome add/encrypt/check flows exercise Web Locks; jsdom uses a
  serializing mock. No unlocked fallback exists; Firefox desktop/Android must confirm supported-origin behavior.

### AUD-08: Imported records and cryptographic parameters are under-validated

- **Severity:** Medium. **Status:** Resolved locally.
- **Location:** `src/core/storage.ts:126-148`, `backup.ts:29-44`, `crypto.ts:111-129`.
- **Evidence:** Schema validation only checks version and top-level arrays; an application with
  `identity: { kind: 'plain' }` is accepted and breaks fills. Missing check fields and orphan references
  are accepted. Encrypted payload iterations are any number, allowing CPU exhaustion from crafted input.
- **Recommended remediation:** Validate record shapes, identities, timestamps, IDs/references and bounded
  cryptographic parameters before import/use. Reject malformed data without overwriting the store. Test
  malformed records, duplicate/orphan IDs and oversized/invalid crypto parameters.
- **Resolution:** Validate identities, application/check records, timestamps, uniqueness and references;
  validate encrypted envelopes before import/write. Shared envelope validation checks version, integer
  iterations 1..2,000,000, decoded salt/IV lengths 16/12 and ciphertext length >=16. Production encryption
  remains 600,000 iterations; the lower test-compatible bound is not used for new production data.
- **Verification:** Core storage/backup/crypto suites: 81 passed, including malformed-envelope/oversized-
  iteration no-overwrite tests. A structurally valid encrypted envelope still needs its passphrase to
  authenticate; import does not prove that arbitrary valid-shaped ciphertext can be decrypted.

### AUD-09: Unlock and Continue lose the user's intended check selection

- **Severity:** Medium (unexpected official-site submissions). **Status:** Resolved locally.
- **Location:** `src/entrypoints/background.ts:187-208,344-355`; `unlock/main.ts:38-54`;
  `result/main.ts:178-184`.
- **Evidence:** Locked selection is not persisted; after unlocking the page starts all applications.
  A stale session passphrase is checked only for presence, so imported/rekeyed identities stall in the
  picker instead of asking to unlock. Repeated Continue messages each consume a queue item and can skip
  an application. Existing unlock E2E covers one application only.
- **Recommended remediation:** Preserve pending selections; validate requested encrypted identities with
  the session phrase; make Continue idempotent and disable the control while advancing. Add multi-app,
  stale-phrase and duplicate-Continue regressions.
- **Resolution:** Persist pending IDs, validate the selected identities against the session phrase, and
  serialize starts. Only one pending unlock prompt exists: a second request focuses it without replacing
  the first selection. Continue consumes a per-result/run token once and disables its button while pending.
  Locking closes/invalidates the pending prompt; an in-progress unlock cannot restore the phrase after a
  lock. A missing/cancelled selection is refused, never interpreted as checking every application.
- **Verification:** Unit regressions cover concurrent starts, stale phrases and duplicate/detached Continue;
  the added two-encrypted-application Chrome case requests the second and verifies only that one is filled.

### AUD-10: Message and alert failures can hang checks or stop reminders

- **Severity:** Medium. **Status:** Resolved locally.
- **Location:** `src/entrypoints/background.ts:66-69,100-111,272-338,365-385`;
  `src/core/messages.ts:87-90`; `src/entrypoints/content.ts:106-109`.
- **Evidence:** The async message listener lacks a rejection handler; deleting an app during its check
  causes appendCheck to throw and leaves no response/result. Alert APIs are awaited before opening the
  result; notification failure also skips reminder rescheduling. Message validation checks only the
  `naciocheck:` prefix. This is an internal reliability issue, not a demonstrated external message attack
  (`externally_connectable` is absent).
- **Recommended remediation:** Validate message shapes and always settle replies, handle deleted-app
  outcomes, isolate optional alert failures from results and reschedule reminders in a finally block.
  Test storage/notification failures and malformed messages.
- **Resolution:** Discriminated message guards, always-settled listener responses, recoverable deleted-app
  outcomes, result navigation isolated from optional alert failure and reminder rescheduling in finally.
- **Verification:** Message/background tests cover malformed shapes, deletion, notification rejection and
  reminder rescheduling; browser check/error flows pass. Android API/display availability remains manual.

### AUD-11: Change alerts cannot reliably be revisited or acknowledged

- **Severity:** Medium. **Status:** Resolved locally; actual OS notification display remains manual.
- **Location:** `src/entrypoints/background.ts:113-118,365-420`;
  `popup/main.ts:91-93`; `result/main.ts:189-196`.
- **Evidence:** Acknowledging one application clears the global badge even if another changed. Closing
  the result leaves no acknowledge control in the popup. Change-notification clicks are ignored.
  Acknowledgement does not update cached result payloads, so reload restores the banner. Deleting an app
  leaves its notifications/badge; closed tabs leave fill/result session entries.
- **Recommended remediation:** Derive badge state from outstanding changes, provide a revisit path from
  popup/notification, persist acknowledgement in result payloads and clean removed-tab/deleted-app state.
  Test two outstanding changes, close/reopen/reload and notification clicks.
- **Resolution:** Derive outstanding changes from all unacknowledged changed records, not just the latest
  pair. Popup and notification links reopen the retained check; acknowledgement updates cached results;
  removed tabs and orphan notifications are cleaned. Storage-change badge synchronization does not rewrite
  active session queues. Popup revisit/check controls use spaced, tap-sized existing button styles.
- **Verification:** Unit regressions cover two changes, unchanged/error follow-ups, acknowledgement/reload,
  notification failure and tab cleanup. Chrome popup/result flows and visual cases exercise the controls;
  real OS notification clicks and badge rendering remain owner platform checks.

### AUD-12: Captcha-only mode can trap the user on an unsubmitted form

- **Severity:** Medium. **Status:** Resolved locally.
- **Location:** `src/entrypoints/content.ts:73-109,125-143`;
  `src/core/autofill.ts:102-111`.
- **Evidence:** A submit click is considered successful even when required-field validation prevents
  submission; polling stops and hidden fields remain inaccessible. No full-page escape control exists.
  The injected picker also accepts synthetic page-triggered clicks (constrained to the trusted sede host).
- **Recommended remediation:** Validate the form before submission, restore full-page fallback when
  blocked and always provide an escape control. Ignore untrusted picker events. Test newly required
  fields and a blocked submission; do not automate the real CAPTCHA.
- **Resolution:** Check/report form validity before clicking submit; blocked/poll-error paths restore the
  full form. Always provide a full-page escape button; picker ignores synthetic clicks.
- **Verification:** Autofill tests cover blocked required fields and visible escape control; fake-sede
  browser flows still require a nonempty stub token. Synthetic-only visual baselines were regenerated after
  inspecting the intended escape control. No real CAPTCHA was solved, bypassed or sent to a service.

### AUD-13: Delete irreversibly removes an application and history in one click

- **Severity:** Medium. **Status:** Resolved locally.
- **Location:** `src/entrypoints/options/main.ts:159-169`, `src/core/storage.ts:245-252`.
- **Evidence:** Delete immediately removes the application and every check, with no confirmation/undo.
- **Recommended remediation:** Require explicit confirmation naming the application and loss of history;
  cancellation must preserve all records. Test both branches and in-flight-check recovery (AUD-10).
- **Resolution:** Confirm deletion with the application label and explicit irreversible-history warning.
- **Verification:** Browser options case covers cancelled and confirmed deletion; background tests cover
  an application deleted while its check is in progress.

### AUD-14: Session encryption lacks a Lock Now control

- **Severity:** Low. **Status:** Resolved locally.
- **Location:** `src/core/messages.ts:61-64`; `src/entrypoints/shared/encryption-sections.ts:187,194-203`.
- **Evidence:** Lock messaging exists but only disabling encryption calls it. There is no user control
  to end an unlocked session without closing the browser or removing encryption. A successful unlock
  leaves the typed passphrase in its input.
- **Recommended remediation:** Add Lock Now, clear password fields after use, accurately distinguish
  add/edit forms (not retained) from the unlocked session phrase (memory until lock/browser close).
- **Resolution:** Lock Now exists in options and the unlocked popup; explicit lock clears passphrase,
  fills, active run and pending selection. Attempted unlock/encryption input fields are cleared after use.
- **Verification:** Session-state/lock invalidation unit tests pass. An idle timeout remains optional, not
  part of the existing promise. Lock/import intentionally ends an in-flight run; it does not submit it.

### AUD-15: Corrupt or unsupported local data has no recovery UI

- **Severity:** Low. **Status:** Resolved locally.
- **Location:** `src/core/storage.ts:126-155`; `src/entrypoints/options/main.ts:338`, `popup/main.ts:110`.
- **Evidence:** A malformed/newer stored schema rejects initialization, leaving pages blank and preventing
  the normal export path. Stronger import validation does not recover previously corrupt local state.
- **Recommended remediation:** Preserve data; show an error and offer raw export and separately confirmed
  reset, never silently replacing an unsupported store. Add corrupt/newer-schema recovery tests.
- **Resolution:** Shared recovery panel offers raw local JSON download and separately confirmed reset;
  options and popup initialization catches include locale reads, with a safe fallback locale. Unsupported
  data is preserved unless the user explicitly resets; replacement validation does not need to parse the old store.
  Confirmed reset locks and clears session data as well; cancelled reset preserves both local/session data.
- **Verification:** Recovery tests cover raw preservation, newer schema, cancelled reset and confirmed
  reset; popup locale-guard regression is covered by the background/popup tests. No real user store was reset.

### AUD-16: Browser extension archives omit the license text

- **Severity:** High (distribution compliance blocker, not an exploit). **Status:** Resolved locally.
- **Location:** `.output/naciocheck-0.1.0-{chrome,firefox}.zip`; `package.json:17-18`.
- **Evidence:** Both browser archives have 30 files and no LICENSE. The source archive includes the GPL
  text, but object-code packages do not. The declared license is GPL-3.0-or-later.
  Follow-up inspection also found compiled WXT 0.21.5 runtime helpers and the MIT-licensed
  `@wxt-dev/browser` 0.3.7 shim without their required notice. The upstream license at
  `https://raw.githubusercontent.com/wxt-dev/wxt/wxt-v0.21.5/LICENSE` has SHA-256
  `7b0b00fcdbc6a036078aad84d0bc0fae240ac67144b86c911149c2daa37c9f85`.
- **Recommended remediation:** Copy the canonical LICENSE into both production builds/packages and verify
  archive contents; retain the canonical source and appropriate source/license notices.
- **Resolution:** `modules/license.ts` copies canonical GPL and `THIRD-PARTY-NOTICES.txt` (versioned WXT/
  browser MIT text and attribution) into both builds. Source archives retain Nunito's `brand/OFL.txt`;
  no font binary is shipped in the extension. Both built notices are asserted by the privacy gate.
- **Verification:** License/hook/version and negative gate tests pass; fresh Chrome/Firefox builds carry
  byte-identical canonical notices. Both generated browser archives were inspected: each notice exactly
  matches its canonical file. Clean-room source rebuilds reproduce both output directories and the Firefox
  zip byte for byte. Source archives are build inputs, not a full test checkout (WXT excludes unit-test files);
  this limitation is documented, and `.nvmrc` is explicitly included without enabling other hidden files.

### AUD-17: Privacy copy overstates what never leaves the device

- **Severity:** Medium (misleading privacy disclosure). **Status:** Resolved locally.
- **Location:** `README.md:35`; `store/listing.en.md:22,40,64`, `listing.es.md:21,39`;
  `public/_locales/{en,es}/messages.json:6`; `site/{en/,}privacy/index.html` summary/meta text.
- **Evidence:** Absolute "nothing leaves"/"no data sent" claims conflict with the official form query
  sending identifying fields to the sede and loading its CAPTCHA. The detailed policy partially clarifies it.
- **Recommended remediation:** Distinguish locally saved data/no third-party telemetry from the official
  request made when the user checks; apply accurate Spanish and English copy consistently.
- **Resolution:** README, listings, manifest descriptions, in-extension footer and both privacy policies
  distinguish saved local data/no telemetry from the official form/CAPTCHA request.
- **Verification:** Site gate and brand/localization tests pass. Manifest descriptions EN 103/ES 125
  characters and AMO summaries EN 246/ES 250 remain within their documented limits.

### AUD-18: Android claims precede device verification; mobile viewport metadata is missing

- **Severity:** Medium (readiness gap). **Status:** Partially resolved; Android device validation open.
- **Location:** `store/listing.en.md:50`, `listing.es.md:49`; index HTML in
  `src/entrypoints/{onboarding,options,popup,statuses,unlock}/`.
- **Evidence:** Listings claim Android support despite the README recording no device validation. Five
  extension pages omit viewport metadata; result alone includes it.
- **Recommended remediation:** Add consistent viewport metadata and qualify Android as an unverified
  target pending device validation. Keep real device, notifications and popup checks open, not waived.
- **Resolution:** All pages have viewport metadata; listings explicitly qualify Android as a target not
  yet device-verified. No claim of verified support is made.
- **Verification:** Viewport regression tests and desktop/mobile-width Chrome visual matrix pass;
  adding metadata/emulating width cannot establish real Firefox for Android compatibility.

### AUD-19: Privacy checks are incomplete and not part of packaging

- **Severity:** Medium (verification gap; no current forbidden request found). **Status:** Resolved locally.
- **Location:** `scripts/check-privacy.mjs:33,109-140,164`; `scripts/check-site.mjs:30-34`;
  `package.json:17-18`; `README.md:47-48`.
- **Evidence:** The built-code scan excludes CSS/SVG and protocol-relative/non-HTTP transports; manifest
  content-script matches/web-accessible resources are not asserted. Packaging does not run the gate,
  despite copy saying it fails the build. Site protocol-relative URL checking omits anchor href.
- **Recommended remediation:** Expand asset/manifest/URL checks and negative fixtures, run a mandatory
  privacy gate when packaging (or accurately qualify the standalone check), verify both browser outputs.
- **Resolution:** Expanded script/CSS/SVG, protocol, API and manifest checks, canonical notice checks and
  site URL checks with negative tests. Both zip commands now build both browsers and must pass privacy checks.
- **Verification:** Offline privacy/site negative tests pass; fresh built privacy gate reports 54 files,
  exact permissions/host/matches, canonical notices and no forbidden API or URL. Final package command
  verifies the new fail-closed wiring. No remote server or CI service was added.

### AUD-20: Public tagline and font regeneration instructions drifted

- **Severity:** Low. **Status:** Resolved locally.
- **Location:** `site/en/index.html:71`; `tests/brand.test.ts:71`; `README.md:210`,
  `brand/README.md:84`, `scripts/outline-logo.mjs:31`.
- **Evidence:** English site uses the superseded "kept in check" tagline; the regression test omits site
  pages. The documented font download does not happen: the script only reads an ignored local cache,
  so regeneration fails from a fresh clone.
- **Recommended remediation:** Use the settled tagline, extend brand regression coverage and document
  the explicit verified-font preparation requirement (or implement a pinned checksum-verified fetch).
- **Resolution:** Settled tagline restored and site included in brand tests; docs now require explicitly
  preparing the pinned font input rather than falsely promising an automatic download.
- **Verification:** Brand/site tests pass; normal build uses tracked outlined paths, not a font download.

### AUD-21: Remaining platform, live-site and visual acceptance gates are incomplete

- **Severity:** Medium (release-validation blocker, not a demonstrated vulnerability). **Status:** Open, manual.
- **Location:** `docs/manual-firefox-checklist.md` observed/sign-off columns;
  `README.md:15-16,64-65`; `store/screenshots/README.md`; active plan closing/checklist record.
- **Evidence:** Firefox run is partial for real checks, notifications/badge and the toolbar popup;
  Firefox for Android has no device run. Real site/CAPTCHA flows, light/dark toolbar icons, logo review
  and store-image framing still need owner acceptance. The onboarding screenshot crop can end mid-button.
- **Recommended remediation:** Keep these as explicit pre-publication gates for the owner on the final
  candidate. No live-site check, actual applicant-data processing, deployment or store action is performed
  in this audit. Optional follow-up features (feedback channel, further locales/dark theme/donations)
  are not missing MVP components and are not silently added.
- **Verification:** Open; no manual sign-off claimed.

### AUD-22: Export download lifetime is not verified in Firefox

- **Severity:** Informational (unverified compatibility risk). **Status:** Hardened locally; real Firefox download check open.
- **Location:** `src/entrypoints/shared/encryption-sections.ts:274-281`.
- **Evidence:** The detached anchor is clicked and its blob URL revoked synchronously. This may race
  Firefox download handling; existing browser tests stub the download and do not demonstrate a failure.
- **Recommended remediation:** Attach the anchor for its click and defer revocation; include an actual
  export/import file round-trip in Firefox manual validation. Do not call this a demonstrated data-loss bug.
- **Resolution:** Attach the anchor for its click and defer object-URL revocation by one second.
- **Verification:** Export warning/blob regression passes; manual checklist now requires actual downloaded
  file import/round-trip on the remediated Firefox package. This was never a demonstrated Firefox failure.

### AUD-23: Permission rationale and public maintenance notes need precision

- **Severity:** Low. **Status:** Resolved locally; floating-browser risk explicitly retained.
- **Location:** `store/permissions.md:18,41-43`; `src/entrypoints/content.ts:30`;
  `wxt.config.ts:31`; `src/core/storage.ts:27`; `docs/manual-firefox-checklist.md:3`;
  `store/REQUIREMENTS.md:49`; `e2e/wdio.conf.ts:86-87`.
- **Evidence:** Content scripts match the settled eConsultas subtree, broader than the rationale's
  "only nationality page" wording. Some public notes refer to completed local-only plan phases.
  Visual E2E uses floating Chrome `stable`, so rendering may change without a source change.
- **Recommended remediation:** Describe the actual settled host scope accurately, remove misleading
  future-tense phase references and document the floating-browser reproducibility limitation. Do not
  narrow permissions or pin a different browser without validating real result URLs/baseline policy.
- **Resolution:** Corrected permission rationale and stale public/source future-tense phase notes; README
  records the unpinned `stable` browser risk. The manual checklist preserves old observations but marks the
  audit candidate as requiring a new full run, not inheriting the old package's sign-off.
- **Verification:** Doc/source review and quality gates pass. No permission scope or browser version was
  silently changed; future rendering drift may still require reviewed baseline updates.

### AUD-24: Save completion is not guarded in the form/test harness

- **Severity:** Low. **Status:** Resolved locally.
- **Location:** Baseline `e2e/support/seed.ts:130-133`;
  `src/entrypoints/shared/application-form.ts:185-243`.
- **Evidence:** The E2E helper refreshes immediately after clicking Save, which can cancel the newly
  serialized asynchronous transaction before commit. The first post-fix E2E attempt exposed repeated
  missing-application assertions. Form storage failures were unhandled and repeated submissions could
  create duplicate applications.
- **Remediation:** Wait for the actual saved-label confirmation before refreshing in E2E. Disable Save
  while pending, restore it in finally and show a recoverable write error rather than an unhandled
  rejection. Preserve inputs except the attempted passphrase after an error.
- **Verification:** Two new form regressions cover storage rejection/no partial write and duplicate
  submission suppression. Parent-owned form/encryption/import suites: 33 tests passed on Node 24.22.1;
  the subsequent browser check-flow and page specs pass with confirmed asynchronous saves.

## Independent remediation review

A separate read-only review caught four gaps after the initial unit-green fixes; these were kept open
rather than treating the first passing run as release evidence:

- AUD-15: popup locale initialization read corrupt storage before the recovery guard.
- AUD-11: latest-only badge/revisit derivation lost an older unacknowledged change after an unchanged/error check.
- AUD-08: a nonempty but malformed encrypted envelope could still replace valid data before unlock failed.
- AUD-09: one global pending selection could be overwritten by a second unlock request.

The follow-up review also found that an old unlock page could start every application after Lock Now or
import cancelled its remembered selection. AUD-09's final guard now requires a nonempty explicit selection;
locking invalidates/closes the prompt and a generation guard invalidates in-progress unlock attempts.
Five further runtime regressions cover that path; full unit verification is now 461 passing tests.

Follow-up fixes and targeted regressions pass. The second read-only review closed the first four gaps and
identified the stale-prompt path above; it did not claim final approval. An initial integrated E2E attempt
was stopped after exposing AUD-24, not reported as passing.
A subsequent run had one new test-harness failure (the storage helper navigates its shared context and
cleared the passphrase before the second disable attempt) plus three expected visual mismatches; the test
now refills the field and synthetic baselines were regenerated after visual inspection. Neither failed run
is used as passing release evidence. No external requests escaped their fake-site guards.

The new cancelled-prompt E2E test initially used a strict selector matching both application buttons;
it was corrected to explicitly select the first. The final complete run passes **68/68 cases, 4/4 specs**,
including that case. Fourteen synthetic baseline PNGs changed for the intended captcha escape control,
popup revisit controls and full-page backup/disclosure content. The ten store screenshots remain byte-
identical to their corresponding baseline sources; the deferred image-framing decision is not waived.

## History and privacy evidence

The repository is not shallow: **53 commits, 265 tracked files and 688 unique reachable blobs** across
`refs/heads/main` and `refs/remotes/origin/main`, both at the baseline. There are no tags, notes, replace
refs, submodules or LFS pointers. `git fsck --unreachable --no-reflogs` found no dangling/unreachable
objects; reflog commits were already reachable. Remote refs were not fetched, so server-only branches,
forks, caches and historical remote state are outside this inspection.

Installed gitleaks 8.30.1 was used with default rules, no suppressions and redaction:

```sh
gitleaks git --log-opts="--all" --redact --report-format json --report-path /tmp/kilo/naciocheck-scan/gitleaks-git-all.json --no-banner --log-level warn .
gitleaks dir --max-archive-depth 3 --redact --report-format json --report-path /tmp/kilo/naciocheck-scan/gl-output-archives.json --no-banner --log-level error --max-target-megabytes 20 .output
git rev-parse --is-shallow-repository
git rev-list --all --count
git fsck --unreachable --no-reflogs
```

- Git history: **zero gitleaks findings**; built/source archives: **zero findings**.
- Pattern review of every text blob covered Spanish identifiers, labeled birthdates/names, email/home
  paths, private-key markers and common credential/token shapes. Tracked applicant-shaped matches are
  documented synthetic fixtures/placeholders. Seven distinct tracked NIE-shaped examples were found;
  no real applicant identity or credential was identified. This is not proof that every free-form name
  or unlabeled number is synthetic. The only tracked email-shaped string is the functional gecko ID.
- All 325 historical binary blobs are PNGs; chunk inspection found no text or EXIF metadata. Current
  files comprise 100 visual baselines and 15 store PNGs. All 10 store screenshots byte-match synthetic
  E2E baselines. Two baselines were visually sampled; no OCR tool was available, so all historical pixel
  content was not exhaustively read. Fixture provenance mitigates but does not eliminate this limitation.
- Existing source archive: 219 entries, 6,360,234 bytes; no `.ai`, `.git`, `.claude`, `.vscode`,
  `e2e/.artifacts`, `node_modules`, `.output`, `.wrangler` or `.cache` entries. Final archives must be rescanned.
- Scan scripts and redacted machine-readable evidence are local temporary files under
  `/tmp/kilo/naciocheck-scan/`; they are not release artifacts or durable dependencies of this report.

## Verification log

Commands executed on 2026-11-18, before remediation:

| Command                                                                           | Result                                                                                                                                                          |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short`                                                              | No output; initially clean.                                                                                                                                     |
| `git rev-parse HEAD`                                                              | `cf6161282fc745e3364c928d01150d38f90444a1`                                                                                                                      |
| `node --version && npm --version`                                                 | `v24.22.0`, `11.19.1`                                                                                                                                           |
| `npm test`                                                                        | 19 files, 317 tests passed.                                                                                                                                     |
| `npm run lint && npm run typecheck && npm run format:check && npm run check:site` | Passed; 4 site pages, no scripts/external references.                                                                                                           |
| `npm run build:chrome && npm run build:firefox && npm run check:privacy`          | Passed; 44 built files, exactly storage/alarms/notifications, only sede host, no forbidden APIs/unlisted URLs.                                                  |
| `npm audit --json`                                                                | Exit 1; 24 moderate package entries, two underlying advisories.                                                                                                 |
| `npm audit --omit=dev --json`                                                     | Exit 0; zero vulnerabilities.                                                                                                                                   |
| `npm audit fix --dry-run --ignore-scripts --json`                                 | Preview only; compatible lint updates available; engine mismatch warnings.                                                                                      |
| `npm run test:e2e`                                                                | Passed: 11 check-flow, 33 page, 2 smoke, 20 visual tests on cached Chrome 158.0.8127.36; 4/4 specs; guards seen 571/376/0/834, outside it 0 in all specs.       |
| `npm exec --yes --package=node@24.22.1 -- node --version`                         | `v24.22.1`; an isolated npm-cache runtime is available without changing the global Node installation.                                                           |
| `npm audit signatures`                                                            | Exit 0: 665 packages have verified registry signatures, 208 verified attestations. Signatures establish registry provenance, not absence of malicious behavior. |

### Final verification

All final npm commands used the prefix `npm exec --yes --package=node@24.22.1 -- `, followed by the exact
command in this table, rather than the older global Node. No `npm audit fix --force` was used.

| Command                                 | Result                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                | Clean install: 661 packages; WXT types prepared; zero audit findings and no engine mismatch.                                        |
| `npm audit --json`                      | Zero vulnerabilities, production and development.                                                                                   |
| `npm audit signatures`                  | 661 registry signatures and 210 attestations verified.                                                                              |
| `npm run lint`                          | Passed.                                                                                                                             |
| `npm run typecheck`                     | Passed both application and E2E TypeScript projects.                                                                                |
| `npm test`                              | 25 files, **461 tests passed** (baseline 317).                                                                                      |
| `npm run format:check`                  | Passed after final documentation formatting.                                                                                        |
| `npm run check:site`                    | Passed: 4 pages; no scripts/external resources or links.                                                                            |
| `npm run test:e2e:update-baselines`     | Generated the complete synthetic matrix; 20 visual scenarios pass; only 14 tracked PNGs differ.                                     |
| `npm run test:e2e`                      | Final complete run: **13 check-flow + 33 pages + 2 smoke + 20 visual = 68 passed**, 4/4 specs, Chrome 158.0.8127.36.                |
| `npm run zip` and `npm run zip:sources` | Both passed, including mandatory post-build privacy gates. Local 0.1.0 audit artifacts only.                                        |
| `npm run check:privacy`                 | 54 scanned files; exact permissions/host/content-script match; canonical GPL/MIT notices; no forbidden APIs/URLs.                   |
| `npm run store:images`                  | Regenerated deterministic icons/promo tiles; tracked outputs unchanged. Ten screenshots still hash-match their synthetic baselines. |

Final E2E network guard: seen **622/375/0/834**, fake-site answers **621/375/0/834**, outside guard
**0/0/0/0**. The first spec deliberately tests an unmapped host; that one attempt is blocked rather than
answered by the fake site. The human's real CAPTCHA was never automated. Existing warnings remain:
WebdriverIO visual-service `saveAboveTolerance` deprecation and a successful BiDi-to-classic stale-node
fallback. They did not fail assertions; floating `stable` browser reproducibility remains AUD-23's limitation.
Clean npm installs also warn about deprecated `whatwg-encoding` and four not-yet-approved install scripts;
no allowlist approval was added, and all required builds/tests succeed without it.

Additional exact verification commands and results:

```sh
# Each comparison exited 0: canonical notice contents inside the actual browser archives.
unzip -p .output/naciocheck-0.1.0-chrome.zip LICENSE | cmp LICENSE -
unzip -p .output/naciocheck-0.1.0-chrome.zip THIRD-PARTY-NOTICES.txt | cmp THIRD-PARTY-NOTICES.txt -
unzip -p .output/naciocheck-0.1.0-firefox.zip LICENSE | cmp LICENSE -
unzip -p .output/naciocheck-0.1.0-firefox.zip THIRD-PARTY-NOTICES.txt | cmp THIRD-PARTY-NOTICES.txt -

# Archive scanner exited 0, JSON report [] (no secret findings).
gitleaks dir --redact --max-archive-depth 3 --max-target-megabytes 20 --report-format json --report-path /tmp/kilo/naciocheck-scan/final-archives.json --no-banner --log-level warn .output

# Source archive: 227 entries; only explicitly permitted .nvmrc adds a hidden source file.
unzip -p .output/naciocheck-0.1.0-sources.zip .nvmrc
# 24.22.1
unzip -q .output/naciocheck-0.1.0-sources.zip -d /tmp/kilo/naciocheck-audit-rebuild
```

In that newly extracted directory, ran `npm ci`, `npm run build:chrome`, `npm run build:firefox`,
`npm run check:privacy` and `npx wxt zip -b firefox`, each with the Node 24.22.1 prefix above: all exited 0.
`diff -qr` compared each original build directory with the corresponding clean-room directory: no output,
exit 0. `cmp .output/naciocheck-0.1.0-firefox.zip /tmp/kilo/naciocheck-audit-rebuild/.output/naciocheck-0.1.0-firefox.zip`
also exited 0. No local font cache, private plans, existing node_modules or generated WXT state was needed.

## Limitations and remaining gates

- **Owner consent:** AUD-04's maintainer name/email in history remains intact. No identity rewrite is authorized.
- **Platform acceptance:** AUD-18/21 require the new Firefox desktop and Android candidate runs, including
  actual toolbar popup, badge/notifications, Web Locks, unlock/encrypted edits and real downloaded backup.
  No Firefox browser was driven in this audit; viewport-width emulation is not an Android device test.
- **Official-site behavior:** No live-sede check, real applicant-data flow, or human CAPTCHA session was run.
  Current DOM, CSP and official-site behavior must be owner-checked, without automatic real-site traffic.
- **Landing site (added 2026-11-24):** from `specs/2026-11-23-landing-page/`, still open at release: the owner
  reviews the Catalan wording on every Catalan page (phrases listed in that spec's `progress.md`); after
  `npm run deploy:site`, the pages render correctly in Chrome and Firefox (`docs/manual-firefox-checklist.md`
  row 17); the store URLs and repository visibility are set in `site/_build/config.json` once they exist; the
  `vgr.cat` links are finalised with `vgr-dev/vgr.cat` `specs/2026-11-23-naciocheck-tie-in/`; 108 axe
  colour-contrast elements over the hero gradient and the language pill get a manual AA look
  (`e2e/.artifacts/axe-incomplete.json`).
- **Site analytics (added 2026-11-23, resolved the same day):** Cloudflare Web Analytics is injected at the
  edge into every page of `naciocheck.vgr.cat`. The owner keeps it on; the privacy pages (es, en) and README
  now disclose it and state that it applies to the website only, not the extension (ADR 0005).
- **Visual/legal/publication acceptance:** Logo/toolbar/icon and store-image framing decisions remain the
  owner's; source/license checks are engineering evidence, not legal advice or publication approval.
- **Detection scope:** Pattern-based scans can miss unlabeled names/identifiers; PNGs were metadata-scanned
  and sampled, not exhaustively OCRed. Remote-only refs/forks, external browser profiles and node_modules
  secrets were not exhaustively searched. No claim of absolute absence of vulnerabilities or personal data.
- **Recovery and encryption:** Unsupported records fail closed with a recovery UI. Encrypted imports are
  structurally validated, not authenticated without a passphrase. Explicit lock/import/reset cancels an
  active run; future checks must be started intentionally. Firefox locking behavior remains manual.
- **Not performed:** Version bump, tag/release, deployment, store upload, repository visibility change,
  history rewrite, staging, commit or push. The project remains **0.1.0** and **not cleared for v1.0.0 publication**.

## Proposed commits

For the owner to review and split; nothing was staged or committed:

- `fix: harden storage, imports and check-run lifecycle before release`
- `build: patch tooling and enforce privacy and license packaging gates`
- `docs: record pre-release audit and outstanding manual acceptance gates`
