#!/bin/bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
node_bin="$(command -v node)"
ffmpeg_bin="$(command -v ffmpeg || true)"
if [[ -z "$ffmpeg_bin" ]]; then echo "ffmpeg is required. Install it before continuing." >&2; exit 1; fi
if [[ "$(uname -s)" != "Darwin" ]]; then echo "This installer requires macOS." >&2; exit 1; fi
if [[ "$project_dir" == *'&'* || "$project_dir" == *'<'* || "$project_dir" == *'>'* ]]; then echo "Move this project to a path without XML special characters." >&2; exit 1; fi

cd "$project_dir"
bash scripts/build-native.sh
agent_dir="$HOME/Library/LaunchAgents"
log_dir="$HOME/Library/Logs/Clip My Screen"
mkdir -p "$agent_dir" "$log_dir" "$HOME/Movies/Clip My Screen"
plist="$agent_dir/dev.jakedoes.clipmyscreen.plist"
cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>dev.jakedoes.clipmyscreen</string>
  <key>ProgramArguments</key><array><string>$node_bin</string><string>$project_dir/server.mjs</string></array>
  <key>WorkingDirectory</key><string>$project_dir</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$node_bin"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$log_dir/service.log</string>
  <key>StandardErrorPath</key><string>$log_dir/service.err.log</string>
</dict></plist>
PLIST
plutil -lint "$plist"
launchctl bootout "gui/$(id -u)/dev.jakedoes.clipmyscreen" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$plist"
launchctl kickstart -k "gui/$(id -u)/dev.jakedoes.clipmyscreen"
echo "Clip My Screen is installed and starts at login."
echo "Dashboard: http://localhost:3917"
echo "Captures: $HOME/Movies/Clip My Screen"
