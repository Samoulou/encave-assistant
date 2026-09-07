"""Source acceptance criteria must survive formalization, review and restore."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

import test_agentic as fixtures

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import restore_progress


def prepare_fixture(test):
    fixture = fixtures.ControllerTest(methodName="runTest")
    fixture.setUp()
    test.addCleanup(fixture.doCleanups)
    fixture.git("branch", "-M", "main")
    fixture.tickets[0]["acceptance_criteria"].append("A separate second acceptance criterion")
    fixture.write_config()
    fixture.write("backlog/source.json", {"tickets": fixture.tickets})
    fixture.commit()
    fixture.initial_head = fixture.git("rev-parse", "HEAD").stdout.strip()
    return fixture


class DeliveryCoverageTest(unittest.TestCase):
    def setUp(self):
        self.fixture = prepare_fixture(self)

    def assert_formalization_rejected(self, case):
        with patch.dict("os.environ", {"FAKE_CASE": case}):
            with self.assertRaisesRegex(fixtures.agentic.Blocked, "Couverture des critères source"):
                fixtures.agentic.Controller(self.fixture.root).run("EA-01")
        state = fixtures.agentic.Controller(self.fixture.root).state["tickets"]["EA-01"]
        self.assertEqual(state["status"], "blocked")
        self.assertNotIn("delivered_commit", state)
        self.assertEqual(len(self.fixture.calls.read_text().splitlines()), 1)

    def test_omitted_source_criterion_stops_before_development(self):
        self.assert_formalization_rejected("criterion_omitted")

    def test_reworded_source_criterion_stops_before_development(self):
        self.assert_formalization_rejected("criterion_reworded")

    def test_unmapped_source_id_stops_before_development(self):
        self.assert_formalization_rejected("criterion_unmapped")

    def test_reordered_source_criteria_stop_before_development(self):
        self.assert_formalization_rejected("criterion_reordered")

    def test_extra_source_criterion_stops_before_development(self):
        self.assert_formalization_rejected("criterion_added")

    def test_partial_review_cannot_deliver_multiple_criteria(self):
        self.fixture.run_blocked("partial_coverage", "Nombre maximal de tentatives")

    def test_review_with_unmapped_id_cannot_deliver(self):
        self.fixture.run_blocked("unmapped_coverage", "Nombre maximal de tentatives")


class RestoreCoverageTest(unittest.TestCase):
    def setUp(self):
        self.fixture = prepare_fixture(self)
        self.record = fixtures.agentic.Controller(self.fixture.root).run("EA-01")
        self.path = Path(self.record["report"]).relative_to(self.record["worktree"])
        self.fixture.git("merge", "--ff-only", self.record["delivered_commit"])
        fixtures.agentic.Controller(self.fixture.root).reconcile()

    def clone(self):
        clone = self.fixture.directory / "fresh-clone"
        subprocess.run(["git", "clone", "--no-hardlinks", str(self.fixture.root), str(clone)],
                       check=True, capture_output=True)
        self.assertFalse((clone / ".agentic/state.json").exists())
        return clone

    def amend(self, change):
        path = self.fixture.root / self.path
        report = json.loads(path.read_text())
        change(report)
        path.write_text(json.dumps(report))
        self.fixture.git("add", "--", str(self.path))
        self.fixture.git("commit", "--amend", "--no-edit")

    def alter_formal_consistently(self, mutate):
        def change(report):
            formal = report["reports"][0]["report"]
            mutate(formal["requirements"])
            report["requirements"] = copy.deepcopy(formal["requirements"])
            contract = (json.dumps(formal, ensure_ascii=False, indent=2) + "\n").encode()
            report["contract_sha256"] = hashlib.sha256(contract).hexdigest()
            report["reports"][0]["sha256"] = hashlib.sha256(json.dumps(formal).encode()).hexdigest()
            report["reports"][-1]["report"]["requirements_covered"] = [r["id"] for r in formal["requirements"]]
        self.amend(change)

    def assert_restore_rejected(self, pattern):
        clone = self.clone()
        with self.assertRaisesRegex(restore_progress.agentic.Blocked, pattern):
            restore_progress.restore(clone)
        self.assertFalse((clone / ".agentic/state.json").exists())

    def test_coherent_hashes_do_not_restore_an_omitted_criterion(self):
        self.alter_formal_consistently(lambda requirements: requirements.pop())
        self.assert_restore_rejected("Couverture des critères source")

    def test_coherent_hashes_do_not_restore_a_reworded_criterion(self):
        self.alter_formal_consistently(lambda requirements: requirements[0].update(description="Weaker criterion"))
        self.assert_restore_rejected("Couverture des critères source")

    def test_unmapped_review_cannot_be_restored(self):
        self.amend(lambda report: report["reports"][-1]["report"].update(requirements_covered=["AC-01", "R2"]))
        self.assert_restore_rejected("Review indépendante incomplète")

    def test_complete_multicriteria_delivery_restores_on_a_fresh_clone(self):
        self.assertEqual(self.record["status"], "delivered_local")
        report = json.loads((self.fixture.root / self.path).read_text())
        self.assertEqual([r["id"] for r in report["requirements"]], ["AC-01", "AC-02"])
        self.assertEqual([r["description"] for r in report["requirements"]], self.fixture.tickets[0]["acceptance_criteria"])
        result = restore_progress.restore(self.clone())
        self.assertEqual(result["restored"], ["EA-01"])


if __name__ == "__main__":
    unittest.main()
