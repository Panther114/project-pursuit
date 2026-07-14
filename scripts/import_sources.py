from __future__ import annotations

import hashlib
import argparse
import gzip
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any

import pandas as pd
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "shsid_sources"
OUT_DIR = ROOT / "src" / "data"
REPORT_DIR = ROOT / "data" / "reports"
REGISTRY_PATH = ROOT / "data" / "sources" / "registry.json"
SNAPSHOT_DIR = ROOT / "data" / "snapshots"
VERIFIED_REVIEWS_PATH = ROOT / "data" / "reviews" / "verified.generated.json"
DATABASE_DIR = ROOT / "data" / "opportunities"
DATABASE_INDEX = DATABASE_DIR / "index.json"
MASS_DISCOVERY_DIR = ROOT / "data" / "reviews" / "mass"
MASS_SNAPSHOT_INDEX = ROOT / "data" / "snapshots" / "mass-sources-index.json"
COMPETITION_CLEANUP_PATH = ROOT / "data" / "curation" / "competition_cleanup.json"

SUBJECT_KEYWORDS = {
    "Mathematics": ["math", "mathematics", "aime", "amc", "modeling", "tournament"],
    "Computer Science": ["computer", "usaco", "csp", "noip", "it", "ai", "artificial intelligence"],
    "Scientific research": ["science research", "scientific research", "research", "invention", "innovation"],
    "Writing": ["writing", "essay", "writer", "play", "philosophy"],
    "Biology": ["biology", "brainbee", "dna"],
    "Chemistry": ["chemistry", "chemical"],
    "Physics": ["physics", "astronomy", "astrophysics"],
    "Business": ["business", "entrepreneur"],
    "Arts": ["arts", "creative", "design"],
    "Social Science": ["psychology", "social science", "linguistics", "earth science"],
}

KNOWN_CONTESTS = [
    ("National 3D Creative Design Contest", "全国三维数字化创新设计大赛"),
    ("John Locke Essay Competition", "约翰洛克写作比赛"),
    ("S.-T.Yau High School Scientific Awards Registration", "丘成桐中学科学奖（各科）申报"),
    ("Canadian Chemistry Olympiad", "加拿大化学奥林匹克"),
    ("Annual DNA Day Essay Contest", "DNA论文竞赛"),
    ("Luxun Young Award", "鲁迅青少年文学奖"),
    ("ASDAN Math Tournament", "ASDAN美式数学竞赛"),
    ("Australian Mathematics Competition", "澳大利亚数学竞赛"),
    ("American Mathematics Competition", "美国数学竞赛"),
    ("Berkeley Mathematics Tournament", "伯克利大学数学竞赛"),
    ("Canadian Senior and Intermediate Mathematics Contests", "加拿大数学竞赛"),
    ("Canadian Open Mathematics Challenge", "加拿大数学公开赛"),
    ("CSP, NOIP", "NOI-CSP,NOIP全国青少年信息学奥林匹克联赛"),
    ("USACO", "USACO美国计算机奥赛"),
    ("High School Mathematical Contest in Modeling (HiMCM)", "美国高中生数学建模竞赛"),
    ("The International Mathematical Modeling Challenge", "国际数学建模挑战赛"),
    ("Youth Artificial Intelligence Olympic Challenge (YAIOC)", "长三角青少年人工智能奥林匹克挑战赛"),
    ("The International Artificial Intelligence Fair (IAIF)", "IAIF国际青少年人工智能交流展示会"),
    ("US Regeneron Science Talent Search", "美国科学天才奖申报（ISEF主办方）"),
    ("Bennington Young Writers Awards", "本宁顿学院青年作家奖"),
    ("Hong Kong Young Writer's Awards", "香港青年作家奖"),
    ("Harvard MIT Mathematics Tournament", "哈佛麻省理工数学锦标赛"),
    ("Princeton University Mathematics Competition", "普林斯顿数学竞赛"),
    ("Youth Artificial Intelligence Innovation Competition", "青少年人工智能创新大赛"),
    ("AI for Scientific Discovery", "全球青少年AI4SD智能体大赛"),
    ("GENIUS Olympiad", "世界青少年英才奥林匹克竞赛"),
    ("Canadian Computing Competition", "加拿大计算机竞赛"),
    ("Brainbee China Round", "脑科学大赛全国赛"),
    ("Song Ching Ling Youth Invention Award", "宋庆龄少年儿童发明奖"),
    ("American Invitational Mathematics Examination (AIME)", "AIME美国高中数学邀请赛"),
    ("US National Chemistry Competition (USNCO)", "美国国家化学竞赛"),
    ("International Greenwich Olympiad (IGO)", "国际格林威治奥林匹克竞赛"),
    ("Exporecerca Jove", "西班牙国际青少年科研博览会"),
    ("TOPSS Competition for High School Psychology Students", "美国心理学协会高中生心理写作竞赛"),
    ("Physics Bowl", "物理杯美国高中生物理思维挑战"),
    ("GCSE Physics Challenge", "英国物理挑战赛（高级）"),
    ("British Astronomy and Astrophysics Olympiad (BAAO)", "英国天文学和天体物理学奥赛"),
    ("Princeton Ten-Minute Play Contest", "普林斯顿10分钟剧本创作比赛"),
    ("International Philosophy Olympiad (IPO)", "国际哲学奥林匹克大赛（IPO）"),
    ("International Linguistics Olympiad", "语言学奥赛初赛"),
    ("Chinese Earth Science Olympiad", "地球科学奥赛预赛"),
    ("Invention Convention China", "全球发明大会中国赛"),
]


