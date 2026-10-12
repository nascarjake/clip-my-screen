# Clip My Screen

Clip My Screen is a free, open-source desktop clip tool. It keeps a rolling 15-minute screen buffer on your own computer, so you can save the last 1, 5, or 15 minutes with a shortcut. It includes display selection, screenshots, long recordings, a searchable clip library, trimming, favorites, and private share links. There is no account or subscription.

## Download

Download a release from [GitHub Releases](https://github.com/nascarjake/clip-my-screen/releases):

- **Mac Apple Silicon:** `Clip-My-Screen-…-macOS-arm64.zip`
- **Mac Intel:** `Clip-My-Screen-…-macOS-x86_64.zip`
- **Windows x64:** `Clip.My.Screen-…-Windows-x64-portable.exe`

On Mac, unzip and keep **Launch Clip My Screen.command** beside **Clip My Screen.app**. Double-click the command to clear the downloaded app's quarantine attribute and open it. This release is unsigned and unnotarized; only run it if you trust this project's source and release. Grant Screen Recording permission to **Clip My Screen Capture** when macOS asks. On Windows, run the portable `.exe` and grant screen capture permission if prompted.

If macOS shows a Screen Recording denial after an update, enable **Clip My Screen Capture** in System Settings → Privacy & Security → Screen & System Audio Recording, then reopen the app. Updated unsigned builds may require permission again.

Closing the desktop window leaves the recorder active in the background. The app requests launch at login. Use the menu bar icon on Mac or the notification area icon on Windows to reopen the window, save the last 1, 5, or 15 minutes, or quit the recorder completely. On Windows, double-clicking the icon also opens the window. Capture files are stored in `~/Movies/Clip My Screen` on Mac or `Videos/Clip My Screen` on Windows. A full 15-minute replay becomes available after 15 minutes of uninterrupted capture. Selecting another display starts a fresh buffer.

| Action | Mac shortcut | Windows shortcut |
| --- | --- | --- |
| Save last 1 minute | `⌘ ⌥ 1` | `Ctrl Alt 1` |
| Save last 5 minutes | `⌘ ⌥ 2` | `Ctrl Alt 2` |
| Save last 15 minutes | `⌘ ⌥ 3` | `Ctrl Alt 3` |
| Save default clip length | `⌘ ⇧ 8` | `Ctrl Shift 8` |
| Screenshot | `⌘ ⇧ 9` | `Ctrl Shift 9` |
| Start or stop long recording | `⌘ ⇧ 7` | `Ctrl Shift 7` |

Windows capture currently records video without system or microphone audio. Mac uses ScreenCaptureKit and can include both. Neither platform detects individual games, adds webcam overlays, or provides Medal's social feed or cloud library.

## Sharing

Saved captures stay local until you create a share link. A link works on the local network by default. You can revoke it at any time. For internet sharing, the Settings panel can start a temporary Cloudflare Quick Tunnel when `cloudflared` is installed; its address changes when restarted. The dashboard and management API remain local to your computer. You can also provide your own HTTPS tunnel URL.

## Build from source

Requires Node.js 20+, macOS 15+ or Windows 10/11. Install dependencies with `npm ci`. To develop on Mac, run `npm run build:native` followed by `npm run desktop`, or double-click `Clip My Screen.command`. To develop on Windows, run `npm run desktop`. On Mac, `bash scripts/install.sh` starts the Electron app at login; `bash scripts/uninstall.sh` removes that login item. The desktop app also removes the older recorder-only login service on first launch.

To package Mac on an Apple Silicon or Intel Mac, run `bash scripts/package-mac.sh`. It produces a ZIP containing the portable `.app` and the adjacent launch command. To package Windows on Windows, run `npm run package:win`. Tag pushes to `v*` run GitHub Actions on Apple Silicon, Intel Mac, and Windows and attach all three artifacts to a release.

## License and third-party software

This project's source code is MIT licensed; see [LICENSE](LICENSE). Releases include a [GPLv3 FFmpeg build](https://github.com/ispysoftware/agentdvr-ffmpeg-build) invoked as a separate process. The FFmpeg distribution's license texts and corresponding-source notice are included with each app in its Resources directory. Electron and other dependencies retain their own licenses.
