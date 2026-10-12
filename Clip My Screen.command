#!/bin/bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$project_dir"

if [[ ! -x node_modules/.bin/electron ]]; then
  echo "Electron is not installed. Run 'npm install' in this folder, then double-click this file again."
  read -r -p "Press Return to close..." _
  exit 1
fi

if [[ -f "$HOME/Library/LaunchAgents/dev.jakedoes.clipmyscreen.plist" ]] &&
   /usr/bin/grep -q '/server.mjs' "$HOME/Library/LaunchAgents/dev.jakedoes.clipmyscreen.plist"; then
  echo "Removing the old recorder-only login service..."
  bash scripts/uninstall.sh
fi

exec "$project_dir/node_modules/.bin/electron" "$project_dir"
