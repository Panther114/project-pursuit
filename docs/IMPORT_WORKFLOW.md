# Import Workflow

The catalog is generated from school files and committed official-page snapshots. A normal rebuild never needs network access.

## Commands

```bash
npm run import:sources      # deterministic offline rebuild
npm run refresh:sources     # allow-listed download, snapshot, then rebuild
npm run validate:sources    # validate without replacing generated JSON
npm run test:importer       # importer unit tests
npm run review:prepare      # export unpublished discovery candidates
npm run review:promote      # validate a submission and snapshot its evidence
npm run review:apply-batches # snapshot and merge bounded Luna review batches
```

`refresh:sources` reads `data/sources/registry.json`, rejects non-HTTPS or non-allow-listed redirects, validates the response, and writes a compressed HTML snapshot plus manifest. A manifest records the source ID, original/final URL, parent listing, status, content type, retrieval time, SHA-256 hash, parser version, and snapshot path. Failed refreshes leave the most recent valid snapshot intact.

The offline build parses the freshest hash-valid snapshots, imports the SHSID files, merges reviewed canonical records, validates `data/opportunities/*.json`, and writes the deterministic public projection `src/data/opportunities.generated.json`. Historical/unverified records stay in the canonical database.

## Adding or repairing a source

1. Confirm the page is controlled by the organizer, institution, or its official China operator.
2. Add a registry entry with an HTTPS allow-list, parser version, refresh policy, reliability note, and complete normalized record mapping.
3. Add narrow evidence terms that must occur in the saved page.
4. Refresh, inspect the snapshot and report, then run an offline rebuild twice and compare hashes.
5. Add/adjust importer fixtures before changing parser behavior. Missing non-core facts remain null; never invent a value to satisfy the schema.

When markup changes, increment `parser_version`, retain the old snapshot, update the adapter/registry mapping, and document the limitation in `docs/ONLINE_SOURCES.md`.

Delegated research uses the separate fail-closed process in `docs/REVIEW_WORKFLOW.md`. Verified review records are imported only when their evidence snapshots exist and retain matching hashes.
