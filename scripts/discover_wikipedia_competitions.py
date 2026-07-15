from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "reviews" / "mass" / "wikipedia_competitions.json"
API = "https://en.wikipedia.org/w/api.php"
CATEGORIES = {
    "International Science Olympiads": ["STEM"],
    "International competitions": ["Multiple"],
    "Academic competitions": ["Multiple"],
    "Educational competitions": ["Multiple"],
    "Science fairs": ["Scientific research"],
    "Youth awards": ["Multiple"],
    "Student competitions": ["Multiple"],
    "Science competitions": ["Scientific research"],
    "Mathematics competitions": ["Mathematics"],
    "Programming contests": ["Computer Science"],
    "Robotics competitions": ["Robotics", "Engineering"],
    "Writing contests": ["Writing"],
    "Business plan competitions": ["Business"],
    "Debating competitions": ["Public Speaking", "Social Science"],
    "Physics competitions": ["Physics"],
    "Chemistry competitions": ["Chemistry"],
    "Biology competitions": ["Biology"],
}
YOUTH = re.compile(r"high school|secondary (?:school|education)|school students?|pre.?college|pre.?university|teen(?:ager)?s?|youth|young people|under.?18|grades?\s+(?:[6-9]|1[0-2])|students? aged|school-level|pupils", re.I)
INTERNATIONAL = re.compile(r"international|world(?:wide| championship| finals?)|global|countries|nations|national teams", re.I)
INACTIVE = re.compile(r"(?:was|were) an? .*competition|discontinued|defunct|last held|final year", re.I)


def api(params: dict[str, str]) -> dict:
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    request = urllib.request.Request(url, headers={"User-Agent": "ProjectPursuit/1.0 (educational catalog)"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                payload = json.loads(response.read().decode("utf-8"))
                time.sleep(0.1)
                return payload
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 5:
                raise
            retry_after = error.headers.get("Retry-After")
            time.sleep(float(retry_after) if retry_after and retry_after.isdigit() else 2 ** (attempt + 1))
    raise RuntimeError("Wikipedia API retry loop exhausted")


def category_pages(category: str, max_depth: int = 1, max_categories: int = 3, max_pages: int = 200) -> list[dict]:
    """Walk category subtrees so competitions below the root are discovered."""
    pages: dict[int, dict] = {}
    queue = [(category, 0)]
    visited: set[str] = set()
    while queue and len(visited) < max_categories:
        current, depth = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)
        continuation = ""
        while True:
            params = {"action": "query", "list": "categorymembers", "cmtitle": f"Category:{current}", "cmnamespace": "0|14", "cmlimit": "500"}
            if continuation:
                params["cmcontinue"] = continuation
            payload = api(params)
            for member in payload.get("query", {}).get("categorymembers", []):
                if member.get("ns") == 0:
                    pages[member["pageid"]] = member
                    if len(pages) >= max_pages:
                        return list(pages.values())
                elif depth < max_depth and member.get("title", "").startswith("Category:"):
                    queue.append((member["title"][9:], depth + 1))
            continuation = payload.get("continue", {}).get("cmcontinue", "")
            if not continuation:
                break
    return list(pages.values())


def extracts(pageids: list[int]) -> dict[int, dict]:
    found: dict[int, dict] = {}
    for start in range(0, len(pageids), 20):
        payload = api({"action": "query", "prop": "extracts|info", "pageids": "|".join(map(str, pageids[start:start + 20])), "exintro": "1", "explaintext": "1", "inprop": "url"})
        for page in payload.get("query", {}).get("pages", []): found[page["pageid"]] = page
    return found


def main() -> None:
    discovered: dict[int, dict] = {}
    page_subjects: dict[int, set[str]] = {}
    page_categories: dict[int, set[str]] = {}
    for category, subjects in CATEGORIES.items():
        for page in category_pages(category):
            discovered[page["pageid"]] = page
            page_subjects.setdefault(page["pageid"], set()).update(subjects)
            page_categories.setdefault(page["pageid"], set()).add(category)
    detail = extracts(sorted(discovered))
    records = []
    for pageid, page in sorted(detail.items(), key=lambda item: item[1].get("title", "")):
        title = page.get("title", "").strip()
        description = page.get("extract", "").strip()
        haystack = f"{title} {description}"
        if not title or not description or not YOUTH.search(haystack) or not INTERNATIONAL.search(haystack) or INACTIVE.search(description):
            continue
        records.append({
            "canonical_name": title, "name_zh": None, "type": "competition",
            "subject_tags": sorted(page_subjects.get(pageid, {"Multiple"})),
            "category": ", ".join(sorted(page_categories.get(pageid, []))), "organizer": None,
            "region": "International", "region_tier": "international_only", "country": None, "city": None,
            "format": None, "date_text": None, "deadline_text": None, "deadline_date": None,
            "start_date": None, "end_date": None, "current_cycle_status": "unknown",
            "eligibility_text": None, "eligible_grades": None, "eligible_ages": None,
            "languages": None, "team_mode": None, "cost_text": None, "time_commitment": None,
            "description": description[:1200], "website_url": page.get("fullurl"),
            "confidence": "unverified", "evidence_urls": [page.get("fullurl")],
            "audience_scope": "unknown", "entry_pathway": None,
            "source_publisher": "Wikipedia contributors",
            "evidence_note": "Secondary-source category discovery; organizer verification and current-cycle enrichment are still required."
        })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"schema_version": 1, "records": records}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"category_pages": len(discovered), "youth_competitions": len(records), "output": str(OUTPUT)}, indent=2))


if __name__ == "__main__":
    main()
