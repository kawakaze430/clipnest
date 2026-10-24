#!/usr/bin/env python3
"""Verify pinned official AWS CLI source and dependency locks before building."""
import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile
from urllib.request import urlopen


def fetch(lock_file, destination):
    lock = json.loads(Path(lock_file).read_text())
    if (lock.get('repository') != 'aws/aws-cli'
            or not re.fullmatch(r'2\.\d+\.\d+', lock.get('version', ''))
            or not re.fullmatch(r'[a-f0-9]{40}', lock.get('commit', ''))
            or not re.fullmatch(r'[a-f0-9]{64}', lock.get('sha256', ''))
            or set(lock.get('dependency_locks', {})) != {
                'requirements/download-deps/bootstrap-lock.txt',
                'requirements/download-deps/system-sandbox-lock.txt'}):
        raise ValueError('Invalid AWS CLI source lock')
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    archive = destination / 'source.tar.gz'
    digest = hashlib.sha256()
    url = 'https://codeload.github.com/aws/aws-cli/tar.gz/' + lock['commit']
    with urlopen(url, timeout=120) as response, archive.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            digest.update(chunk)
            output.write(chunk)
    if digest.hexdigest() != lock['sha256']:
        raise ValueError('AWS CLI source checksum mismatch; refusing extraction')
    prefix = 'aws-cli-' + lock['commit']
    with tarfile.open(archive) as bundle:
        if {Path(entry.name).parts[0] for entry in bundle.getmembers()} != {prefix}:
            raise ValueError('Unexpected AWS CLI archive layout')
        bundle.extractall(destination, filter='data')
    source = destination / prefix
    version = re.search(r"^__version__\s*=\s*['\"]([^'\"]+)['\"]", (source / 'awscli/__init__.py').read_text(), re.M)
    if not version or version.group(1) != lock['version']:
        raise ValueError('Unexpected AWS CLI source version')
    for name, expected in lock['dependency_locks'].items():
        data = (source / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('AWS CLI dependency lock checksum mismatch')
        if b'--hash=sha256:' not in data:
            raise ValueError('AWS CLI dependency hashes are missing')
    archive.unlink()
    return source


if __name__ == '__main__':
    print(fetch(sys.argv[1], sys.argv[2]))
