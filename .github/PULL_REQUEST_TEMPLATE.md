## Summary

<!-- What does this change, and why? Link the issue if there is one. -->

## Checks run locally

<!-- Tick what you ran. CI runs all of these; see CONTRIBUTING.md. -->

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build:chrome` and `npm run build:firefox`
- [ ] `npm run check:privacy` (after both builds)
- [ ] `npm run check:site`
- [ ] `npm run check:workflows` and `npm run lint:workflows` (only if `.github/` changed)

## Confirmations

- [ ] This change includes no personal data: only invented identities, never a real NIE, name or birth date.
- [ ] It adds no network request, telemetry, permission or host, and does not automate the captcha.
- [ ] The pull request title is a Conventional Commit (one line, imperative, at most 72 characters), because
      it becomes the squash-merge commit.
- [ ] I agree that my contribution is licensed under GPL-3.0-or-later.