def slug(value: str) -> str:
    clean = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if clean:
        return clean[:80]
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def file_timestamp(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat()


def normalize_space(value: Any) -> str:
    if value is None or str(value) == "nan":
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def infer_subjects(text: str) -> list[str]:
    lowered = text.lower()
    subjects = []
    for subject, keys in SUBJECT_KEYWORDS.items():
        for key in keys:
            if len(key) <= 2:
                if re.search(rf"(?<![a-z]){re.escape(key)}(?![a-z])", lowered):
                    subjects.append(subject)
                    break
            elif key in lowered:
                subjects.append(subject)
                break
    return subjects or ["Multiple"]


SUBJECT_ALIASES = {
    "ai": "Computer Science", "artificial intelligence": "Computer Science", "computing": "Computer Science",
    "computer science": "Computer Science", "math": "Mathematics", "mathematics": "Mathematics",
    "science": "Scientific research", "scientific research": "Scientific research", "research": "Scientific research",
    "social science": "Social Science", "debate": "Public Speaking", "public speaking": "Public Speaking",
    "stem": "STEM", "arts": "Arts", "art": "Arts", "biology": "Biology", "business": "Business",
    "chemistry": "Chemistry", "economics": "Economics", "engineering": "Engineering", "english": "English",
    "finance": "Finance", "interdisciplinary": "Interdisciplinary", "law": "Law", "media": "Media",
    "medicine": "Medicine", "multiple": "Multiple", "physics": "Physics", "psychology": "Psychology",
    "robotics": "Robotics", "technology": "Technology", "writing": "Writing", "astronomy": "Astronomy",
    "environment": "Environment",
}


def normalize_subject_tags(values: Any) -> list[str]:
    if not isinstance(values, list):
        values = [values] if values else []
    normalized = []
    for value in values:
        text = normalize_space(value)
        if not text:
            continue
        canonical = SUBJECT_ALIASES.get(text.lower(), text[:1].upper() + text[1:])
        if canonical not in normalized:
            normalized.append(canonical)
    return normalized or ["Multiple"]


def infer_format(text: str) -> str:
    lowered = text.lower()
    has_online = "online" in lowered
    has_in_person = any(token in lowered for token in ["in person", "onsite", "on-site", "offline"])
    if "contact instructor" in lowered or "contact" in lowered and not has_online and not has_in_person:
        return "contact_instructor"
    if has_online and has_in_person:
        return "hybrid"
    if has_online:
        return "online"
    if has_in_person:
        return "in_person"
    return "unknown"


def confidence_for(record: dict[str, Any]) -> str:
    if not record.get("canonical_name"):
        return "needs_review"
    if record.get("type") == "competition" and "2025-2026" in record["sources"][0]["source_file"]:
        return "partially_verified"
    if record.get("type") == "competition":
        return "historical_information_only"
    if record.get("website_url") and record.get("deadline_text"):
        return "partially_verified"
    return "unverified"


def import_summer_programs(imported_at: str) -> list[dict[str, Any]]:
    path = SOURCE_DIR / "2024 Summer_Programs.xlsx"
    records: list[dict[str, Any]] = []
    if not path.exists():
        return records

    xl = pd.ExcelFile(path)
    for sheet in xl.sheet_names:
        df = pd.read_excel(path, sheet_name=sheet, header=1)
        df = df[df["Name"].notna()]
        df = df[df["Name"].astype(str).str.lower() != "name"]
        for index, row in df.iterrows():
            name = normalize_space(row.get("Name"))
            text = " ".join(normalize_space(row.get(field)) for field in ["Name", "Intro", "Category", "Region", "Form"])
            record = {
                "id": f"summer-{slug(name)}",
                "canonical_name": name,
                "name_en": name,
                "type": "summer_program",
                "subject_tags": infer_subjects(text + " " + normalize_space(row.get("Category"))),
                "category": normalize_space(row.get("Category")),
                "region": normalize_space(row.get("Region")),
                "format": infer_format(normalize_space(row.get("Form"))),
                "date_text": normalize_space(row.get("Date")),
                "deadline_text": normalize_space(row.get("Application Deadline")),
                "deadline_date": None,
                "website_url": normalize_space(row.get("Website")),
                "description": normalize_space(row.get("Intro")),
                "confidence": "partially_verified",
                "last_verified_at": None,
                "sources": [
                    {
                        "source_file": path.name,
                        "source_type": "xlsx",
                        "page_or_sheet": sheet,
                        "row_or_text_ref": str(index + 2),
                        "raw_excerpt": text[:900],
                        "extracted_at": file_timestamp(path),
                    }
                ],
            }
            records.append(record)
    return records


def extract_pdf_text(path: Path) -> tuple[str, dict[int, str]]:
    page_texts: dict[int, str] = {}
    with pdfplumber.open(path) as pdf:
        for idx, page in enumerate(pdf.pages, start=1):
            page_texts[idx] = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
    return "\n".join(page_texts.values()), page_texts


def find_page_for_name(page_texts: dict[int, str], name: str, zh_name: str) -> tuple[int, str]:
    name_tokens = [name.split("(")[0].strip(), zh_name]
    for page, text in page_texts.items():
        compact = re.sub(r"\s+", " ", text)
        if any(token and token in compact for token in name_tokens):
            start = min((compact.find(token) for token in name_tokens if token and compact.find(token) >= 0), default=0)
            return page, compact[max(0, start - 180) : start + 720]
    return 1, re.sub(r"\s+", " ", next(iter(page_texts.values()), ""))[:900]


def import_pdf_contests(imported_at: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for path in sorted(SOURCE_DIR.glob("SHSID*.pdf")):
        full_text, page_texts = extract_pdf_text(path)
        urls = re.findall(r"https?://[^\s]+", full_text)
        for english_name, zh_name in KNOWN_CONTESTS:
            if english_name not in full_text and zh_name not in full_text:
                continue
            page, excerpt = find_page_for_name(page_texts, english_name, zh_name)
            source_text = f"{english_name} {zh_name} {excerpt}"
            record = {
                "id": f"contest-{slug(english_name)}-{slug(path.stem)}",
                "canonical_name": english_name,
                "name_zh": zh_name,
                "name_en": english_name,
                "type": "competition",
                "subject_tags": infer_subjects(source_text),
                "category": ", ".join(infer_subjects(source_text)),
                "region": "SHSID / International",
                "format": infer_format(source_text),
                "date_text": infer_nearby_date(excerpt),
                "deadline_text": infer_deadline(excerpt),
                "deadline_date": None,
                "website_url": infer_url(excerpt, urls),
                "registration_contact": infer_contact(excerpt),
                "instructor_contact": infer_instructor(excerpt),
                "preparation": infer_preparation(excerpt),
                "description": "",
                "confidence": "historical_information_only",
                "last_verified_at": None,
                "sources": [
                    {
                        "source_file": path.name,
                        "source_type": "pdf",
                        "page_or_sheet": f"page {page}",
                        "row_or_text_ref": english_name,
                        "raw_excerpt": excerpt[:900],
                        "extracted_at": file_timestamp(path),
                    }
                ],
            }
            record["confidence"] = confidence_for(record)
            records.append(record)
    return records


def infer_url(excerpt: str, fallback_urls: list[str]) -> str:
    match = re.search(r"https?://[^\s]+", excerpt)
    if match and is_usable_url(match.group(0)):
        return match.group(0).rstrip(".,)")
    for url in fallback_urls:
        if is_usable_url(url):
            return url.rstrip(".,)")
    return ""


def is_usable_url(url: str) -> bool:
    clean = url.rstrip(".,)")
    return bool(re.match(r"^https?://[^/\s]+\.[^/\s]+", clean)) and len(clean) >= 14


def infer_nearby_date(excerpt: str) -> str:
    match = re.search(r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z.]*\s*(?:-|to)?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)?[a-z.]*\.?(?:\s*\d{1,2})?)", excerpt, re.I)
    return normalize_space(match.group(1)) if match else ""


