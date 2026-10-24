#!/usr/bin/env python3
"""Fail-closed image scan and SBOM evidence for one immutable image subject."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
TRIVY_VERSION = '0.70.0'
DB_REPOSITORY = 'ghcr.io/aquasecurity/trivy-db:2'
DIGEST = re.compile(r'^sha256:[0-9a-f]{64}$')
spec = importlib.util.spec_from_file_location('external_verify', ROOT / 'scripts/external/verify.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


def scan_environment(environ):
    # An inherited ignore file, policy or severity setting must not weaken a gate.
    allowed = {'TRIVY_CACHE_DIR', 'TRIVY_USERNAME', 'TRIVY_PASSWORD', 'TRIVY_TOKEN'}
    return {key: value for key, value in environ.items()
            if not key.startswith('TRIVY_') or key in allowed}


def load_object(path):
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f'{path.name} must contain an object')
    return value


def sanitize_report(value, environ):
    if isinstance(value, str):
        return runner.redact(value, environ)
    if isinstance(value, list):
        return [sanitize_report(item, environ) for item in value]
    if isinstance(value, dict):
        return {key: sanitize_report(item, environ) for key, item in value.items()}
    return value


def safe_scan_report(report, environ):
    report = sanitize_report(report, environ)
    for row in report.get('Results', []):
        for finding in row.get('Secrets') or []:
            finding['Match'] = '[REDACTED_SECRET_FINDING]'
            finding['Code'] = {'Redacted': True}
    config = report.get('Metadata', {}).get('ImageConfig', {}).get('config', {})
    if isinstance(config.get('Env'), list):
        config['Env'] = [entry.split('=', 1)[0] + '=[REDACTED]' if re.search(
            r'PASSWORD|SECRET|TOKEN|ACCESS_KEY|PRIVATE_KEY|DATABASE_URL', entry.split('=', 1)[0], re.I)
                        else entry for entry in config['Env']]
    return report


def validate_reports(report, sbom, subject, source):
    if report.get('ArtifactType') != 'container_image' or report.get('ArtifactName') != subject:
        raise ValueError('Scan report does not identify the requested immutable image')
    image_id = report.get('Metadata', {}).get('ImageID', '')
    if not DIGEST.fullmatch(image_id) or (source == 'docker' and image_id != subject):
        raise ValueError('Scan report has a missing or mismatched Docker image ID')
    if source == 'remote' and subject not in report.get('Metadata', {}).get('RepoDigests', []):
        raise ValueError('Remote scan does not attest the requested manifest digest')
    results = report.get('Results')
    if not isinstance(results, list) or not results:
        raise ValueError('Scan report contains no executed package/secret results')
    if not any(row.get('Class') == 'os-pkgs' and row.get('Packages') for row in results):
        raise ValueError('Scan report contains no operating-system package inventory')
    if sbom.get('bomFormat') != 'CycloneDX' or not sbom.get('components'):
        raise ValueError('Missing complete CycloneDX package inventory')
    component = sbom.get('metadata', {}).get('component', {})
    properties = component.get('properties', [])
    sbom_ids = [row.get('value') for row in properties
                if row.get('name') == 'aquasecurity:trivy:ImageID']
    if component.get('type') != 'container' or component.get('name') != subject or sbom_ids != [image_id]:
        raise ValueError('SBOM and scan report identify different image subjects')
    counts = Counter()
    unique = set()
    for row in results:
        for item in row.get('Vulnerabilities') or []:
            if item.get('Severity') in ('HIGH', 'CRITICAL'):
                counts[item['Severity']] += 1
                unique.add(item.get('VulnerabilityID'))
        for item in row.get('Secrets') or []:
            if item.get('Severity') in ('HIGH', 'CRITICAL'):
                counts['secrets'] += 1
    return image_id, {'high': counts['HIGH'], 'critical': counts['CRITICAL'],
                      'secret_findings': counts['secrets'], 'distinct_cves': len(unique)}


def validate_media_sources(expected, actual):
    if actual != expected or expected.get('schema_version') != 1:
        raise ValueError('Image media-source manifest differs from the checked source lock')
    floors = {'libxml2': (2, 15, 4), 'ffmpeg': (9, 0, 2)}
    sources = expected.get('sources', {})
    if set(sources) != set(floors):
        raise ValueError('Incomplete patched media-source inventory')
    for name, floor in floors.items():
        item = sources[name]
        version = item.get('version', '')
        if not re.fullmatch(r'\d+\.\d+\.\d+', version) or tuple(map(int, version.split('.'))) < floor:
            raise ValueError(f'{name} is below the known upstream security floor')
        if not re.fullmatch(r'[0-9a-f]{40}', item.get('commit', '')) or not re.fullmatch(r'[0-9a-f]{64}', item.get('sha256', '')):
            raise ValueError('Missing pinned media-source identity/checksum')


def run_gate(image, source, output, trivy, timeout=600, environ=None, docker='docker', media_lock=None):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    env = scan_environment(dict(os.environ) if environ is None else environ)
    env.setdefault('TRIVY_CACHE_DIR', str(ROOT / '.cache/trivy'))
    record = {'recorded_at': datetime.now(timezone.utc).isoformat(),
              'requested_image': image, 'image_source': source, 'commands': [],
              'severity': ['HIGH', 'CRITICAL'], 'package_types': ['os', 'library'],
              'scanners': ['vuln', 'secret'], 'database_repository': DB_REPOSITORY,
              'status': 'failed', 'production_acceptance': False}
    deadline = time.monotonic() + timeout
    media_lock = Path(media_lock) if media_lock else ROOT / 'build/media-sources.json'
    report_path, sbom_path = output / 'trivy-report.json', output / 'image.sbom.cdx.json'

    def execute(name, argv):
        result, raw = runner.execute(argv, deadline, timeout, env)
        (output / f'{name}.log').write_text(runner.redact(raw, env))
        record['commands'].append({'name': name, 'argv': [runner.redact(arg, env) for arg in argv], **result})
        return result, raw

    code = 1
    try:
        if source == 'docker':
            resolved, raw = execute('image-identity', [docker, 'image', 'inspect', '--format', '{{.Id}}', image])
            subject = raw.strip()
            if resolved['exit_code'] != 0 or not DIGEST.fullmatch(subject):
                raise ValueError('Cannot resolve one immutable local Docker image ID')
        else:
            if not re.fullmatch(r'[^\s@]+@sha256:[0-9a-f]{64}', image):
                raise ValueError('Remote image must be qualified by its immutable sha256 digest')
            subject = image
        record['image_subject'] = subject
        version_result, raw = execute('scanner-before', [str(trivy), 'version', '--format', 'json'])
        version = json.loads(raw)
        if version_result['exit_code'] != 0 or version.get('Version') != TRIVY_VERSION:
            raise ValueError(f'Use verified Trivy {TRIVY_VERSION}')
        record['scanner_before'] = version
        # Reports from a previous invocation must never satisfy a current scan.
        report_path.unlink(missing_ok=True)
        sbom_path.unlink(missing_ok=True)
        with tempfile.TemporaryDirectory(prefix='clipnest-image-gate-') as work:
            config, ignore = Path(work) / 'trivy.yaml', Path(work) / 'ignore'
            config.write_text('{}\n')
            ignore.write_text('')
            common = [str(trivy), 'image', '--config', str(config), '--ignorefile', str(ignore),
                      '--ignore-unfixed=false', '--severity', 'HIGH,CRITICAL', '--pkg-types', 'os,library',
                      '--db-repository', DB_REPOSITORY, '--image-src', source, '--no-progress',
                      '--timeout', f'{max(1, int(deadline - time.monotonic()))}s']
            scan, _ = execute('scan', common + ['--scanners', 'vuln,secret', '--exit-code', '1',
                                                '--format', 'json', '--output', str(report_path), subject])
            # Inventory is retained even if the vulnerability scan fails; its
            # success cannot replace the scan's nonzero status.
            sbom_result, _ = execute('sbom', common + ['--format', 'cyclonedx', '--output', str(sbom_path), subject])
        after, raw = execute('scanner-after', [str(trivy), 'version', '--format', 'json'])
        record['scanner_after'] = json.loads(raw)
        if after['exit_code'] != 0 or record['scanner_after'].get('Version') != TRIVY_VERSION:
            raise ValueError('Cannot retain the scanner identity after execution')
        database = record['scanner_after'].get('VulnerabilityDB', {})
        if database.get('Version') != 2 or not database.get('UpdatedAt') or not database.get('DownloadedAt'):
            raise ValueError('Missing vulnerability database provenance')
        report, sbom = safe_scan_report(load_object(report_path), env), load_object(sbom_path)
        report_path.write_text(json.dumps(report, indent=2) + '\n')
        record['image_id'], record['findings'] = validate_reports(report, sbom, subject, source)
        # A clean vendor feed alone does not close the previously identified
        # upstream FFmpeg/XML flaws. Inspect the immutable image without starting it.
        if source == 'remote':
            pulled, _ = execute('media-image-pull', [docker, 'pull', subject])
            if pulled['exit_code'] != 0:
                raise ValueError('Cannot inspect the exact remote image media manifest')
        created, raw = execute('media-container-create', [docker, 'create', '--network', 'none', '--entrypoint', '/bin/true', subject])
        container = raw.strip()
        if created['exit_code'] != 0 or not re.fullmatch(r'[0-9a-f]{64}', container):
            raise ValueError('Cannot inspect the immutable media build without execution')
        try:
            manifest = output / 'media-sources.json'
            manifest.unlink(missing_ok=True)
            copied, _ = execute('media-source-copy', [docker, 'cp', container + ':/opt/media/share/clipnest/media-sources.json', str(manifest)])
            if copied['exit_code'] != 0:
                raise ValueError('Image lacks verified patched media-source provenance')
            expected = load_object(media_lock)
            validate_media_sources(expected, load_object(manifest))
            record['verified_media_sources'] = expected
        finally:
            cleanup_args = [docker, 'rm', '--force', '--volumes', container]
            removed, raw = runner.execute(cleanup_args, time.monotonic() + 15, 15, env)
            (output / 'media-container-cleanup.log').write_text(runner.redact(raw, env))
            record['commands'].append({'name': 'media-container-cleanup', 'argv': cleanup_args, **removed})
            if removed['exit_code'] != 0:
                raise ValueError('Could not remove the unstarted inventory container')
        # Scanner package inventories do not discover our source-built components.
        # Retain them explicitly, with the source-distribution hash and commit.
        for name, item in expected['sources'].items():
            sbom['components'].append({'type': 'library' if name == 'libxml2' else 'application',
                'name': name, 'version': item['version'], 'bom-ref': 'clipnest-source:' + name + ':' + item['commit'],
                'purl': f"pkg:generic/{name}@{item['version']}",
                'externalReferences': [{'type': 'distribution',
                    'url': f"https://codeload.github.com/{item['repository']}/tar.gz/{item['commit']}",
                    'hashes': [{'alg': 'SHA-256', 'content': item['sha256']}]}]})
        sbom_path.write_text(json.dumps(sbom, indent=2) + '\n')
        for path in (report_path, sbom_path):
            record.setdefault('artifact_sha256', {})[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        if scan['exit_code'] != 0 or scan['timed_out']:
            code = scan['exit_code'] if scan['exit_code'] is not None and 0 < scan['exit_code'] < 256 else 1
            record['reason'] = 'Strict scan returned failure; inventory does not override it'
        elif sbom_result['exit_code'] != 0 or sbom_result['timed_out']:
            code = 1
            record['reason'] = 'SBOM command failed'
        elif any(record['findings'].values()):
            record['reason'] = 'Scan reported HIGH/CRITICAL or secret findings despite a zero command exit'
        else:
            code = 0
            record['status'] = 'passed'
    except (OSError, ValueError, TypeError, KeyError) as error:
        record['reason'] = runner.redact(str(error), env)
    finally:
        # A later metadata failure must not leave raw secret matches available
        # for an always-run artifact upload.
        if report_path.is_file():
            try:
                report_path.write_text(json.dumps(safe_scan_report(load_object(report_path), env), indent=2) + '\n')
            except (OSError, ValueError, TypeError, KeyError):
                report_path.write_text('{"error":"Malformed scanner report withheld from artifacts"}\n')
                record['status'], code = 'failed', 1
    record['exit_code'] = code
    record['source_commit'] = runner.read_command(['git', 'rev-parse', 'HEAD'])['text'].strip()
    record['app_test_tree_sha256'] = runner.fingerprint()
    (output / 'summary.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps(record, indent=2), flush=True)
    return code


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image')
    parser.add_argument('--source', choices=('docker', 'remote'), default='docker')
    parser.add_argument('--output', type=Path, default=ROOT / 'qa-artifacts/image-security')
    parser.add_argument('--trivy', type=Path, default=ROOT / '.cache/external/bin/trivy')
    parser.add_argument('--timeout-seconds', type=int, default=600)
    args = parser.parse_args()
    if args.timeout_seconds < 1:
        parser.error('A positive timeout is required')
    if not args.trivy.is_file():
        subprocess.run(['bash', str(ROOT / 'scripts/ci/install-trivy.sh')], cwd=ROOT, check=True)
    return run_gate(args.image, args.source, args.output, args.trivy, args.timeout_seconds)


if __name__ == '__main__':
    raise SystemExit(main())
