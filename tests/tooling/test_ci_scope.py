import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('ci_scope', Path(__file__).resolve().parents[2] / 'scripts/ci_scope.py')
scope = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scope)


class ProductScopeTests(unittest.TestCase):
    def test_docs_only_bootstrap_has_no_product(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'apps').mkdir()
            (root / 'apps/README.md').write_text('Architecture prévue')
            self.assertFalse(scope.product_required(root, 'push'))

    def test_first_app_code_triggers_product_quality(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'apps/api').mkdir(parents=True)
            (root / 'apps/api/index.ts').write_text('export {};')
            self.assertTrue(scope.product_required(root, 'pull_request'))

    def test_release_and_manual_checks_cannot_skip_missing_product(self):
        with tempfile.TemporaryDirectory() as directory:
            for event in ('workflow_call', 'workflow_dispatch', 'unknown'):
                self.assertTrue(scope.product_required(Path(directory), event))

    def test_database_migration_requires_product_checks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'migrations').mkdir()
            (root / 'migrations/001.sql').write_text('CREATE TABLE example (id uuid);')
            self.assertTrue(scope.product_required(root, 'push'))
