from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import urllib.parse
import urllib.request
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from scripts import import_sources as catalog
BATCH_DIR = ROOT / "data" / "reviews" / "batches"
SNAPSHOT_DIR = ROOT / "data" / "snapshots" / "review-evidence"
REPORT_PATH = ROOT / "data" / "reviews" / "batch-application-report.json"


def authority(value: str) -> str:
    lowered = (value or "").lower()
    if "official" in lowered or "organizer" in lowered or "institution" in lowered:
        return "official"
    if "government" in lowered or "association" in lowered:
        return "government"
    if "school" in lowered or "shsid" in lowered:
        return "school"
    if "histor" in lowered:
        return "historical"
    return "reputable_secondary"


def valid_web_url(url: str | None) -> bool:
    if not url:
        return False
    parsed = urllib.parse.urlparse(url)
    return parsed.scheme == "https" and bool(parsed.hostname)


def snapshot_url(url: str) -> tuple[str, dict[str, Any] | None, str | None]:
    try:
        request = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 ProjectPursuitReview/1.0",
            "Accept": "text/html,application/xhtml+xml",
        })
        with urllib.request.urlopen(request, timeout=35) as response:
            content = response.read()
            final_url = response.geturl()
            content_type = response.headers.get("Content-Type", "")
            status = response.status
        if status != 200 or len(content) < 500 or "text/html" not in content_type.lower():
            raise ValueError(f"invalid response status={status} bytes={len(content)} type={content_type}")
        digest = hashlib.sha256(content).hexdigest()
        retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        host = urllib.parse.urlparse(final_url).hostname or "source"
        folder = SNAPSHOT_DIR / re.sub(r"[^a-z0-9.-]+", "-", host.lower())
        folder.mkdir(parents=True, exist_ok=True)
        snapshot = folder / f"{digest[:16]}.html.gz"
        if not snapshot.exists():
            snapshot.write_bytes(gzip.compress(content, mtime=0))
        manifest = {
            "original_url": url, "final_url": final_url, "retrieved_at": retrieved_at,
            "content_hash": digest, "content_type": content_type, "status": status,
            "parser_version": "luna-review-v1", "snapshot_path": snapshot.relative_to(ROOT).as_posix()
        }
        manifest_path = snapshot.with_suffix("").with_suffix(".manifest.json")
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return url, manifest, None
    except Exception as exc:  # network failures must remain reviewable rather than aborting the sweep
        return url, None, str(exc)


