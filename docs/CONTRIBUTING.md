# Contributing to Project Pursuit

## Prerequisites

- Node.js with npm.
- Python 3 with the dependencies required by `scripts/import_sources.py` when regenerating the catalog.
- Git for branch and commit management.

## Local setup

```bash
npm install
npm run import:sources
npm run dev
```

The app is served by Vite at a local address. On Windows, `quickrun.bat` can stop an existing local server, start a fresh one, and open the app in the default browser.

## Validation

Run the unit tests and production build before committing:

```bash
npm test
npm run build
```

When source files change, regenerate the catalog with `npm run import:sources`, inspect `data/reports/import_report.json` when present, and rerun both checks.

## Data provenance

The prototype catalog is scoped to files under `shsid_sources/`. New or changed records must retain source file and location metadata. Online verification may update verification fields for existing records, but must not silently add catalog records. See [`VERIFICATION_POLICY.md`](VERIFICATION_POLICY.md), [`DATA_SOURCE_INVENTORY.md`](DATA_SOURCE_INVENTORY.md), and [`IMPORT_WORKFLOW.md`](IMPORT_WORKFLOW.md).

## Branches and commits

Use a topic branch under the `codex/` namespace for repository work. Keep commits focused and describe the resulting change directly. Do not commit generated build output, local logs, dependency directories, environment files, or Playwright runtime state.
