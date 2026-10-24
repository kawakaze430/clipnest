#!/usr/bin/env python3
"""Build and verify a complete, portable ClipNest source snapshot (stdlib only)."""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import tempfile
from zipfile import BadZipFile, ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
PREFIX = 'clipnest/'
MANIFEST = PREFIX + 'delivery/FILE_MANIFEST.json'
SOURCE_DIRS = ('backend', 'dist', 'tests', 'scripts', 'docs', '.github', 'infra', 'certs', 'release', 'delivery')
ROOT_FILES = ('package.json', 'package-lock.json', 'requirements.txt', '.env.example',
              'Dockerfile', 'compose.yaml', '.dockerignore', '.gitignore',
              'playwright.config.mjs', '.openai/hosting.json', 'ClipNest-H02-Delivery-Receipt.json')
REQUIRED = ('README.md', 'START_HERE.md', 'NEXT_MODEL_PROMPT.md', 'AGENTS.md',
            'backend/server.mjs', 'backend/worker.mjs', 'dist/index.html',
            'package-lock.json', 'docs/END_TO_END_STATUS.json', 'delivery/HANDOFF_STATE.json')
EXCLUDED_PARTS = {'.git', '.aws', '.ssh', '.terraform', '__pycache__', 'node_modules',
                  '.cache', 'test-results', 'playwright-report', 'qa-artifacts',
                  'downloads', 'secrets', 'evidence-private', 'runtime-private'}
EXCLUDED_NAMES = {'credentials', 'auth.json', 'id_rsa', 'id_ed25519', 'file_manifest.json'}
EXCLUDED_ENDINGS = ('.zip', '.tar', '.tar.gz', '.tgz', '.7z', '.tfstate', '.tfplan',
                    '.tfvars', '.tfvars.json', '.key', '.p12', '.pfx', '.sqlite',
                    '.sqlite3', '.db', '.log', '.sha256')
PRIVATE_KEY = re.compile(rb'-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def excluded(path):
    name = path.name.lower()
    return (bool(EXCLUDED_PARTS.intersection(path.parts))
            or name in EXCLUDED_NAMES
            or name.endswith(EXCLUDED_ENDINGS)
            or '.tfstate.' in name
            or (name.startswith('.env') and path.as_posix() != '.env.example')
            or (name.endswith('.pem') and path.as_posix() != 'certs/rds-global-bundle.pem'))


def source_files():
    candidates = [ROOT / name for name in ROOT_FILES]
    candidates.extend(ROOT.glob('*.md'))
    for name in SOURCE_DIRS:
        directory = ROOT / name
        if directory.is_symlink():
            raise ValueError(f'Symlink source directory refused: {name}')
        candidates.extend(directory.rglob('*'))
    files = {}
    for path in candidates:
        relative = path.relative_to(ROOT)
        if excluded(relative):
            continue
        if path.is_symlink():
            raise ValueError(f'Symlink source entry refused: {relative}')
        if not path.is_file():
            continue
        if not path.resolve().is_relative_to(ROOT):
            raise ValueError(f'Source entry outside checkout: {relative}')
        data = path.read_bytes()
        if PRIVATE_KEY.search(data):
            raise ValueError(f'Private key material refused in: {relative}')
        mode = 0o755 if path.stat().st_mode & stat.S_IXUSR else 0o644
        files[relative.as_posix()] = (data, mode)
    missing = set(REQUIRED) - files.keys()
    if missing:
        raise ValueError('Incomplete source snapshot: missing ' + ', '.join(sorted(missing)))
    return files


def write_entry(archive, name, data, mode=0o644):
    # Fixed timestamps and stable ordering make unchanged inputs reproducible.
    info = ZipInfo(name, date_time=(2000, 1, 1, 0, 0, 0))
    info.create_system = 3
    info.external_attr = (stat.S_IFREG | mode) << 16
    info.compress_type = ZIP_DEFLATED
    archive.writestr(info, data)


def verify(path):
    with ZipFile(path) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        if len(names) != len(set(names)):
            raise ValueError('Duplicate archive paths')
        for entry in entries:
            name = entry.filename
            pure = PurePosixPath(name)
            if (not name.startswith(PREFIX) or pure.is_absolute() or '..' in pure.parts
                    or '\\' in name or entry.is_dir()
                    or stat.S_ISLNK(entry.external_attr >> 16)):
                raise ValueError(f'Unsafe archive entry: {name}')
            if name != MANIFEST and excluded(PurePosixPath(name).relative_to('clipnest')):
                raise ValueError(f'Excluded data in archive: {name}')
        manifest = json.loads(archive.read(MANIFEST))
        if manifest.get('schema_version') != 1 or manifest.get('project') != 'ClipNest':
            raise ValueError('Unrecognized manifest')
        records = manifest['files']
        paths = [record['path'] for record in records]
        if len(paths) != len(set(paths)) or set(names) != {MANIFEST, *(PREFIX + p for p in paths)}:
            raise ValueError('Manifest file set mismatch')
        if manifest['source_file_count'] != len(records) or set(REQUIRED) - set(paths):
            raise ValueError('Manifest is incomplete')
        for record in records:
            data = archive.read(PREFIX + record['path'])
            if len(data) != record['bytes'] or digest(data) != record['sha256']:
                raise ValueError(f'Integrity failure: {record["path"]}')
            if PRIVATE_KEY.search(data):
                raise ValueError(f'Private key material in archive: {record["path"]}')
        if archive.testzip() is not None:
            raise ValueError('ZIP CRC check failed')
    return {'archive': str(path.resolve()), 'bytes': path.stat().st_size,
            'sha256': digest(path.read_bytes()), 'source_files': len(records),
            'zip_entries': len(entries), 'verified': True}


def build(path):
    if path.suffix.lower() != '.zip':
        raise ValueError('Output must have a .zip extension')
    files = source_files()
    state = json.loads(files['delivery/HANDOFF_STATE.json'][0])
    manifest = {'schema_version': 1, 'project': 'ClipNest',
                'checkpoint': state['checkpoint'], 'handoff_revision': state['handoff_revision'],
                'application_baseline_commit': state['application_baseline_commit'],
                'source_file_count': len(files),
                'files': [{'path': name, 'bytes': len(data), 'sha256': digest(data)}
                          for name, (data, _) in sorted(files.items())]}
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.clipnest-package-', suffix='.zip', dir=path.parent)
    os.close(fd)
    temporary = Path(temporary)
    try:
        with ZipFile(temporary, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
            for name, (data, mode) in sorted(files.items()):
                write_entry(archive, PREFIX + name, data, mode)
            write_entry(archive, MANIFEST, (json.dumps(manifest, indent=2) + '\n').encode())
        verify(temporary)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    result = verify(path)
    checksum = path.with_name(path.name + '.sha256')
    checksum.write_text(f'{result["sha256"]}  {path.name}\n', encoding='utf-8')
    result['checksum_file'] = str(checksum.resolve())
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--output', type=Path, help='Full source ZIP output (default dist/clipnest-source.zip)')
    group.add_argument('--verify', type=Path, help='Read-only integrity/contents verification of an existing ZIP')
    args = parser.parse_args()
    try:
        result = verify(args.verify) if args.verify else build(args.output or ROOT / 'dist/clipnest-source.zip')
    except (OSError, ValueError, KeyError, BadZipFile) as error:
        parser.exit(1, f'Packaging failed: {error}\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
