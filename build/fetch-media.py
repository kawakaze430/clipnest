#!/usr/bin/env python3
"""Fetch pinned upstream source archives with TLS and SHA-256 verification."""
import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile
from urllib.request import urlopen

lock = json.loads(Path(sys.argv[1]).read_text())
destination = Path(sys.argv[2])
destination.mkdir(parents=True, exist_ok=True)
assert lock['schema_version'] == 1
assert set(lock['sources']) == {'libxml2', 'ffmpeg'}
for name, source in lock['sources'].items():
    assert re.fullmatch(r'[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+', source['repository'])
    assert re.fullmatch(r'[0-9a-f]{40}', source['commit'])
    assert re.fullmatch(r'[0-9a-f]{64}', source['sha256'])
    url = f"https://codeload.github.com/{source['repository']}/tar.gz/{source['commit']}"
    archive = destination / (name + '.tar.gz')
    digest = hashlib.sha256()
    with urlopen(url, timeout=120) as response, archive.open('wb') as output:
        while data := response.read(1024 * 1024):
            digest.update(data)
            output.write(data)
    if digest.hexdigest() != source['sha256']:
        raise SystemExit(f'Upstream checksum mismatch for {name}; refusing source')
    target = destination / name
    target.mkdir()
    with tarfile.open(archive) as bundle:
        entries = bundle.getmembers()
        roots = {Path(entry.name).parts[0] for entry in entries}
        if len(roots) != 1:
            raise SystemExit('Unexpected upstream archive layout')
        bundle.extractall(target, filter='data')
    extracted = target / roots.pop()
    extracted.rename(destination / (name + '-source'))
    target.rmdir()
    archive.unlink()
    version_file = 'VERSION' if name == 'libxml2' else 'RELEASE'
    if (destination / (name + '-source') / version_file).read_text().strip() != source['version']:
        raise SystemExit(f'Unexpected upstream source version for {name}')
    print(f"Verified {name} {source['version']} at {source['commit']}", flush=True)
