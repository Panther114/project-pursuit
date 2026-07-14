from __future__ import annotations

import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.apply_review_batches import snapshot_url

MASS_DIR = ROOT / "data" / "reviews" / "mass"
INDEX_PATH = ROOT / "data" / "snapshots" / "mass-sources-index.json"


def main() -> None:
    urls: set[str] = set()
    for path in sorted(MASS_DIR.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        records = payload if isinstance(payload, list) else payload.get("records", [])
        for record in records:
            if record.get("confidence") != "verified":
                continue
            for url in record.get("evidence_urls", []) or [record.get("website_url")]:
                if isinstance(url, str) and url.startswith("https://"):
                    urls.add(url)
    retained = json.loads(INDEX_PATH.read_text(encoding="utf-8")) if INDEX_PATH.exists() else {}
    failures: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=12) as executor:
        futures = [executor.submit(snapshot_url, url) for url in sorted(urls)]
        for future in as_completed(futures):
            url, manifest, error = future.result()
            if manifest: retained[url] = manifest
            if error: failures[url] = error
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(retained, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"requested": len(urls), "retained": len(retained), "failed": len(failures)}, indent=2))


if __name__ == "__main__":
    main()
