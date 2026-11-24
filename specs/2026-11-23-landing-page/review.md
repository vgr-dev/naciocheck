# Review: A product landing page for naciocheck.vgr.cat

## 2026-11-24 - Final review (reviewer, after the autonomous run)

**Verdict: PASS WITH CHANGES**

Scope reviewed: commits `d704021..9172a97` (steps 1 to 9; `43a3c42` and `21c1788` belong to the share-progress
spec), plus the uncommitted tree (steps 10 to 14 and the orchestrator's visual-mask fix). I read the code, the
pages and the tests directly, and probed the gate with crafted input.

Every repo command passes. The privacy pages are accurate and consistent in es, en and ca. No page carries
JavaScript outside the feedback pages, the E2E guard stays at 0, axe runs and finds nothing, and the extension
baselines are unchanged. Nothing blocks the commit of steps 10 to 14. The changes asked for are a hardening
follow-up for the gate and an owner decision on two sentences in the privacy policy.

### Critical

None.

### Medium

1. **The site gate can be evaded by URL spellings it does not normalise** (`scripts/check-site.mjs:105`,
   `FORBIDDEN`, and `withoutAllowedAddresses` at :170). `pageProblems` returns no problem for each of these
   (checked with a probe script):
   - `srcset="/a.png 1x, //evil.example/b.png 2x"` (only the first candidate is checked);
   - `src="https:evil.example/x.png"` (browsers read it as `https://evil.example/`);
   - `src="\\evil.example/x.png"` and `src="/\evil.example/x.png"` (backslashes become slashes);
   - `src=" //evil.example/x.png"` (leading whitespace);
   - `src="&#47;&#47;evil.example/x.png"` (character references);
   - CSS `url("\2f\2f evil.example/x.png")` (CSS escapes);
   - `<meta http-equiv="refresh" content="0;url=//evil.example/">`.

   The FORBIDDEN rules predate this spec, and no current page uses any of these spellings, so nothing leaks
   today. But this spec added images and `srcset` to the site, and its criterion reads "fails on any remote
   resource". The SVG rules already refuse `&#` and `\`; the HTML rules should match. Suggested hardening, for
   the builder: check every `srcset` candidate, refuse `&#`, `\` and leading whitespace in URL attributes,
   refuse a scheme with no `//`, refuse CSS escapes inside `url()` and refuse `http-equiv="refresh"`. Add a test
   for each case. `README.md:179` ("`npm run check:site` fails on anything else") overclaims until then.

2. **The privacy policy names a repository and store listings that do not exist yet** (es
   `site/privacy/index.html:168-180`, en `site/en/privacy/index.html:162-173`, ca
   `site/ca/privacy/index.html:164-175`). "The project's history is in the repository" and "write on the
   listing … or open an issue in the repository (github.com/vgr-dev/naciocheck)" cannot be acted on while
   `repositoryPublic` is `false` and both store URLs are `null`. That undercuts the "repository visibility and
   store URLs in one place" contract. The es and en wording predates this spec, and step 8 had to translate it
   faithfully, so this is the owner's call, not a builder fix. Options:
   - put the sentence inside `@if repository` and give a contact that works now (the feedback page);
   - or accept it as is, because the policy only matters once the extension is published.

### Low

3. `package.json:37`: `deploy:site` builds and deploys without running the gate. Suggest
   `npm run check:site && wrangler deploy`. It matches the plan's contract, so this is a suggestion.
4. `scripts/build-site.mjs:287`: the English changelog page also shows "The release notes are written in
   English." Plan step 9 asked for the note on es and ca only.
5. Unused screenshots ship: `img/screens/{es,en}/onboarding-empty-*` and `options-encrypted-*`, 8 files no page
   references (step 4's delegated decision, see below).
6. Landing privacy card, "the only request is the check you send to the official site" (`site/index.html:231`,
   `site/en/index.html:235`, `site/ca/index.html:238`): true of the extension's own requests. The privacy page
   is more precise (the sede page also loads reCAPTCHA; "report a problem" opens the website). Acceptable as
   marketing wording, and noted for the owner.
7. `e2e/specs/site.e2e.ts` `runAxe`: only `violations` are asserted. axe reports contrast it cannot compute
   (text over gradients or images) as `incomplete`, which is not checked. The unit contrast test covers the
   tokens, so this is low risk.
8. `specs/2026-11-23-landing-page/progress.md` is untracked: nine step commits landed without it. It should go
   in with the step 10 to 14 commits.
9. Brand tints outside the four documented teals (`#f0fdfa`, `#ccfbf1`, `#99f6e4`, `#115e59`, `#134e4a`,
   `#042f2e` in `site/_build/partials/base.css`). This is already recorded as the owner's call. Either record
   them in `brand/README.md` or keep them.
10. Desktop hero: the `result-changed` screenshot is too small to read at 30rem and repeats in step 3. This is
    already listed as Low for the owner.

### Delegated decisions ("Decided by Claude (delegated)")

| Decision                                                                                               | Assessment                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1: ADR 0005 amendment accepted by Claude                                                              | **The content is sound** and matches the spec and plan. The acceptance itself is a governance act: AGENTS.md lists ADR changes under "ask first". The owner committed `d704021`, which reads as consent. The owner should change the status line to their own acceptance (`docs/adr/0005-distribution-and-public-pages.md:73`). |
| Step 2: PNG, WebP and ICO checked by magic number; extra SVG refusals; exact `rel` values              | Agree. These are stricter than the plan.                                                                                                                                                                                                                                                                                        |
| Step 2: `lang` checked against the directory, deferred to step 10                                      | Agree. It is done (`check-site.mjs`, `pageProblems`).                                                                                                                                                                                                                                                                           |
| Step 3: `<article lang="en">`, strict parser, ISO dates                                                | Agree.                                                                                                                                                                                                                                                                                                                          |
| Step 4: ship all five screenshots, not only the three Q3 maps                                          | **Mild disagreement.** Two are unused in both languages (Low 5). Ship only the referenced files, or use them.                                                                                                                                                                                                                   |
| Step 5: the 404 has no canonical, hreflang or OG tags; `@changelog` emits the note; no nested `@if`    | Agree. Caveat: the en note (Low 4).                                                                                                                                                                                                                                                                                             |
| Step 6: feedback pages keep a small nav; per-page skip link; shared footers                            | Agree.                                                                                                                                                                                                                                                                                                                          |
| Step 6/10: internal-link check added to the gate                                                       | Agree. Useful, and tested.                                                                                                                                                                                                                                                                                                      |
| Step 7: no lazy loading; hero icon hidden below 52rem; state names in Spanish                          | Agree. The state names are the sede's literal text.                                                                                                                                                                                                                                                                             |
| Step 7: FAQ corrected to "Firefox for Android is a target not yet verified" (es, en, ca)               | Agree. Verified on all three pages.                                                                                                                                                                                                                                                                                             |
| Step 8: Catalan section anchors                                                                        | Agree.                                                                                                                                                                                                                                                                                                                          |
| Step 9: `noindex` on 404s                                                                              | Agree.                                                                                                                                                                                                                                                                                                                          |
| Step 10: lang/directory and internal-link checks, beyond the step's scope                              | Agree. Coverage is kept through the fixture wrapper, and `check-site.d.mts` is updated.                                                                                                                                                                                                                                         |
| Step 12: add step 14 for the Medium and the cheap Lows; leave the red alert and the tints to the owner | Agree. The plan was amended properly.                                                                                                                                                                                                                                                                                           |
| Step 14: logo cropped by CSS with the animated icon as its badge; `result-changed` as desktop hero art | Agree with the badge: `brand/README.md` names the website hero as a use of the animated icon, and nothing is redrawn or recoloured. The hero art is acceptable (Low 10).                                                                                                                                                        |

### Focus checks

- **Privacy and honesty.** es, en and ca state the same things: Turnstile on the feedback pages; Cloudflare Web
  Analytics on the website only ("the extension never loads it and sends nothing"); the extension sends nothing
  by itself; optional encryption. The non-affiliation line is in every footer and in the hero facts. The status
  teaser carries "Orientativo, no oficial" / its equivalent, and its text matches `src/core/statuses.ts`.
  Firefox for Android is described as unverified. The install buttons are non-link "coming soon" spans. Medium
  2 is the one exception.
- **Gate.**
  - Outbound list: the exact prefixes, exact LinkedIn, the repository and its subpaths only. `vgr.cat@evil` is
    refused.
  - Own origin: only in canonical, alternate and og/twitter metadata.
  - Internal links: resolve.
  - `lang`: matches the directory.
  - Parity and required pages: 15.
  - SVG rules and magic numbers: in place.
  - Evasions: Medium 1.
- **Build.**
  - No network module is imported (fs, path and sharp only).
  - Unknown markers, arguments, conditions, nesting and stray `@endif` all throw.
  - `_build/` is filtered from the copy, and `outDir` inside the source is refused.
  - Store URLs are prefix-validated and escaped.
  - `site/_build/config.json` is the one place for store URLs and repository visibility.
- **Quality.**
  - No `<script>` outside the feedback pages, checked by the gate and by `tests/site-landing.test.ts`.
  - Reduced motion: the agency animation runs only under `no-preference`, and `brand/icon-animated.svg`
    stops under `reduce`.
  - Tokens only in `landing.css`; system font stack; no remote fonts.
  - The Catalan landing has the same section ids, 7 states and 5 FAQ items.
  - The 412 px dark Catalan baseline looks right.
- **Tests.**
  - E2E: the site host is mapped and the server reports any other Host to the guard. The guard is
    `outside it 0` in all 5 workers.
  - axe runs in both schemes, with a passes > 10 sanity check.
  - Baselines: 152 (104 extension + 48 `site-*`). No extension baseline differs from HEAD; the only extension
    baseline changes since `ba56464` are in `43a3c42`, the previous spec.
- **Plan status vs git.** Steps 1 to 9 carry hashes that exist and match their commits. Steps 10 to 14 are
  `uncommitted`, which matches the working tree. No stale line; no fix needed.

### Scope check

- Every changed file is in a step's Files list, or explained in progress.md: `check-site.d.mts` (step 10) and
  the visual mask fix (pre-existing midnight flake, a legitimate test fix).
- Untouched: `src/` (apart from `43a3c42`, the previous spec), the manifest, `scripts/allowed-urls.json`,
  `worker/`, `brand/`, `store/`, `tests/fixtures/`, and the other ADRs.
- `feedback.js` changed only to add the Catalan texts.
- The `axe-core` dev dependency was approved at G2.

### Commands run

| Command                                         | Result                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `npm test`                                      | pass: 37 files, 1139 tests; worker 2 files, 31 tests                     |
| `npm run lint`                                  | pass                                                                     |
| `npm run format:check`                          | pass                                                                     |
| `npm run typecheck`                             | pass (root, e2e, worker)                                                 |
| `npm run check:site`                            | pass: built 15 pages and 27 generated files; gate passed                 |
| `npm run build:chrome && npm run build:firefox` | pass                                                                     |
| `npm run check:privacy`                         | pass (one host, notices present, no forbidden APIs, URLs allowed)        |
| `npm run test:e2e`                              | pass: 13, 41, 55, 2 and 22 passing; guard `outside it 0` in every worker |
| Gate probe (`pageProblems` on crafted pages)    | 7 evasions accepted (Medium 1)                                           |

Mechanical fixes applied: none needed.

### Next action

1. The owner commits steps 10 to 14, with `progress.md` and this review.
2. The owner decides on Medium 2 and on the ADR status line.
3. A small follow-up hardens the gate (Medium 1) and picks up Lows 3 to 5.
4. The spec stays `active`: the post-deploy criterion and the owner's review of the Catalan wording are still
   open.

### Manual smoke test

```sh
npm run dev:site
```

Then open `http://localhost:8787/`, `/en/` and `/ca/` in Chrome and in Firefox:

- switch languages from the header;
- toggle the OS dark mode;
- enable "reduce motion" and check that the agency rings and the hero icon stop;
- open `/ca/nope` and expect the Catalan 404;
- open `/ca/privacy/` and read the Turnstile and Web Analytics paragraphs.

DevTools Network should show only `localhost` requests on every page except `/feedback/`.

## Follow-up — 2026-11-24

Medium 1 and three Lows (deploy without the gate, the English changelog note, unused screenshots) are fixed in
step 15; see `progress.md`. Medium 2 and the ADR status line are the owner's decisions.

## 2026-11-24 — Independent review after step 15

**Verdict: FAIL.** The current build runs locally. Two explicit acceptance criteria and one
repository brand requirement remain open.

### Findings

1. **High — The HTML gate misses inline event handlers.** `scripts/check-site.mjs:113` rejects
   script elements and the normalized attribute check at line 284 checks URLs, style and refresh.
   Neither checks HTML event attributes. An offline check against the built landing page confirmed
   that the gate accepts an empty `onload` attribute. The site currently carries no such handlers,
   but the gate does not enforce the spec's ban on scripts outside feedback. Reject event attributes
   in HTML and add regression coverage, keeping the two approved feedback script tags.
2. **Medium — All three 404 pages lack head-level language alternates.**
   `scripts/build-site.mjs:139` skips the alternates for 404 pages, and `tests/build-site.test.ts:195`
   explicitly expects that behavior. The language switcher works as
   specified in step 9 and takes visitors to localized home pages. The acceptance criterion in
   `spec.md:96` and the ADR decision still require `hreflang` alternates on these pages.
   Align the build and the requirement, and test the chosen behavior.
3. **Medium — The site distributes outlined logos without the required Nunito notice.**
   `scripts/site-assets.mjs:102` copies both wordmarks into `img/`. The output lacks
   `brand/OFL.txt`, which `brand/README.md:106` requires next to outlined copies. The current gate
   also rejects text assets, so the signed-off allowlist and the brand requirement need to be
   reconciled before release.
4. **Medium — The privacy contact instructions still point to unavailable channels.**
   All three privacy pages name a store listing and repository issues as contact routes, while
   `site/_build/config.json` still has both store URLs unset and `repositoryPublic` false. This is
   the existing owner decision from the prior review. The locale-specific feedback pages already
   provide a route that can be used before the store listings are available.
5. **Low — The axe report omits checks that require human review.** `e2e/specs/site.e2e.ts` returns
   `passes` and `violations` only. Token contrast tests complement the axe run. Where axe returns
   `incomplete` for text over a gradient or image, the suite provides no record of the affected
   elements for a manual AA check.

### Scope and acceptance

- Inspected steps 1–15, including the untracked E2E files and 48 site baselines. The landing build
  changes leave extension code, manifest, permissions, Worker, allowed URLs, test fixtures and
  existing extension baselines untouched. The feedback script's functional changes are limited to
  Catalan strings and language selection.
- All 15 pages build with a language switcher. The 12 non-error pages emit four head alternate links
  and an Open Graph image. Parity, install placeholders and their config, changelog parsing and
  rendering, the three landing layouts, and the Catalan website-only analytics disclosure are covered
  by the build or repository checks. Q6 leaves feedback out of Chrome visual and axe coverage.
- Inspected all 48 site baselines as contact sheets across three languages, two widths and both
  themes. The mobile agency artwork fits below the copy, and no new clipping, overlap or official
  visual treatment was apparent at the reviewed sizes. The existing desktop hero screenshot is
  reused under “how it works” (for example, `e2e/baselines/chrome/site-landing-light-en-full1280.png`).
  The recorded font setup matches this host (835 fonts and DejaVu Sans
  Book for both system and sans-serif). RTL was a source check only, with no site RTL rendering.
  The outlined wordmark uses an explicit left-to-right crop. Static images leave focus, animation
  and final contrast judgments outside this visual review.
- The plan hashes for steps 1–9 resolve and the rest of the implementation is in the working tree.
  Steps 5 and 15 are marked done, but their metadata and gate behavior leave acceptance gaps as
  described above. The earlier review and follow-up remain part of the record.
- Owner checks remain open for Catalan copy, the ADR acceptance line, and deployed behavior in
  Chrome and Firefox. The spec stays active.

### Verification

- `npm test` passed (1,188 application tests and 31 Worker tests). The initial sandbox run could
  not bind loopback. The retry with local test access passed.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `git diff --check 21c1788`,
  `npm run check:site` and `npm run check:privacy` passed.
- Chrome E2E passed across two runs. `npm run test:e2e` rebuilt both extensions and passed
  check-flow, pages, site (including axe) and smoke before the process was terminated during the
  visual spec. `E2E_SPEC=visual npm run test:e2e` passed all 22 visual tests. The screenshot index
  reports 152 comparisons and zero above tolerance. All five completed workers reported zero
  unexpected requests.
- Local Wrangler served all three landing pages, the ICO and the social PNG with HTTP 200,
  and the correct localized body with HTTP 404 for a missing path under each locale. A nested
  Catalan path also returned the Catalan 404. The 1200 × 630 social card opened successfully.
  [Cloudflare local development documentation](https://developers.cloudflare.com/workers/local-development/)

### Manual smoke test

Run `npm run dev:site`. In Chrome and Firefox, open `http://localhost:8787/ca/`, tab through
the language switcher and FAQ, and switch to English from the privacy page. Open
`http://localhost:8787/ca/missing` and use the 404 recovery links. Toggle the system color
scheme and reduced motion, then reload the landing page to check the icon and agency animation.

### Follow-up — 2026-11-24

All five findings are addressed in step 16 (see `progress.md`): event attributes refused by the gate, the 404
alternates exempted in the spec and ADR 0005, `img/OFL.txt` shipped and gated, the privacy contact pointed at the
feedback page, and axe `incomplete` results recorded (108 colour-contrast elements over the hero gradient and the
language pill, left for a manual AA check).

## 2026-11-24 — Independent recheck of step 16

**Verdict: PASS WITH CHANGES.** The five earlier findings are addressed in the implementation.
One documentation discrepancy remains for owner sign-off.

- **Low — ADR 0005 still omits the licence exception.** Its Consequences section
  (`docs/adr/0005-distribution-and-public-pages.md:115`) limits the allowed asset types to images.
  Step 16 adds exactly one text asset, `img/OFL.txt`. Explicitly record that path and the requirement
  to serve it with the outlined logos when confirming the 404 amendment. The output already contains
  the correct licence.
- The gate rejected an empty HTML event attribute on each of the 15 generated pages in an offline
  check. The generated pages themselves passed, including the three feedback pages with their approved
  scripts. The built licence matches `brand/OFL.txt` byte for byte.
- The 12 non-error pages emit four head alternates each. The three localized 404 pages use
  `noindex` and their switchers link to the language home pages, matching the amended spec.
- Each built privacy contact section links to its localized feedback form. An isolated build with
  `repositoryPublic` enabled verified that the repository wording follows that option in all three
  languages. The store wording is conditional on publication.
- Source-pair contrast for the elements axe could not assess clears the 4.5:1 AA text threshold.
  Using the conservative RGB channel bounds of the hero gradient gives minimum ratios of
  7.25:1 in light and 7.33:1 in dark. The language switcher's default, current and hovered text
  pairs are at least 7.56:1 in light and 7.74:1 in dark.
- Reviewed the contact section in all 12 updated privacy baselines at desktop and phone widths
  in both themes. The links and updated paragraphs fit in all three languages. The working-tree
  diff touches only those 12 baseline images. The extension, Worker, permissions and dependencies
  are outside the step 16 diff.

### Verification

- `npm test` passed (1,388 application tests and 31 Worker tests).
- Lint, typecheck, formatting, `git diff --check`, the site gate (15 pages and 20 generated files)
  and the extension privacy gate passed.
- The full `npm run test:e2e` run passed all five Chrome specs and 133 tests, with zero unexpected
  requests in every worker and zero of 152 screenshot comparisons above tolerance. Axe reported
  zero violations across 24 audits. Its fresh JSON report records 72 language-switcher targets
  and 36 hero text targets under `color-contrast`, covered by the manual source check above.

### Manual smoke test

Run `npm run dev:site`. In Chrome and Firefox, open `http://localhost:8787/ca/privacy/#contacte`
and follow the contact link to the Catalan feedback form. Open `http://localhost:8787/ca/missing`
and check the language recovery links. The spec stays active pending owner confirmation of the ADR
amendment, Catalan wording review and the post-deploy Chrome and Firefox check.
