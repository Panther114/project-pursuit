# Project Pursuit

Project Pursuit is a prototype competition and course discovery product for SHSID international high-school students.

The first prototype is intentionally narrow: ingest the offline files in `shsid_sources/`, normalize them into a source-backed opportunity catalog, and ship a focused web UI for search, filtering, detail review, saved opportunities, and basic fit recommendations.

## Interface routes

- `/` — full-screen Project Pursuit lander.
- `/competitions` — the 14-record Competition Board and its source-review queue.
- `/programs` — the 39-record Program Board.

The application uses browser-history navigation, so these routes are shareable during local development and on hosts configured with an SPA fallback.

## Project Documents

Start with [`docs/README.md`](docs/README.md), the index for product, design, data, verification, and contribution documentation.

## Run Locally

```bash
npm install
npm run import:sources
npm run dev
```

On Windows, double-click `quickrun.bat` to stop any existing local servers for this project, start a fresh dev server, and open the app in your default browser.

Build and test:

```bash
npm test
npm run build
```

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for the complete local development and data-import workflow.

## Current Offline Sources

- `shsid_sources/2024 Summer_Programs.xlsx`
- `shsid_sources/SHSID2024-2025 1st Semester Contests and Activities.pdf`
- `shsid_sources/SHSID2024-2025 2nd Semester Contests and Activities(2).pdf`
- `shsid_sources/SHSID2025-2026 1st Semester Contests and Activities.pdf`

## Initial Scope

The initial product only includes opportunities found in the offline sources above. Online sources may be used to verify official links, dates, eligibility, and stale records, but they must not expand the catalog unless explicitly approved.