def infer_deadline(excerpt: str) -> str:
    candidates = re.findall(r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z.]*\.?\s*\d{0,2}(?:\s*\(appr\.\))?|Closed|All|After AMC|Late Feb\.?", excerpt, re.I)
    if len(candidates) >= 2:
        return normalize_space(candidates[-1])
    return normalize_space(candidates[0]) if candidates else ""


def infer_contact(excerpt: str) -> str:
    if "Contact instructor" in excerpt:
        return "Contact instructor"
    if "公众号" in excerpt:
        return "Official WeChat account"
    return ""


def infer_instructor(excerpt: str) -> str:
    names = re.findall(r"[\u4e00-\u9fff]{2,4}(?:、[\u4e00-\u9fff]{2,4})*", excerpt)
    filtered = [name for name in names if len(name) <= 16 and not any(token in name for token in ["中文名", "比赛", "竞赛", "奥林匹克"])]
    return filtered[-1] if filtered else ""


def infer_preparation(excerpt: str) -> str:
    for phrase in ["Research Essay", "Research essay", "Past papers", "Club activities", "Problem solving", "Essay", "Creative Writing", "NOI Online training", "USACO Online Training"]:
        if phrase.lower() in excerpt.lower():
            return phrase
    return ""


def record_identity_key(record: dict[str, Any]) -> str:
    identity = re.sub(r"\b20(?:2[0-9]|3[0-9])\b", "", record["canonical_name"], flags=re.I)
    identity = re.sub(r"\b(?:highly\s+recommend(?:ed)?|recommend(?:ed)?|cambridge\s+bursary)\b", "", identity, flags=re.I)
    base_key = slug(identity)
    ambiguous = len(base_key) < 12 or base_key in {"competition", "contest", "program", "summer-school", "research-program"}
    return slug(f'{base_key}|{record.get("organizer", "")}') if ambiguous else base_key


