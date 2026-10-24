"""Check CI evidence handling, not the application acceptance it records."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('ci_check', Path(__file__).resolve().parents[1] / 'scripts/ci/check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


class CiCheckTests(unittest.TestCase):
    def test_failure_status_and_sanitized_evidence_are_preserved(self):
        secret = 'unique-ci-evidence-secret-12345678'
        with tempfile.TemporaryDirectory() as tmp, patch.dict('os.environ', {'SESSION_SECRET': secret}):
            output = Path(tmp)
            code = check.run_check('failure', [sys.executable, '-c',
                                   'import os; print(os.environ["SESSION_SECRET"]); raise SystemExit(7)'], output, 5)
            self.assertEqual(code, 7)
            self.assertNotIn(secret, (output / 'failure.log').read_text())
            record = json.loads((output / 'failure.json').read_text())
            self.assertEqual(record['exit_code'], 7)
            self.assertFalse(record['timed_out'])
            self.assertTrue(record['app_test_tree_sha256'])

    def test_timeout_does_not_become_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            code = check.run_check('timeout', [sys.executable, '-c', 'import time; time.sleep(10)'], output, 1)
            self.assertEqual(code, 124)
            record = json.loads((output / 'timeout.json').read_text())
            self.assertTrue(record['timed_out'])
            self.assertIsNotNone(record['exit_code'])
            self.assertGreaterEqual(record['seconds'], 0.9)

    def test_check_name_cannot_escape_evidence_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                check.run_check('../escape', [sys.executable, '-c', 'pass'], Path(tmp), 5)


if __name__ == '__main__':
    unittest.main()
