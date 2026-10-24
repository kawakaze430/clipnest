"""Source verification refuses altered bytes, versions and archive traversal."""
import hashlib
import io
import json
from pathlib import Path
import runpy
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'build/fetch-media.py'


def archive(path, content):
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode='w:gz') as bundle:
        entry = tarfile.TarInfo(path)
        entry.size = len(content)
        bundle.addfile(entry, io.BytesIO(content))
    return stream.getvalue()


class MediaSourceTests(unittest.TestCase):
    def run_fetch(self, payload, expected=None):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            entry = {'version': '2.15.4', 'repository': 'GNOME/libxml2',
                     'commit': 'a' * 40, 'sha256': expected or hashlib.sha256(payload).hexdigest()}
            lock = base / 'lock.json'
            lock.write_text(json.dumps({'schema_version': 1,
                'sources': {'libxml2': entry, 'ffmpeg': entry}}))
            with patch.object(sys, 'argv', [str(SCRIPT), str(lock), str(base / 'source')]), \
                    patch('urllib.request.urlopen', return_value=io.BytesIO(payload)):
                runpy.run_path(str(SCRIPT), run_name='__main__')

    def test_altered_source_bytes_are_refused_before_extraction(self):
        with self.assertRaisesRegex(SystemExit, 'checksum mismatch'):
            self.run_fetch(b'altered archive bytes', expected='b' * 64)

    def test_matching_hash_with_wrong_upstream_version_is_refused(self):
        with self.assertRaisesRegex(SystemExit, 'Unexpected upstream source version'):
            self.run_fetch(archive('root/VERSION', b'2.13.9\n'))

    def test_checksum_matched_archive_cannot_escape_destination(self):
        with self.assertRaises((tarfile.TarError, ValueError)):
            self.run_fetch(archive('../escape', b'not source'))


if __name__ == '__main__':
    unittest.main()
