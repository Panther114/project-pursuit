# Online Sources

Project Pursuit uses curated official-source adapters, not generic web search. The registry is declarative and each adapter has a narrow allow-list.

## Global high-school coverage source

`data/reviews/mass/global_high_school_competitions.json` is the curated gap-audit source for international competitions available to high-school students. It distinguishes direct global entry, regional open entry, and national-team selection pathways. Organizer pages are retained by `npm run snapshot:mass-sources`; a record requested as verified is only promoted when its snapshot contains every configured evidence-term group. Terms inside one group are alternatives, while all groups are required.

Wikipedia category discovery is candidate-only. The crawler samples a fixed budget across broad subject roots, requires both school-age and international signals, excludes obvious inactive descriptions, and never promotes its results without organizer evidence. Hard page, category, and request limits keep every run bounded.

Operational completeness is defined by `data/curation/tier_a_competitions.json`, the maintained high-priority competition-family inventory. `npm run audit:competitions` fails when any listed family has no catalog match, so a refresh cannot silently drop a known competition. This is a reproducible coverage guarantee for the maintained inventory, not a claim that every newly created, private, or unpublished competition on the internet can be enumerated.

## Initial operational family

ASEEDER/阿思丹 is used because it publishes official China participation pages and region-specific programs for international-school students. The catalog page is a discovery surface; registered detail pages are evidence surfaces. Organizer identity and current-cycle facts should be cross-checked against any linked international organizer when available.

The initial registry covers six competitions and three regional programs. The Luna sweep adds retained official institution/organizer snapshots for legacy records when reachable. Candidate discovery, evidence review, and public projection remain separate stages.

## Planned university family

Duke Kunshan, HKU, HKUST, CUHK, and NYU Shanghai official program indexes are approved source families but must not be represented by guessed or obsolete URLs. Enable each adapter only after confirming a stable official listing, official detail pages, current eligibility, schedule/application status, cost status, and regional delivery information.

## Stewardship

- Refresh weekly for catalogs and once per application cycle for detail pages.
- Preserve every accepted snapshot; never overwrite history.
- Treat redirects outside the allow-list, small/error responses, hash mismatches, missing evidence terms, or incomplete cards as failures.
- Review `discovered_candidates`, `rejected_online`, and refresh failures after every network run.
