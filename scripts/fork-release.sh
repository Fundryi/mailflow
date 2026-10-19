#!/usr/bin/env bash
# One-step fork release: tags the next v<upstream version>-fork.<n> on the pushed main, pushes the tag,
# builds both images here and pushes them to GHCR with the latest tag. The hub's stack follows
# ghcr.io/fundryi/mailflow-*:latest, so it picks the release up on its next auto-update.
# Usage: scripts/fork-release.sh [platforms]
set -euo pipefail
cd "$(dirname "$0")/.."

[[ $(git rev-parse --abbrev-ref HEAD) == main ]] || { echo "release from main only" >&2; exit 1; }
[[ -z $(git status --porcelain) ]] || { echo "commit or stash first; the tree is not clean" >&2; exit 1; }
git fetch -q origin
[[ $(git rev-parse HEAD) == $(git rev-parse origin/main) ]] || { echo "main is not pushed (or behind origin); push first" >&2; exit 1; }

base=$(node -p "require('./backend/package.json').version")   # upstream's version as merged
last=$(git tag --list "v$base-fork.*" | sed "s/^v$base-fork\.//" | sort -n | tail -1)
version="$base-fork.$(( ${last:-0} + 1 ))"

echo "Releasing v$version from $(git rev-parse --short HEAD)"
git tag "v$version"
git push -q origin "v$version"
scripts/publish-local.sh "$version" "${1:-linux/amd64}"
echo "Done: ghcr.io/fundryi/mailflow-{backend,frontend}:$version and :latest. The hub pulls latest on its next auto-update."
