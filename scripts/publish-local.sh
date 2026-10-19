#!/usr/bin/env bash
# Builds both MailFlow images on this PC and pushes them to GHCR, what .github/workflows/publish.yml
# does on a runner (Actions are disabled on the fork; a runner takes ages). Keep it in step with publish.yml.
# Usage: scripts/publish-local.sh <version> [platforms]   e.g. 4.0.1.3; default linux/amd64
# A fork version is upstream's version plus one number: 4.0.1.3 is our third build on upstream 4.0.1.
# (publish.yml builds linux/amd64,linux/arm64; that needs a docker-container buildx builder here.)
# The tag v<version> must exist (scripts/fork-release.sh makes it). Log in first:
#   gh auth token | docker login ghcr.io -u Fundryi --password-stdin
set -euo pipefail

version="${1:?usage: scripts/publish-local.sh <version> [platforms]}"
version="${version#v}"
[[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || { echo "not a version: $version" >&2; exit 1; }
platforms="${2:-linux/amd64}"
cd "$(dirname "$0")/.."
sha=$(git rev-parse "v$version^{commit}")

# Build from a clean export of the tag, as a runner would: the working tree is CRLF (core.autocrlf), which
# breaks the frontend's /docker-entrypoint.d scripts, and it holds gitignored private files that
# `COPY . /repo` in backend/Dockerfile would bake into the image.
src=$(mktemp -d)
trap 'rm -rf "$src"' EXIT
git -c core.autocrlf=false archive "v$version" | tar -x -C "$src"
cd "$src"

# Two tags per image: the version and latest, which the hub follows. The source label links the
# GHCR package to the repo (publish.yml gets it from metadata-action).
tags() {
  local image="ghcr.io/fundryi/$1"
  t=(-t "$image:$version" -t "$image:latest" --label "org.opencontainers.image.source=https://github.com/Fundryi/mailflow")
}

tags mailflow-backend
docker buildx build --platform "$platforms" --provenance=false -f backend/Dockerfile \
  --build-arg BUILD_SHA="$sha" --build-arg APP_VERSION="v$version" "${t[@]}" --push .

tags mailflow-frontend
docker buildx build --platform "$platforms" --provenance=false -f frontend/Dockerfile \
  --build-arg VITE_BUILD_SHA="$sha" "${t[@]}" --push .
