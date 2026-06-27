#!/usr/bin/env bash
# Build an extensions.gnome.org (EGO) zip from src/, mirroring `gnome-extensions pack`.
# Shared by the Makefile and CI so local and automated packaging stay identical.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/src"
BUILD="$ROOT/build"
DIST="$ROOT/dist"

UUID="$(sed -n 's/.*"uuid"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SRC/metadata.json")"
if [ -z "$UUID" ]; then
    echo "pack: cannot read uuid from $SRC/metadata.json" >&2
    exit 1
fi

rm -rf "$BUILD"
mkdir -p "$BUILD" "$DIST"
cp -r "$SRC/." "$BUILD/"

ZIP="$DIST/$UUID.shell-extension.zip"
rm -f "$ZIP"
(cd "$BUILD" && zip -qr "$ZIP" . -x '*.DS_Store' -x 'schemas/gschemas.compiled')

echo "pack: wrote $ZIP"
