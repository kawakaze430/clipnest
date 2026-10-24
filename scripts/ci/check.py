#!/usr/bin/env python3
"""Run one CI check, preserve its exit status, and retain only sanitized evidence."""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import re
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('external_verify', ROOT / 'scripts/external/verify.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


def run_check(name, argv, output, timeout):
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', name):
        raise ValueError('Check name must contain only lowercase letters, digits, hyphens or underscores')
    output.mkdir(parents=True, exist_ok=True)
    import os
    result, raw = runner.execute(argv, time.monotonic() + timeout + 1, timeout, dict(os.environ))
    text = runner.redact(raw)
    (output / (name + '.log')).write_text(text)
    commit = runner.read_command(['git', 'rev-parse', 'HEAD'])
    record = {'name': name, 'recorded_at': datetime.now(timezone.utc).isoformat(),
              'source_commit': commit['text'].strip() if commit['exit_code'] == 0 else None,
              'app_test_tree_sha256': runner.fingerprint(),
              'argv': [runner.redact(arg) for arg in argv], **result,
              'log': name + '.log', 'scope': 'CI command evidence; not production acceptance'}
    (output / (name + '.json')).write_text(json.dumps(record, indent=2) + '\n')
    print(text, end='' if text.endswith('\n') else '\n', flush=True)
    print(json.dumps(record, indent=2), flush=True)
    if result['timed_out']:
        return 124
    code = result['exit_code']
    return code if code is not None and 0 <= code <= 255 else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--name', required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'qa-artifacts/ci')
    parser.add_argument('--timeout-seconds', type=int, default=600)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    argv = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not argv or args.timeout_seconds <= 0:
        parser.error('A command and positive timeout are required')
    return run_check(args.name, argv, args.output, args.timeout_seconds)


if __name__ == '__main__':
    raise SystemExit(main())
