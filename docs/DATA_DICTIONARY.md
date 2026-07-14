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
| `region_tier` | enum | `shanghai_local`, `mainland_china`, `greater_china`, `china_participation_route`, or `international_only`. |
| `organizer`, `country`, `city` | string | Normalized operator and delivery geography. |
| `format` | enum | `online`, `in_person`, `hybrid`, `contact_instructor`, or `unknown`. |
| `date_text` | string | Human-readable source date text. |
| `deadline_text` | string | Human-readable source registration deadline text. |
| `deadline_date` | string/null | ISO deadline when confidently parsed. Null when approximate or unknown. |
| `start_date`, `end_date` | string/null | ISO activity dates when published. |
| `current_cycle_status` | enum | `open`, `upcoming`, `closed`, `rolling`, or `unknown`. |
| `eligible_grades`, `eligible_ages`, `eligible_curricula` | arrays/text | Structured and source-readable eligibility. |
| `languages`, `team_mode` | arrays/enum | Delivery language and individual/team participation. |
| `cost_amount`, `cost_currency`, `time_commitment` | number/text/enum | Structured affordability and expected workload. |
| `website_url` | string | Source-listed website when present. |
| `registration_contact` | string | Registration contact or channel. |
| `instructor_contact` | string | SHSID instructor/contact when extracted. |
| `preparation` | string | Source preparation recommendation. |
| `description` | string | Description, mainly from the summer-program spreadsheet. |
| `confidence` | enum | Reliability label shown in the UI. |
| `last_verified_at` | string/null | Official online verification timestamp, when performed. |
| `verification_note` | string | Human-readable scope and limitation of the latest official-source check. |
| `sources` | Source[] | Source trace records. |
| `publication_status` | enum | `official_verified`, `corroborated`, `partially_verified`, `historical`, or `unverified`. Historical/unverified records remain internal. |
| `evidence` | EvidenceReference[] | Publishers, URLs, authority, retrieval dates, and notes supporting factual fields. |
| `field_evidence` | object | Per-field status and evidence IDs. Missing facts use `missing` and an empty evidence list. |

The canonical database is `data/opportunities/`: one stable-ID JSON file per record plus `index.json`. `src/data/opportunities.generated.json` is a deterministic public projection, not an editing surface.

## Source

| Field | Type | Meaning |
|---|---|---|
| `source_file` | string | Offline file name under `shsid_sources/`. |
| `source_type` | enum | `xlsx`, `pdf`, or `web_snapshot`. |
| `page_or_sheet` | string | PDF page or Excel sheet. |
| `row_or_text_ref` | string | Excel row or text anchor. |
| `raw_excerpt` | string | Extracted source excerpt for review. |
| `extracted_at` | string | Import timestamp. |
| `source_id`, `original_url`, `snapshot_path` | string | Registered web identity and reproducible evidence location. |
| `retrieved_at`, `content_hash`, `extraction_locator` | string | Retrieval/version integrity and parser trace. |

## Confidence Labels

- `verified`: critical fields have been verified against a current official source.
- `partially_verified`: source name and key metadata are clear, but some critical fields still need official checking.
- `historical_information_only`: record appears only in older SHSID source files.
- `unverified`: imported record is incomplete or weakly supported.
- `needs_review`: missing critical data, conflicting duplicate, or suspicious extraction.

## Field Evidence Status

- `official`: supported by a retained official organizer/institution snapshot.
- `corroborated`: supported by at least two independent reputable organizations/domains.
- `single_source`: one school or reputable source supports the fact.
- `historical`: supported only by historical evidence.
- `missing`: deliberately blank; no fact was inferred.
