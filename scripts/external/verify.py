#!/usr/bin/env python3
"""Bounded execution-only handoff. No installs, app edits, AWS API calls or deployment."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import uuid
from urllib.parse import urlsplit
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[2]
GROUPS = ('native', 'browser', 'terraform', 'containers')
TASKS = {
    'native': ['E-04', 'E-08', 'E-09', 'F-11', 'J-07', 'J-12'],
    'browser': ['B-05', 'B-06', 'B-07', 'B-09', 'B-10', 'B-11', 'B-12', 'J-04'],
    'terraform': ['I-03', 'I-04', 'I-05', 'I-06', 'I-07', 'I-08'],
    'containers': ['H-02', 'H-03', 'H-06', 'E-04'],
}
SKIP_PARTS = {'.terraform', '.cache', 'node_modules', '__pycache__', 'qa-artifacts', 'test-results', 'playwright-report'}


def now():
    return datetime.now(timezone.utc).isoformat()


def redact(text, environ=None):
    environ = os.environ if environ is None else environ
    values = [v for k, v in environ.items()
              if re.search(r'PASSWORD|SECRET|TOKEN|COOKIE|DATABASE_URL|ACCESS_KEY', k, re.I) and len(v) >= 6]
    local_env = ROOT / '.env'
    if local_env.is_file():
        for line in local_env.read_text().splitlines():
            if '=' in line and re.search(r'PASSWORD|SECRET|TOKEN|COOKIE', line.split('=', 1)[0], re.I):
                values.append(line.split('=', 1)[1].strip().strip("'\""))
    for value in sorted(set(values), key=len, reverse=True):
        if len(value) >= 6:
            text = text.replace(value, '[REDACTED]')
    text = re.sub(r'postgres(?:ql)?://[^\s\'"<>]+', '[REDACTED_DATABASE_URL]', text, flags=re.I)
    text = re.sub(r'-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----.*?-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----',
                  '[REDACTED_PRIVATE_KEY]', text, flags=re.S)
    text = re.sub(r'(?im)^(\s*(?:authorization|cookie|set-cookie)\s*:).+$', r'\1 [REDACTED]', text)
    def private_url(match):
        value = match.group(0)
        try:
            parsed = urlsplit(value)
        except ValueError:
            return '[REDACTED_INVALID_URL]'
        # GitHub artifact redirects use Azure SAS (sig), while S3/CloudFront
        # use their own signature names. None belongs in evidence or errors.
        sensitive_query = re.search(r'(?:^|&)(?:sig|signature|token|access_token|code|policy|expires|key-pair-id|x-amz-[^=]+)=', parsed.query, re.I)
        action_fragment = re.search(r'(?:^|&)(?:reset|verify|invite|token)=', parsed.fragment, re.I)
        return '[REDACTED_SIGNED_OR_ACTION_URL]' if sensitive_query or action_fragment else value
    text = re.sub(r'https?://[^\s\'"<>]+', private_url, text)
    text = re.sub(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b', '[REDACTED_ACCESS_KEY]', text)
    return text


def read_command(argv, timeout=8, env=None):
    try:
        r = subprocess.run(argv, cwd=ROOT, env=env, capture_output=True, text=True, timeout=timeout)
        return {'exit_code': r.returncode, 'text': redact((r.stdout + r.stderr)[-3000:])}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {'exit_code': None, 'text': type(exc).__name__}


def terraform_bin():
    candidates = [os.environ.get('CLIPNEST_TERRAFORM_BIN'),
                  str(ROOT / '.cache/external/bin/terraform'), shutil.which('terraform')]
    return next((p for p in candidates if p and Path(p).is_file()), None)


def fingerprint():
    files = []
    for name in ('backend', 'build', 'dist', 'tests', 'scripts', 'infra', 'certs', '.github'):
        for p in (ROOT / name).rglob('*'):
            rel = p.relative_to(ROOT)
            if SKIP_PARTS.intersection(rel.parts) or p.is_symlink() or not p.is_file():
                continue
            if p.suffix.lower() in {'.md', '.zip', '.sha256', '.log', '.tfstate', '.tfplan', '.tfvars'}:
                continue
            if (p.name.startswith('.env') or '.tfstate.' in p.name or p.name.endswith('.tfvars.json')
                    or p.suffix.lower() in {'.key', '.p12', '.pfx', '.db', '.sqlite'}
                    or (p.suffix.lower() == '.pem' and rel.as_posix() != 'certs/rds-global-bundle.pem')):
                continue
            files.append(p)
    files += [ROOT / n for n in ('package.json', 'package-lock.json', 'requirements.txt', 'Dockerfile',
                                  'compose.yaml', 'playwright.config.mjs', '.dockerignore') if (ROOT / n).is_file()]
    records = [{'path': p.relative_to(ROOT).as_posix(),
                'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(set(files))]
    return hashlib.sha256(json.dumps(records, sort_keys=True).encode()).hexdigest()


def socket_probe(family):
    try:
        with tempfile.TemporaryDirectory(prefix='clipnest-capability-') as tmp:
            with socket.socket(family, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', 0) if family == socket.AF_INET else str(Path(tmp) / 'probe.sock'))
        return {'available': True}
    except OSError as exc:
        return {'available': False, 'reason': f'{exc.__class__.__name__}: {exc.strerror}'}


def disposable_url_allowed(value):
    try:
        url = urlsplit(value)
        return url.scheme in ('postgres', 'postgresql') and url.hostname in ('localhost', '127.0.0.1', '::1')
    except ValueError:
        return False


def probe():
    versions = {}
    for name, args in {'node': ['--version'], 'npm': ['--version'], 'ffmpeg': ['-version'],
                       'openssl': ['version'], 'docker': ['--version']}.items():
        executable = shutil.which(name)
        versions[name] = {'installed': bool(executable)}
        if executable:
            result = read_command([executable] + args)
            versions[name]['version'] = result['text'].splitlines()[0] if result['text'] else ''
    tf = terraform_bin()
    versions['terraform'] = {'installed': bool(tf)}
    if tf:
        versions['terraform']['version'] = read_command([tf, 'version'])['text'].splitlines()[0]
    docker = read_command(['docker', 'info', '--format', '{{.ServerVersion}}']) if versions['docker']['installed'] else {}
    compose = read_command(['docker', 'compose', 'version', '--short']) if versions['docker']['installed'] else {}
    mapped = {'available': True, 'reason': 'Non-root process'}
    if hasattr(os, 'getuid') and os.getuid() == 0:
        try:
            with tempfile.TemporaryDirectory(prefix='clipnest-uid-probe-') as tmp:
                p = Path(tmp) / 'owner'; p.write_text('capability')
                os.chown(p, 65534, 65534)
            mapped = {'available': bool(shutil.which('runuser')), 'reason': 'UID 65534 chown succeeded; runuser also required'}
        except OSError as exc:
            mapped = {'available': False, 'reason': f'{exc.__class__.__name__}: {exc.strerror}'}
    browser = {'installed': False, 'reason': 'Playwright package/runtime not prepared'}
    if versions['node']['installed'] and (ROOT / 'node_modules/@playwright/test/package.json').is_file():
        result = read_command(['node', '--input-type=module', '-e',
                               "import {chromium} from '@playwright/test'; console.log(chromium.executablePath())"])
        selected = os.environ.get('CLIPNEST_CHROMIUM_EXECUTABLE_PATH')
        binary = selected or result['text'].strip()
        installed = bool(binary) and Path(binary).is_file() and os.access(binary, os.X_OK)
        browser = {'installed': installed, 'executable': binary,
                   'selection': 'explicit system browser' if selected else 'Playwright-pinned browser',
                   'reason': 'Executable existence only; no browser launch in capability probe'}
        if installed:
            version = read_command([binary, '--version'])
            browser['version'] = version['text'].strip()
    git = read_command(['git', 'rev-parse', 'HEAD'])
    changed = any(read_command(command)['exit_code'] != 0 for command in
                  (['git', 'diff', '--quiet'], ['git', 'diff', '--cached', '--quiet']))
    return {'profile': 'ClipNest-E01', 'recorded_at': now(), 'platform': os.name,
            'source_commit': git['text'].strip() if git['exit_code'] == 0 else None,
            'tracked_source_changes': changed,
            'app_test_tree_sha256': fingerprint(), 'tools': versions,
            'loopback_tcp': socket_probe(socket.AF_INET),
            'unix_socket': socket_probe(socket.AF_UNIX) if hasattr(socket, 'AF_UNIX') else {'available': False},
            'nonroot_native_user': mapped, 'browser_runtime': browser,
            'docker_daemon': {'available': docker.get('exit_code') == 0, 'detail': docker.get('text', 'Docker CLI absent')},
            'docker_compose': {'available': compose.get('exit_code') == 0},
            'dependencies_installed': (ROOT / 'node_modules/pg/package.json').is_file(),
            'native_database_mode': os.environ.get('CLIPNEST_TEST_DATABASE_MODE', 'auto'),
            'external_test_db_present': bool(os.environ.get('TEST_DATABASE_URL')),
            'scope': 'Capability metadata only. Does not prove a suite or production service passed.'}


def unmet(group, caps):
    tools = caps['tools']
    for name in ('node', 'npm'):
        if not tools[name]['installed']:
            return name + ' is missing; use prepared setup, do not modify the app'
    if not tools['node'].get('version', '').startswith('v24.'):
        return 'Select Node 24 for this prepared runner; do not change package/lockfiles'
    if not caps['dependencies_installed']:
        return 'Locked npm dependencies are missing'
    if group in ('native', 'browser') and not caps['loopback_tcp']['available']:
        return 'Loopback TCP socket creation is unavailable'
    if group in ('native', 'browser') and not tools['ffmpeg']['installed']:
        return 'FFmpeg is missing'
    if group == 'native':
        if not tools['openssl']['installed']:
            return 'OpenSSL is missing for the disposable native TLS test'
        value = os.environ.get('TEST_DATABASE_URL')
        if value:
            if os.environ.get('CLIPNEST_DISPOSABLE_TEST_DB') != '1' or not disposable_url_allowed(value):
                return 'Refused supplied DB target: require explicit disposable acknowledgement and loopback host'
            if not os.environ.get('TEST_DB_CA_FILE'):
                return 'Explicit DB supplied without its trusted disposable TLS CA file'
        else:
            mode = caps.get('native_database_mode', 'auto')
            docker = caps['docker_daemon']['available']
            if mode == 'docker' and not docker:
                return 'Docker PostgreSQL mode requires an already working daemon; do not start a nested daemon'
            if mode == 'embedded' or (mode == 'auto' and not docker):
                if not caps['nonroot_native_user']['available'] or not caps['unix_socket']['available']:
                    return 'Embedded PostgreSQL requires mapped non-root identity and permitted Unix sockets; an existing Docker daemon can provide a disposable alternative'
    if group == 'browser' and not caps['browser_runtime']['installed']:
        return 'Chromium is not installed; prepare the pinned browser or explicitly configure an installed executable'
    if group == 'terraform':
        if not tools['terraform']['installed']:
            return 'Pinned Terraform is missing'
        if 'v1.17.0' not in tools['terraform'].get('version', ''):
            return 'Use project-pinned Terraform 1.17.0; do not upgrade the source or lockfile'
        if not caps['unix_socket']['available']:
            return 'Provider Unix socket creation is unavailable'
    if group == 'containers' and (not caps['docker_daemon']['available'] or not caps['docker_compose']['available']):
        return 'Working Docker daemon and Compose v2 absent; no daemon installation or privilege workaround in this task'
    return None


def tap_summary(text):
    values = {}
    for name in ('tests', 'pass', 'fail', 'skipped'):
        matches = re.findall(r'(?m)^\s*#\s*' + name + r'\s+(\d+)\s*$', text)
        if matches:
            values[name] = int(matches[-1])
    return values


def browser_summary(text):
    decoder = json.JSONDecoder()
    data = None
    for match in re.finditer(r'\{', text):
        try:
            candidate, _ = decoder.raw_decode(text[match.start():])
            if isinstance(candidate, dict) and 'stats' in candidate and 'config' in candidate:
                data = candidate
                break
        except ValueError:
            continue
    if data is None:
        raise ValueError('No complete Playwright report')
    stats = data['stats']
    return {'tests': sum(stats.get(k, 0) for k in ('expected', 'unexpected', 'skipped', 'flaky')),
            'pass': stats.get('expected', 0), 'fail': stats.get('unexpected', 0),
            'skipped': stats.get('skipped', 0), 'flaky': stats.get('flaky', 0),
            'projects': sorted(p['name'] for p in data['config']['projects'])}


def terraform_summary(text):
    result = None
    for line in text.splitlines():
        try:
            event = json.loads(line)
            if event.get('type') == 'test_summary':
                result = event['test_summary']
        except (ValueError, KeyError):
            continue
    return result


def accepted(group, text):
    if group == 'native':
        stats = tap_summary(text)
        expected = ('native PostgreSQL parallel idempotency and global worker claim limits',
                    'SIGKILL expires a real native lease',
                    'native PostgreSQL TLS verifies trusted certificate')
        return (stats.get('pass', 0) > 0 and stats.get('fail') == 0 and stats.get('skipped') == 0
                and 'Real PostgreSQL ' in text and 'native-postgresql' in text
                and all(name in text for name in expected)), stats
    if group == 'browser':
        try:
            stats = browser_summary(text)
            return (stats['pass'] >= 8 and not stats['fail'] and not stats['skipped'] and not stats['flaky']
                    and stats['projects'] == ['desktop-chromium', 'mobile-chromium']), stats
        except (ValueError, KeyError, TypeError):
            return False, {'reason': 'Missing complete Playwright JSON report'}
    if group == 'terraform':
        stats = terraform_summary(text)
        return (bool(stats) and stats.get('passed', 0) > 0 and stats.get('failed', 0) == 0
                and stats.get('errored', 0) == 0 and stats.get('skipped', 0) == 0), stats
    return 'CLIPNEST_CONTAINER_SMOKE_PASSED' in text, {'scope': 'TLS + image/Compose/non-root/readiness/restart smoke only'}


def execute(argv, deadline, timeout, env):
    limit = min(timeout, max(0, deadline - time.monotonic()))
    if limit < 1:
        return {'exit_code': None, 'timed_out': True, 'seconds': 0}, 'Overall execution budget exhausted'
    start = time.monotonic()
    try:
        proc = subprocess.Popen(argv, cwd=ROOT, env=env, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True, start_new_session=True)
    except OSError as exc:
        return {'exit_code': None, 'timed_out': False, 'seconds': 0}, str(exc)
    timeout_hit = False
    try:
        text = proc.communicate(timeout=limit)[0]
    except subprocess.TimeoutExpired:
        timeout_hit = True
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            text = proc.communicate(timeout=5)[0]
        except subprocess.TimeoutExpired:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            text = proc.communicate()[0]
    return {'exit_code': proc.returncode, 'timed_out': timeout_hit,
            'seconds': round(time.monotonic() - start, 2)}, text


def group_commands(group):
    if group == 'native':
        return [(['node', 'scripts/test-database.mjs', '--with-crash', '--with-tls'], 240)]
    if group == 'browser':
        return [(['node', 'node_modules/@playwright/test/cli.js', 'test', '--reporter=json'], 420)]
    if group == 'terraform':
        prefix = [terraform_bin(), '-chdir=infra/terraform']
        return [(prefix + ['init', '-backend=false', '-input=false', '-lockfile=readonly'], 240),
                (prefix + ['validate', '-no-color'], 90),
                (prefix + ['test', '-json', '-no-color'], 240)]
    # The pinned upstream XML/media build is a cold-build prerequisite on a
    # fresh runner. The overall caller budget still bounds this command.
    return [(['bash', 'scripts/external/containers.sh'], 1500)]


def write_report(directory, report):
    (directory / 'summary.json').write_text(json.dumps(report, indent=2) + '\n')
    lines = ['# ClipNest E01 — execution-only return', '', '**Production remains NO_GO.**', '',
             'Application/test tree SHA-256: ' + report['capabilities']['app_test_tree_sha256'], '',
             '| Group | Result | Scope / reason |', '| --- | --- | --- |']
    for row in report['results']:
        detail = row.get('reason', row.get('scope', '')) or 'Read recorded command and test counts'
        lines.append('| ' + row['group'] + ' | ' + row['status'] + ' | ' + str(detail).replace('|', '/') + ' |')
    lines += ['', 'No master task status was promoted automatically. Return this evidence to the owning chat for review.',
              'A passed E01 group is bounded local-runner evidence, not AWS/native-RDS/live-source/production acceptance.', '']
    (directory / 'summary.md').write_text('\n'.join(lines))
    bundle = directory / 'ClipNest-External-Evidence.zip'
    with ZipFile(bundle, 'w', ZIP_DEFLATED) as archive:
        for p in sorted(directory.rglob('*')):
            if p.is_file() and p != bundle and p.suffix in ('.json', '.md', '.log'):
                archive.write(p, p.relative_to(directory))
    sha = hashlib.sha256(bundle.read_bytes()).hexdigest()
    bundle.with_suffix('.zip.sha256').write_text(sha + '  ' + bundle.name + '\n')
    return bundle


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('probe', 'run'))
    parser.add_argument('--groups', nargs='+', choices=GROUPS, default=list(GROUPS))
    parser.add_argument('--budget-minutes', type=int, choices=range(2, 46), default=20)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--resume', type=Path, help='Reuse only passed same-tree evidence from an earlier summary')
    args = parser.parse_args()
    directory = args.output or ROOT / 'qa-artifacts' / ('external-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:6])
    directory.mkdir(parents=True, exist_ok=False)
    caps = probe()
    (directory / 'capabilities.json').write_text(json.dumps(caps, indent=2) + '\n')
    if args.action == 'probe':
        print(json.dumps({'capabilities': str(directory / 'capabilities.json'), 'data': caps}, indent=2))
        return 0
    report = {'profile': 'ClipNest-E01', 'started_at': now(), 'capabilities': caps, 'results': [],
              'production_release_decision': 'NO_GO', 'app_edits_allowed': False,
              'aws_api_calls_or_deployment_allowed': False, 'master_statuses_changed': False}
    old = json.loads(args.resume.read_text()) if args.resume else {}
    reusable = old.get('profile') == 'ClipNest-E01' and old.get('capabilities', {}).get('app_test_tree_sha256') == caps['app_test_tree_sha256']
    deadline = time.monotonic() + args.budget_minutes * 60
    for group in dict.fromkeys(args.groups):
        prior = next((r for r in old.get('results', []) if r['group'] == group and r['status'] == 'passed'), None) if reusable else None
        if prior:
            report['results'].append({**prior, 'carried_from': str(args.resume)})
            continue
        row = {'group': group, 'task_ids_for_review': TASKS[group], 'status': 'blocked', 'commands': []}
        if group == 'browser':
            row['browser_runtime'] = caps['browser_runtime']
        if group == 'native':
            row['database_mode'] = caps['native_database_mode']
        report['results'].append(row)
        reason = unmet(group, caps)
        if reason or time.monotonic() >= deadline:
            row['reason'] = reason or 'Overall run budget exhausted; preserve results and run only this group next time'
            print(group + ': BLOCKED — ' + row['reason'], flush=True)
            continue
        env = dict(os.environ)
        for key in list(env):
            if key.startswith('AWS_') or key in ('DATABASE_URL', 'PGHOST', 'PGPASSWORD', 'PGSERVICE', 'PGSERVICEFILE'):
                env.pop(key)
        env['AWS_EC2_METADATA_DISABLED'] = 'true'
        env['TF_IN_AUTOMATION'] = '1'
        row['status'] = 'failed'
        combined = ''
        for number, (argv, timeout) in enumerate(group_commands(group), 1):
            print(group + ': running ' + ' '.join(argv), flush=True)
            result, raw = execute(argv, deadline, timeout, env)
            log_name = group + '-' + str(number) + '.log'
            (directory / log_name).write_text(redact(raw))
            row['commands'].append({'argv': argv, **result, 'log': log_name})
            combined = raw
            if result['exit_code'] != 0 or result['timed_out']:
                _, stats = accepted(group, raw)
                if stats:
                    row['test_counts'] = stats
                row['reason'] = 'Execution failed or timed out; inspect sanitized log and return findings without app edits'
                break
        else:
            okay, stats = accepted(group, combined)
            row['status'] = 'passed' if okay else 'incomplete'
            row['test_counts'] = stats
            row['scope'] = ('Native runner PostgreSQL/concurrency/upgrade/SIGKILL/local trusted-and-negative TLS; not RDS' if group == 'native'
                            else 'Real Playwright Chromium desktop/mobile + axe with synthetic media; not real YouTube' if group == 'browser'
                            else 'Locked real provider schema/mock checks; no account plan/apply' if group == 'terraform'
                            else 'Docker TLS/image/Compose/non-root/readiness/restart smoke; no active OOM/source/scan/SBOM proof')
            if not okay:
                row['reason'] = 'Exit zero without complete required tests/no-skip evidence; not a passed group'
        print(group + ': ' + row['status'].upper(), flush=True)
        write_report(directory, report)
    report['finished_at'] = now()
    bundle = write_report(directory, report)
    print(json.dumps({'evidence_zip': str(bundle), 'summary': str(directory / 'summary.json'),
                      'statuses': {r['group']: r['status'] for r in report['results']},
                      'production': 'NO_GO'}, indent=2))
    return 0 if all(r['status'] == 'passed' for r in report['results']) else 2


if __name__ == '__main__':
    raise SystemExit(main())
