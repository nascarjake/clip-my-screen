#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
arch="$(uname -m)"
case "$arch" in
  arm64) checksum=3275793ae92f421aa2c3e282f21a29b334eb40e4e9489cbb9653562f3fc0e0f6 ;;
  x86_64) checksum=987614b8c1e6f64b339e9bf66e19f3103297c523fc87651e6c0f2d67e9a38966 ;;
  *) echo "Unsupported Mac architecture: $arch" >&2; exit 1 ;;
esac
archive="ffmpeg9.0.1-macos-${arch}.zip"
mkdir -p vendor/ffmpeg
if [[ ! -f "vendor/$archive" ]]; then
  curl -fL --retry 3 "https://github.com/ispysoftware/agentdvr-ffmpeg-build/releases/download/v9.0.1/$archive" -o "vendor/$archive"
fi
echo "$checksum  vendor/$archive" | shasum -a 256 -c -
unzip -q -o "vendor/$archive" -d vendor/ffmpeg
build="$(vendor/ffmpeg/bin/ffmpeg -buildconf 2>&1)"
encoders="$(vendor/ffmpeg/bin/ffmpeg -encoders 2>&1)"
[[ "$build" == *--disable-nonfree* && "$build" == *--enable-gpl* ]]
[[ "$encoders" == *libx264* ]]
echo 'Verified redistributable GPL FFmpeg with H.264 encoding.'
