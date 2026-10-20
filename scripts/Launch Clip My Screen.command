#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
# Keep normal macOS security checks intact. Releases install from the DMG;
# this legacy launcher only opens an app placed beside it.
open "./Clip My Screen.app"
