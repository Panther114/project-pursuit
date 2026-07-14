# Project Pursuit

Project Pursuit is an offline-first competition and program discovery product for SHSID and other Chinese international-school students.

The catalog combines school-provided files, curated official-page snapshots, bounded online discovery batches, and reproducible secondary-source indexes. It prioritizes Shanghai, mainland China, Greater China, and opportunities with an explicit China participation route. The interface is factual only: it offers search criteria and source confidence, not personal-fit or admissions judgments.

## Interface routes

- `/` — full-screen Project Pursuit lander.
- `/competitions` — the factual Competition Board and criteria console.
- `/programs` — the Summer and Research Program Board.

The application uses browser-history navigation, so these routes are shareable during local development and on hosts configured with an SPA fallback.

## Project Documents

Start with [`docs/README.md`](docs/README.md), the index for product, design, data, verification, and contribution documentation.

## Run Locally

```bash
npm install
npm run import:sources
npm run refresh:sources
npm run discover:wikipedia
npm run snapshot:mass-sources
npm run dev
```

On Windows, double-click `quickrun.bat` to stop any existing local servers for this project, start a fresh dev server, and open the app in your default browser.

Build and test:

```bash
npm test
npm run build
```

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for the complete local development and data-import workflow.

## Current Sources

- `shsid_sources/2024 Summer_Programs.xlsx`
- `shsid_sources/SHSID2024-2025 1st Semester Contests and Activities.pdf`
- `shsid_sources/SHSID2024-2025 2nd Semester Contests and Activities(2).pdf`
- `shsid_sources/SHSID2025-2026 1st Semester Contests and Activities.pdf`
- Official ASEEDER/阿思丹 catalog and detail pages registered in `data/sources/registry.json`
- Structured mass-discovery batches under `data/reviews/mass/`, covering China-facing and international competitions and pre-college, summer, research, and enrichment programs
- A reproducible Wikipedia category adapter used only for secondary discovery; its records remain hollow-dot/unverified until stronger evidence is retained
- Versioned official-page snapshots under `data/snapshots/`

Online discovery is evidence-controlled: official sources are preferred, while non-official facts require two independent reputable organizations. See `docs/ONLINE_SOURCES.md` and `docs/REVIEW_WORKFLOW.md`.

Detected candidates can be researched by a bounded low-cost review agent. Agent output is schema-validated and normalized before it enters the database. Filled dots mean retained official verification; hollow dots identify partial, unverified, or historical records whose facts should be checked before action. See `docs/REVIEW_WORKFLOW.md`.
