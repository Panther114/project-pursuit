from __future__ import annotations

import gzip
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import import_sources as importer
from scripts import review_candidates as reviewer
from scripts import apply_review_batches as batch_reviewer


class ImporterTests(unittest.TestCase):
    def test_allow_list_rejects_http_and_unregistered_domains(self) -> None:
        source = {"allowed_domains": ["example.edu"]}
        self.assertTrue(importer.allowed_url("https://programs.example.edu/item", source))
        self.assertFalse(importer.allowed_url("http://programs.example.edu/item", source))
        self.assertFalse(importer.allowed_url("https://example.edu.attacker.test/item", source))

    def test_stable_slug_and_identity_ignore_retrieval_time(self) -> None:
        self.assertEqual(importer.slug("ASEEDER Hippo 2026"), importer.slug("ASEEDER  Hippo 2026"))
        records = [
            {"canonical_name": "Same", "organizer": "One", "type": "competition", "sources": [], "confidence": "verified"},
            {"canonical_name": "Same", "organizer": "Two", "type": "competition", "sources": [], "confidence": "verified"},
        ]
        self.assertEqual(len(importer.dedupe(records)), 2)

    def test_latest_snapshot_verifies_hash_and_falls_back(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            snapshots = root / "data" / "snapshots" / "source"
            snapshots.mkdir(parents=True)
            content = b"<html>valid official page content</html>" * 30
            snapshot = snapshots / "2026.html.gz"
            snapshot.write_bytes(gzip.compress(content, mtime=0))
            manifest = {
                "snapshot_path": "data/snapshots/source/2026.html.gz",
                "content_hash": hashlib.sha256(content).hexdigest(),
            }
            (snapshots / "2026.manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            with patch.object(importer, "ROOT", root), patch.object(importer, "SNAPSHOT_DIR", root / "data" / "snapshots"):
                found = importer.latest_snapshot("source")
                self.assertIsNotNone(found)

    def test_online_validation_quarantines_missing_card_fields(self) -> None:
        source = {"id": "missing", "record": {"canonical_name": "Incomplete", "type": "competition"}}
        with patch.object(importer, "latest_snapshot", return_value=None):
            accepted, rejected = importer.import_online_sources([source])
        self.assertEqual(accepted, [])
        self.assertEqual(rejected[0]["missing_fields"], ["snapshot"])

    def test_gzip_snapshot_bytes_are_deterministic(self) -> None:
        content = b"official source"
        self.assertEqual(gzip.compress(content, mtime=0), gzip.compress(content, mtime=0))

    def test_mass_evidence_requires_every_term_group(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            snapshot = root / "official.html.gz"
            snapshot.write_bytes(gzip.compress(b"<h1>International Example Olympiad</h1><p>Open to secondary school students worldwide.</p>", mtime=0))
            manifest = {"snapshot_path": "official.html.gz"}
            groups = [["Example Olympiad", "EO"], ["high school", "secondary school"], ["worldwide", "global"]]
            with patch.object(importer, "ROOT", root):
                self.assertTrue(importer.mass_evidence_matches({"evidence_term_groups": groups}, manifest))
                self.assertFalse(importer.mass_evidence_matches({"evidence_term_groups": groups + [["ages 13-18"]]}, manifest))

    def test_review_requires_verified_complete_official_evidence(self) -> None:
        review = {
            "reviewer_confidence": "verified", "canonical_name": "Example", "organizer": "Organizer",
            "type": "competition", "subject_tags": ["Mathematics"], "region": "Shanghai",
            "region_tier": "shanghai_local", "format": "in_person", "eligibility_text": "Grades 9-12",
            "languages": ["English"], "team_mode": "individual", "date_text": "December 2026",
            "deadline_text": "2026-11-01", "deadline_date": "2026-11-01", "current_cycle_status": "open",
            "cost_text": "Free", "time_commitment": "medium", "difficulty_level": "Intermediate",
            "recognition_level": "Regional", "description": "Official regional mathematics competition.",
            "website_url": "https://official.example/item", "evidence_urls": ["https://official.example/item"],
            "reviewed_at": str(reviewer.date.today()),
        }
        self.assertEqual(reviewer.validate_review(review), [])
        self.assertTrue(reviewer.validate_review({**review, "eligibility_text": "See website"}))
        self.assertTrue(reviewer.validate_review({**review, "website_url": "http://unsafe.example"}))

    def test_nonverified_agent_output_stays_unverified(self) -> None:
        errors = reviewer.validate_review({"reviewer_confidence": "insufficient_evidence"})
        self.assertIn("reviewer did not mark the record verified", errors)

    def test_database_accepts_nullable_non_core_facts(self) -> None:
        record = importer.database_record({
            "id": "nullable", "canonical_name": "Verified Identity", "type": "competition",
            "format": "unknown", "subject_tags": [], "confidence": "partially_verified",
            "sources": [{"source_file": "school.pdf", "source_type": "pdf", "page_or_sheet": "1", "row_or_text_ref": "x", "raw_excerpt": "Verified Identity", "extracted_at": "2026-07-11"}],
        })
        self.assertEqual(importer.validate_database_record(record), [])
        self.assertEqual(record["field_evidence"]["cost_text"]["status"], "missing")

    def test_competition_curation_merges_bad_titles_and_splits_combined_records(self) -> None:
        source = {"id": "x", "type": "competition", "organizer": "", "subject_tags": ["Mathematics"], "sources": [], "confidence": "unverified"}
        records = importer.curate_competition_identities([
            {**source, "canonical_name": "ASDAN Critical Thinking Qualification • First Round: 3rd April, 2021 • Second Round: 9th May,"},
            {**source, "canonical_name": "CSP, NOIP"},
            {**source, "canonical_name": "International curriculum and qualification"},
        ])
        self.assertEqual([record["canonical_name"] for record in records], ["ASDAN Critical Thinking Qualification", "NOI-CSP", "NOIP"])
        self.assertEqual(records[0]["organizer"], "ASEEDER")

    def test_database_rejects_broken_field_evidence_reference(self) -> None:
        record = importer.database_record({
            "id": "broken", "canonical_name": "Broken", "type": "competition", "format": "unknown",
            "confidence": "partially_verified", "sources": [{"source_file": "school.pdf", "source_type": "pdf", "page_or_sheet": "1", "row_or_text_ref": "x", "raw_excerpt": "Broken", "extracted_at": "2026-07-11"}],
            "field_evidence": {"canonical_name": {"status": "single_source", "evidence_ids": ["absent"]}},
        })
        self.assertTrue(any("missing evidence" in error for error in importer.validate_database_record(record)))

    def test_review_authority_and_urls_are_normalized(self) -> None:
        self.assertEqual(batch_reviewer.authority("official institution page"), "official")
        self.assertTrue(batch_reviewer.valid_web_url("https://example.edu/program"))
        self.assertFalse(batch_reviewer.valid_web_url("http://example.edu/program"))


if __name__ == "__main__":
    unittest.main()
