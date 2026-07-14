from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "src" / "data" / "opportunities.generated.json"
OUTPUT = ROOT / "data" / "reports" / "competition_research_queue.json"


def main() -> None:
    records = json.loads(CATALOG.read_text(encoding="utf-8"))["records"]
    queue = []
    for record in records:
        if record["type"] != "competition":
            continue
        queue.append({
            "record_id": record["id"],
            "canonical_name": record["canonical_name"],
            "organizer": record.get("organizer") or None,
            "official_url": record.get("website_url") or None,
            "subject_tags": record.get("subject_tags") or [],
            "competition_category": record.get("category") or None,
            "region_tier": record.get("region_tier") or None,
            "country": record.get("country") or None,
            "city": record.get("city") or None,
            "participation_format": None,
            "eligibility_text": record.get("eligibility_text") or None,
            "eligible_grades": record.get("eligible_grades") or [],
            "eligible_ages": record.get("eligible_ages") or [],
            "eligible_curricula": record.get("eligible_curricula") or [],
            "languages": record.get("languages") or [],
            "team_mode": None,
            "cycle": {"label": None, "status": None, "registration_deadline": None, "start_date": None, "end_date": None, "date_text": None},
            "cost": {"text": None, "amount": None, "currency": None},
            "time_commitment": None,
            "description": None,
            "awards_and_recognition": None,
            "china_participation_route": None,
            "evidence": [],
            "missing_fields": [],
            "conflicts": [],
            "reviewer_confidence": "unverified",
            "review_notes": None
        })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"schema_version": 1, "records": queue}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"records": len(queue), "output": str(OUTPUT)}, indent=2))


if __name__ == "__main__":
    main()
