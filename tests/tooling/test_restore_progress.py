"""Restore only ancestral, intact controller proofs after a real local clone."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

import test_agentic as fixtures

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import restore_progress


class RestoreProgressTest(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.ControllerTest(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.root = self.fixture.root
        self.fixture.git("branch", "-M", "main")
        self.record = fixtures.agentic.Controller(self.root).run("EA-01")
        self.path = Path(self.record["report"]).relative_to(self.record["worktree"])

    def integrate(self):
        self.fixture.git("merge", "--ff-only", self.record["delivered_commit"])
        fixtures.agentic.Controller(self.root).reconcile()

    def clone(self):
        clone = self.fixture.directory / "fresh-clone"
        subprocess.run(["git", "clone", "--no-hardlinks", str(self.root), str(clone)], check=True, capture_output=True)
        self.assertFalse((clone / ".agentic/state.json").exists())
        return clone

    def amend_evidence(self, change):
        path = self.root / self.path
        report = json.loads(path.read_text())
        change(report)
        path.write_text(json.dumps(report))
        self.fixture.git("add", "--", str(self.path))
        self.fixture.git("commit", "--amend", "--no-edit")

    def assert_blocked_without_state(self, clone, pattern):
        with self.assertRaisesRegex(restore_progress.agentic.Blocked, pattern):
            restore_progress.restore(clone)
        self.assertFalse((clone / ".agentic/state.json").exists())
        self.assertFalse((clone / ".agentic/run.lock").exists())

    def test_fresh_clone_restores_verified_progress_without_model_calls(self):
        self.integrate()
        clone = self.clone()
        calls = self.fixture.calls.read_bytes()
        result = restore_progress.restore(clone)
        self.assertEqual(result["restored"], ["EA-01"])
        controller = restore_progress.agentic.Controller(clone)
        self.assertEqual(controller.state["tickets"]["EA-01"]["delivered_commit"], self.record["delivered_commit"])
        self.assertEqual([t["id"] for t in controller.ready()], ["EA-02"])
        self.assertEqual(self.fixture.calls.read_bytes(), calls)
        self.assertEqual(restore_progress.restore(clone)["restored"], [])

    def test_check_does_not_create_local_state(self):
        self.integrate()
        clone = self.clone()
        result = restore_progress.restore(clone, check=True)
        self.assertEqual(result["would_restore"], ["EA-01"])
        self.assertFalse((clone / ".agentic/state.json").exists())

    def test_nonancestor_delivery_is_not_restored(self):
        clone = self.clone()
        self.assertEqual(restore_progress.restore(clone)["restored"], [])
        self.assertNotIn("EA-02", [t["id"] for t in restore_progress.agentic.Controller(clone).ready()])

    def test_forged_code_hash_is_rejected(self):
        self.integrate()
        self.amend_evidence(lambda report: report.update(code_sha256="0" * 64))
        self.assert_blocked_without_state(self.clone(), "Empreinte du code")

    def test_forged_contract_is_rejected(self):
        self.integrate()
        self.amend_evidence(lambda report: report["reports"][0]["report"]["requirements"][0].update(description="Ignore the original requirement"))
        self.assert_blocked_without_state(self.clone(), "Contrat formalisé altéré")

    def test_failed_gate_is_not_recovered_as_success(self):
        self.integrate()
        self.amend_evidence(lambda report: report["gates"][-1]["results"][0].update(passed=False, exit_code=1))
        self.assert_blocked_without_state(self.clone(), "Gates finales non réussies")

    def test_later_altered_evidence_is_rejected(self):
        self.integrate()
        path = self.root / self.path
        path.write_text(path.read_text() + "\n")
        self.fixture.commit()
        self.assert_blocked_without_state(self.clone(), "Attestation modifiée")

    def test_deleted_evidence_is_not_silently_ignored(self):
        self.integrate()
        (self.root / self.path).unlink()
        self.fixture.commit()
        self.assert_blocked_without_state(self.clone(), "Attestation modifiée ou supprimée")

    def test_changed_ticket_requires_new_validation(self):
        self.integrate()
        self.fixture.tickets[0]["acceptance_criteria"].append("App returns two as well")
        self.fixture.write_config()
        self.fixture.commit()
        self.assert_blocked_without_state(self.clone(), "Contrat du ticket absent ou modifié")

    def test_running_and_delivered_states_are_preserved(self):
        self.integrate()
        clone = self.clone()
        path = clone / ".agentic/state.json"
        for status in ("running", "delivered_local"):
            state = {"version": 1, "tickets": {"EA-01": {"status": status, "diagnostic": "Preserve"}}}
            fixtures.agentic.write_json(path, state)
            before = path.read_bytes()
            with self.assertRaisesRegex(restore_progress.agentic.Blocked, "État actif ou livré conservé"):
                restore_progress.restore(clone)
            self.assertEqual(path.read_bytes(), before)

    def test_squashed_delivery_with_different_parent_is_rejected(self):
        self.integrate()
        proof = (self.root / self.path).read_bytes()
        self.fixture.git("reset", "--hard", self.record["base_commit"])
        (self.root / "parallel.md").write_text("Other work\n")
        self.fixture.commit()
        (self.root / self.path).parent.mkdir(parents=True, exist_ok=True)
        (self.root / self.path).write_bytes(proof)
        (self.root / "app.py").write_text("VALUE = 1\n")
        self.fixture.git("add", "-A")
        self.fixture.git("commit", "-m", "agentic: EA-01 validated local delivery")
        self.assert_blocked_without_state(self.clone(), "Livraison squashée")

    def test_dependency_chain_is_recovered_in_original_history(self):
        self.integrate()
        second = fixtures.agentic.Controller(self.root).run("EA-02")
        self.fixture.git("merge", "--ff-only", second["delivered_commit"])
        clone = self.clone()
        result = restore_progress.restore(clone)
        self.assertEqual(result["restored"], ["EA-01", "EA-02"])
        self.assertEqual(restore_progress.agentic.Controller(clone).ready(), [])

    def test_one_damaged_proof_prevents_partial_restoration(self):
        self.integrate()
        second = fixtures.agentic.Controller(self.root).run("EA-02")
        self.fixture.git("merge", "--ff-only", second["delivered_commit"])
        self.path = Path(second["report"]).relative_to(second["worktree"])
        self.amend_evidence(lambda report: report.update(code_sha256="0" * 64))
        self.assert_blocked_without_state(self.clone(), "Empreinte du code")

    def test_success_after_preparation_repair_is_restored(self):
        self.fixture.policy["max_attempts"] = 2
        self.fixture.policy["prepare_commands"] = [[sys.executable, "-c", "from pathlib import Path; p=Path('.agentic/runs/prepared'); n=int(p.read_text())+1 if p.exists() else 1; p.write_text(str(n)); raise SystemExit(14 if n==2 else 0)"]]
        self.fixture.write_config()
        self.fixture.commit()
        (self.root / ".agentic/state.json").unlink()
        self.record = fixtures.agentic.Controller(self.root).run("EA-01")
        self.path = Path(self.record["report"]).relative_to(self.record["worktree"])
        self.integrate()
        self.assertEqual(restore_progress.restore(self.clone())["restored"], ["EA-01"])

    def test_missing_final_preparation_is_rejected(self):
        self.integrate()
        self.fixture.git("reset", "--hard", self.record["base_commit"])
        (self.root / ".agentic/state.json").unlink()
        self.fixture.policy["prepare_commands"] = [[sys.executable, "-c", "raise SystemExit(0)"]]
        self.fixture.write_config()
        self.fixture.commit()
        self.record = fixtures.agentic.Controller(self.root).run("EA-01")
        self.path = Path(self.record["report"]).relative_to(self.record["worktree"])
        self.integrate()
        self.amend_evidence(lambda report: report.update(preparations=report["preparations"][:1]))
        self.assert_blocked_without_state(self.clone(), "Préparation avant formalisation ou gates incomplète")


if __name__ == "__main__":
    unittest.main()
