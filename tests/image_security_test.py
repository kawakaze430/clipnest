"""Gate regressions: a scanner/SBOM or vendor-feed success must not hide failure."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('image_gate', ROOT / 'scripts/ci/image-security.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
SUBJECT = 'sha256:' + 'a' * 64
CONTAINER = 'c' * 64


class ImageSecurityTests(unittest.TestCase):
    def execute_gate(self, scan_exit=0, missing=False, mismatch=False, old_media=False, secret=False, after_failure=False):
        calls = []
        expected = json.loads((ROOT / 'build/media-sources.json').read_text())
        if old_media:
            expected['sources']['ffmpeg']['version'] = '8.1.2'
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'results'
            lock = Path(directory) / 'lock.json'
            lock.write_text(json.dumps(expected))

            def execute(argv, deadline, timeout, env):
                calls.append(argv)
                self.assertNotIn('TRIVY_IGNORE_UNFIXED', env)
                self.assertNotIn('TRIVY_SEVERITY', env)
                result = {'exit_code': 0, 'timed_out': False, 'seconds': 0.01}
                text = ''
                if argv[0] == 'docker':
                    if argv[1:3] == ['image', 'inspect']:
                        text = SUBJECT
                    elif argv[1] == 'create':
                        text = CONTAINER
                    elif argv[1] == 'cp':
                        Path(argv[-1]).write_text(json.dumps(expected))
                elif argv[1] == 'version':
                    if after_failure and sum('version' in call for call in calls) > 1:
                        result['exit_code'] = 7
                    text = json.dumps({'Version': '0.70.0', 'VulnerabilityDB': {
                        'Version': 2, 'UpdatedAt': '2026-10-24T00:00:00Z', 'DownloadedAt': '2026-10-24T00:01:00Z'}})
                else:
                    self.assertIn('--ignore-unfixed=false', argv)
                    self.assertEqual(argv[argv.index('--severity') + 1], 'HIGH,CRITICAL')
                    self.assertEqual(Path(argv[argv.index('--ignorefile') + 1]).read_text(), '')
                    target = Path(argv[argv.index('--output') + 1])
                    if argv[argv.index('--format') + 1] == 'json':
                        result['exit_code'] = scan_exit
                        report = {'ArtifactType': 'container_image', 'ArtifactName': SUBJECT,
                            'Metadata': {'ImageID': SUBJECT}, 'Results': [
                                {'Class': 'os-pkgs', 'Packages': [{'Name': 'zlib'}]}]}
                        if mismatch:
                            report['Metadata']['ImageID'] = 'sha256:' + 'b' * 64
                        if secret:
                            report['Results'][0]['Secrets'] = [{'Severity': 'HIGH', 'Match': 'synthetic-secret',
                                'Code': {'Lines': [{'Content': 'synthetic-secret'}]}}]
                        if not missing:
                            target.write_text(json.dumps(report))
                    else:
                        target.write_text(json.dumps({'bomFormat': 'CycloneDX',
                            'components': [{'type': 'library', 'name': 'zlib'}],
                            'metadata': {'component': {'type': 'container', 'name': SUBJECT,
                                'properties': [{'name': 'aquasecurity:trivy:ImageID', 'value': SUBJECT}]}}}))
                return result, text

            with patch.object(gate.runner, 'execute', execute), contextlib.redirect_stdout(io.StringIO()):
                status = gate.run_gate('mutable-tag', 'docker', output, Path('trivy'),
                    environ={'TRIVY_IGNORE_UNFIXED': 'true', 'TRIVY_SEVERITY': 'LOW'}, media_lock=lock)
            report = json.loads((output / 'summary.json').read_text())
            artifacts = {p.name: p.read_text() for p in output.iterdir() if p.is_file()}
            return status, report, calls, artifacts

    def test_failing_scan_survives_successful_sbom(self):
        code, summary, calls, artifacts = self.execute_gate(scan_exit=7)
        self.assertEqual(code, 7)
        self.assertEqual(summary['status'], 'failed')
        self.assertIn('image.sbom.cdx.json', artifacts)
        self.assertTrue(any('cyclonedx' in call for call in calls))

    def test_zero_exit_without_fresh_scan_report_fails(self):
        self.assertNotEqual(self.execute_gate(missing=True)[0], 0)

    def test_mismatched_image_cannot_pass(self):
        self.assertNotEqual(self.execute_gate(mismatch=True)[0], 0)

    def test_vendor_feed_clean_with_old_upstream_media_cannot_pass(self):
        code, summary, _, _ = self.execute_gate(old_media=True)
        self.assertNotEqual(code, 0)
        self.assertIn('security floor', summary['reason'])

    def test_secret_findings_fail_and_are_redacted(self):
        code, _, _, artifacts = self.execute_gate(secret=True)
        self.assertNotEqual(code, 0)
        self.assertNotIn('synthetic-secret', artifacts['trivy-report.json'])

    def test_pinned_clean_inventory_is_retained_and_succeeds(self):
        code, summary, _, artifacts = self.execute_gate()
        self.assertEqual(code, 0)
        self.assertEqual(summary['image_id'], SUBJECT)
        self.assertIn('verified_media_sources', summary)
        components = json.loads(artifacts['image.sbom.cdx.json'])['components']
        self.assertTrue(any(item['name'] == 'ffmpeg' and item['version'] == '9.0.2' for item in components))

    def test_late_metadata_failure_still_redacts_secret_report(self):
        code, _, _, artifacts = self.execute_gate(secret=True, after_failure=True)
        self.assertNotEqual(code, 0)
        self.assertNotIn('synthetic-secret', artifacts['trivy-report.json'])

    def test_remote_report_requires_its_manifest_digest(self):
        remote = 'registry.example.test/service@sha256:' + 'd' * 64
        report = {'ArtifactType': 'container_image', 'ArtifactName': remote,
                  'Metadata': {'ImageID': SUBJECT, 'RepoDigests': []},
                  'Results': [{'Class': 'os-pkgs', 'Packages': [{'Name': 'zlib'}]}]}
        sbom = {'bomFormat': 'CycloneDX', 'components': [{'name': 'zlib'}],
                'metadata': {'component': {'type': 'container', 'name': remote,
                    'properties': [{'name': 'aquasecurity:trivy:ImageID', 'value': SUBJECT}]}}}
        with self.assertRaisesRegex(ValueError, 'manifest digest'):
            gate.validate_reports(report, sbom, remote, 'remote')
        report['Metadata']['RepoDigests'] = [remote]
        self.assertEqual(gate.validate_reports(report, sbom, remote, 'remote')[0], SUBJECT)


if __name__ == '__main__':
    unittest.main()
