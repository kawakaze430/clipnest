"""Source integrity checks; these make no AWS request and never install a CLI."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('fetch_aws', Path(__file__).resolve().parents[1] / 'scripts/external/fetch-aws-cli.py')
fetcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fetcher)


class AwsCliSourceTests(unittest.TestCase):
    def run_fetch(self, entries, mutate=None):
        commit = 'a' * 40
        locks = ['requirements/download-deps/bootstrap-lock.txt', 'requirements/download-deps/system-sandbox-lock.txt']
        payload = b'fixture==1 --hash=sha256:' + b'b' * 64 + b'\n'
        files = {'awscli/__init__.py': b"__version__ = '2.38.5'\n", **{p: payload for p in locks}, **entries}
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w:gz') as archive:
            for name, data in files.items():
                entry = tarfile.TarInfo('aws-cli-' + commit + '/' + name)
                entry.size = len(data)
                archive.addfile(entry, io.BytesIO(data))
        blob = stream.getvalue()
        lock = {'repository': 'aws/aws-cli', 'version': '2.38.5', 'commit': commit,
                'sha256': hashlib.sha256(blob).hexdigest(),
                'dependency_locks': {name: hashlib.sha256(payload).hexdigest() for name in locks}}
        if mutate:
            mutate(lock)
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'lock.json'
            path.write_text(json.dumps(lock))
            with patch.object(fetcher, 'urlopen', return_value=io.BytesIO(blob)):
                return fetcher.fetch(path, Path(temporary) / 'source').name

    def test_verified_archive_and_dependency_locks_are_accepted(self):
        self.assertEqual(self.run_fetch({}), 'aws-cli-' + 'a' * 40)

    def test_altered_source_is_refused_before_extraction(self):
        with self.assertRaisesRegex(ValueError, 'source checksum mismatch'):
            self.run_fetch({}, lambda lock: lock.update(sha256='b' * 64))

    def test_dependency_lock_and_source_version_mismatch_are_refused(self):
        with self.assertRaisesRegex(ValueError, 'dependency lock checksum mismatch'):
            self.run_fetch({'requirements/download-deps/bootstrap-lock.txt': b'altered dependency'})
        with self.assertRaisesRegex(ValueError, 'source version'):
            self.run_fetch({'awscli/__init__.py': b"__version__ = '1.0.0'\n"})

    def test_archive_cannot_write_outside_destination(self):
        with self.assertRaises((tarfile.TarError, ValueError)):
            self.run_fetch({'../../escape': b'unsafe'})
