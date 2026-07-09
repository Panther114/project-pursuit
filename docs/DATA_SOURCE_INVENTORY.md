# Data Source Inventory

Last reviewed: 2026-07-09

## Offline Sources

| Source | Type | Observed structure | Prototype use |
|---|---:|---|---|
| `shsid_sources/2024 Summer_Programs.xlsx` | Excel | 1 sheet, 42 data rows after header normalization | Summer program catalog import |
| `shsid_sources/SHSID2024-2025 1st Semester Contests and Activities.pdf` | PDF | 8 pages, table-like bilingual SHSID contest list, 25 extracted URL occurrences | Historical contest import and source comparison |
| `shsid_sources/SHSID2024-2025 2nd Semester Contests and Activities(2).pdf` | PDF | 5 pages, table-like bilingual SHSID contest list, 15 extracted URL occurrences | Historical contest import and source comparison |
| `shsid_sources/SHSID2025-2026 1st Semester Contests and Activities.pdf` | PDF | 9 pages, table-like bilingual SHSID contest list, 24 extracted URL occurrences | Primary current contest import |

## Excel Fields Observed

The summer-program spreadsheet contains these normalized columns:

- `Name`
- `Intro`
- `Website`
- `Region`
- `Category`
- `Date`
- `Application Deadline`
- `Form`

Observed category values include `Business`, `STEM`, `Writing`, `Arts`, `Social Science`, `Interdisciplinary`, and `Multiple`. Observed region values include `US`, `UK`, and `HK China`. Observed form values include `Online`, `In person`, and mixed online/in-person variants.

## PDF Fields Observed

The SHSID contest PDFs use table-like columns:

- Chinese name
- English name
- Date
- Time or duration
- Site or format
- Subject
- Registration deadline
- Registration website or contact
- Instructor or contact
- Preparation

PDF extraction is imperfect because text order is line-based and some wrapped cells split across lines. The prototype should preserve raw extracted text and source coordinates or page references so human review can correct parser mistakes.

## Data Rules For Prototype

- Treat `SHSID2025-2026 1st Semester Contests and Activities.pdf` as the freshest offline source among overlapping SHSID contest records.
- Preserve historical records from 2024-2025 for recurring-competition detection and deadline inference, but label them as historical unless verified against the 2025-2026 file or an official source.
- Do not guess critical fields. Unknown deadlines, eligibility, cost, or location should remain null with a visible confidence label.
- Store every imported record with `source_file`, `source_page_or_sheet`, `source_row_or_text_ref`, `imported_at`, and `confidence`.
- Online lookups, when used, should target official competition pages already present in the offline material or official organizer websites. They should update verification fields, not silently add new competitions.
