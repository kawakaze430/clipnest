#!/usr/bin/env bash
# Ephemeral Linux test-runner preparation only. No app edits, AWS calls or deployment.
set -eo pipefail
cd "$(dirname "$0")/../.."
mode="$1"
if [ -z "$mode" ]; then mode=all; fi
case "$mode" in all|native|browser|terraform|containers) ;; *) echo 'Use all, native, browser, terraform or containers.' >&2; exit 2;; esac
if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0])===24?0:1)'; then
  echo 'BLOCKED: select Node 24 in the remote environment before setup. Do not change the project lockfile.' >&2; exit 2
fi
command -v npm >/dev/null
mkdir -p .cache/external/bin
if [ "$CLIPNEST_SKIP_SYSTEM_PACKAGES" != 1 ]; then
  if command -v apt-get >/dev/null; then
    if [ "$(id -u)" = 0 ]; then apt_command=apt-get
    elif command -v sudo >/dev/null && sudo -n true 2>/dev/null; then apt_command='sudo -n apt-get'
    else echo 'BLOCKED: remote setup requires preinstalled packages or permitted package installation.' >&2; exit 2; fi
    $apt_command update
    $apt_command install -y --no-install-recommends ffmpeg openssl unzip ca-certificates curl
  else
    echo 'BLOCKED: use a prepared Linux image with FFmpeg, OpenSSL, unzip, CA and curl.' >&2; exit 2
  fi
fi
lock_sha=$(sha256sum package-lock.json | cut -d' ' -f1)
installed_sha=$(cat .cache/external/npm-lock.sha256 2>/dev/null || true)
if [ ! -f node_modules/pg/package.json ] || [ "$lock_sha" != "$installed_sha" ]; then
  npm ci --ignore-scripts --no-audit --no-fund
  printf '%s\n' "$lock_sha" > .cache/external/npm-lock.sha256
fi
if [ "$mode" = all ] || [ "$mode" = terraform ]; then
  case "$(uname -m)" in x86_64) tf_arch=amd64;; aarch64|arm64) tf_arch=arm64;; *) echo 'BLOCKED: unsupported Terraform runner architecture.' >&2; exit 2;; esac
  tf_file=terraform_1.17.0_linux_$tf_arch.zip
  if [ ! -x .cache/external/bin/terraform ]; then
    temp_dir=$(mktemp -d)
    trap 'rm -rf "$temp_dir"' EXIT
    curl --fail --silent --show-error --retry 1 --connect-timeout 15 --max-time 120 --output "$temp_dir/terraform.zip" "https://releases.hashicorp.com/terraform/1.17.0/$tf_file"
    curl --fail --silent --show-error --retry 1 --connect-timeout 15 --max-time 120 --output "$temp_dir/SHA256SUMS" https://releases.hashicorp.com/terraform/1.17.0/terraform_1.17.0_SHA256SUMS
    expected=$(awk -v file="$tf_file" '$2==file {print $1}' "$temp_dir/SHA256SUMS")
    test -n "$expected"
    printf '%s  %s\n' "$expected" "$temp_dir/terraform.zip" | sha256sum --check --status
    unzip -q "$temp_dir/terraform.zip" -d .cache/external/bin
    chmod 755 .cache/external/bin/terraform
    rm -rf "$temp_dir"
    trap - EXIT
  fi
  if ! AWS_EC2_METADATA_DISABLED=true .cache/external/bin/terraform -chdir=infra/terraform init -backend=false -input=false -lockfile=readonly; then
    echo 'PREPARED WITH A BLOCKER: Terraform provider prewarm failed. Preserve its error; continue the other groups.' >&2
  fi
fi
if [ "$mode" = all ] || [ "$mode" = browser ]; then
  if [ "$CLIPNEST_SKIP_SYSTEM_PACKAGES" = 1 ]; then
    if ! node node_modules/@playwright/test/cli.js install chromium; then
      echo 'PREPARED WITH A BLOCKER: Chromium installation failed. Preserve the error; run other available groups.' >&2
    fi
  else
    if ! node node_modules/@playwright/test/cli.js install --with-deps chromium; then
      echo 'PREPARED WITH A BLOCKER: Chromium/system-library installation failed. Preserve the error; run other groups.' >&2
    fi
  fi
fi
echo "Remote setup finished for $mode; check any blocker warnings. No suite has been marked passed. Run scripts/external/verify.py."
