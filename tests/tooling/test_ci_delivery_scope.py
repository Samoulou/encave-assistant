"""CI scope uses real Git delivery evidence; the CLI itself is an offline fake."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

import test_agentic as fixtures
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import agentic
import ci_scope
import product_quality


class DeliveryScopeTest(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.ControllerTest(methodName='runTest')
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.root = self.fixture.root
        self.fixture.git('branch', '-M', 'main')
        self.fixture.policy['gates']['foundation'] = [sys.executable, '-c', 'raise SystemExit(0)']
        self.fixture.policy['gates']['evals'] = [sys.executable, '-c', 'raise SystemExit(0)']
        self.fixture.tickets[0]['required_gates'] = ['kit', 'foundation']
        self.fixture.tickets[1].update(kind='code', required_gates=['kit', 'unit', 'functional', 'business', 'e2e'])
        third = copy.deepcopy(self.fixture.tickets[1])
        third.update(id='EA-03', dependencies=['EA-02'], kind='discovery', required_gates=['kit'])
        self.fixture.tickets.append(third)
        self.fixture.write_config()
        self.fixture.commit()
        binary = self.fixture.binary / 'codex'
        binary.write_text(binary.read_text().replace("pathlib.Path('app.py').write_text('VALUE = 1\\n')", "pathlib.Path('apps/api').mkdir(parents=True, exist_ok=True); pathlib.Path('apps/api/index.py').write_text('VALUE = 1\\n')"))

    def deliver(self, identifier):
        record = fixtures.agentic.Controller(self.root).run(identifier)
        self.fixture.git('merge', '--ff-only', record['delivered_commit'])
        fixtures.agentic.Controller(self.root).reconcile()
        return Path(record['report']).relative_to(record['worktree'])

    def test_foundation_delivery_selects_only_foundation_in_detached_ci(self):
        self.deliver('EA-01')
        self.fixture.git('checkout', '--detach')
        result = ci_scope.delivery_scope(self.root, 'push')
        self.assertEqual(result['gates'], ['foundation'])
        self.assertEqual(result['mode'], 'verified_deliveries')

    def test_cumulative_code_gates_survive_later_discovery_delivery(self):
        for identifier in ('EA-01', 'EA-02', 'EA-03'):
            self.deliver(identifier)
        self.assertEqual(ci_scope.delivery_scope(self.root, 'push')['gates'], ['foundation', 'unit', 'functional', 'business', 'e2e'])

    def test_ai_delivery_adds_evals(self):
        self.fixture.tickets[1]['required_gates'].append('evals')
        self.fixture.tickets[1]['requires_evals'] = True
        self.fixture.write_config()
        self.fixture.commit()
        self.deliver('EA-01')
        self.deliver('EA-02')
        self.assertEqual(ci_scope.delivery_scope(self.root, 'push')['gates'], [g for g in ci_scope.GATE_ORDER if g != 'ux'])

    def test_release_forces_all_product_gates_after_foundation(self):
        self.deliver('EA-01')
        self.assertEqual(ci_scope.delivery_scope(self.root, 'workflow_call')['gates'], [g for g in ci_scope.GATE_ORDER if g != 'ux'])

    def test_release_forces_product_gates_even_without_app(self):
        self.assertEqual(ci_scope.delivery_scope(self.root, 'workflow_dispatch')['gates'], ci_scope.PRODUCT_GATES)

    def test_unattested_direct_app_requires_all_gates(self):
        (self.root / 'apps').mkdir()
        (self.root / 'apps/main.py').write_text('VALUE = 1\n')
        self.fixture.commit()
        self.assertEqual(ci_scope.delivery_scope(self.root, 'push')['gates'], [g for g in ci_scope.GATE_ORDER if g != 'ux'])

    def test_unattested_change_cannot_hide_behind_later_delivery(self):
        self.deliver('EA-01')
        (self.root / 'apps/api/hidden.py').write_text('VALUE = 2\n')
        self.fixture.commit()
        self.deliver('EA-02')
        self.assertEqual(ci_scope.delivery_scope(self.root, 'push')['gates'], [g for g in ci_scope.GATE_ORDER if g != 'ux'])

    def test_tampered_evidence_fails_closed(self):
        path = self.deliver('EA-01')
        report = json.loads((self.root / path).read_text())
        report['code_sha256'] = '0' * 64
        (self.root / path).write_text(json.dumps(report))
        self.fixture.git('add', '-A')
        self.fixture.git('commit', '--amend', '--no-edit')
        with self.assertRaisesRegex(agentic.Blocked, 'Empreinte du code'):
            ci_scope.delivery_scope(self.root, 'push')

    def test_deleted_evidence_fails_closed(self):
        (self.root / self.deliver('EA-01')).unlink()
        self.fixture.commit()
        with self.assertRaisesRegex(agentic.Blocked, 'Attestation'):
            ci_scope.delivery_scope(self.root, 'push')

    def test_shallow_history_fails_closed(self):
        self.deliver('EA-01')
        clone = self.fixture.directory / 'shallow'
        subprocess.run(['git', 'clone', '--depth', '1', self.root.as_uri(), str(clone)], check=True, capture_output=True)
        with self.assertRaisesRegex(agentic.Blocked, 'Historique Git incomplet'):
            ci_scope.delivery_scope(clone, 'push')

    def test_quality_runs_selected_configured_command_and_propagates_failure(self):
        with patch.object(product_quality, 'ROOT', self.root):
            self.assertEqual(product_quality.main(['--gates', '["foundation"]']), 0)
            self.fixture.policy['gates']['foundation'] = [sys.executable, '-c', 'raise SystemExit(7)']
            self.fixture.write_config()
            self.assertEqual(product_quality.main(['--gates', '["foundation"]']), 1)
            for invalid in ('[]', '["unknown"]', '["unit", "unit"]'):
                with self.assertRaises(SystemExit):
                    product_quality.main(['--gates', invalid])

    def test_ui_delivery_adds_ux_and_later_discovery_keeps_it(self):
        self.fixture.policy['gates']['ux'] = [sys.executable, '-c', 'raise SystemExit(0)']
        self.fixture.tickets[1]['required_gates'].append('ux')
        self.fixture.tickets[1]['requires_ux'] = True
        self.fixture.write_config()
        self.fixture.commit()
        for identifier in ('EA-01', 'EA-02', 'EA-03'):
            self.deliver(identifier)
        self.assertEqual(ci_scope.delivery_scope(self.root, 'push')['gates'], ['foundation', 'unit', 'functional', 'business', 'e2e', 'ux'])

    def test_release_includes_configured_ux_before_ui_delivery(self):
        self.fixture.policy['gates']['ux'] = [sys.executable, '-c', 'raise SystemExit(9)']
        self.fixture.write_config()
        self.fixture.commit()
        self.deliver('EA-01')
        self.assertEqual(ci_scope.delivery_scope(self.root, 'workflow_call')['gates'], ci_scope.GATE_ORDER)
        with patch.object(product_quality, 'ROOT', self.root):
            self.assertEqual(product_quality.main([]), 1)
