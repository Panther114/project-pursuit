# Verification Policy

Last updated: 2026-07-09

## Catalog Scope

The prototype catalog is offline-source scoped. A competition or program should appear in the app only if it is present in `shsid_sources/`.

## Online Verification

Online sources may be used to verify:

- Official website URLs.
- Registration deadlines.
- Eligibility.
- Format/location.
- Fees.
- Current-year availability.

Online sources must not be used to silently add new records to the prototype catalog unless the product scope is explicitly expanded.

## Source Priority

1. Current official competition or organizer website.
2. Current SHSID source file.
3. Older SHSID source file.
4. Historical official page.
5. Third-party summaries.

Third-party summaries should not upgrade a record to `verified`.

## UI Requirements

- Display confidence labels near critical facts.
- Show raw source excerpts on detail pages.
- Mark missing deadlines as `Needs review`.
- Do not present admissions relevance as a guaranteed outcome.
- Explain recommendation scores with visible reasons and cautions.
