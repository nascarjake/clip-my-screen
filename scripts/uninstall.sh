#!/bin/bash
set -euo pipefail
launchctl bootout "gui/$(id -u)/dev.jakedoes.clipmyscreen" >/dev/null 2>&1 || true
rm -f "$HOME/Library/LaunchAgents/dev.jakedoes.clipmyscreen.plist"
echo "Login service removed. Your clips in ~/Movies/Clip My Screen are untouched."
