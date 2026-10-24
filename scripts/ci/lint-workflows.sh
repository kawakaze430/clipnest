#!/usr/bin/env bash
# Validate GitHub workflow syntax/expressions using a checksum-verified official release.
set -euo pipefail
cd "$(dirname "$0")/../.."
version=1.7.12
case "$(uname -m)" in
  x86_64) architecture=amd64 ;;
  aarch64|arm64) architecture=arm64 ;;
  *) echo 'Unsupported actionlint Linux architecture' >&2; exit 2 ;;
esac
archive="actionlint_${version}_linux_${architecture}.tar.gz"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
curl --location --fail --silent --show-error --connect-timeout 15 --max-time 120 \
  --output "$work/$archive" "https://github.com/rhysd/actionlint/releases/download/v$version/$archive"
curl --location --fail --silent --show-error --connect-timeout 15 --max-time 120 \
  --output "$work/checksums.txt" "https://github.com/rhysd/actionlint/releases/download/v$version/actionlint_${version}_checksums.txt"
expected=$(awk -v file="$archive" '$2==file || $2=="*"file {print $1}' "$work/checksums.txt")
test -n "$expected"
printf '%s  %s\n' "$expected" "$work/$archive" | sha256sum --check --status
mkdir -p .cache/external/bin
tar --extract --gzip --to-stdout --file "$work/$archive" actionlint > .cache/external/bin/actionlint
chmod 755 .cache/external/bin/actionlint
.cache/external/bin/actionlint -version
.cache/external/bin/actionlint
