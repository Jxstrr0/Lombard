#!/usr/bin/env bash
# Hash of every bake input (docs/04-ASSETS.md § Bake pipeline). The one place
# the list lives for CI: bake.yml calls this both to decide whether to bake and,
# just before committing, to check the inputs haven't changed under the run.
# Keep it in step with input_files() in bake/bake.py.
set -euo pipefail
cd "$(dirname "$0")/.."
cat bake/layout.json bake/materials.py bake/bake.py scripts/bake-pack.mjs \
  $(find bake/textures bake/props -type f | LC_ALL=C sort) | sha256sum | cut -c1-16
