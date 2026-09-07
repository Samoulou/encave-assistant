"""Offline checks that technical bootstrap cannot rewrite product acceptance."""
import copy
from pathlib import Path
import sys
import unittest

import test_agentic as fixtures


REPOSITORY = Path(__file__).resolve().parents[2]
agentic = fixtures.agentic


class BootstrapContractTest(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.ControllerTest(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.root = self.fixture.root
        for name in ("source.json", "tickets.json", "bootstrap.json"):
            value = agentic.read_json(REPOSITORY / "backlog" / name)
            self.fixture.write("backlog/" + name, value)
        self.fixture.policy["gates"]["foundation"] = [sys.executable, "-c", "raise SystemExit(0)"]
        self.fixture.policy["gates"]["evals"] = [sys.executable, "-c", "raise SystemExit(0)"]
        self.fixture.policy["gates"]["ux"] = [sys.executable, "-c", "raise SystemExit(0)"]
        self.fixture.write(".agentic/policy.json", self.fixture.policy)
        self.data = agentic.read_json(self.root / "backlog/tickets.json")
        self.tickets = {item["id"]: item for item in self.data["tickets"]}

    def write_tickets(self):
        self.fixture.write("backlog/tickets.json", self.data)

    def test_supplementary_tickets_preserve_all_original_contracts(self):
        _, index = agentic.validate(self.root)
        self.assertEqual(len(index), 42)
        self.assertEqual(list(index)[:2], ["INIT-01", "DEV-01"])
        self.assertEqual(index["DEV-01"]["dependencies"], ["INIT-01"])
        self.assertEqual(index["DEV-01"]["required_gates"], ["kit", "foundation"])
        source = agentic.read_json(self.root / "backlog/source.json")
        self.assertEqual(len(source["tickets"]), 40)
        for item in source["tickets"]:
            self.assertEqual(index[item["id"]]["acceptance_criteria"], item["acceptance_criteria"])
            self.assertTrue(set(item["dependencies"]).issubset(index[item["id"]]["dependencies"]))

    def test_init_unlocks_only_technical_foundation_without_completing_product(self):
        controller = agentic.Controller(self.root)
        initial = [item["id"] for item in controller.ready()]
        self.assertIn("INIT-01", initial)
        self.assertNotIn("DEV-01", initial)
        controller.state["tickets"]["INIT-01"] = {
            "status": "integrated", "delivered_commit": self.fixture.initial_head,
        }
        ready = [item["id"] for item in controller.ready()]
        self.assertEqual(ready[0], "DEV-01")
        self.assertNotIn("EA-04", ready)
        self.assertFalse(any(identifier.startswith("EA-") for identifier in controller.state["tickets"]))

    def test_changed_product_acceptance_is_rejected(self):
        self.tickets["EA-01"]["acceptance_criteria"] = ["Always pass"]
        self.write_tickets()
        with self.assertRaisesRegex(agentic.Blocked, "Critères source modifiés : EA-01"):
            agentic.validate(self.root)

    def test_removed_product_dependency_is_rejected(self):
        self.tickets["EA-04"]["dependencies"] = ["INIT-01"]
        self.write_tickets()
        with self.assertRaisesRegex(agentic.Blocked, "Dépendances source supprimées : EA-04"):
            agentic.validate(self.root)

    def test_undocumented_product_dependency_is_rejected(self):
        self.tickets["EA-01"]["dependencies"] = ["DEV-01"]
        self.write_tickets()
        with self.assertRaisesRegex(agentic.Blocked, "Dépendances source modifiées : EA-01"):
            agentic.validate(self.root)

    def test_bootstrap_scope_change_is_rejected(self):
        self.tickets["DEV-01"]["acceptance_criteria"][0] = "Only create empty folders"
        self.write_tickets()
        with self.assertRaisesRegex(agentic.Blocked, "Contrat bootstrap modifié : DEV-01"):
            agentic.validate(self.root)

    def test_bootstrap_gate_cannot_be_dropped(self):
        self.tickets["DEV-01"]["required_gates"] = ["kit"]
        self.write_tickets()
        with self.assertRaisesRegex(agentic.Blocked, "Contrat bootstrap modifié : DEV-01"):
            agentic.validate(self.root)

    def test_bootstrap_reference_is_required_for_dev_ticket(self):
        (self.root / "backlog/bootstrap.json").unlink()
        with self.assertRaisesRegex(agentic.Blocked, "Référentiel bootstrap absent"):
            agentic.validate(self.root)

    def test_malformed_bootstrap_entries_fail_closed(self):
        bootstrap = agentic.read_json(self.root / "backlog/bootstrap.json")
        bootstrap["tickets"].append(None)
        self.fixture.write("backlog/bootstrap.json", bootstrap)
        with self.assertRaisesRegex(agentic.Blocked, "IDs bootstrap"):
            agentic.validate(self.root)

    def test_unregistered_extra_ticket_is_rejected(self):
        extra = copy.deepcopy(self.tickets["INIT-01"])
        extra["id"] = "DEV-02"
        self.data["tickets"].append(extra)
        self.write_tickets()
        with self.assertRaisesRegex(agentic.Blocked, "IDs bootstrap"):
            agentic.validate(self.root)

    def test_full_source_requirements_are_mandatory_with_bootstrap(self):
        source = agentic.read_json(self.root / "backlog/source.json")
        del source["tickets"][0]["acceptance_criteria"]
        self.fixture.write("backlog/source.json", source)
        with self.assertRaisesRegex(agentic.Blocked, "Critères source modifiés"):
            agentic.validate(self.root)

    def test_foundation_gate_must_have_a_command(self):
        del self.fixture.policy["gates"]["foundation"]
        self.fixture.write(".agentic/policy.json", self.fixture.policy)
        with self.assertRaisesRegex(agentic.Blocked, "Gates obligatoires absentes : DEV-01"):
            agentic.validate(self.root)

    def test_ux_gate_cannot_be_omitted_for_an_interface_ticket(self):
        self.tickets['EA-05']['required_gates'].remove('ux')
        self.write_tickets()
        with self.assertRaisesRegex(agentic.Blocked, 'Gate UX obligatoire'):
            agentic.validate(self.root)

    def test_ux_requirement_cannot_be_removed_from_the_current_contract(self):
        self.tickets['EA-05'].pop('requires_ux')
        self.tickets['EA-05']['required_gates'].remove('ux')
        self.write_tickets()
        with self.assertRaisesRegex(agentic.Blocked, 'validation UX supprimée'):
            agentic.validate(self.root)

    def test_bootstrap_reference_is_protected_even_without_policy_entry(self):
        self.fixture.commit()
        baseline = agentic.snapshot(self.root)
        head = self.fixture.git("rev-parse", "HEAD").stdout.strip()
        bootstrap = agentic.read_json(self.root / "backlog/bootstrap.json")
        bootstrap["tickets"][1]["acceptance_criteria"] = ["Weakened requirement"]
        self.fixture.write("backlog/bootstrap.json", bootstrap)
        with self.assertRaisesRegex(agentic.Blocked, "protégé.*backlog/bootstrap.json"):
            agentic.enforce(self.root, baseline, head, self.fixture.policy)


if __name__ == "__main__":
    unittest.main()
