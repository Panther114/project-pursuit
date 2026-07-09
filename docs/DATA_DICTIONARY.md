# Data Dictionary

Last updated: 2026-07-09

## Opportunity

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable prototype identifier derived from source name. |
| `canonical_name` | string | Primary display name. English is preferred when available. |
| `name_zh` | string | Chinese source name, when available. |
| `name_en` | string | English source name, when available. |
| `type` | enum | `competition`, `summer_program`, `research_program`, or `other`. |
| `subject_tags` | string[] | Normalized searchable subject tags inferred from source fields. |
| `category` | string | Source category or normalized subject summary. |
| `region` | string | Source region or SHSID/international scope. |
| `format` | enum | `online`, `in_person`, `hybrid`, `contact_instructor`, or `unknown`. |
| `date_text` | string | Human-readable source date text. |
| `deadline_text` | string | Human-readable source registration deadline text. |
| `deadline_date` | string/null | ISO deadline when confidently parsed. Null when approximate or unknown. |
| `website_url` | string | Source-listed website when present. |
| `registration_contact` | string | Registration contact or channel. |
| `instructor_contact` | string | SHSID instructor/contact when extracted. |
| `preparation` | string | Source preparation recommendation. |
| `description` | string | Description, mainly from the summer-program spreadsheet. |
| `confidence` | enum | Reliability label shown in the UI. |
| `last_verified_at` | string/null | Official online verification timestamp, when performed. |
| `sources` | Source[] | Source trace records. |

## Source

| Field | Type | Meaning |
|---|---|---|
| `source_file` | string | Offline file name under `shsid_sources/`. |
| `source_type` | enum | `xlsx` or `pdf`. |
| `page_or_sheet` | string | PDF page or Excel sheet. |
| `row_or_text_ref` | string | Excel row or text anchor. |
| `raw_excerpt` | string | Extracted source excerpt for review. |
| `extracted_at` | string | Import timestamp. |

## Confidence Labels

- `verified`: critical fields have been verified against a current official source.
- `partially_verified`: source name and key metadata are clear, but some critical fields still need official checking.
- `historical_information_only`: record appears only in older SHSID source files.
- `unverified`: imported record is incomplete or weakly supported.
- `needs_review`: missing critical data, conflicting duplicate, or suspicious extraction.
