# Contributing to React Native Nitro Geolocation

Thank you for helping improve **react-native-nitro-geolocation**. This document finishes off the remaining "contributing guide" task from [issue #25 (Roadmap)](https://github.com/jingjing2222/react-native-nitro-geolocation/issues/25) by outlining how to report problems, work on a change, and ship it.

## Getting started

1. Enable Corepack (the repo is pinned to [Yarn 4.9.4](https://yarnpkg.com/)): `corepack enable`.
2. Install dependencies from the workspace root: `yarn install`.
3. Run `yarn` commands from the repo root per the scripts in `package.json`. For example:
   - `yarn format` to format everything with Biome.
   - `yarn lint` and `yarn typecheck` to keep the workspace healthy.
   - `yarn build:all` to ensure every package and example compiles.

## Issue workflow

- Search for an existing issue before opening a new one. When reporting a bug or requesting a feature, use the templates under `.github/ISSUE_TEMPLATE/` so the maintainers get the right information up front.
- Provide reproduction steps, platform/device details, and any code you ran. That helps the reviewer triage the problem quickly.
- Reference relevant docs (the `docs/` site or package READMEs) and the examples in `examples/` whenever possible so the context stays clear.

## Development workflow

1. Branch off the latest `main`: `git switch main && git pull && git switch -c issue-<number>-short-description`.
2. Make small, self-contained commits that explain *what* changed and *why*.
3. Keep formatting consistent by running `yarn format` (or `biome format --write .`). The repository uses Biome for linting and formatting across all packages.
4. If you add a new package or example, remember to update the workspace (e.g., `package.json`, `nx.json`, `yarn.lock`) so the change is visible to the rest of the monorepo.

## Testing & validation

- Run `yarn lint` and `yarn typecheck` from the root to validate your changes.
- `yarn build:all` ensures every workspace project builds; it’s a heavier command but helps catch bundling issues.
- Use `yarn format:check` to confirm Biome formatting matches the existing style before submitting a PR.
- For the documentation site inside `docs/`, you can run `cd docs && yarn dev` to preview changes or `yarn build` to verify the static site compiles.
- When you touch runtime behavior, rerun the Maestro E2E test suite from the example app as described in the PR template:
  ```bash
  cd examples/v0.81.1
  yarn test:e2e:ios  # or yarn test:e2e:android
  ```
  Provide the Maestro output (or mark it as "N/A" if your change is docs-only) in the PR.

## Documentation & examples

- The main README (`README.md`) and each package README (for example, `packages/react-native-nitro-geolocation/READEME.md`) are the canonical entry points. Keep them in sync with any API or workflow changes.
- The `/docs` site is powered by Rspress. Update the content under `docs/docs/` and rerun `yarn build` if you touch the published documentation.
- Examples live in `examples/`; rebuild or rerun sample apps whenever you change native modules so you can verify on-device behavior.

## Pull request checklist

Before opening a PR:

- [ ] Update the changelog via `yarn changeset` when your change affects the published API or user experience.
- [ ] Fill out the `.github/pull_request_template.md` sections, including the type of change, testing status, platform matrix, and Maestro artifacts.
- [ ] Reference the issue you’re closing with `Closes #<issue-number>` in the PR description so GitHub can track progress.
- [ ] Mention any manual steps needed to test the change (e.g., rebuild the docs or run a specific example).

## After the PR

- Watch the CI checks (GitHub Actions) and address any formatting or linting failures.
- Respond to review comments promptly; mention if you need help reproducing something locally.
- Once merged, the maintainers will release through Changesets. If you were told to add a release note, keep the text concise and accurate.

Thanks again for contributing — every fix, doc tweak, and example improvement makes the library better for everyone.
