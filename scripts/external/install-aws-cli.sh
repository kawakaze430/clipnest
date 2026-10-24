#!/usr/bin/env bash
# Official source-sandbox AWS CLI v2, with pinned source and hashed dependencies.
# No AWS API calls, credentials or global installation.
set -euo pipefail
cd "$(dirname "$0")/../.."
task_root=$PWD
python=${CLIPNEST_AWS_CLI_PYTHON:-python3}
"$python" -c 'import sys; assert sys.version_info >= (3,12), "Python 3.12+ required for safe source extraction"'
command -v make >/dev/null
prefix=${CLIPNEST_AWS_CLI_PREFIX:-$task_root/.cache/external/aws-cli}
bindir=${CLIPNEST_AWS_CLI_BINDIR:-$task_root/.cache/external/bin}
case "$prefix:$bindir" in /*:/*) ;; *) echo 'AWS CLI install and bin paths must be absolute.' >&2; exit 1;; esac
lock=$task_root/scripts/external/aws-cli-source.json
version=$("$python" -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$lock")
marker=$prefix/clipnest-source-lock.json
if [ -e "$prefix" ]; then
  if [ -f "$marker" ] && cmp -s "$lock" "$marker" && [ -x "$prefix/lib/aws-cli/bin/aws" ]; then
    actual=$("$prefix/lib/aws-cli/bin/aws" --version)
    case "$actual" in "aws-cli/$version "*) ;; *) echo 'Cached AWS CLI version mismatch.' >&2; exit 1;; esac
    printf '%s\n' "$actual"
    exit 0
  fi
  echo 'Refusing to overwrite an existing unverified/different AWS CLI install. Select an empty CLIPNEST_AWS_CLI_PREFIX.' >&2
  exit 1
fi
work=$(mktemp -d "${TMPDIR:-/tmp}/clipnest-aws-cli-XXXXXX")
trap 'rm -rf "$work"' EXIT
public_ca=${CLIPNEST_BUILD_CA_FILE:-${NODE_EXTRA_CA_CERTS:-${SSL_CERT_FILE:-}}}
if [ -n "$public_ca" ]; then
  test -r "$public_ca"
  export SSL_CERT_FILE="$public_ca" PIP_CERT="$public_ca"
fi
source_dir=$("$python" scripts/external/fetch-aws-cli.py "$lock" "$work")
cd "$source_dir"
# Official build installs its bootstrap/runtime lockfiles with --hash entries;
# pip enforces their pinned SHA-256 values. The local CLI wheel uses --no-index.
export PIP_NO_CACHE_DIR=1
PYTHON=$(command -v "$python") ./configure --with-install-type=system-sandbox --with-download-deps --prefix="$prefix" --bindir="$bindir"
make
make install
actual=$("$prefix/lib/aws-cli/bin/aws" --version)
case "$actual" in "aws-cli/$version "*) ;; *) echo 'Installed AWS CLI version mismatch.' >&2; exit 1;; esac
"$prefix/lib/aws-cli/bin/aws" sts get-caller-identity --generate-cli-skeleton input --no-cli-pager >/dev/null
cp "$lock" "$marker"
printf '%s\n' "$actual"
