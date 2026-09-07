"""Offline campaign tests with isolated Git histories and the existing fake CLI."""
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import test_agentic as fixtures
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import continuous


class ContinuousTest(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.ControllerTest(methodName='runTest')
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.root = self.fixture.root
        self.fixture.git('branch', '-M', 'main')
        with (self.root / '.gitignore').open('a') as stream:
            stream.write('.agentic/continuous.json\n.agentic/continuous.json.tmp\n.agentic/continuous.lock\n.agentic/continuous.stop\n')
        self.fixture.policy['continuous'] = {**continuous.DEFAULTS, 'publish_mode': 'local'}
        self.config()

    def config(self):
        self.fixture.write_config()
        self.fixture.commit()

    def calls(self):
        return len(self.fixture.calls.read_text().splitlines()) if self.fixture.calls.exists() else 0

    def campaign(self):
        return continuous.Campaign(self.root)

    def test_processes_more_than_twenty_tickets(self):
        self.fixture.tickets = [dict(self.fixture.tickets[0], id=f'EA-{i:02d}', dependencies=[f'EA-{i-1:02d}'] if i > 1 else []) for i in range(1, 23)]
        self.config()
        result = self.campaign().execute()
        self.assertEqual(result['status'], 'complete', result)
        self.assertEqual(len(result['integrated']), 22)
        self.assertEqual(self.calls(), 66)
        self.assertEqual(self.campaign().execute()['status'], 'complete')
        self.assertEqual(self.calls(), 66)

    def test_blocked_ticket_allows_independent_work_but_never_false_complete(self):
        self.fixture.tickets.append(dict(self.fixture.tickets[0], id='EA-03'))
        self.config()
        original = continuous.agentic.Controller.run
        def selected(controller, identifier):
            with patch.dict(os.environ, {'FAKE_CASE': 'blocked' if identifier == 'EA-01' else 'pass'}):
                return original(controller, identifier)
        with patch.object(continuous.agentic.Controller, 'run', selected):
            result = self.campaign().execute()
        self.assertEqual(result['status'], 'blocked')
        self.assertEqual(result['integrated'], ['EA-03'])
        self.assertEqual(result['blocked'], ['EA-01'])
        before = self.calls()
        self.assertEqual(self.campaign().execute()['status'], 'blocked')
        self.assertEqual(self.calls(), before)

    def test_explicit_retry_keeps_prior_budget(self):
        with patch.dict(os.environ, {'FAKE_CASE': 'blocked'}):
            first = self.campaign().execute()
        self.assertEqual(first['agent_calls_charged'], 1)
        result = self.campaign().execute(retry='EA-01')
        self.assertEqual(result['status'], 'complete', result)
        self.assertEqual(result['agent_calls_charged'], 7)
        self.assertEqual(result['ticket_runs'], 3)

    def test_global_call_budget_persists_on_resume_and_retry(self):
        self.fixture.policy['continuous']['max_agent_calls'] = 2
        self.config()
        first = self.campaign().execute()
        self.assertEqual(first['status'], 'budget_exhausted')
        self.assertEqual(first['agent_calls_charged'], 2)
        second = self.campaign().execute(retry='EA-01')
        self.assertEqual(second['status'], 'budget_exhausted')
        self.assertEqual(self.calls(), 2)

    def test_ticket_run_budget_survives_explicit_retries(self):
        self.fixture.policy['continuous']['max_runs_per_ticket'] = 2
        self.config()
        with patch.dict(os.environ, {'FAKE_CASE': 'blocked'}):
            self.campaign().execute()
            second = self.campaign().execute(retry='EA-01')
            third = self.campaign().execute(retry='EA-01')
        self.assertEqual(second['ticket_runs'], 2)
        self.assertEqual(third['status'], 'blocked')
        self.assertIn('Budget persistant', third['reason'])
        self.assertEqual(self.calls(), 2)

    def test_crash_after_integrate_resumes_without_duplicate_work(self):
        original = continuous.autopilot.integrate
        count = 0
        def interrupted(root, identifier):
            nonlocal count
            result = original(root, identifier)
            count += 1
            if count == 1:
                raise KeyboardInterrupt()
            return result
        with patch.object(continuous.autopilot, 'integrate', interrupted):
            first = self.campaign().execute()
        self.assertEqual(first['status'], 'stopped')
        self.assertEqual(self.calls(), 3)
        resumed = self.campaign().execute()
        self.assertEqual(resumed['status'], 'complete', resumed)
        self.assertEqual(self.calls(), 6)

    def test_running_crash_is_uncertain_not_replayed(self):
        original = continuous.agentic.Controller.run
        def interrupted(controller, identifier):
            result = original(controller, identifier)
            state = continuous.agentic.read_json(controller.state_path)
            state['tickets'][identifier]['status'] = 'running'
            continuous.agentic.write_json(controller.state_path, state)
            raise KeyboardInterrupt()
        with patch.object(continuous.agentic.Controller, 'run', interrupted):
            first = self.campaign().execute()
        self.assertEqual(first['status'], 'stopped')
        resumed = self.campaign().execute()
        self.assertEqual(resumed['status'], 'blocked')
        self.assertIn('incertaine', resumed['reason'])
        self.assertEqual(resumed['agent_calls_charged'], 8)
        self.assertEqual(self.calls(), 3)

    def test_block_before_state_creation_is_recorded_once(self):
        with patch.object(continuous.agentic.shutil, 'which', return_value=None):
            first = self.campaign().execute()
        self.assertEqual(first['status'], 'blocked')
        self.assertEqual(first['blocked'], ['EA-01'])
        self.assertEqual(first['agent_calls_charged'], 0)
        self.assertEqual(self.campaign().execute()['ticket_runs'], 1)
        self.assertEqual(self.calls(), 0)
        self.assertEqual(self.campaign().execute(retry='EA-01')['status'], 'complete')

    def test_status_before_start_is_read_only_and_needs_no_cli(self):
        before = {str(path.relative_to(self.root)) for path in self.root.rglob('*')}
        with patch.object(continuous.agentic.shutil, 'which', return_value=None), patch.object(continuous.agentic.Controller, 'run', side_effect=AssertionError('No agent')):
            result = self.campaign().status()
        after = {str(path.relative_to(self.root)) for path in self.root.rglob('*')}
        self.assertEqual(result['status'], 'not_started')
        self.assertEqual(before, after)

    def test_dirty_repository_rejected_before_campaign_creation(self):
        (self.root / 'pending.txt').write_text('Not committed')
        with self.assertRaisesRegex(continuous.agentic.Blocked, 'propre'):
            self.campaign().execute()
        self.assertFalse((self.root / '.agentic/continuous.json').exists())
        self.assertEqual(self.calls(), 0)

    def test_external_head_change_cannot_resume(self):
        with patch.dict(os.environ, {'FAKE_CASE': 'blocked'}):
            self.campaign().execute()
        (self.root / 'outside.txt').write_text('Separate work')
        self.fixture.commit()
        result = self.campaign().execute()
        self.assertEqual(result['status'], 'blocked')
        self.assertIn('HEAD', result['reason'])
        self.assertEqual(self.calls(), 1)

    def test_frozen_plan_rejects_contract_changes(self):
        with patch.dict(os.environ, {'FAKE_CASE': 'blocked'}):
            self.campaign().execute()
        self.fixture.tickets[0]['acceptance_criteria'].append('Additional scope')
        self.config()
        with self.assertRaisesRegex(continuous.agentic.Blocked, 'Plan ou politique'):
            self.campaign()

    def test_os_lock_prevents_overlapping_campaign(self):
        with continuous.campaign_lock(self.root):
            with self.assertRaisesRegex(continuous.agentic.Blocked, 'déjà active'):
                self.campaign().execute()
        self.assertEqual(self.calls(), 0)

    def test_stop_between_tickets_preserves_progress_for_resume(self):
        (self.root / '.agentic/continuous.stop').touch()
        result = self.campaign().execute()
        self.assertEqual(result['status'], 'stopped')
        self.assertEqual(self.calls(), 0)
        self.assertEqual(self.campaign().execute()['status'], 'complete')

    def test_wall_clock_budget_survives_process_restart(self):
        with patch.dict(os.environ, {'FAKE_CASE': 'blocked'}):
            self.campaign().execute()
        state_path = self.root / '.agentic/continuous.json'
        data = json.loads(state_path.read_text())
        data['started_at'] -= continuous.DEFAULTS['max_wall_seconds'] + 1
        continuous.agentic.write_json(state_path, data)
        result = self.campaign().execute(retry='EA-01')
        self.assertEqual(result['status'], 'budget_exhausted')
        self.assertEqual(self.calls(), 1)

    def test_status_complete_rejects_deleted_controller_state_without_writing(self):
        self.assertEqual(self.campaign().execute()['status'], 'complete')
        (self.root / '.agentic/state.json').unlink()
        before = (self.root / '.agentic/continuous.json').read_bytes()
        self.assertEqual(self.campaign().status()['status'], 'blocked')
        self.assertEqual((self.root / '.agentic/continuous.json').read_bytes(), before)
        self.assertEqual(self.calls(), 6)

    def test_missing_budget_history_is_rejected(self):
        with patch.dict(os.environ, {'FAKE_CASE': 'blocked'}):
            self.campaign().execute()
        state_path = self.root / '.agentic/continuous.json'
        data = json.loads(state_path.read_text())
        data['runs'] = []
        continuous.agentic.write_json(state_path, data)
        with self.assertRaisesRegex(continuous.agentic.Blocked, 'Journal de budget'):
            self.campaign()

    def unproven_integrated_state(self):
        head = self.fixture.git('rev-parse', 'HEAD').stdout.strip()
        base = self.fixture.git('rev-parse', 'HEAD^').stdout.strip()
        return {'version': 1, 'tickets': {ticket['id']: {
            'status': 'integrated', 'run_id': 'unproved-' + ticket['id'],
            'delivered_commit': head, 'base_commit': base, 'agent_calls': 0,
        } for ticket in self.fixture.tickets}}

    def fabricate_cached_completion(self):
        campaign = self.campaign()
        campaign.initialize()
        state = self.unproven_integrated_state()
        continuous.agentic.write_json(self.root / '.agentic/state.json', state)
        campaign.data['tickets'] = state['tickets']
        campaign.data['runs'] = [{'ticket': key, 'reserved_calls': 0, 'agent_calls': 0}
                                 for key in state['tickets']]
        campaign.data['status'] = 'complete'
        campaign.save()

    def test_initial_state_cannot_import_unproven_integrated_tickets(self):
        continuous.agentic.write_json(self.root / '.agentic/state.json', self.unproven_integrated_state())
        with self.assertRaisesRegex(continuous.agentic.Blocked, 'sans attestation'):
            self.campaign().execute()
        self.assertEqual(self.calls(), 0)
        self.assertFalse((self.root / '.agentic/continuous.json').exists())

    def test_complete_requires_historical_evidence_for_every_required_ticket(self):
        self.fabricate_cached_completion()
        result = self.campaign().execute()
        self.assertEqual(result['status'], 'blocked')
        self.assertIn('attestations vérifiées pour tous', result['reason'])
        self.assertEqual(self.calls(), 0)

    def test_status_rejects_unproven_completion_without_any_write_or_lock(self):
        self.fabricate_cached_completion()
        before = (self.root / '.agentic/continuous.json').read_bytes()
        with patch.object(continuous.agentic, 'lock', side_effect=AssertionError('Read-only status cannot lock')), patch.object(continuous.agentic, 'write_json', side_effect=AssertionError('Read-only status cannot write')):
            result = self.campaign().status()
        self.assertEqual(result['status'], 'blocked')
        self.assertEqual((self.root / '.agentic/continuous.json').read_bytes(), before)
        self.assertEqual(self.calls(), 0)

    def test_status_accepts_proven_completion_without_any_write_or_lock(self):
        self.assertEqual(self.campaign().execute()['status'], 'complete')
        with patch.object(continuous.agentic, 'lock', side_effect=AssertionError('Read-only status cannot lock')), patch.object(continuous.agentic, 'write_json', side_effect=AssertionError('Read-only status cannot write')):
            self.assertEqual(self.campaign().status()['status'], 'complete')
        self.assertEqual(self.calls(), 6)

    def test_completion_rejects_wrong_delivered_commit_even_when_ancestral(self):
        self.assertEqual(self.campaign().execute()['status'], 'complete')
        state_path = self.root / '.agentic/state.json'
        state = json.loads(state_path.read_text())
        state['tickets']['EA-01']['delivered_commit'] = self.fixture.git('rev-parse', 'HEAD').stdout.strip()
        continuous.agentic.write_json(state_path, state)
        campaign = self.campaign()
        campaign.data['tickets'] = state['tickets']
        campaign.save()
        self.assertEqual(self.campaign().status()['status'], 'blocked')
        self.assertEqual(self.campaign().execute()['status'], 'blocked')
        self.assertEqual(self.calls(), 6)

    def remote(self):
        path = self.fixture.directory / 'remote.git'
        fixtures.subprocess.run(['git', 'init', '--bare', '-q', str(path)], check=True)
        self.fixture.git('remote', 'add', 'origin', str(path))
        self.fixture.policy['continuous']['publish_mode'] = 'verified_push'
        self.config()
        self.fixture.git('push', 'origin', 'main')
        return path

    def test_verified_push_publishes_each_validated_commit(self):
        remote = self.remote()
        result = self.campaign().execute()
        self.assertEqual(result['status'], 'complete', result)
        self.assertTrue(result['remote_published'])
        found = fixtures.subprocess.run(['git', '-C', str(remote), 'rev-parse', 'refs/heads/main'], capture_output=True, text=True, check=True).stdout.strip()
        self.assertEqual(found, self.fixture.git('rev-parse', 'HEAD').stdout.strip())

    def test_rejected_push_stops_spending_and_resume_only_retries_pending_delivery(self):
        remote = self.remote()
        hook = remote / 'hooks/pre-receive'
        hook.write_text('#!/bin/sh\nexit 1\n')
        hook.chmod(0o755)
        first = self.campaign().execute()
        self.assertEqual(first['status'], 'publish_blocked', first)
        self.assertEqual(self.calls(), 3)
        self.assertEqual(first['pending_push'], first['expected_head'])
        repeated = self.campaign().execute()
        self.assertEqual(repeated['status'], 'publish_blocked')
        self.assertEqual(self.calls(), 3)
        hook.unlink()
        final = self.campaign().execute()
        self.assertEqual(final['status'], 'complete', final)
        self.assertEqual(self.calls(), 6)

    def test_changed_push_remote_is_rejected(self):
        remote = self.remote()
        hook = remote / 'hooks/pre-receive'
        hook.write_text('#!/bin/sh\nexit 1\n')
        hook.chmod(0o755)
        self.campaign().execute()
        self.fixture.git('remote', 'set-url', 'origin', str(self.fixture.directory / 'other.git'))
        resumed = self.campaign().execute()
        self.assertEqual(resumed['status'], 'publish_blocked')
        self.assertEqual(self.calls(), 3)


if __name__ == '__main__':
    unittest.main()