def curate_competition_identities(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not COMPETITION_CLEANUP_PATH.exists():
        return records
    rules = json.loads(COMPETITION_CLEANUP_PATH.read_text(encoding="utf-8"))
    aliases = rules.get("aliases", {})
    organizers = rules.get("organizers", {})
    splits = rules.get("split", {})
    dropped = set(rules.get("drop", []))
    curated = []
    for record in records:
        if record.get("type") != "competition":
            curated.append(record)
            continue
        original_name = record["canonical_name"]
        if original_name in dropped:
            continue
        if original_name in splits:
            for split in splits[original_name]:
                split_record = dict(record)
                split_record["canonical_name"] = split["canonical_name"]
                split_record["name_en"] = split["canonical_name"]
                split_record["organizer"] = split.get("organizer", record.get("organizer"))
                split_record["id"] = f'{record["id"]}-{slug(split["canonical_name"])}'
                curated.append(split_record)
            continue
        record = dict(record)
        record["canonical_name"] = aliases.get(original_name, original_name)
        record["name_en"] = record["canonical_name"]
        if record["canonical_name"] in organizers:
            record["organizer"] = organizers[record["canonical_name"]]
        curated.append(record)
    return curated


def dedupe(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for record in records:
        key = record_identity_key(record)
        if key not in grouped:
            grouped[key] = record
            continue
        existing = grouped[key]
        existing["sources"].extend(record["sources"])
        if record["confidence"] == "partially_verified":
            for field in ["format", "date_text", "deadline_text", "website_url", "instructor_contact", "preparation"]:
                if record.get(field):
                    existing[field] = record[field]
            existing["confidence"] = "partially_verified"
    return sorted(grouped.values(), key=lambda item: (item["type"], item["canonical_name"].lower()))


FACT_FIELDS = [
    "canonical_name", "name_zh", "name_en", "organizer", "type", "subject_tags", "category",
    "region", "region_tier", "country", "city", "format", "date_text", "deadline_text",
    "deadline_date", "start_date", "end_date", "current_cycle_status", "eligibility_text",
    "eligible_grades", "eligible_ages", "eligible_curricula", "languages", "team_mode",
    "duration_text", "website_url", "registration_contact", "instructor_contact", "preparation",
    "description", "cost_text", "cost_amount", "cost_currency", "time_commitment"
]


def publication_status_for(record: dict[str, Any]) -> str:
    if record.get("publication_status"):
        return record["publication_status"]
    if record.get("confidence") == "verified" and any(source.get("source_type") == "web_snapshot" for source in record.get("sources", [])):
        return "official_verified"
    if record.get("confidence") == "historical_information_only":
        return "historical"
    return "partially_verified"


def database_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(record)
    normalized["subject_tags"] = normalize_subject_tags(record.get("subject_tags"))
    normalized["schema_version"] = 1
    normalized["publication_status"] = publication_status_for(record)
    evidence: list[dict[str, Any]] = list(record.get("evidence", []))
    if not evidence:
        for index, source in enumerate(record.get("sources", []), start=1):
            authority = "official" if source.get("source_type") == "web_snapshot" else "reputable_secondary" if source.get("source_type") == "web_reference" else "school"
            evidence.append({
                "evidence_id": f'{record["id"]}-e{index}', "url": source.get("original_url"),
                "publisher": source.get("source_id") or source.get("source_file", "Unknown source"),
                "authority": authority, "retrieved_at": source.get("retrieved_at") or source.get("extracted_at"),
                "source_id": source.get("source_id"), "note": source.get("raw_excerpt", "")[:240]
            })
    normalized["evidence"] = evidence
    evidence_ids = [item["evidence_id"] for item in evidence]
    is_official = any(item["authority"] == "official" for item in evidence)
    field_evidence = dict(record.get("field_evidence", {}))
    for field in FACT_FIELDS:
        if field in field_evidence:
            continue
        value = record.get(field)
        if value in (None, "", []):
            field_evidence[field] = {"status": "missing", "evidence_ids": []}
        else:
            status = "official" if is_official else "historical" if normalized["publication_status"] == "historical" else "single_source"
            field_evidence[field] = {"status": status, "evidence_ids": evidence_ids}
    normalized["field_evidence"] = field_evidence
    return normalized


def validate_database_record(record: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for field in ("schema_version", "id", "canonical_name", "type", "format", "publication_status", "sources", "evidence", "field_evidence"):
        if record.get(field) in (None, "", []):
            errors.append(f"missing {field}")
    if record.get("publication_status") not in {"official_verified", "corroborated", "partially_verified", "historical", "unverified"}:
        errors.append("invalid publication_status")
    evidence_ids = {item.get("evidence_id") for item in record.get("evidence", [])}
    for field, trace in record.get("field_evidence", {}).items():
        if any(reference not in evidence_ids for reference in trace.get("evidence_ids", [])):
            errors.append(f"field {field} references missing evidence")
    return errors


def write_database(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    normalized = [database_record(record) for record in records]
    failures: list[str] = []
    for record in normalized:
        errors = validate_database_record(record)
        if errors:
            failures.append(f'{record.get("id", "unknown")}: {", ".join(errors)}')
            continue
        (DATABASE_DIR / f'{record["id"]}.json').write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if failures:
        raise ValueError("Database validation failed:\n" + "\n".join(failures))
    current_files = {f'{record["id"]}.json' for record in normalized}
    for stale_path in DATABASE_DIR.glob("*.json"):
        if stale_path.name != DATABASE_INDEX.name and stale_path.name not in current_files:
            stale_path.unlink()
    index = {"schema_version": 1, "records": [record["id"] for record in sorted(normalized, key=lambda item: item["id"])]}
    DATABASE_INDEX.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    return normalized


def write_database_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized = database_record(record)
    errors = validate_database_record(normalized)
    if errors:
        raise ValueError(f'{normalized.get("id", "unknown")}: {", ".join(errors)}')
    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    (DATABASE_DIR / f'{normalized["id"]}.json').write_text(json.dumps(normalized, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    ids = set()
    if DATABASE_INDEX.exists():
        ids.update(json.loads(DATABASE_INDEX.read_text(encoding="utf-8")).get("records", []))
    ids.add(normalized["id"])
    DATABASE_INDEX.write_text(json.dumps({"schema_version": 1, "records": sorted(ids)}, indent=2) + "\n", encoding="utf-8")
    return normalized


def load_database_records() -> list[dict[str, Any]]:
    if not DATABASE_INDEX.exists():
        return []
    index = json.loads(DATABASE_INDEX.read_text(encoding="utf-8"))
    records: list[dict[str, Any]] = []
    for record_id in index.get("records", []):
        path = DATABASE_DIR / f"{record_id}.json"
        if path.exists():
            records.append(json.loads(path.read_text(encoding="utf-8")))
    return records


def merge_with_database(incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    existing = {record["id"]: record for record in load_database_records()}
    merged: dict[str, dict[str, Any]] = {}
    for record in incoming:
        stored = existing.get(record["id"])
        incoming_status = publication_status_for(record)
        has_structured_review = stored and any(
            source.get("source_id") == "competition-research-completed-v1"
            for source in stored.get("sources", [])
        )
        if stored and (
            has_structured_review
            or (
                stored.get("publication_status") in {"official_verified", "corroborated", "unverified"}
                and incoming_status not in {"official_verified", "corroborated"}
            )
        ):
            preserved = dict(stored)
            known_sources = {(source.get("source_type"), source.get("source_file"), source.get("original_url")) for source in preserved.get("sources", [])}
            preserved["sources"] = preserved.get("sources", []) + [source for source in record.get("sources", []) if (source.get("source_type"), source.get("source_file"), source.get("original_url")) not in known_sources]
            merged[record["id"]] = preserved
        else:
            merged[record["id"]] = record
    merged_identity_keys = {record_identity_key(record) for record in merged.values()}
    for record_id, record in existing.items():
        if record_id not in merged:
            if record_identity_key(record) in merged_identity_keys:
                continue
            merged[record_id] = record
    return sorted(merged.values(), key=lambda item: (item["type"], item["canonical_name"].lower()))


def normalize_mass_type(value: str, name: str = "") -> str:
    lowered = (value or "").lower()
    identity = name.lower()
    if re.search(r"summer school|winter school|summer camp|debating camp|pre.?college|course|training|academy|research (?:program|scholar|internship)|project qualification", identity):
        return "research_program" if "research" in identity else "summer_program"
    if "competition" in lowered or "contest" in lowered or "olympiad" in lowered or "challenge" in lowered:
        return "competition"
    if "research" in lowered:
        return "research_program"
    if "summer" in lowered or "program" in lowered or "academy" in lowered or "school" in lowered:
        return "summer_program"
    return "other"


def normalize_mass_format(value: Any) -> str:
    lowered = str(value or "unknown").lower().replace("-", "_").replace(" ", "_")
    return {"in_person": "in_person", "online": "online", "hybrid": "hybrid", "contact_instructor": "contact_instructor"}.get(lowered, "unknown")


def normalize_mass_region_tier(value: Any, region: str) -> str | None:
    allowed = {"shanghai_local", "mainland_china", "greater_china", "china_participation_route", "international_only"}
    if value in allowed:
        return value
    lowered = region.lower()
    if "shanghai" in lowered: return "shanghai_local"
    if any(token in lowered for token in ["china", "beijing", "shenzhen", "suzhou", "hangzhou", "chengdu", "zhuhai"]): return "mainland_china"
    if any(token in lowered for token in ["hong kong", "taiwan", "macau"]): return "greater_china"
    if any(token in lowered for token in ["global", "international", "online"]): return "china_participation_route"
    return "international_only" if region else None


def import_mass_discovery(imported_at: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    snapshot_index = json.loads(MASS_SNAPSHOT_INDEX.read_text(encoding="utf-8")) if MASS_SNAPSHOT_INDEX.exists() else {}
    if not MASS_DISCOVERY_DIR.exists():
        return records
    for path in sorted(MASS_DISCOVERY_DIR.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        items = payload if isinstance(payload, list) else payload.get("records", [])
        artifact_at = file_timestamp(path)
        for item in items:
            name = normalize_space(item.get("canonical_name"))
            if not name:
                continue
            opportunity_type = normalize_mass_type(item.get("type", ""), name)
            evidence_urls = [url for url in item.get("evidence_urls", []) if isinstance(url, str) and url.startswith("http")]
            website = item.get("website_url") or (evidence_urls[0] if evidence_urls else "")
            requested_confidence = item.get("confidence") if item.get("confidence") in {"verified", "partially_verified", "unverified"} else "unverified"
            retained = next((snapshot_index[url] for url in evidence_urls if url in snapshot_index and (ROOT / snapshot_index[url]["snapshot_path"]).exists()), None)
            confidence = "verified" if requested_confidence == "verified" and retained else "partially_verified" if requested_confidence != "unverified" else "unverified"
            region = normalize_space(item.get("region"))
            record = {
                "id": f'mass-{"contest" if opportunity_type == "competition" else "program"}-{slug(name)}',
                "canonical_name": name, "name_zh": normalize_space(item.get("name_zh")), "name_en": name,
                "type": opportunity_type, "subject_tags": item.get("subject_tags") or infer_subjects(f'{name} {item.get("category", "")}'),
                "category": normalize_space(item.get("category")), "organizer": normalize_space(item.get("organizer")),
                "region": region, "region_tier": normalize_mass_region_tier(item.get("region_tier"), region),
                "country": normalize_space(item.get("country")), "city": normalize_space(item.get("city")),
                "format": normalize_mass_format(item.get("format")), "date_text": normalize_space(item.get("date_text")),
                "deadline_text": normalize_space(item.get("deadline_text")), "deadline_date": item.get("deadline_date"),
                "start_date": item.get("start_date"), "end_date": item.get("end_date"),
                "current_cycle_status": item.get("current_cycle_status") or "unknown",
                "eligibility_text": normalize_space(item.get("eligibility_text")), "eligible_grades": item.get("eligible_grades"),
                "eligible_ages": item.get("eligible_ages"), "languages": item.get("languages"),
                "team_mode": item.get("team_mode") if item.get("team_mode") in {"individual", "team", "either", "unknown"} else "unknown",
                "cost_text": normalize_space(item.get("cost_text")), "time_commitment": item.get("time_commitment") if item.get("time_commitment") in {"low", "medium", "high", "unknown"} else "unknown",
                "description": normalize_space(item.get("description")), "website_url": website,
                "confidence": confidence, "last_verified_at": None,
                "publication_status": "official_verified" if confidence == "verified" else "partially_verified" if confidence != "unverified" else "unverified",
                "verification_note": "Discovered through broad web research; hollow-dot records require stronger retained evidence or current-cycle enrichment.",
                "sources": []
            }
            for index, url in enumerate(evidence_urls or ([website] if website else []), start=1):
                manifest = snapshot_index.get(url)
                source_type = "web_snapshot" if manifest and (ROOT / manifest["snapshot_path"]).exists() else "web_reference"
                source_record = {"source_file": Path(manifest["snapshot_path"]).name if source_type == "web_snapshot" else path.name, "source_type": source_type, "page_or_sheet": "official web evidence" if source_type == "web_snapshot" else "web research", "row_or_text_ref": name, "raw_excerpt": normalize_space(item.get("evidence_note"))[:900], "extracted_at": manifest["retrieved_at"] if manifest else artifact_at, "source_id": f'mass-{slug(path.stem)}-{index}', "original_url": manifest["final_url"] if manifest else url, "retrieved_at": manifest["retrieved_at"] if manifest else item.get("reviewed_at") or artifact_at, "extraction_locator": "mass discovery artifact"}
                if source_type == "web_snapshot":
                    source_record.update({"snapshot_path": manifest["snapshot_path"], "content_hash": manifest["content_hash"]})
                record["sources"].append(source_record)
            if retained:
                record["last_verified_at"] = retained["retrieved_at"][:10]
                record["verification_note"] = "Official discovery evidence was retained offline; missing detail fields were not inferred."
            if not record["sources"]:
                record["sources"] = [{"source_file": path.name, "source_type": "web_reference", "page_or_sheet": "web research", "row_or_text_ref": name, "raw_excerpt": normalize_space(item.get("evidence_note"))[:900], "extracted_at": artifact_at}]
            records.append(record)
    return records


def records_from_listing_candidates(candidates: list[dict[str, str]], registry: list[dict[str, Any]]) -> list[dict[str, Any]]:
    source_map = {source["id"]: source for source in registry}
    records: list[dict[str, Any]] = []
    for candidate in candidates:
        source = source_map.get(candidate["source_id"])
        latest = latest_snapshot(candidate["source_id"])
        if not source or not latest:
            continue
        snapshot, manifest = latest
        name = normalize_space(candidate["name"])
        lowered = f'{name} {candidate["url"]}'.lower()
        opportunity_type = "competition" if re.search(r"competition|olympiad|contest|challenge|award", lowered) else "research_program" if "research" in lowered else "summer_program"
        bracket = re.search(r"【([^】]+)】|\[([^]]+)\]", name)
        region = (bracket.group(1) or bracket.group(2)) if bracket else "China participation route"
        clean_name = re.sub(r"【[^】]+】|\[[^]]+\]", "", name).strip()
        records.append({
            "id": f'listing-{"contest" if opportunity_type == "competition" else "program"}-{slug(clean_name)}',
            "canonical_name": clean_name, "name_en": clean_name, "type": opportunity_type,
            "subject_tags": infer_subjects(clean_name), "category": ", ".join(infer_subjects(clean_name)),
            "organizer": source.get("organization", "ASEEDER"), "region": region,
            "region_tier": normalize_mass_region_tier(None, region), "format": "unknown",
            "date_text": "", "deadline_text": "", "deadline_date": None, "current_cycle_status": "unknown",
            "eligibility_text": "", "languages": [], "team_mode": "unknown", "cost_text": "",
            "time_commitment": "unknown", "description": "", "website_url": candidate["url"],
            "confidence": "partially_verified", "last_verified_at": manifest["retrieved_at"][:10],
            "publication_status": "partially_verified", "verification_note": "Identity discovered on the retained official ASEEDER catalog snapshot; detail fields are not yet enriched.",
            "sources": [{"source_file": Path(manifest["snapshot_path"]).name, "source_type": "web_snapshot", "page_or_sheet": "official listing page", "row_or_text_ref": clean_name, "raw_excerpt": name[:900], "extracted_at": manifest["retrieved_at"], "source_id": candidate["source_id"], "original_url": source["url"], "snapshot_path": manifest["snapshot_path"], "retrieved_at": manifest["retrieved_at"], "content_hash": manifest["content_hash"], "extraction_locator": candidate["url"]}]
        })
    return records


def public_projection(record: dict[str, Any]) -> dict[str, Any]:
    projected = {key: value for key, value in record.items() if key not in {"schema_version", "evidence", "field_evidence"}}
    source_fields = {"source_file", "source_type", "page_or_sheet", "row_or_text_ref", "source_id", "original_url", "retrieved_at"}
    projected["sources"] = [{key: value for key, value in source.items() if key in source_fields and value not in (None, "")} for source in record.get("sources", [])]
    return projected


def load_registry() -> list[dict[str, Any]]:
    if not REGISTRY_PATH.exists():
        return []
    payload = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return payload.get("sources", [])


def allowed_url(url: str, source: dict[str, Any]) -> bool:
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and any(host == domain or host.endswith(f".{domain}") for domain in source.get("allowed_domains", []))


def latest_snapshot(source_id: str) -> tuple[Path, dict[str, Any]] | None:
    folder = SNAPSHOT_DIR / source_id
    manifests = sorted(folder.glob("*.manifest.json"), reverse=True) if folder.exists() else []
    for manifest_path in manifests:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        snapshot = ROOT / manifest["snapshot_path"]
        if snapshot.exists() and hashlib.sha256(gzip.decompress(snapshot.read_bytes())).hexdigest() == manifest["content_hash"]:
            return snapshot, manifest
    return None


def refresh_sources(registry: list[dict[str, Any]]) -> dict[str, Any]:
    report: dict[str, Any] = {"refreshed": [], "failed": [], "unchanged": []}
    for source in registry:
        url = source["url"]
        if not allowed_url(url, source):
            report["failed"].append({"source_id": source["id"], "error": "URL is outside the source allow-list"})
            continue
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "ProjectPursuit/1.0 (+offline educational catalog)"})
            with urllib.request.urlopen(request, timeout=35) as response:
                final_url = response.geturl()
                if not allowed_url(final_url, source):
                    raise ValueError("Redirect left the source allow-list")
                content = response.read()
                status = response.status
                content_type = response.headers.get("Content-Type", "")
            if status != 200 or len(content) < 500 or "text/html" not in content_type.lower():
                raise ValueError(f"Unexpected response: status={status}, bytes={len(content)}, type={content_type}")
            digest = hashlib.sha256(content).hexdigest()
            previous = latest_snapshot(source["id"])
            if previous and previous[1]["content_hash"] == digest:
                report["unchanged"].append(source["id"])
                continue
            retrieved_at = now_iso()
            stamp = retrieved_at.replace(":", "-").replace("+00:00", "Z")
            folder = SNAPSHOT_DIR / source["id"]
            folder.mkdir(parents=True, exist_ok=True)
            snapshot = folder / f"{stamp}.html.gz"
            snapshot.write_bytes(gzip.compress(content, mtime=0))
            manifest = {
                "source_id": source["id"], "original_url": url, "final_url": final_url,
                "parent_listing_url": source.get("listing_url", url), "status": status,
                "content_type": content_type, "retrieved_at": retrieved_at, "content_hash": digest,
                "parser_version": source["parser_version"], "snapshot_path": snapshot.relative_to(ROOT).as_posix()
            }
            snapshot.with_suffix("").with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            report["refreshed"].append(source["id"])
        except (OSError, ValueError, urllib.error.URLError) as exc:
            report["failed"].append({"source_id": source["id"], "error": str(exc), "using_last_good": latest_snapshot(source["id"]) is not None})
    return report


def html_text(content: bytes) -> str:
    decoded = content.decode("utf-8", "ignore")
    decoded = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", decoded, flags=re.I | re.S)
    return normalize_space(unescape(re.sub(r"<[^>]+>", " ", decoded)))


def extract_meta(content: bytes, name: str) -> str:
    decoded = content.decode("utf-8", "ignore")
    pattern = rf'<meta[^>]+(?:name|property)=["\']{re.escape(name)}["\'][^>]+content=["\']([^"\']+)["\']'
    match = re.search(pattern, decoded, re.I)
    if not match:
        pattern = rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:name|property)=["\']{re.escape(name)}["\']'
        match = re.search(pattern, decoded, re.I)
    return normalize_space(unescape(match.group(1))) if match else ""


ONLINE_REQUIRED = ["canonical_name", "organizer", "type", "subject_tags", "region_tier", "eligibility_text", "format", "current_cycle_status", "cost_text", "description", "website_url"]


def import_online_sources(registry: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    accepted: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    for source in registry:
        if source.get("kind", "detail") != "detail":
            continue
        latest = latest_snapshot(source["id"])
        if not latest:
            rejected.append({"source_id": source["id"], "missing_fields": ["snapshot"]})
            continue
        snapshot, manifest = latest
        content = gzip.decompress(snapshot.read_bytes())
        text = html_text(content)
        record = dict(source["record"])
        record["description"] = record.get("description") or extract_meta(content, "description") or extract_meta(content, "og:description")
        record["id"] = f'{"contest" if record["type"] == "competition" else "program"}-{slug(record.get("organizer", ""))}-{slug(record["canonical_name"])}'
        record["last_verified_at"] = manifest["retrieved_at"][:10]
        record["confidence"] = "verified"
        record["verification_note"] = f'Official page snapshot retrieved {manifest["retrieved_at"][:10]}; verify time-sensitive details before applying.'
        record["sources"] = [{
            "source_file": Path(manifest["snapshot_path"]).name, "source_type": "web_snapshot",
            "page_or_sheet": "official detail page", "row_or_text_ref": source["id"],
            "raw_excerpt": text[:900], "extracted_at": manifest["retrieved_at"], "source_id": source["id"],
            "original_url": manifest["final_url"], "snapshot_path": manifest["snapshot_path"],
            "retrieved_at": manifest["retrieved_at"], "content_hash": manifest["content_hash"],
            "extraction_locator": source.get("extraction_locator", "document")
        }]
        missing = [field for field in ONLINE_REQUIRED if record.get(field) in (None, "", [])]
        evidence_missing = [term for term in source.get("evidence_terms", []) if term.lower() not in text.lower()]
        if missing or evidence_missing:
            rejected.append({"source_id": source["id"], "missing_fields": missing, "missing_evidence_terms": evidence_missing})
        else:
            accepted.append(record)
    return accepted, rejected


def import_verified_reviews() -> list[dict[str, Any]]:
    if not VERIFIED_REVIEWS_PATH.exists():
        return []
    records = json.loads(VERIFIED_REVIEWS_PATH.read_text(encoding="utf-8")).get("records", [])
    accepted: list[dict[str, Any]] = []
    for record in records:
        valid_sources = record.get("sources") and all(
            source.get("source_type") == "web_snapshot"
            and source.get("snapshot_path")
            and (ROOT / source["snapshot_path"]).exists()
            and source.get("content_hash")
            for source in record.get("sources", [])
        )
        if record.get("confidence") == "verified" and valid_sources:
            accepted.append(record)
    return accepted


def discover_listing_candidates(registry: list[dict[str, Any]]) -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []
    for source in registry:
        if source.get("kind") != "listing":
            continue
        latest = latest_snapshot(source["id"])
        if not latest:
            continue
        content = gzip.decompress(latest[0].read_bytes()).decode("utf-8", "ignore")
        for href, label_html in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', content, re.I | re.S):
            url = urllib.parse.urljoin(source["url"], unescape(href))
            label = normalize_space(unescape(re.sub(r"<[^>]+>", " ", label_html)))
            if not label or not allowed_url(url, source) or not re.search(source.get("candidate_pattern", r"competition|olympiad|program"), f"{label} {url}", re.I):
                continue
            candidates.append({"source_id": source["id"], "name": label[:180], "url": url})
    unique = {(item["source_id"], item["url"]): item for item in candidates}
    return sorted(unique.values(), key=lambda item: (item["source_id"], item["name"].lower(), item["url"]))


def write_report(records: list[dict[str, Any]], rejected: list[dict[str, Any]], refresh_report: dict[str, Any] | None, candidates: list[dict[str, str]]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    counts = {
        "total": len(records),
        "by_type": {},
        "by_confidence": {},
        "missing_deadline": 0,
        "missing_website": 0,
        "by_source": {},
        "by_region_tier": {},
        "rejected_online": rejected,
        "refresh": refresh_report,
        "discovered_candidates": candidates,
    }
    for record in records:
        counts["by_type"][record["type"]] = counts["by_type"].get(record["type"], 0) + 1
        counts["by_confidence"][record["confidence"]] = counts["by_confidence"].get(record["confidence"], 0) + 1
        counts["missing_deadline"] += 0 if record.get("deadline_text") else 1
        counts["missing_website"] += 0 if record.get("website_url") else 1
        tier = record.get("region_tier", "unclassified")
        counts["by_region_tier"][tier] = counts["by_region_tier"].get(tier, 0) + 1
        for source in record["sources"]:
            source_id = source.get("source_id", source["source_file"])
            counts["by_source"][source_id] = counts["by_source"].get(source_id, 0) + 1
    (REPORT_DIR / "import_report.json").write_text(json.dumps(counts, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Project Pursuit offline-first catalog")
    parser.add_argument("--refresh-online", action="store_true", help="Refresh allow-listed official web snapshots before rebuilding")
    parser.add_argument("--validate-only", action="store_true", help="Validate available sources without writing the catalog")
    args = parser.parse_args()
    imported_at = now_iso()
    registry = load_registry()
    refresh_report = refresh_sources(registry) if args.refresh_online else None
    online, rejected = import_online_sources(registry)
    candidates = discover_listing_candidates(registry)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    listing_records = records_from_listing_candidates(candidates, registry)
    records = import_summer_programs(imported_at) + import_pdf_contests(imported_at) + online + import_verified_reviews() + listing_records + import_mass_discovery(imported_at)
    records = curate_competition_identities(records)
    normalized = dedupe(curate_competition_identities(merge_with_database(dedupe(records))))
    normalized = write_database(normalized)
    public_records = normalized
    generated_candidates = [source.get("extracted_at") for record in public_records for source in record["sources"] if source.get("extracted_at")]
    output = {
        "generated_at": max(generated_candidates, default=imported_at),
        "source_scope": "offline_files_and_official_web_snapshots",
        "records": [public_projection(record) for record in public_records],
    }
    write_report(normalized, rejected, refresh_report, candidates)
    if not args.validate_only:
        (OUT_DIR / "opportunities.generated.json").write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        metadata = {
            "total": len(public_records),
            "competitions": sum(record["type"] == "competition" for record in public_records),
            "programs": sum(record["type"] != "competition" for record in public_records),
            "official_web_records": sum(any(source["source_type"] == "web_snapshot" for source in record["sources"]) for record in public_records),
        }
        (OUT_DIR / "catalog-metadata.generated.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"database_records": len(normalized), "public_records": len(public_records), "output": str(OUT_DIR / "opportunities.generated.json")}, indent=2))


if __name__ == "__main__":
    main()
