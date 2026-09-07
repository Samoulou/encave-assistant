"""Preauthorized infrastructure work cannot broaden the agent's permissions."""
from pathlib import Path
from unittest.mock import patch
import os
import unittest

import test_agentic as fixtures

agentic = fixtures.agentic


class ScopedMaintenanceTest(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.ControllerTest(methodName='runTest')
        self.f.setUp()
        self.addCleanup(self.f.doCleanups)
        self.root = self.f.root
        self.f.tickets = [dict(self.f.tickets[0], id='EA-04')]
        self.f.policy['maintenance'] = {'EA-04': ['.github/workflows/product-quality.yml']}
        self.f.policy['protected_paths'].append('.github/workflows')
        (self.root / '.github/workflows').mkdir(parents=True)
        self.target = self.root / '.github/workflows/product-quality.yml'
        self.target.write_text((Path(__file__).resolve().parents[2] / '.github/workflows/product-quality.yml').read_text())
        self.f.write_config()
        self.f.commit()

    def enforce_change(self, ticket, change):
        base = agentic.snapshot(self.root)
        head = self.f.git('rev-parse', 'HEAD').stdout.strip()
        change()
        return agentic.enforce(self.root, base, head, self.f.policy, ticket)

    def test_allowed_file_requires_the_correct_ticket(self):
        with self.assertRaisesRegex(agentic.Blocked, 'protégé'):
            self.enforce_change('EA-05', lambda: self.target.write_text('name: Changed\n'))

    def test_ordinary_enforcement_has_no_maintenance_permission(self):
        with self.assertRaisesRegex(agentic.Blocked, 'protégé'):
            self.enforce_change(None, lambda: self.target.write_text('name: Changed\n'))

    def test_controller_integrity_is_never_in_the_allowlist(self):
        for name in ('scripts/agentic.py', 'AGENTS.md', '.agentic/policy.json', 'tests/test_existing.py', '.github/workflows/*'):
            self.f.policy['maintenance']['EA-04'] = [name]
            self.f.write_config()
            with self.assertRaisesRegex(agentic.Blocked, 'maintenance non autorisé'):
                agentic.validate(self.root)

    def test_allowed_workflow_cannot_be_deleted(self):
        with self.assertRaisesRegex(agentic.Blocked, 'Suppression'):
            self.enforce_change('EA-04', self.target.unlink)

    def test_grant_does_not_allow_editing_an_old_test(self):
        with self.assertRaisesRegex(agentic.Blocked, 'test existant'):
            self.enforce_change('EA-04', lambda: (self.root / 'tests/test_existing.py').write_text('assert True\n'))

    def test_grant_cannot_be_extended_by_the_developer(self):
        with self.assertRaisesRegex(agentic.Blocked, 'protégé'):
            self.enforce_change('EA-04', lambda: self.f.write('.agentic/policy.json', dict(self.f.policy, maintenance={})))

    def test_full_ticket_can_deliver_its_preapproved_workflow_change(self):
        code = fixtures.FAKE_CODEX.replace("    pathlib.Path('app.py').write_text('VALUE = 1\\n')", "    pathlib.Path('app.py').write_text('VALUE = 1\\n')\n    assert context['maintenance_paths'] == ['.github/workflows/product-quality.yml']\n    workflow = pathlib.Path('.github/workflows/product-quality.yml')\n    workflow.write_text(workflow.read_text() + '# Configuration de fixture\\n')")
        (self.f.binary / 'codex').write_text(code)
        record = agentic.Controller(self.root).run('EA-04')
        self.assertEqual(record['status'], 'delivered_local')
        self.assertTrue(Path(record['worktree'], '.github/workflows/product-quality.yml').read_text().endswith('# Configuration de fixture\n'))
        self.assertEqual(len(self.f.calls.read_text().splitlines()), 3)
