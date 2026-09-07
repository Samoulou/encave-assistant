"""Semantic invariants for preauthorized CI maintenance; no workflow is executed."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import workflow_contract as contract
import yaml

ROOT = Path(__file__).resolve().parents[2]


class WorkflowContractTest(unittest.TestCase):
    def setUp(self):
        self.sources = {name: (ROOT / '.github/workflows' / name).read_text() for name in ('product-quality.yml', 'release.yml')}

    def changed(self, name, mutate):
        value = contract.parse(self.sources[name])
        mutate(value)
        return yaml.safe_dump(value, sort_keys=False)

    def rejected(self, name, mutate):
        with self.assertRaises(contract.WorkflowContractError):
            contract.validate_workflow_edit(name, self.sources[name], self.changed(name, mutate))

    def test_current_workflows_and_comment_only_edits_are_valid(self):
        for name, source in self.sources.items():
            contract.validate_workflow_edit(name, source, source + '\n# Deployment preparation\n')

    def test_product_can_add_database_service_and_browser_setup(self):
        def mutate(value):
            product = value['jobs']['product']
            product['services'] = {'postgres': {'image': 'postgres:17', 'env': {'POSTGRES_PASSWORD': 'isolated-test'}}}
            product['env'] = {'DATABASE_URL': 'postgresql://isolated-test'}
            product['steps'].insert(-1, {'run': 'npx playwright install --with-deps chromium'})
        contract.validate_workflow_edit('product-quality.yml', self.sources['product-quality.yml'], self.changed('product-quality.yml', mutate))

    def test_release_can_add_setup_and_explicit_oidc_permissions(self):
        def mutate(value):
            deploy = value['jobs']['deploy']
            deploy['permissions'] = {'contents': 'read', 'id-token': 'write'}
            deploy['steps'].insert(-1, {'run': 'python3 ops/prepare_release.py'})
        contract.validate_workflow_edit('release.yml', self.sources['release.yml'], self.changed('release.yml', mutate))

    def test_replacing_workflow_with_true_is_rejected(self):
        for name, source in self.sources.items():
            with self.assertRaises(contract.WorkflowContractError):
                contract.validate_workflow_edit(name, source, 'name: Fake\njobs:\n  pass:\n    steps:\n      - run: "true"\n')

    def test_missing_quality_command_and_modified_gate_list_are_rejected(self):
        self.rejected('product-quality.yml', lambda value: value['jobs']['product']['steps'].pop())
        self.rejected('product-quality.yml', lambda value: value['jobs']['product']['steps'][-1]['env'].update(QUALITY_GATES='["unit"]'))

    def test_if_and_continue_on_error_cannot_skip_mandatory_steps(self):
        for key, condition in (('if', 'false'), ('if', 'always()'), ('continue-on-error', 'true')):
            self.rejected('product-quality.yml', lambda value: value['jobs']['product']['steps'][-1].update({key: condition}))

    def test_product_cannot_skip_scope_or_run_unconditionally(self):
        for patch in ({'needs': []}, {'if': 'always()'}, {'continue-on-error': 'true'}):
            self.rejected('product-quality.yml', lambda value: value['jobs']['product'].update(patch))

    def test_scope_outputs_and_force_input_are_immutable(self):
        self.rejected('product-quality.yml', lambda value: value['jobs']['scope']['outputs'].update(required='false'))
        self.rejected('product-quality.yml', lambda value: value['on']['workflow_call']['inputs']['force_product'].update(default='false'))

    def test_release_must_force_product_and_wait_for_quality(self):
        self.rejected('release.yml', lambda value: value['jobs']['quality']['with'].update(force_product='false'))
        self.rejected('release.yml', lambda value: value['jobs']['deploy'].update(needs=[]))
        self.rejected('release.yml', lambda value: value['jobs']['deploy'].update({'if': 'always()'}))

    def test_release_cannot_remove_environment_or_override_target(self):
        self.rejected('release.yml', lambda value: value['jobs']['deploy'].pop('environment'))
        self.rejected('release.yml', lambda value: value['jobs']['deploy']['steps'][-1]['env'].update(DELIVERY_TARGET='production'))

    def test_existing_setup_steps_cannot_be_replaced_or_reordered(self):
        self.rejected('product-quality.yml', lambda value: value['jobs']['product']['steps'][0].update(uses='untrusted/checkout@main'))
        self.rejected('product-quality.yml', lambda value: value['jobs']['product']['steps'].reverse())

    def test_aliases_duplicate_keys_and_multiple_documents_are_rejected(self):
        for payload in ('name: first\nname: second\n', 'job: &job {run: "true"}\ncopy: *job\n', 'name: first\n---\nname: second\n'):
            with self.assertRaises(contract.WorkflowContractError):
                contract.parse(payload)

    def test_trigger_filters_and_additional_jobs_cannot_change(self):
        self.rejected('product-quality.yml', lambda value: value['on'].pop('push'))
        self.rejected('release.yml', lambda value: value['jobs'].update(bypass={'steps': [{'run': 'true'}]}))
