#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p "build/Clip My Screen Capture.app/Contents/MacOS"
mkdir -p build/module-cache
swiftc -O -module-cache-path build/module-cache -framework ScreenCaptureKit -framework AppKit -framework Carbon -framework AVFoundation \
  native/CaptureAgent.swift -o "build/Clip My Screen Capture.app/Contents/MacOS/clip-capture"
cp native/Info.plist "build/Clip My Screen Capture.app/Contents/Info.plist"
codesign --force --sign - "build/Clip My Screen Capture.app" >/dev/null
echo "Built native capture helper"
