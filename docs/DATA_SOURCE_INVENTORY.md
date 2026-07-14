# Data Source Inventory

## School sources

The four files under `shsid_sources/` remain school-endorsement and historical-recurrence evidence: one 2024 summer-program XLSX and three SHSID semester competition PDFs. PDF table extraction remains reviewable because wrapped cells can be misordered.

The initial bounded review sweep was followed by mass China-competition, international-competition, and program discovery batches. Counts are build outputs rather than editorial targets and should be read from `src/data/catalog-metadata.generated.json` after every import. Competition identities are cleaned through `data/curation/competition_cleanup.json`, which records aliases, combined-record splits, organizer corrections, and non-competition exclusions.

## Online source registry

`data/sources/registry.json` is the authoritative machine-readable inventory. The initial operational adapter uses the official ASEEDER/阿思丹 catalog and official detail pages for China participation routes and Shanghai/mainland programs. It currently covers English, psychology, economics, finance, public speaking, performance, robotics, synthetic biology, and mathematical modeling.

The listing adapter snapshots the ASEEDER catalog and emits additional matching detail links as review candidates. Structured batches under `data/reviews/mass/` extend this with official and secondary web references. Discovery does not imply high confidence: records without retained official evidence are deliberately shown with a hollow status dot. Non-core fields may remain empty.

Program discovery includes official and secondary references for pre-college, summer, research, academy, and enrichment offerings in China and internationally. Stable official indexes from Duke Kunshan, HKU, HKUST, CUHK, NYU Shanghai, and other institutions remain preferred enrichment targets; a generic university home page is not sufficient for a filled verification dot.

`npm run discover:wikipedia` reproducibly queries a fixed set of competition categories and retains youth-relevant candidates as unverified discovery records. `npm run snapshot:mass-sources` attempts to retain official evidence for review-batch records. Neither command upgrades confidence without the deterministic import checks.

See `docs/ONLINE_SOURCES.md` for authority and maintenance rules.
