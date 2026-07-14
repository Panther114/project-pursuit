from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts import import_sources as catalog

ARCHIVE = ROOT / "data" / "reviews" / "competition_research_completed.json"
REPORT = ROOT / "data" / "reports" / "completed_research_import.json"
RESEARCH_QUEUE = ROOT / "data" / "reports" / "competition_research_queue.json"

CONFIDENCE = {"official_verified", "partially_verified", "unverified"}
FORMATS = {"online", "in_person", "hybrid", "unknown"}
TEAM_MODES = {"individual", "team", "either", "unknown"}
CYCLE_STATUSES = {"open", "upcoming", "closed", "unknown"}
REGION_TIERS = {
    "shanghai_local", "mainland_china", "greater_china",
    "china_participation_route", "international_only",
}


def present(value: Any) -> bool:
    return value not in (None, "", [])


def identity_key(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return "".join(character for character in ascii_value if character.isalnum())


def reconcile_ids(records: list[dict[str, Any]], competitions: dict[str, dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    queue = json.loads(RESEARCH_QUEUE.read_text(encoding="utf-8"))["records"]
    by_short_id = {catalog.slug(item["canonical_name"]): item["record_id"] for item in queue}
    by_name = {identity_key(record["canonical_name"]): record_id for record_id, record in competitions.items()}
    reconciled: list[dict[str, Any]] = []
    resolutions: list[dict[str, str]] = []
    for original in records:
        row = dict(original)
        supplied_id = row.get("record_id", "")
        resolved = supplied_id if supplied_id in competitions else by_short_id.get(supplied_id)
        if not resolved:
            resolved = by_name.get(identity_key(str(row.get("canonical_name") or "")))
        if not resolved:
            key = identity_key(str(row.get("canonical_name") or ""))
            ranked = sorted(((SequenceMatcher(None, key, candidate).ratio(), record_id) for candidate, record_id in by_name.items()), reverse=True)
            if ranked and ranked[0][0] >= 0.94 and (len(ranked) == 1 or ranked[0][0] - ranked[1][0] >= 0.04):
                resolved = ranked[0][1]
        if resolved:
            row["record_id"] = resolved
            resolutions.append({"submitted_id": supplied_id, "database_id": resolved})
        reconciled.append(row)
    return reconciled, resolutions


def validate_payload(payload: Any, database_ids: set[str]) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(payload, dict) or payload.get("schema_version") != 1:
        return [], ["root must be an object with schema_version 1"], []
    records = payload.get("records")
    if not isinstance(records, list):
        return [], ["records must be an array"], []
    seen: set[str] = set()
    for index, row in enumerate(records):
        prefix = f"records[{index}]"
        if not isinstance(row, dict):
            errors.append(f"{prefix} must be an object")
            continue
        record_id = row.get("record_id")
        if not isinstance(record_id, str) or not record_id:
            errors.append(f"{prefix}.record_id is required")
        elif record_id in seen:
            errors.append(f"{prefix}.record_id is duplicated: {record_id}")
        elif record_id not in database_ids:
            errors.append(f"{prefix}.record_id does not exist in the database: {record_id}")
        seen.add(record_id)
        for field in ("canonical_name", "subject_tags", "eligible_grades", "eligible_ages", "eligible_curricula", "languages", "evidence", "missing_fields", "conflicts"):
            if field not in row:
                errors.append(f"{prefix}.{field} is required")
        if row.get("reviewer_confidence") not in CONFIDENCE:
            errors.append(f"{prefix}.reviewer_confidence is invalid")
        if row.get("participation_format") not in FORMATS:
            errors.append(f"{prefix}.participation_format is invalid")
        if row.get("team_mode") not in TEAM_MODES:
            errors.append(f"{prefix}.team_mode is invalid")
        if row.get("region_tier") is not None and row.get("region_tier") not in REGION_TIERS:
            errors.append(f"{prefix}.region_tier is invalid")
        cycle = row.get("cycle")
        if not isinstance(cycle, dict) or cycle.get("status") not in CYCLE_STATUSES:
            errors.append(f"{prefix}.cycle/status is invalid")
        if not isinstance(row.get("cost"), dict):
            errors.append(f"{prefix}.cost must be an object")
        for evidence_index, evidence in enumerate(row.get("evidence", [])):
            if not isinstance(evidence, dict):
                errors.append(f"{prefix}.evidence[{evidence_index}] must be an object")
                continue
            url = urlparse(str(evidence.get("url") or ""))
            if url.scheme != "https" or not url.hostname:
                warnings.append(f"{prefix}.evidence[{evidence_index}].url was ignored because it is not HTTPS")
            if not isinstance(evidence.get("supports_fields"), list):
                errors.append(f"{prefix}.evidence[{evidence_index}].supports_fields must be an array")
    missing = database_ids - seen
    if missing:
        errors.append(f"submission omits {len(missing)} database competition IDs")
    return records, errors, warnings


def evidence_status(source_type: str, count: int) -> str:
    if source_type == "official":
        return "official"
    return "corroborated" if count >= 2 else "single_source"


def map_record(existing: dict[str, Any], review: dict[str, Any], artifact_hash: str) -> dict[str, Any]:
    record = dict(existing)
    cycle = review["cycle"]
    cost = review["cost"]
    supplied_url = str(review.get("official_url") or "")
    parsed_supplied_url = urlparse(supplied_url)
    retained_urls = [
        source.get("original_url") for source in existing.get("sources", [])
        if source.get("source_type") == "web_snapshot"
        and str(source.get("original_url") or "").startswith("https://")
    ]
    existing_url = str(existing.get("website_url") or "")
    safe_website_url = (
        supplied_url if parsed_supplied_url.scheme == "https" and parsed_supplied_url.hostname
        else existing_url if existing_url.startswith("https://")
        else retained_urls[0] if retained_urls
        else None
    )
    mapped = {
        "canonical_name": review["canonical_name"],
        "name_en": review["canonical_name"],
        "organizer": review.get("organizer"),
        "website_url": safe_website_url,
        "subject_tags": review.get("subject_tags") or [],
        "category": review.get("competition_category"),
        "region_tier": review.get("region_tier"),
        "country": review.get("country"),
        "city": review.get("city"),
        "format": review.get("participation_format") or "unknown",
        "eligibility_text": review.get("eligibility_text"),
        "eligible_grades": review.get("eligible_grades") or [],
        "eligible_ages": review.get("eligible_ages") or [],
        "eligible_curricula": review.get("eligible_curricula") or [],
        "languages": review.get("languages") or [],
        "team_mode": review.get("team_mode") or "unknown",
        "current_cycle_status": cycle.get("status") or "unknown",
        "deadline_date": cycle.get("registration_deadline"),
        "deadline_text": cycle.get("registration_deadline") or "",
        "start_date": cycle.get("start_date"),
        "end_date": cycle.get("end_date"),
        "date_text": cycle.get("date_text") or "",
        "cost_text": cost.get("text") or "",
        "cost_amount": cost.get("amount"),
        "cost_currency": cost.get("currency"),
        "time_commitment": review.get("time_commitment") or "",
        "description": review.get("description") or "",
        "awards_and_recognition": review.get("awards_and_recognition"),
        "china_participation_route": review.get("china_participation_route"),
    }
    record.update(mapped)

    confidence = review["reviewer_confidence"]
    has_retained_web_evidence = any(
        source.get("source_type") == "web_snapshot"
        and source.get("snapshot_path")
        and (ROOT / source["snapshot_path"]).exists()
        for source in existing.get("sources", [])
    )
    record["publication_status"] = (
        "unverified" if confidence == "unverified"
        else "official_verified" if confidence == "official_verified" and has_retained_web_evidence
        else "partially_verified"
    )
    record["confidence"] = "verified" if confidence == "official_verified" else confidence
    record["last_verified_at"] = max(
        (str(item.get("retrieved_at"))[:10] for item in review.get("evidence", []) if item.get("retrieved_at")),
        default=(
            existing.get("last_verified_at")
            or next((str(source.get("retrieved_at"))[:10] for source in existing.get("sources", []) if source.get("source_type") == "web_snapshot" and source.get("retrieved_at")), None)
        ),
    )
    record["verification_note"] = review.get("review_notes") or "Imported from the structured competition research review."
    record["review_conflicts"] = review.get("conflicts") or []
    record["review_missing_fields"] = review.get("missing_fields") or []

    source = {
        "source_file": ARCHIVE.name,
        "source_type": "structured_review",
        "page_or_sheet": "records",
        "row_or_text_ref": review["record_id"],
        "raw_excerpt": (review.get("review_notes") or review["canonical_name"])[:900],
        "extracted_at": datetime.fromtimestamp(ARCHIVE.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat(),
        "source_id": "competition-research-completed-v1",
        "snapshot_path": ARCHIVE.relative_to(ROOT).as_posix(),
        "content_hash": artifact_hash,
        "extraction_locator": f"records[record_id={review['record_id']}]",
    }
    sources = [item for item in record.get("sources", []) if item.get("source_id") != source["source_id"]]
    sources.append(source)
    record["sources"] = sources

    evidence = [item for item in record.get("evidence", []) if not str(item.get("evidence_id", "")).startswith("research-")]
    field_refs: dict[str, list[tuple[str, str]]] = {}
    for index, item in enumerate(review.get("evidence", []), start=1):
        parsed_url = urlparse(str(item.get("url") or ""))
        if parsed_url.scheme != "https" or not parsed_url.hostname:
            continue
        evidence_id = f"research-{review['record_id']}-{index}"
        source_type = str(item.get("source_type") or "reputable_secondary")
        authority = "official" if source_type == "official" else "government" if source_type == "government" else "school" if source_type == "school" else "reputable_secondary"
        evidence.append({
            "evidence_id": evidence_id,
            "url": item["url"],
            "publisher": item.get("publisher") or "Web source",
            "authority": authority,
            "retrieved_at": item.get("retrieved_at"),
            "source_id": "competition-research-completed-v1",
            "note": item.get("excerpt") or "",
        })
        for field in item.get("supports_fields", []):
            field_refs.setdefault(field, []).append((evidence_id, source_type))
    record["evidence"] = evidence

    aliases = {
        "official_url": "website_url", "competition_category": "category",
        "participation_format": "format", "cycle": "current_cycle_status", "cost": "cost_text",
    }
    field_evidence = dict(record.get("field_evidence", {}))
    for research_field, database_field in aliases.items():
        if research_field in field_refs and database_field not in field_refs:
            field_refs[database_field] = field_refs[research_field]
    for field in catalog.FACT_FIELDS:
        refs = field_refs.get(field, [])
        if present(record.get(field)) and refs:
            types = [source_type for _, source_type in refs]
            status = "official" if "official" in types else evidence_status(types[0], len(refs))
            field_evidence[field] = {"status": status, "evidence_ids": [evidence_id for evidence_id, _ in refs]}
        elif not present(record.get(field)):
            field_evidence[field] = {"status": "missing", "evidence_ids": []}
    record["field_evidence"] = field_evidence
    return record


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and import a completed competition research queue")
    parser.add_argument("input", type=Path)
    parser.add_argument("--check", action="store_true", help="validate without writing")
    args = parser.parse_args()

    raw = args.input.read_bytes()
    payload = json.loads(raw.decode("utf-8-sig"))
    database = {record["id"]: record for record in catalog.load_database_records()}
    competitions = {record_id: record for record_id, record in database.items() if record.get("type") == "competition"}
    submitted = payload.get("records", []) if isinstance(payload, dict) else []
    reconciled, resolutions = reconcile_ids(submitted, competitions) if isinstance(submitted, list) else ([], [])
    normalized_payload = {**payload, "records": reconciled} if isinstance(payload, dict) else payload
    reviews, errors, warnings = validate_payload(normalized_payload, set(competitions))
    if errors:
        raise ValueError("Research import validation failed:\n- " + "\n- ".join(errors))

    if args.check:
        print(json.dumps({"valid": True, "records": len(reviews), "id_resolutions": len(resolutions), "warnings": warnings}, indent=2))
        return

    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.input, ARCHIVE)
    artifact_hash = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
    updated = [map_record(competitions[row["record_id"]], row, artifact_hash) for row in reviews]
    for record in updated:
        catalog.write_database_record(record)

    report = {
        "schema_version": 1,
        "source": ARCHIVE.relative_to(ROOT).as_posix(),
        "content_hash": artifact_hash,
        "records_received": len(reviews),
        "records_updated": len(updated),
        "reviewer_confidence": dict(Counter(row["reviewer_confidence"] for row in reviews)),
        "records_with_missing_fields": sum(bool(row.get("missing_fields")) for row in reviews),
        "records_without_evidence": sum(not row.get("evidence") for row in reviews),
        "id_resolutions": resolutions,
        "warnings": warnings,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
