#!/usr/bin/env bash
# Build an extensions.gnome.org (EGO) zip from src/, mirroring `gnome-extensions pack`.
# Shared by the Makefile and CI so local and automated packaging stay identical.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/src"
DIST="$ROOT/dist"

UUID="$(sed -n 's/.*"uuid"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SRC/metadata.json")"
if [ -z "$UUID" ]; then
    echo "pack: cannot read uuid from $SRC/metadata.json" >&2
    exit 1
fi

mkdir -p "$DIST"
ZIP="$DIST/$UUID.shell-extension.zip"
rm -f "$ZIP"
(cd "$SRC" && zip -qr "$ZIP" . -x 'schemas/gschemas.compiled')

echo "pack: wrote $ZIP"
