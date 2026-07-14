# Delegated Review Workflow

The review mechanism lets a low-cost research agent investigate detected candidates without granting it catalog-write authority.

## Flow

1. Run `npm run refresh:sources` to update official listing snapshots and candidate detection.
2. Run `npm run review:prepare` to write `data/reviews/queue.generated.json` from unpublished candidates.
3. Give the queue to a bounded reviewer. The reviewer must search current official organizer/institution pages, use null rather than inference, and return `reviewer_confidence` as `verified`, `insufficient_evidence`, or `rejected`.
4. Save the returned JSON as `data/reviews/submission.json` and run `npm run review:promote`.
5. Promotion performs identity, date, HTTPS, independence, and evidence checks, then downloads and hashes every accepted evidence page.
6. Passing records are stored in `verified.generated.json` and enter the next offline catalog build. All other submissions remain in `unverified.generated.json` with machine-readable reasons.

## Trust boundary

The reviewer cannot publish directly. Promotion requires verified identity/current existence, consistent dates when supplied, official HTTPS evidence or two independent reputable organizations, and successful local snapshots. Missing non-core facts remain empty. Network failures and unverifiable identity fail closed.

Bounded Luna batches live under `data/reviews/batches/`. `npm run review:apply-batches` normalizes reviewer authority labels, snapshots unique URLs concurrently, applies only fields with retained evidence, empties conflicts, and writes `batch-application-report.json`.

Re-review unverified records when an official current-cycle page becomes available. Never edit a rejection reason away or replace official evidence with a third-party summary.
