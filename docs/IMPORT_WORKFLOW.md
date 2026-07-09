# Import Workflow

Last updated: 2026-07-09

## Purpose

The prototype catalog is generated from offline SHSID source files. The import step writes `src/data/opportunities.generated.json`, which is consumed directly by the React app.

## Commands

```bash
npm run import:sources
```

The script:

1. Reads `shsid_sources/2024 Summer_Programs.xlsx` with `pandas` and `openpyxl`.
2. Reads SHSID contest PDFs with `pdfplumber`.
3. Normalizes records into the `Opportunity` schema.
4. Preserves source excerpts for traceability.
5. Deduplicates repeated competition names across school years.
6. Writes an import summary to `data/reports/import_report.json`.

## Current Output

The latest reviewed run generated 53 normalized records.

## Parser Notes

Excel extraction is structured and high confidence.

PDF extraction is inherently less reliable because table cells wrap across lines. The importer uses known competition names from the SHSID files plus page-level raw excerpts. Any parser-derived deadline, contact, or website should be treated as reviewable until official verification is performed.

## Adding New Offline Sources

1. Add the file to `shsid_sources/`.
2. Update `docs/DATA_SOURCE_INVENTORY.md`.
3. Extend `scripts/import_sources.py` if the source has a new format.
4. Run `npm run import:sources`.
5. Check `data/reports/import_report.json`.
6. Run `npm test` and `npm run build`.
