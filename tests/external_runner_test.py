"""Evidence-controller tests only; these do not execute PostgreSQL, browsers, Docker or AWS."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
from zipfile import ZipFile

spec = importlib.util.spec_from_file_location('external_verify', Path(__file__).resolve().parents[1] / 'scripts/external/verify.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class ExternalRunnerTests(unittest.TestCase):
    def test_redacts_environment_secret_and_database_url(self):
        value = 'unique-disposable-secret-012345'
        text = runner.redact('token=' + value + ' postgresql://user:pass@localhost:5432/test', {'SESSION_SECRET': value})
        self.assertNotIn(value, text)
        self.assertNotIn('user:pass', text)

    def test_redacts_private_key_envelope(self):
        marker = '-----BEGIN ' + 'PRIVATE KEY-----\nSYNTHETIC-TEST-ONLY\n-----END ' + 'PRIVATE KEY-----'
        self.assertEqual(runner.redact(marker, {}), '[REDACTED_PRIVATE_KEY]')

    def test_only_explicit_loopback_database_targets_qualify(self):
        self.assertTrue(runner.disposable_url_allowed('postgresql://u:p@127.0.0.1:5432/disposable'))
        self.assertTrue(runner.disposable_url_allowed('postgresql://u:p@[::1]:5432/disposable'))
        self.assertFalse(runner.disposable_url_allowed('postgresql://u:p@db.example.com/prod'))
        self.assertFalse(runner.disposable_url_allowed('https://localhost/test'))

    def native_text(self, skipped=0):
        return ('Real PostgreSQL 18.4 is ready\nDatabase scope: native-postgresql\n'
                'native PostgreSQL parallel idempotency and global worker claim limits\n'
                'SIGKILL expires a real native lease\nnative PostgreSQL TLS verifies trusted certificate\n'
                f'# tests 20\n# pass 20\n# fail 0\n# skipped {skipped}\n')

    def test_native_skip_does_not_become_pass(self):
        self.assertFalse(runner.accepted('native', self.native_text(1))[0])

    def test_native_requires_concurrency_crash_tls_and_counts(self):
        self.assertTrue(runner.accepted('native', self.native_text())[0])
        self.assertFalse(runner.accepted('native', self.native_text().replace('SIGKILL expires a real native lease', 'missing'))[0])
        self.assertFalse(runner.accepted('native', '# tests 0\n# pass 0\n# fail 0\n# skipped 0\n')[0])

    def browser_text(self, skipped=0, projects=None):
        return json.dumps({'stats': {'expected': 8, 'unexpected': 0, 'skipped': skipped, 'flaky': 0},
                           'config': {'projects': [{'name': n} for n in (projects or ['desktop-chromium', 'mobile-chromium'])]}})

    def test_browser_report_with_console_noise_is_read(self):
        self.assertTrue(runner.accepted('browser', 'warning\n' + self.browser_text() + '\n')[0])

    def test_browser_skips_or_missing_mobile_are_not_passed(self):
        self.assertFalse(runner.accepted('browser', self.browser_text(1))[0])
        self.assertFalse(runner.accepted('browser', self.browser_text(projects=['desktop-chromium']))[0])

    def test_browser_empty_output_is_not_a_pass(self):
        self.assertFalse(runner.accepted('browser', 'command returned zero without report')[0])

    def test_terraform_requires_executed_non_skipped_mock_results(self):
        self.assertFalse(runner.accepted('terraform', 'validated successfully')[0])
        self.assertTrue(runner.accepted('terraform', json.dumps({'type': 'test_summary', 'test_summary': {'passed': 1, 'failed': 0, 'errored': 0, 'skipped': 0}}))[0])
        self.assertFalse(runner.accepted('terraform', json.dumps({'type': 'test_summary', 'test_summary': {'passed': 1, 'skipped': 1}}))[0])

    def test_process_timeout_terminates_the_command(self):
        result, _ = runner.execute([sys.executable, '-c', 'import time; time.sleep(10)'], time.monotonic() + 3, 1, {})
        self.assertTrue(result['timed_out'])
        self.assertIsNotNone(result['exit_code'])

    def test_process_failure_is_retained(self):
        result, _ = runner.execute([sys.executable, '-c', 'raise SystemExit(7)'], time.monotonic() + 2, 1, {})
        self.assertEqual(result['exit_code'], 7)

    def test_fingerprint_changes_for_source_but_not_runtime_output(self):
        with tempfile.TemporaryDirectory() as d, patch.object(runner, 'ROOT', Path(d)):
            root = Path(d); (root / 'backend').mkdir()
            p = root / 'backend/server.mjs'; p.write_text('first')
            original = runner.fingerprint()
            (root / 'qa-artifacts').mkdir(); (root / 'qa-artifacts/result.log').write_text('test output')
            self.assertEqual(original, runner.fingerprint())
            p.write_text('changed')
            self.assertNotEqual(original, runner.fingerprint())

    def test_evidence_bundle_does_not_claim_production_or_mutate_status(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d)
            report = {'capabilities': {'app_test_tree_sha256': 'test-tree'}, 'results': [{'group': 'native', 'status': 'blocked', 'reason': 'No native runtime'}],
                      'production_release_decision': 'NO_GO', 'master_statuses_changed': False}
            bundle = runner.write_report(path, report)
            with ZipFile(bundle) as z:
                saved = json.loads(z.read('summary.json'))
                self.assertEqual(saved['production_release_decision'], 'NO_GO')
                self.assertFalse(saved['master_statuses_changed'])
                self.assertNotIn(bundle.name, z.namelist())


if __name__ == '__main__':
    unittest.main()
