# Contributing to NacioCheck

NacioCheck is a small personal project, and contributions are welcome. This page says how a change gets from
your fork to `main`. For what the project is and how to build it, see [`README.md`](README.md); the rules the
code must keep are in [`AGENTS.md`](AGENTS.md) and the decisions in [`docs/adr/`](docs/adr/).

## Before you start

- For anything larger than a small fix, open an issue first so we can agree on the approach before you spend
  time on it.
- Read the boundaries below. A change that breaks one will not be merged, however well it works.

## Boundaries

- The extension never makes a network request of its own, adds no telemetry, and never uses `storage.sync`.
- The captcha is never bypassed, solved by a program or outsourced. The person always solves it.
- No new manifest permission or host pattern, no new URL in `scripts/allowed-urls.json`, and no dependency
  change without asking first in an issue. `npm run check:privacy` allows exactly one host.
- Nothing in a test, tool or script may reach the live sede or reCAPTCHA.
- A decision recorded in `docs/adr/` is settled. If you think one is wrong, raise it in an issue instead of
  reverting it in a pull request.

## Fake data only

The repository and the store listings are public. Use invented identities everywhere: in code, tests,
fixtures, screenshots, logs, issues and pull requests. Never include a real NIE, name or birth date, yours or
anyone else's. Files in `tests/fixtures/` are copies of what the official site served and stay
byte-for-byte: do not reformat or edit them.

## Set up

You need the Node.js version pinned in [`.nvmrc`](.nvmrc) and npm (`nvm use`, then):

```sh
npm ci
```

## Make a change

1. Fork the repository, or create a branch if you have write access, from an up-to-date `main`. Never work on
   `main` directly.
2. Keep the change to one concern, and add or update tests for it.
3. Run the same checks CI runs, and fix anything that fails:

   ```sh
   npm run format:check   # or `npm run format` to fix
   npm run lint
   npm run typecheck
   npm test
   npm run build:chrome
   npm run build:firefox
   npm run check:privacy  # needs both builds first
   npm run check:site
   ```

   If you touched `.github/`, also run `npm run check:workflows` and `npm run lint:workflows`. The
   end-to-end tests (`npm run test:e2e`) run locally only, not in CI; run them when your change affects the
   UI or the check flow.

4. Push your branch and open a pull request against `main`. Fill in the template.

## Pull requests and CI

- Every pull request runs the CI workflow. Two checks must pass before it can be merged: `checks` (format,
  lint, typecheck, unit tests, both builds, the privacy gate and the site check) and `workflow-lint` (the
  workflow policy check and the workflow lint).
- If this is your first contribution, the workflows wait for the maintainer to approve the run before they
  start. That is expected, not a failure; the maintainer reads the change first.
- Pull requests that change workflows, permissions or dependencies get closer scrutiny.
- Resolve every review conversation. Do not force-push over a review in progress without saying so.

## Merging and commit messages

The maintainer merges with **squash and merge**, so `main` keeps a linear history and each pull request
becomes one commit. The pull request title becomes the commit subject, so write it as a Conventional Commit:

- one line, imperative, at most 72 characters, no `"` characters;
- a type such as `feat`, `fix`, `docs`, `test`, `refactor`, `ci` or `chore`, then a colon and a space, for
  example `fix: keep the badge after a failed check`.

## Security reports

Do not open a public issue for a vulnerability. Follow [`SECURITY.md`](SECURITY.md) and use GitHub's private
vulnerability reporting.

## Licence

NacioCheck is licensed under GPL-3.0-or-later (see [`LICENSE`](LICENSE)). By submitting a contribution you
agree that it is licensed under the same terms.
