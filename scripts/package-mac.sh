#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
arch="$(uname -m)"
case "$arch" in
  arm64|x86_64) ;;
  *) echo "Unsupported macOS architecture: $arch" >&2; exit 1 ;;
esac
npm run build:native
bash scripts/fetch-ffmpeg-mac.sh
builder_arch="$arch"
if [[ "$arch" == x86_64 ]]; then builder_arch=x64; fi
npx electron-builder --config electron-builder.config.cjs --mac dir --"$builder_arch"
version="$(node -p 'require("./package.json").version')"
stage="dist/Clip-My-Screen-${version}-macOS-${arch}"
rm -rf "$stage"
mkdir -p "$stage"
app_dir="dist/mac"
if [[ "$arch" == arm64 ]]; then app_dir="dist/mac-arm64"; fi
cp -R "$app_dir/Clip My Screen.app" "$stage/"
cp scripts/Launch\ Clip\ My\ Screen.command "$stage/"
chmod +x "$stage/Launch Clip My Screen.command"
(
  cd dist
  ditto -c -k --sequesterRsrc --keepParent "$(basename "$stage")" "$(basename "$stage").zip"
)
echo "Created ${stage}.zip"
