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
npm run test:importer
npm run build
```

When source files or snapshots change, regenerate with `npm run import:sources`, inspect `data/reports/import_report.json`, confirm a second offline rebuild has the same hash, and rerun all checks. Network access is used only by `npm run refresh:sources`.

Canonical factual records live in `data/opportunities/`; do not hand-edit the generated frontend bundle. Review changes must retain field-level evidence and pass the bounded-batch or single-submission promotion command.

## Data provenance

New sources require an official-page registry entry, a strict domain allow-list, committed snapshots, complete provenance, and the online publication gate. Discovery candidates never publish automatically. See [`VERIFICATION_POLICY.md`](VERIFICATION_POLICY.md), [`ONLINE_SOURCES.md`](ONLINE_SOURCES.md), and [`IMPORT_WORKFLOW.md`](IMPORT_WORKFLOW.md).

## Branches and commits

Use a topic branch under the `codex/` namespace for repository work. Keep commits focused and describe the resulting change directly. Do not commit generated build output, local logs, dependency directories, environment files, or Playwright runtime state.