def load_batches() -> list[dict[str, Any]]:
    reviews: list[dict[str, Any]] = []
    for path in sorted(BATCH_DIR.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        for record in payload.get("records", []):
            record["_batch"] = path.name
            reviews.append(record)
    return reviews


def normalize_evidence(review: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    normalized: dict[str, list[dict[str, Any]]] = {}
    for field, entries in review.get("field_evidence", {}).items():
        normalized[field] = []
        for entry in entries if isinstance(entries, list) else []:
            note = entry.get("note") or entry.get("evidence_note") or ""
            normalized[field].append({**entry, "authority": authority(entry.get("authority", "")), "note": note})
    return normalized


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply Luna review batches through deterministic evidence gates")
    parser.add_argument("--refresh-evidence", action="store_true")
    args = parser.parse_args()
    reviews = load_batches()
    database = {record["id"]: record for record in catalog.load_database_records()}
    urls = sorted({entry.get("url") for review in reviews for entries in normalize_evidence(review).values() for entry in entries if valid_web_url(entry.get("url"))})
    snapshots: dict[str, dict[str, Any]] = {}
    failures: dict[str, str] = {}
    if args.refresh_evidence:
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(snapshot_url, url) for url in urls]
            for future in as_completed(futures):
                url, manifest, error = future.result()
                if manifest: snapshots[url] = manifest
                if error: failures[url] = error
    report: dict[str, Any] = {"reviewed": len(reviews), "updated": [], "unverified": [], "snapshot_failures": failures}
    for review in reviews:
        record = database.get(review.get("id"))
        if not record:
            report["unverified"].append({"id": review.get("id"), "reason": "record id not found", "batch": review.get("_batch")})
            continue
        field_entries = normalize_evidence(review)
        identity_entries = field_entries.get("canonical_name", [])
        valid_identity = [entry for entry in identity_entries if entry.get("url") in snapshots]
        official_identity = [entry for entry in valid_identity if entry["authority"] == "official"]
        reputable_hosts = {urllib.parse.urlparse(entry["url"]).hostname for entry in valid_identity if entry["authority"] in {"government", "school", "reputable_secondary"}}
        if official_identity:
            status = "official_verified"
        elif len(reputable_hosts) >= 2:
            status = "corroborated"
        else:
            record["publication_status"] = "unverified"
            record["verification_note"] = "Luna review completed, but identity evidence did not pass the official or two-independent-source snapshot gate."
            catalog.write_database_record(record)
            report["unverified"].append({"id": record["id"], "reason": "identity evidence did not pass official/two-source snapshot gate", "batch": review.get("_batch")})
            continue
        facts = {"canonical_name": record["canonical_name"], **review.get("factual_fields", {})}
        if official_identity:
            facts["website_url"] = official_identity[0]["url"]
            field_entries["website_url"] = official_identity
        conflicts = set(review.get("conflicts", []))
        evidence = list(record.get("evidence", []))
        field_evidence = dict(record.get("field_evidence", {}))
        sources = list(record.get("sources", []))
        for field, value in facts.items():
            if field in conflicts:
                record[field] = None
                field_evidence[field] = {"status": "missing", "evidence_ids": []}
                continue
            valid_entries = [entry for entry in field_entries.get(field, []) if entry.get("url") in snapshots]
            if not valid_entries:
                continue
            ids: list[str] = []
            for entry in valid_entries:
                manifest = snapshots[entry["url"]]
                evidence_id = f'luna-{hashlib.sha1((record["id"] + field + entry["url"]).encode()).hexdigest()[:12]}'
                ids.append(evidence_id)
                if not any(item.get("evidence_id") == evidence_id for item in evidence):
                    evidence.append({"evidence_id": evidence_id, "url": manifest["final_url"], "publisher": entry.get("publisher", "Web source"), "authority": entry["authority"], "retrieved_at": manifest["retrieved_at"], "note": entry.get("note", "")})
                if not any(source.get("original_url") == manifest["final_url"] for source in sources):
                    sources.append({"source_file": Path(manifest["snapshot_path"]).name, "source_type": "web_snapshot", "page_or_sheet": "review evidence", "row_or_text_ref": field, "raw_excerpt": entry.get("note", "")[:900], "extracted_at": manifest["retrieved_at"], "source_id": evidence_id, "original_url": manifest["final_url"], "snapshot_path": manifest["snapshot_path"], "retrieved_at": manifest["retrieved_at"], "content_hash": manifest["content_hash"], "extraction_locator": f"Luna batch field: {field}"})
            authorities = {entry["authority"] for entry in valid_entries}
            record[field] = value
            evidence_status = "official" if "official" in authorities else "corroborated" if len({urllib.parse.urlparse(entry["url"]).hostname for entry in valid_entries}) >= 2 else "single_source"
            field_evidence[field] = {"status": evidence_status, "evidence_ids": ids}
        record.update({"publication_status": status, "confidence": "verified" if status == "official_verified" else "partially_verified", "last_verified_at": datetime.now(timezone.utc).date().isoformat(), "verification_note": "Identity and factual fields reviewed through the Luna evidence pipeline; blank fields were not inferred.", "evidence": evidence, "field_evidence": field_evidence, "sources": sources})
        catalog.write_database_record(record)
        database[record["id"]] = record
        report["updated"].append({"id": record["id"], "status": status, "batch": review.get("_batch")})
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"reviewed": report["reviewed"], "updated": len(report["updated"]), "unverified": len(report["unverified"]), "snapshot_failures": len(failures)}, indent=2))


if __name__ == "__main__":
    main()
