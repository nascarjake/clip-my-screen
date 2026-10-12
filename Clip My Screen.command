#!/bin/bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$project_dir"

if [[ ! -x node_modules/.bin/electron ]]; then
  echo "Electron is not installed. Run 'npm install' in this folder, then double-click this file again."
  read -r -p "Press Return to close..." _
  exit 1
fi

if ! curl --silent --fail --max-time 2 http://127.0.0.1:3917/api/status > /dev/null; then
  echo "Starting the Clip My Screen capture service..."
  if ! launchctl kickstart -k "gui/$(id -u)/dev.jakedoes.clipmyscreen"; then
    echo "The capture service is not installed. Run 'bash scripts/install.sh' in this folder first."
    read -r -p "Press Return to close..." _
    exit 1
  fi

  for _ in {1..30}; do
    if curl --silent --fail --max-time 1 http://127.0.0.1:3917/api/status > /dev/null; then
      break
    fi
    sleep 1
  done

  if ! curl --silent --fail --max-time 2 http://127.0.0.1:3917/api/status > /dev/null; then
    echo "The capture service did not become ready. Check the service logs and try again."
    read -r -p "Press Return to close..." _
    exit 1
  fi
fi

exec "$project_dir/node_modules/.bin/electron" "$project_dir"
