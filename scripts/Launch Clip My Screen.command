#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
xattr -c "./Clip My Screen.app"
open "./Clip My Screen.app"
