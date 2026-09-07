"""Offline checks of exact-commit integration using the isolated fake-Codex fixture."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

import test_agentic as fixtures

SCRIPTS=Path(__file__).resolve().parents[2]/'scripts'
sys.path.insert(0,str(SCRIPTS))
import autopilot


class IntegrationTest(unittest.TestCase):
    def setUp(self):
        self.fixture=fixtures.ControllerTest(methodName='runTest')
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.root=self.fixture.root
        self.fixture.git('branch','-M','main')
        self.record=fixtures.agentic.Controller(self.root).run('EA-01')

    def test_integrates_exact_commit_and_unlocks_dependent_ticket(self):
        result=autopilot.integrate(self.root,'EA-01')
        self.assertEqual(result['status'],'integrated')
        self.assertEqual(self.fixture.git('rev-parse','HEAD').stdout.strip(),self.record['delivered_commit'])
        self.assertEqual([t['id'] for t in fixtures.agentic.Controller(self.root).ready()],['EA-02'])

    def test_changed_base_refuses_integration(self):
        (self.root/'parallel.md').write_text('Independent change')
        self.fixture.commit()
        with self.assertRaisesRegex(autopilot.agentic.Blocked,'Base modifiée'):
            autopilot.integrate(self.root,'EA-01')

    def test_wrong_branch_refuses_integration(self):
        self.fixture.git('checkout','-b','other')
        with self.assertRaisesRegex(autopilot.agentic.Blocked,'branche de base'):
            autopilot.integrate(self.root,'EA-01')

    def test_hidden_change_in_base_is_rejected_before_merge(self):
        self.fixture.git('update-index','--assume-unchanged','existing.py')
        (self.root/'existing.py').write_text('VALUE = 999\n')
        with self.assertRaisesRegex(autopilot.agentic.Blocked,'Index Git spécial'):
            autopilot.integrate(self.root,'EA-01')
        self.assertEqual(self.fixture.git('rev-parse','HEAD').stdout.strip(),self.record['base_commit'])

    def test_dirty_worktree_refuses_integration(self):
        (Path(self.record['worktree'])/'app.py').write_text('VALUE = 2\n')
        with self.assertRaisesRegex(autopilot.agentic.Blocked,'Worktree modifiée'):
            autopilot.integrate(self.root,'EA-01')

    def test_hidden_content_change_refuses_integration(self):
        wt=Path(self.record['worktree'])
        fixtures.agentic.git(wt,'update-index','--assume-unchanged','app.py')
        (wt/'app.py').write_text('VALUE = 2\n')
        with self.assertRaisesRegex(autopilot.agentic.Blocked,'code testé'):
            autopilot.integrate(self.root,'EA-01')

    def test_blocked_ticket_is_never_integrated(self):
        state=fixtures.agentic.read_json(self.root/'.agentic/state.json')
        state['tickets']['EA-01']['status']='blocked'
        fixtures.agentic.write_json(self.root/'.agentic/state.json',state)
        with self.assertRaisesRegex(autopilot.agentic.Blocked,'Aucune livraison locale'):
            autopilot.integrate(self.root,'EA-01')

    def test_missing_evidence_is_not_success(self):
        Path(self.record['report']).unlink()
        with self.assertRaises(autopilot.agentic.Blocked):
            autopilot.integrate(self.root,'EA-01')

    def test_reviewer_cannot_omit_a_requirement(self):
        report_path=Path(self.record['report'])
        report=json.loads(report_path.read_text())
        report['reports'][-1]['report']['requirements_covered']=[]
        report_path.write_text(json.dumps(report))
        wt=Path(self.record['worktree'])
        fixtures.agentic.git(wt,'add','-A')
        fixtures.agentic.git(wt,'commit','-m','Tampered fixture evidence')
        self.record['delivered_commit']=fixtures.agentic.git(wt,'rev-parse','HEAD').stdout.strip()
        with self.assertRaisesRegex(autopilot.agentic.Blocked,'Review indépendante'):
            autopilot.verify_evidence(self.root,fixtures.agentic.Controller(self.root),'EA-01',self.record)


if __name__=='__main__':unittest.main()
