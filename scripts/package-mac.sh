#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
arch="$(uname -m)"
case "$arch" in
  arm64) builder_arch=arm64 ;;
  x86_64) builder_arch=x64 ;;
  *) echo "Unsupported macOS architecture: $arch" >&2; exit 1 ;;
esac
npm run build:native
bash scripts/fetch-ffmpeg-mac.sh
./node_modules/.bin/electron-builder --config electron-builder.config.cjs --mac dmg --"$builder_arch"
app_dir="dist/mac"
if [[ "$arch" == arm64 ]]; then app_dir="dist/mac-arm64"; fi
codesign --verify --deep --strict "$app_dir/Clip My Screen.app"
# A plain .app ZIP is also available; no quarantine-removal scripts are shipped.
ditto -c -k --sequesterRsrc --keepParent "$app_dir/Clip My Screen.app" "dist/Clip-My-Screen-macOS-${builder_arch}.zip"
echo "Created macOS ${builder_arch} DMG and ZIP."
