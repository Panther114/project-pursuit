from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "data" / "reports" / "import_report.json"
REVIEW_DIR = ROOT / "data" / "reviews"
SNAPSHOT_DIR = ROOT / "data" / "snapshots" / "reviews"
VERIFIED_PATH = REVIEW_DIR / "verified.generated.json"
UNVERIFIED_PATH = REVIEW_DIR / "unverified.generated.json"
QUEUE_PATH = REVIEW_DIR / "queue.generated.json"

REQUIRED = ["canonical_name", "organizer", "type", "website_url", "evidence_urls", "reviewed_at"]
REGION_TIERS = {"shanghai_local", "mainland_china", "greater_china", "china_participation_route", "international_only"}
STATUSES = {"open", "upcoming", "closed", "rolling"}
TYPES = {"competition", "summer_program", "research_program", "other"}


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:100]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def prepare_queue(limit: int) -> dict[str, Any]:
    report = load_json(REPORT)
    published_urls = set()
    registry = load_json(ROOT / "data" / "sources" / "registry.json")
    for source in registry.get("sources", []):
        if source.get("record"):
            published_urls.add(source["record"].get("website_url"))
    candidates = [item for item in report.get("discovered_candidates", []) if item.get("url") not in published_urls]
    payload = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "instructions": "Research current official sources. Never infer missing facts. Submit verified only when every required field is supported; otherwise submit insufficient_evidence.",
        "candidates": candidates[:limit],
    }
    write_json(QUEUE_PATH, payload)
    return payload


def iso_date(value: Any) -> bool:
    if value in (None, ""):
        return True
    try:
        date.fromisoformat(str(value)[:10])
        return True
    except ValueError:
        return False


