from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "shsid_sources"
OUT_DIR = ROOT / "src" / "data"
REPORT_DIR = ROOT / "data" / "reports"

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
                        "extracted_at": imported_at,
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
                        "extracted_at": imported_at,
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


def dedupe(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for record in records:
        key = slug(record["canonical_name"])
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


def write_report(records: list[dict[str, Any]]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    counts = {
        "total": len(records),
        "by_type": {},
        "by_confidence": {},
        "missing_deadline": 0,
        "missing_website": 0,
    }
    for record in records:
        counts["by_type"][record["type"]] = counts["by_type"].get(record["type"], 0) + 1
        counts["by_confidence"][record["confidence"]] = counts["by_confidence"].get(record["confidence"], 0) + 1
        counts["missing_deadline"] += 0 if record.get("deadline_text") else 1
        counts["missing_website"] += 0 if record.get("website_url") else 1
    (REPORT_DIR / "import_report.json").write_text(json.dumps(counts, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    imported_at = now_iso()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    records = import_summer_programs(imported_at) + import_pdf_contests(imported_at)
    normalized = dedupe(records)
    output = {
        "generated_at": imported_at,
        "source_scope": "offline",
        "records": normalized,
    }
    (OUT_DIR / "opportunities.generated.json").write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    write_report(normalized)
    print(json.dumps({"records": len(normalized), "output": str(OUT_DIR / "opportunities.generated.json")}, indent=2))


if __name__ == "__main__":
    main()
