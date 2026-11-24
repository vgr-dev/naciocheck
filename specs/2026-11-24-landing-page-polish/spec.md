---
status: active # draft | active | done | abandoned
created: 2026-11-24
status-date: 2026-11-24
---

# NacioCheck landing page polish

## Goal

Make the Spanish, English and Catalan landing pages feel visually cohesive in both themes,
fix the FAQ icons, and help visitors understand the reminder → captcha → result flow at a glance.

## Scope

- Polish every visible part of the landing page in light and dark mode, from the header and
  language selector through the hero, install controls, product screenshots, status guide, privacy cards,
  FAQ, agency section and footer. Refine colour, typography, spacing, alignment, borders, icons
  and interactive states where needed. Reorder sections or replace existing UI blocks where
  the change helps visitors understand the product, find installation options or answer
  common questions.
- Centre the plus and minus in each FAQ control. Retain native disclosure behaviour.
- Give the existing product captures a consistent visual treatment around the authentic UI.
- Show an authentic, localized product screenshot in the hero at desktop and phone widths.
  Use additional static captures alongside the steps where they clarify the product. Explain
  the reminder, the human captcha step and the result in text.
- Add a localized Light, Dark and Auto control to the landing, privacy, feedback, changelog and
  404 pages in all three languages. Auto is the default and follows the system. Save the
  selection locally and apply it across reloads, languages and pages.
- Record the owner-approved exception to ADR 0005 for one small same-origin theme script and
  update the site gate to enforce that exception.
- During planning, evaluate Tailwind or another build-time styling tool alongside the existing
  CSS. Use maintainability, consistency across locales and themes, and generated CSS size to
  inform the choice.

## Non-goals

- Extension features, extension theme settings, store listings and release or deployment work.
- Rebranding or changing site copy beyond the labels and descriptive text needed for the refresh.
- Feedback submission, privacy policy and changelog content changes.
- Video, animated walkthroughs and playback controls.

## Relevant files

- `site/index.html`, `site/en/index.html` and `site/ca/index.html` contain the localized hero,
  product captures and FAQ markup.
- `site/_build/partials/base.css` defines shared theme tokens and system scheme behaviour.
  `site/_build/partials/landing.css` covers the landing palette, screenshot frames and FAQ.
- `site/_build/strings.json` and `scripts/build-site.mjs` provide localized shared page elements.
- `scripts/site-assets.mjs`, `store/screenshots/` and `brand/README.md` govern the source and
  generated display assets.
- `docs/adr/0005-distribution-and-public-pages.md` and `scripts/check-site.mjs` define the
  site's script and asset rules.
- `tests/site-contrast.test.ts`, `tests/site-gate.test.ts`, `e2e/specs/site.e2e.ts` and
  `e2e/baselines/` cover contrast, site policy and visual behaviour.

## Constraints (do not touch)

- Preserve the approved logo, icon, brand identity, install paths and non-affiliation wording.
- Use fake identities in all product screenshots and baselines. Capture from local or offline fixtures.
  Preserve the human captcha step and leave the fixtures byte-for-byte.
- Serve product screenshots from the site origin. Preserve the existing outbound link and remote resource
  policy. The approved script exception covers theme handling. Any additional script or media
  format outside the current allowlist requires owner approval. Keep the feedback script and its
  existing exception.
- Preserve extension code, manifest, permissions and store capture originals. Any new site
  styling dependency needs explicit approval and must produce local CSS at build time.
  Deployment stays with the owner.

## Acceptance criteria

- [ ] A visual review covers all three landing pages at phone and desktop widths in light and dark.
      It checks every section for consistent typography, spacing, colour and alignment, and
      verifies hover, focus and selected states where applicable. Updated text, controls and focus
      indicators meet applicable WCAG AA contrast requirements.
- [ ] For each section reorder or UI block replacement, the plan identifies the visitor task it
      improves. Review confirms that product information and key actions remain easy to find and
      that reading and keyboard focus order follow the revised layout.
- [ ] All FAQ plus and minus icons sit at the horizontal and vertical centre of their circles,
      including when question text wraps. Pointer and keyboard activation still work.
- [ ] The screenshot treatment is consistent across steps and preserves the legibility of the
      relevant interface, localized descriptions and current screenshot language fallback.
- [ ] The hero shows a static capture of the extension on desktop and phone, with readable
      localized context and fake data. The written steps explain the reminder, the human captcha
      step and the result. All screenshots load from the site origin.
- [ ] Light and Dark override the system and Auto follows system changes. The choice survives
      reloads and navigation between languages and page types, including feedback and 404 pages.
      The wordmark, browser colour scheme and page colours agree. The control has a localized
      accessible name and exposes the selected setting. System theming still works without script.
- [ ] `npm run check:site` and the site visual and accessibility checks pass. Site E2E reports
      zero unexpected requests. Gate tests verify the specific approved script and assets and
      confirm that video, unrelated scripts, inline handlers and external resources are rejected.

## Open questions

None.
