"""Audit competition catalog quality for Tier-A and China coverage."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "reports" / "competition_audit.txt"
GEN = ROOT / "src" / "data" / "opportunities.generated.json"
TIER = ROOT / "data" / "curation" / "tier_a_competitions.json"
DEFERRED = ROOT / "data" / "curation" / "deferred_gaps.json"
REPORT = ROOT / "data" / "reports" / "competition_enrichment_report.json"


def match_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def main() -> None:
    payload = json.loads(GEN.read_text(encoding="utf-8"))
    records = payload.get("records", [])
    comps = [r for r in records if r.get("type") == "competition"]
    tier_names = [match_key(n) for n in json.loads(TIER.read_text(encoding="utf-8")).get("competitions", [])]
    tier_set = set(tier_names)
    tier = []
    for r in comps:
        names = {match_key(str(r.get("canonical_name") or "")), match_key(str(r.get("name_en") or ""))}
        names |= {match_key(a) for a in (r.get("aliases") or [])}
        if names & tier_set:
            tier.append(r)

    def rate(items, pred):
        n = len(items) or 1
        filled = sum(1 for item in items if pred(item))
        return filled, len(items), round(100 * filled / n, 1)

    def has_deadline(r):
        return bool(r.get("deadline_date") or r.get("deadline_text") or (r.get("current_cycle_status") not in (None, "", "unknown")))

    def has_cost(r):
        return r.get("cost_amount") is not None or bool(r.get("cost_text"))

    def tags_ok(r):
        tags = r.get("subject_tags") or []
        return bool(tags) and not (len(tags) == 1 and str(tags[0]).lower() == "multiple")

    gap_families = {
        "UKMT/BMO": any("ukmt" in match_key(r.get("canonical_name", "")) or "britishmathematical" in match_key(r.get("canonical_name", "")) for r in comps),
        "COMC": any("canadianopenmathematics" in match_key(r.get("canonical_name", "")) or match_key(r.get("canonical_name", "")) == "comc" for r in comps),
        "Euclid": any("euclid" in match_key(r.get("canonical_name", "")) for r in comps),
        "DECA": any("deca" in match_key(r.get("canonical_name", "")) for r in comps),
        "FBLA": any("fbla" in match_key(r.get("canonical_name", "")) for r in comps),
        "Scholastic Art & Writing": any("scholastic" in match_key(r.get("canonical_name", "")) for r in comps),
        "National History Day": any("nationalhistoryday" in match_key(r.get("canonical_name", "")) or "historyday" in match_key(r.get("canonical_name", "")) for r in comps),
        "HOSA": any("hosa" in match_key(r.get("canonical_name", "")) for r in comps),
        "BPhO": any("britishphysics" in match_key(r.get("canonical_name", "")) or "bpho" in match_key(r.get("canonical_name", "")) for r in comps),
        "F=ma": any(match_key(r.get("canonical_name", "")) in {"fma", "fmacontest"} or "f=ma" in (r.get("canonical_name") or "").lower() for r in comps),
    }

    deferred = json.loads(DEFERRED.read_text(encoding="utf-8")).get("deferred", []) if DEFERRED.exists() else []
    enrichment = json.loads(REPORT.read_text(encoding="utf-8")) if REPORT.exists() else {}

    lines = []
    lines.append("Project Pursuit competition audit")
    lines.append(f"generated_catalog: {GEN}")
    lines.append(f"competitions_total: {len(comps)}")
    lines.append(f"tier_a_size: {len(tier_names)}")
    lines.append(f"tier_a_matched: {len(tier)}")
    lines.append("tier_a_names:")
    for name in json.loads(TIER.read_text(encoding="utf-8")).get("competitions", []):
        lines.append(f"  - {name}")
    metrics = {
        "deadline_signal": rate(tier, has_deadline),
        "cost_signal": rate(tier, has_cost),
        "entry_pathway": rate(tier, lambda r: bool(r.get("entry_pathway"))),
        "name_zh": rate(tier, lambda r: bool(r.get("name_zh"))),
        "region_tier": rate(tier, lambda r: bool(r.get("region_tier"))),
        "eligible_grades": rate(tier, lambda r: bool(r.get("eligible_grades"))),
        "website": rate(tier, lambda r: bool(r.get("website_url"))),
        "tags_non_multiple": rate(tier, tags_ok),
    }
    lines.append("tier_a_fill_rates:")
    for key, (filled, total, pct) in metrics.items():
        lines.append(f"  {key}: {filled}/{total} ({pct}%)")
    lines.append("china_competition_tiers:")
    for tier_name in ["china_participation_route", "mainland_china", "greater_china", "shanghai_local"]:
        count = sum(1 for r in comps if r.get("region_tier") == tier_name)
        lines.append(f"  {tier_name}: {count}")
    lines.append("priority_gap_families:")
    for name, present in gap_families.items():
        lines.append(f"  {name}: {'present' if present else 'MISSING'}")
    lines.append("deferred_gaps:")
    for item in deferred:
        lines.append(f"  - {item.get('name')}: {item.get('reason')}")
    lines.append("duplicate_cleanup_actions:")
    lines.append("  - competition_cleanup.json aliases/organizers/split/drop applied via import pipeline")
    lines.append(f"  - enrichment overlays_applied: {enrichment.get('overlays_applied')}")
    lines.append(f"  - gap_records_created: {enrichment.get('gap_records_created')}")
    lines.append(f"  - missing_overlays: {enrichment.get('missing_overlays')}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(OUT)
    print("\n".join(lines[:40]))


if __name__ == "__main__":
    main()
