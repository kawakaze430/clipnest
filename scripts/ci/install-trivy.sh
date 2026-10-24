#!/usr/bin/env bash
# Install the same official, checksum-verified scanner locally and in CI.
set -euo pipefail
cd "$(dirname "$0")/../.."
version=0.70.0
case "$(uname -m)" in
  x86_64) architecture=64bit ;;
  aarch64|arm64) architecture=ARM64 ;;
  *) echo 'Unsupported Trivy Linux architecture' >&2; exit 2 ;;
esac
archive="trivy_${version}_Linux-${architecture}.tar.gz"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
curl --location --fail --silent --show-error --connect-timeout 15 --max-time 120 \
  --output "$work/$archive" "https://github.com/aquasecurity/trivy/releases/download/v$version/$archive"
curl --location --fail --silent --show-error --connect-timeout 15 --max-time 120 \
  --output "$work/checksums.txt" "https://github.com/aquasecurity/trivy/releases/download/v$version/trivy_${version}_checksums.txt"
expected=$(awk -v file="$archive" '$2==file || $2=="*"file {print $1}' "$work/checksums.txt")
test -n "$expected"
printf '%s  %s\n' "$expected" "$work/$archive" | sha256sum --check --status
mkdir -p .cache/external/bin
tar --extract --gzip --to-stdout --file "$work/$archive" trivy > "$work/trivy"
chmod 755 "$work/trivy"
mv "$work/trivy" .cache/external/bin/trivy
.cache/external/bin/trivy version --format json