def validate_review(review: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if review.get("reviewer_confidence") != "verified":
        errors.append("reviewer did not mark the record verified")
        return errors
    missing = [field for field in REQUIRED if review.get(field) in (None, "", [])]
    if missing:
        errors.append(f"missing required fields: {', '.join(missing)}")
    if review.get("region_tier") not in REGION_TIERS:
        errors.append("invalid region_tier")
    if review.get("current_cycle_status") not in STATUSES:
        errors.append("current_cycle_status must be explicit and current")
    if review.get("type") not in TYPES:
        errors.append("invalid opportunity type")
    for field in ("deadline_date", "start_date", "end_date", "reviewed_at"):
        if not iso_date(review.get(field)):
            errors.append(f"{field} must use ISO YYYY-MM-DD")
    reviewed_at = review.get("reviewed_at")
    if iso_date(reviewed_at) and reviewed_at:
        if abs((date.today() - date.fromisoformat(str(reviewed_at)[:10])).days) > 45:
            errors.append("review is older than 45 days")
    deadline = review.get("deadline_date")
    status = review.get("current_cycle_status")
    if deadline and status in {"open", "upcoming"} and date.fromisoformat(deadline) < date.today():
        errors.append("open/upcoming status conflicts with a past deadline")
    urls = review.get("evidence_urls") or []
    if review.get("website_url") and review["website_url"] not in urls:
        errors.append("official website_url must be included in evidence_urls")
    for url in urls:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https" or not parsed.hostname:
            errors.append(f"evidence URL is not valid HTTPS: {url}")
    if review.get("eligibility_text") and re.search(r"(?:tbd|unknown|see website|confirm|not specified)$", str(review.get("eligibility_text", "")), re.I):
        errors.append("eligibility is not specific")
    return errors


def snapshot_evidence(review: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    review_id = slug(f'{review["organizer"]}-{review["canonical_name"]}')
    folder = SNAPSHOT_DIR / review_id
    folder.mkdir(parents=True, exist_ok=True)
    sources: list[dict[str, Any]] = []
    errors: list[str] = []
    for index, url in enumerate(review["evidence_urls"], start=1):
        try:
            original_host = urllib.parse.urlparse(url).hostname
            request = urllib.request.Request(url, headers={"User-Agent": "ProjectPursuitReview/1.0 (+offline educational catalog)"})
            with urllib.request.urlopen(request, timeout=40) as response:
                final_url = response.geturl()
                content = response.read()
                content_type = response.headers.get("Content-Type", "")
                status = response.status
            if urllib.parse.urlparse(final_url).hostname != original_host:
                raise ValueError("evidence redirect changed host")
            if status != 200 or len(content) < 500 or "text/html" not in content_type.lower():
                raise ValueError(f"invalid evidence response status={status} bytes={len(content)} type={content_type}")
            retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
            digest = hashlib.sha256(content).hexdigest()
            stamp = retrieved_at.replace(":", "-").replace("+00:00", "Z")
            snapshot = folder / f"{stamp}-{index}.html.gz"
            snapshot.write_bytes(gzip.compress(content, mtime=0))
            manifest = {
                "source_id": f"review-{review_id}-{index}", "original_url": url, "final_url": final_url,
                "status": status, "content_type": content_type, "retrieved_at": retrieved_at,
                "content_hash": digest, "parser_version": "agent-review-v1",
                "snapshot_path": snapshot.relative_to(ROOT).as_posix(),
            }
            manifest_path = snapshot.with_suffix("").with_suffix(".manifest.json")
            write_json(manifest_path, manifest)
            sources.append({
                "source_file": snapshot.name, "source_type": "web_snapshot", "page_or_sheet": "official review evidence",
                "row_or_text_ref": review_id, "raw_excerpt": (review.get("evidence_notes") or "")[:900],
                "extracted_at": retrieved_at, "source_id": manifest["source_id"], "original_url": final_url,
                "snapshot_path": manifest["snapshot_path"], "retrieved_at": retrieved_at,
                "content_hash": digest, "extraction_locator": "review submission evidence",
            })
        except (OSError, ValueError) as exc:
            errors.append(f"{url}: {exc}")
    return sources, errors


def review_submission(path: Path, refresh_evidence: bool) -> dict[str, Any]:
    payload = load_json(path)
    reviews = payload if isinstance(payload, list) else payload.get("reviews", [payload])
    verified_existing = load_json(VERIFIED_PATH).get("records", []) if VERIFIED_PATH.exists() else []
    unverified_existing = load_json(UNVERIFIED_PATH).get("records", []) if UNVERIFIED_PATH.exists() else []
    verified_by_id = {item["id"]: item for item in verified_existing}
    unverified: list[dict[str, Any]] = unverified_existing

    for review in reviews:
        errors = validate_review(review)
        sources: list[dict[str, Any]] = []
        if not errors and refresh_evidence:
            sources, snapshot_errors = snapshot_evidence(review)
            errors.extend(snapshot_errors)
        elif not errors:
            errors.append("promotion requires --refresh-evidence so official evidence is saved offline")
        review_id = slug(f'{review.get("organizer", "unknown")}-{review.get("canonical_name", "unknown")}')
        if errors:
            unverified.append({"id": review_id, "review": review, "reasons": errors, "checked_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat()})
            continue
        record = {key: value for key, value in review.items() if key not in {"candidate_url", "evidence_urls", "evidence_notes", "reviewer_confidence"}}
        record.update({
            "id": f'reviewed-{review_id}', "confidence": "verified", "last_verified_at": review["reviewed_at"],
            "publication_status": "official_verified",
            "verification_note": "Low-cost agent review passed deterministic completeness checks and official evidence was saved offline.",
            "sources": sources,
        })
        verified_by_id[record["id"]] = record

    verified_payload = {"schema_version": 1, "records": sorted(verified_by_id.values(), key=lambda item: item["id"])}
    unverified_payload = {"schema_version": 1, "records": unverified}
    write_json(VERIFIED_PATH, verified_payload)
    write_json(UNVERIFIED_PATH, unverified_payload)
    return {"verified": len(verified_payload["records"]), "unverified": len(unverified_payload["records"])}


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare and validate delegated opportunity reviews")
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--limit", type=int, default=25)
    parser.add_argument("--submission", type=Path)
    parser.add_argument("--refresh-evidence", action="store_true")
    args = parser.parse_args()
    if args.prepare:
        result = prepare_queue(args.limit)
        print(json.dumps({"queued": len(result["candidates"]), "output": str(QUEUE_PATH)}, indent=2))
    elif args.submission:
        print(json.dumps(review_submission(args.submission, args.refresh_evidence), indent=2))
    else:
        parser.error("choose --prepare or --submission")


if __name__ == "__main__":
    main()
