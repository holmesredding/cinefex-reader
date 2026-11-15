import copy
import json
import tempfile
import unittest
import zlib
from pathlib import Path

from common import part_text, read_index, units, validate
from proofread import apply_review, export_review


class ProofreadingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp.name)
        (self.repo / "issues/1").mkdir(parents=True)
        (self.repo / "assets/data/search/text").mkdir(parents=True)
        self.raw = 'The model flew past “Mars” and a star.'
        self.index_file = self.repo / "assets/data/search/text/1.js"
        self.write_index(self.raw)
        (self.repo / "issues/1/data.js").write_text('window.ISSUE={"pages":[{"ref":"1"}]};\n')
        self.config = {"issue": 1, "articles": [{"id": "1", "format": "indexed", "title": "Models", "indices": [0], "refs": ["1"], "startRef": "1", "indexCrc": {"1": zlib.crc32(self.raw.encode())}, "blocks": [{"type": "p", "ref": "1", "parts": [{"index": "1", "start": 0, "end": len(units(self.raw))}]}]}]}
        self.configs = [(self.repo / "1.json", self.config)]

    def tearDown(self):
        self.temp.cleanup()

    def write_index(self, text):
        self.index_file.write_text('CinefexSearchData.register("text/1",' + json.dumps({"pages": [["1", "Models", text]]}) + ');\n')

    def part(self):
        return self.config["articles"][0]["blocks"][0]["parts"][0]

    def test_correction_preserves_index_and_unicode(self):
        review = export_review(self.configs, self.repo, set())
        review["fragments"][0]["text"] = 'The miniature flew past “Mars” and a star \U0001f31f.'
        original = self.index_file.read_bytes()
        self.assertEqual(apply_review(review, self.configs, self.repo), ({1}, 1))
        self.assertEqual(part_text(self.part(), read_index(self.repo, 1)), review["fragments"][0]["text"])
        self.assertEqual(self.index_file.read_bytes(), original)
        self.assertEqual(validate(self.config, self.repo), 1)

    def test_unchanged_review_preserves_existing_edits(self):
        self.part()["patches"] = [[4, 9, "miniature"]]
        self.part()["dropEnd"] = 1
        before = copy.deepcopy(self.config)
        review = export_review(self.configs, self.repo, set())
        self.assertEqual(apply_review(review, self.configs, self.repo), (set(), 0))
        self.assertEqual(self.config, before)

    def test_stale_review_is_rejected(self):
        review = export_review(self.configs, self.repo, set())
        review["fragments"][0]["text"] = 'Changed text'
        self.part()["patches"] = [[4, 9, "miniature"]]
        with self.assertRaisesRegex(ValueError, "source has changed"):
            apply_review(review, self.configs, self.repo)

    def test_changed_ocr_is_rejected(self):
        self.write_index(self.raw.replace("Mars", "Venus"))
        with self.assertRaisesRegex(ValueError, "index text changed"):
            validate(self.config, self.repo)

    def test_duplicate_article_is_rejected(self):
        self.config["articles"].append(copy.deepcopy(self.config["articles"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate article"):
            validate(self.config, self.repo)

    def test_overlapping_corrections_are_rejected(self):
        self.part()["patches"] = [[0, 8, "Some"], [4, 9, "more"]]
        with self.assertRaisesRegex(ValueError, "overlapping"):
            validate(self.config, self.repo)


if __name__ == "__main__":
    unittest.main()
