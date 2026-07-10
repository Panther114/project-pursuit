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
- Preserve an explicit verification note when an organizer URL has been checked but the current-cycle schedule remains unconfirmed.

## Motion Policy

Project Pursuit uses staged reveals, orbit motion, and panel transitions as part of the product identity. Do not disable visual effects through `prefers-reduced-motion`; Windows and Edge may expose that setting in environments where the product still needs to render its primary content and motion states. Only non-visual comfort behavior, such as `scroll-behavior`, may use that media query. Critical UI must have a visible static end state so it remains usable if CSS animation is unavailable.
