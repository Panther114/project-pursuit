# Project Pursuit

Project Pursuit is a prototype competition discovery and recommendation product for SHSID international high-school students.

The first prototype is intentionally narrow: ingest the offline files in `shsid_sources/`, normalize them into a verified competition catalog, and ship a clean web UI for search, filtering, detail review, shortlist comparison, and basic fit recommendations.

## Project Documents

- `CONCEPT.md` - original product concept and long-term direction.
- `docs/DATA_SOURCE_INVENTORY.md` - current source inventory and extraction notes.
- `docs/DATA_DICTIONARY.md` - normalized opportunity fields and confidence labels.
- `docs/IMPORT_WORKFLOW.md` - repeatable offline-source import workflow.
- `docs/VERIFICATION_POLICY.md` - source reliability and online verification rules.
- `PRODUCT.md` and `DESIGN.md` - product and UI system context for future implementation work.

## Run Locally

```bash
npm install
npm run import:sources
npm run dev
```

Build and test:

```bash
npm test
npm run build
```

## Current Offline Sources

- `shsid_sources/2024 Summer_Programs.xlsx`
- `shsid_sources/SHSID2024-2025 1st Semester Contests and Activities.pdf`
- `shsid_sources/SHSID2024-2025 2nd Semester Contests and Activities(2).pdf`
- `shsid_sources/SHSID2025-2026 1st Semester Contests and Activities.pdf`

## Initial Scope

The initial product only includes opportunities found in the offline sources above. Online sources may be used to verify official links, dates, eligibility, and stale records, but they must not expand the catalog unless explicitly approved.
