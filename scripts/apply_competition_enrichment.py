"""Apply curated competition enrichment, gap records, pathway edges, and regenerate public catalog."""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATABASE_DIR = ROOT / "data" / "opportunities"
DATABASE_INDEX = DATABASE_DIR / "index.json"
CURATION_DIR = ROOT / "data" / "curation"
OUT_DIR = ROOT / "src" / "data"
ENRICHMENT_PATH = CURATION_DIR / "competition_enrichment.json"
TIER_A_PATH = CURATION_DIR / "tier_a_competitions.json"
GAP_PATH = CURATION_DIR / "gap_competitions.json"
PATHWAY_PATH = CURATION_DIR / "pathway_edges.json"
DEFERRED_PATH = CURATION_DIR / "deferred_gaps.json"
REPORT_PATH = ROOT / "data" / "reports" / "competition_enrichment_report.json"

FACT_FIELDS = [
    "canonical_name", "name_zh", "name_en", "organizer", "type", "subject_tags", "category",
    "region", "region_tier", "country", "city", "format", "date_text", "deadline_text",
    "deadline_date", "start_date", "end_date", "current_cycle_status", "eligibility_text",
    "eligible_grades", "eligible_ages", "eligible_curricula", "languages", "team_mode",
    "duration_text", "website_url", "registration_contact", "instructor_contact", "preparation",
    "description", "cost_text", "cost_amount", "cost_currency", "time_commitment",
    "entry_pathway", "audience_scope", "aliases", "difficulty_level", "recognition_level",
    "route_type",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def slug(value: str) -> str:
    clean = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return clean[:80] if clean else hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def normalize_grades(value: Any) -> list[str] | None:
    if value in (None, "", []):
        return None
    if not isinstance(value, list):
        value = [value]
    out: list[str] = []
    for item in value:
        text = str(item).strip()
        if not text:
            continue
        # normalize "Grade 11" -> "11"
        m = re.search(r"(9|10|11|12)", text)
        out.append(m.group(1) if m else text)
    return out or None


def normalize_tags(tags: Any) -> list[str]:
    if not isinstance(tags, list):
        tags = [tags] if tags else []
    cleaned: list[str] = []
    for tag in tags:
        text = str(tag).strip()
        if not text or text.lower() == "multiple":
            continue
        # collapse near-duplicates
        aliases = {
            "programming": "Computer Science",
            "computing": "Computer Science",
            "software development": "Computer Science",
            "software engineering": "Computer Science",
            "math": "Mathematics",
            "scientific research": "Scientific research",
            "research": "Scientific research",
        }
        canonical = aliases.get(text.lower(), text)
        if canonical not in cleaned:
            cleaned.append(canonical)
    return cleaned or ["Interdisciplinary"]


def database_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(record)
    normalized["schema_version"] = 1
    normalized["type"] = "competition"
    if normalized.get("eligible_grades") is not None:
        normalized["eligible_grades"] = normalize_grades(normalized.get("eligible_grades"))
    if normalized.get("subject_tags") is not None:
        normalized["subject_tags"] = normalize_tags(normalized.get("subject_tags"))
    if not normalized.get("format"):
        normalized["format"] = "unknown"
    if not normalized.get("publication_status"):
        normalized["publication_status"] = "partially_verified"
    if not normalized.get("confidence"):
        normalized["confidence"] = "partially_verified"
    evidence = list(normalized.get("evidence") or [])
    if not evidence:
        for index, source in enumerate(normalized.get("sources") or [], start=1):
            evidence.append({
                "evidence_id": f'{normalized["id"]}-e{index}',
                "url": source.get("original_url"),
                "publisher": source.get("source_id") or source.get("source_file") or "curation",
                "authority": "reputable_secondary" if source.get("source_type") in {"web_reference", "structured_review", "curated_enrichment"} else "school",
                "retrieved_at": source.get("retrieved_at") or source.get("extracted_at"),
                "source_id": source.get("source_id"),
                "note": (source.get("raw_excerpt") or "")[:240],
            })
    normalized["evidence"] = evidence
    evidence_ids = [item["evidence_id"] for item in evidence]
    field_evidence = dict(normalized.get("field_evidence") or {})
    for field in FACT_FIELDS:
        value = normalized.get(field)
        if value in (None, "", []):
            field_evidence[field] = {"status": "missing", "evidence_ids": []}
        elif field not in field_evidence or field_evidence[field].get("status") == "missing":
            field_evidence[field] = {"status": "single_source", "evidence_ids": evidence_ids[:1] or []}
    normalized["field_evidence"] = field_evidence
    return normalized


def public_projection(record: dict[str, Any]) -> dict[str, Any]:
    projected = {key: value for key, value in record.items() if key not in {"schema_version", "evidence", "field_evidence"}}
    source_fields = {"source_file", "source_type", "page_or_sheet", "row_or_text_ref", "source_id", "original_url", "retrieved_at"}
    projected["sources"] = [
        {key: value for key, value in source.items() if key in source_fields and value not in (None, "")}
        for source in record.get("sources", [])
    ]
    return projected


def load_database() -> dict[str, dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}
    if not DATABASE_INDEX.exists():
        return records
    for record_id in load_json(DATABASE_INDEX).get("records", []):
        path = DATABASE_DIR / f"{record_id}.json"
        if path.exists():
            records[record_id] = load_json(path)
    return records


def match_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def find_record(records: dict[str, dict[str, Any]], query: dict[str, Any]) -> dict[str, Any] | None:
    by_id = query.get("id")
    if by_id and by_id in records:
        return records[by_id]
    names = [query.get("canonical_name"), *(query.get("match_names") or [])]
    keys = {match_key(n) for n in names if n}
    for record in records.values():
        if record.get("type") != "competition":
            continue
        candidates = [record.get("canonical_name"), record.get("name_en"), *(record.get("aliases") or [])]
        if any(match_key(str(c)) in keys for c in candidates if c):
            return record
    return None


def apply_overlay(record: dict[str, Any], overlay: dict[str, Any], stamp: str) -> dict[str, Any]:
    updated = dict(record)
    fields = overlay.get("fields") or {k: v for k, v in overlay.items() if k not in {"id", "canonical_name", "match_names", "tier_a", "notes"}}
    for key, value in fields.items():
        if value is None:
            continue
        if key == "eligible_grades":
            value = normalize_grades(value)
        if key == "subject_tags":
            value = normalize_tags(value)
        if key == "aliases" and isinstance(value, list):
            existing = list(updated.get("aliases") or [])
            for alias in value:
                if alias not in existing:
                    existing.append(alias)
            value = existing
        updated[key] = value
    # strip bare Multiple if other tags exist
    if updated.get("subject_tags"):
        updated["subject_tags"] = normalize_tags(updated["subject_tags"])
    sources = list(updated.get("sources") or [])
    source_id = "competition-enrichment-v1"
    if not any(s.get("source_id") == source_id for s in sources):
        sources.append({
            "source_file": "competition_enrichment.json",
            "source_type": "curated_enrichment",
            "page_or_sheet": "records",
            "row_or_text_ref": updated.get("canonical_name") or updated.get("id"),
            "raw_excerpt": overlay.get("notes") or "Curated competition enrichment for Tier-A decision fields and China pathways.",
            "extracted_at": stamp,
            "source_id": source_id,
            "snapshot_path": "data/curation/competition_enrichment.json",
            "content_hash": hashlib.sha256(ENRICHMENT_PATH.read_bytes()).hexdigest() if ENRICHMENT_PATH.exists() else None,
            "extraction_locator": f"enrichment[{updated.get('id')}]",
        })
    updated["sources"] = sources
    if not updated.get("verification_note"):
        updated["verification_note"] = "Enriched from curated Tier-A competition pack; re-check official organizer pages for cycle-sensitive deadlines."
    elif "Enriched from curated" not in updated["verification_note"]:
        updated["verification_note"] = updated["verification_note"] + " Enriched from curated Tier-A competition pack."
    updated["last_verified_at"] = updated.get("last_verified_at") or stamp[:10]
    return database_record(updated)


def create_gap_record(spec: dict[str, Any], stamp: str) -> dict[str, Any]:
    name = spec["canonical_name"]
    record_id = spec.get("id") or f"curated-contest-{slug(name)}"
    record = {
        "id": record_id,
        "canonical_name": name,
        "name_en": spec.get("name_en") or name,
        "name_zh": spec.get("name_zh") or "",
        "aliases": spec.get("aliases") or [],
        "type": "competition",
        "subject_tags": normalize_tags(spec.get("subject_tags") or ["Interdisciplinary"]),
        "category": spec.get("category") or ", ".join(normalize_tags(spec.get("subject_tags") or [])),
        "organizer": spec.get("organizer"),
        "region": spec.get("region") or "International",
        "region_tier": spec.get("region_tier") or "international_only",
        "country": spec.get("country"),
        "city": spec.get("city"),
        "format": spec.get("format") or "unknown",
        "date_text": spec.get("date_text"),
        "deadline_text": spec.get("deadline_text"),
        "deadline_date": spec.get("deadline_date"),
        "start_date": spec.get("start_date"),
        "end_date": spec.get("end_date"),
        "current_cycle_status": spec.get("current_cycle_status") or "unknown",
        "eligibility_text": spec.get("eligibility_text"),
        "eligible_grades": normalize_grades(spec.get("eligible_grades") or ["9", "10", "11", "12"]),
        "eligible_ages": spec.get("eligible_ages"),
        "eligible_curricula": spec.get("eligible_curricula") or [],
        "languages": spec.get("languages") or ["English"],
        "team_mode": spec.get("team_mode") or "unknown",
        "website_url": spec.get("website_url"),
        "description": spec.get("description") or "",
        "cost_text": spec.get("cost_text"),
        "cost_amount": spec.get("cost_amount"),
        "cost_currency": spec.get("cost_currency"),
        "time_commitment": spec.get("time_commitment") or "medium",
        "entry_pathway": spec.get("entry_pathway"),
        "audience_scope": spec.get("audience_scope") or "global_open",
        "route_type": spec.get("route_type") or "official",
        "difficulty_level": spec.get("difficulty_level"),
        "recognition_level": spec.get("recognition_level"),
        "preparation": spec.get("preparation"),
        "confidence": "partially_verified",
        "publication_status": "partially_verified",
        "last_verified_at": stamp[:10],
        "verification_note": spec.get("verification_note")
            or "Curated gap-fill competition record from official public organizer information; cycle dates may change annually.",
        "sources": [{
            "source_file": "gap_competitions.json",
            "source_type": "curated_enrichment",
            "page_or_sheet": "records",
            "row_or_text_ref": name,
            "raw_excerpt": spec.get("description") or name,
            "extracted_at": stamp,
            "source_id": "competition-gap-fill-v1",
            "original_url": spec.get("website_url"),
            "snapshot_path": "data/curation/gap_competitions.json",
            "extraction_locator": f"gap[{record_id}]",
        }],
    }
    return database_record(record)


def write_database(records: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    ordered = sorted(records.values(), key=lambda item: (item.get("type", ""), item.get("canonical_name", "").lower()))
    current = {f'{item["id"]}.json' for item in ordered}
    for path in DATABASE_DIR.glob("*.json"):
        if path.name != DATABASE_INDEX.name and path.name not in current:
            # keep non-touched files; only rewrite ones we manage via full rewrite of index
            pass
    for item in ordered:
        save_json(DATABASE_DIR / f'{item["id"]}.json', item)
    # remove only competition files no longer present if we replaced via id map - keep all in records map
    for path in list(DATABASE_DIR.glob("*.json")):
        if path.name == DATABASE_INDEX.name:
            continue
        if path.name not in current:
            # do not delete programs etc. that are in records
            pass
    # rebuild index from all files currently on disk after writes
    all_ids = sorted(p.stem for p in DATABASE_DIR.glob("*.json") if p.name != DATABASE_INDEX.name)
    # ensure our ordered records are on disk; merge with leftover non-competition files already written
    remaining = {}
    for record_id in all_ids:
        if record_id in records:
            remaining[record_id] = records[record_id]
        else:
            remaining[record_id] = load_json(DATABASE_DIR / f"{record_id}.json")
    save_json(DATABASE_INDEX, {"schema_version": 1, "records": sorted(remaining.keys())})
    return sorted(remaining.values(), key=lambda item: (item.get("type", ""), item.get("canonical_name", "").lower()))


def regenerate_public(all_records: list[dict[str, Any]], stamp: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    public = [public_projection(record) for record in all_records]
    output = {
        "generated_at": stamp,
        "source_scope": "offline_files_and_official_web_snapshots_plus_curated_enrichment",
        "records": public,
    }
    save_json(OUT_DIR / "opportunities.generated.json", output)
    metadata = {
        "total": len(public),
        "competitions": sum(record.get("type") == "competition" for record in public),
        "programs": sum(record.get("type") != "competition" for record in public),
        "official_web_records": sum(
            any(source.get("source_type") == "web_snapshot" for source in record.get("sources", []))
            for record in public
        ),
        "tier_a": len(load_json(TIER_A_PATH).get("competitions", [])) if TIER_A_PATH.exists() else 0,
    }
    save_json(OUT_DIR / "catalog-metadata.generated.json", metadata)
    # emit pathway edges for the app
    if PATHWAY_PATH.exists():
        edges = load_json(PATHWAY_PATH)
        save_json(OUT_DIR / "pathway-edges.generated.json", edges)


def completeness_metrics(records: list[dict[str, Any]], tier_names: set[str]) -> dict[str, Any]:
    comps = [r for r in records if r.get("type") == "competition"]
    tier = []
    for r in comps:
        names = {match_key(str(r.get("canonical_name") or "")), match_key(str(r.get("name_en") or ""))}
        aliases = {match_key(a) for a in (r.get("aliases") or [])}
        if names & tier_names or aliases & tier_names:
            tier.append(r)
    def rate(items: list[dict[str, Any]], pred) -> dict[str, Any]:
        n = len(items) or 1
        filled = sum(1 for item in items if pred(item))
        return {"filled": filled, "total": len(items), "pct": round(100 * filled / n, 1)}
    def has_deadline(r):
        return bool(r.get("deadline_date") or r.get("deadline_text") or (r.get("current_cycle_status") not in (None, "", "unknown")))
    def has_cost(r):
        return r.get("cost_amount") is not None or bool(r.get("cost_text"))
    def tags_ok(r):
        tags = r.get("subject_tags") or []
        return bool(tags) and not (len(tags) == 1 and str(tags[0]).lower() == "multiple")
    return {
        "competitions_total": len(comps),
        "tier_a_matched": len(tier),
        "tier_a": {
            "deadline_signal": rate(tier, has_deadline),
            "cost_signal": rate(tier, has_cost),
            "entry_pathway": rate(tier, lambda r: bool(r.get("entry_pathway"))),
            "name_zh": rate(tier, lambda r: bool(r.get("name_zh"))),
            "region_tier": rate(tier, lambda r: bool(r.get("region_tier"))),
            "eligible_grades": rate(tier, lambda r: bool(r.get("eligible_grades"))),
            "website": rate(tier, lambda r: bool(r.get("website_url"))),
            "tags_non_multiple": rate(tier, tags_ok),
            "organizer": rate(tier, lambda r: bool(r.get("organizer"))),
            "languages": rate(tier, lambda r: bool(r.get("languages"))),
            "team_mode": rate(tier, lambda r: bool(r.get("team_mode")) and r.get("team_mode") != "unknown"),
        },
        "china_tiers": {
            "china_participation_route": sum(1 for r in comps if r.get("region_tier") == "china_participation_route"),
            "mainland_china": sum(1 for r in comps if r.get("region_tier") == "mainland_china"),
            "greater_china": sum(1 for r in comps if r.get("region_tier") == "greater_china"),
            "shanghai_local": sum(1 for r in comps if r.get("region_tier") == "shanghai_local"),
        },
    }


def main() -> None:
    stamp = now_iso()
    records = load_database()
    enrichment = load_json(ENRICHMENT_PATH) if ENRICHMENT_PATH.exists() else {"records": []}
    gaps = load_json(GAP_PATH) if GAP_PATH.exists() else {"records": []}
    tier_a = load_json(TIER_A_PATH) if TIER_A_PATH.exists() else {"competitions": []}
    deferred = load_json(DEFERRED_PATH) if DEFERRED_PATH.exists() else {"deferred": []}

    applied = []
    missing_overlays = []
    for overlay in enrichment.get("records", []):
        found = find_record(records, overlay)
        if not found:
            missing_overlays.append(overlay.get("canonical_name") or overlay.get("id"))
            continue
        updated = apply_overlay(found, overlay, stamp)
        records[updated["id"]] = updated
        applied.append(updated["id"])

    created = []
    for spec in gaps.get("records", []):
        existing = find_record(records, spec)
        if existing:
            updated = apply_overlay(existing, {"fields": {k: v for k, v in spec.items() if k not in {"id", "match_names"}}, "notes": "Gap record merged into existing competition."}, stamp)
            records[updated["id"]] = updated
            applied.append(updated["id"])
            continue
        created_rec = create_gap_record(spec, stamp)
        records[created_rec["id"]] = created_rec
        created.append(created_rec["id"])

    # normalize grades/tags on all competitions lightly
    for record_id, record in list(records.items()):
        if record.get("type") != "competition":
            continue
        changed = False
        if record.get("eligible_grades") is not None:
            grades = normalize_grades(record.get("eligible_grades"))
            if grades != record.get("eligible_grades"):
                record["eligible_grades"] = grades
                changed = True
        tags = normalize_tags(record.get("subject_tags") or [])
        if tags != record.get("subject_tags"):
            record["subject_tags"] = tags
            changed = True
        if changed:
            records[record_id] = database_record(record)

    all_records = write_database(records)
    regenerate_public(all_records, stamp)

    tier_names = {match_key(name) for name in tier_a.get("competitions", [])}
    metrics = completeness_metrics(all_records, tier_names)
    report = {
        "generated_at": stamp,
        "overlays_applied": len(applied),
        "gap_records_created": created,
        "missing_overlays": missing_overlays,
        "deferred_gaps": deferred.get("deferred", []),
        "metrics": metrics,
        "tier_a_names": tier_a.get("competitions", []),
    }
    save_json(REPORT_PATH, report)
    print(json.dumps({
        "overlays_applied": len(applied),
        "created": len(created),
        "missing_overlays": len(missing_overlays),
        "competitions": metrics["competitions_total"],
        "tier_a_matched": metrics["tier_a_matched"],
        "tier_a_deadline_pct": metrics["tier_a"]["deadline_signal"]["pct"],
        "tier_a_pathway_pct": metrics["tier_a"]["entry_pathway"]["pct"],
        "tier_a_name_zh_pct": metrics["tier_a"]["name_zh"]["pct"],
    }, indent=2))


if __name__ == "__main__":
    main()
