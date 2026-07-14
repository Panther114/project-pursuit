# Verification Policy

## Display and confidence gate

The broad catalog displays discovered records even when identity/current-cycle verification is incomplete, so users can see the full research surface. Confidence is explicit rather than implied: a filled dot is reserved for records backed by retained official verification, while a hollow dot covers partially verified, unverified, and historical records. Non-core facts may remain empty and must never be guessed. Conflicting facts remain empty until resolved.

## Source priority

1. Current official organizer/institution detail page.
2. Official China operator page, such as ASEEDER.
3. Current SHSID source file.
4. Historical official or SHSID material.
5. Third-party pages, which may support discovery and hollow-dot factual fields but cannot produce a filled verification dot on their own.

Every filled-dot web record must expose an official URL, retrieval date, snapshot path, content hash, parser version, and extraction trace. Hollow-dot records may instead retain a `web_reference` while awaiting a successful snapshot and stronger evidence. Refresh failure never deletes last-good evidence. Time-sensitive facts must carry an explicit current-cycle status; unknown or stale dates must remain visibly unknown.

The student UI is factual only. It displays confidence status, missing values, verification age, and source traces without suitability scores or admissions judgments. The maintenance review queue itself is not rendered, although its hollow-dot candidates are visible in the broad catalog.
