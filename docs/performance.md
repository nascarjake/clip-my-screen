# Performance notes

Capture is paused on first launch. Enabling it records one selected display; macOS privacy indicators are part of normal OS capture behavior and are never suppressed.

## Changes in 0.2

The Mac helper keeps one ScreenCaptureKit display stream. Automatic recording-output rotation changes from every 4 seconds to every 30 seconds; saving a clip still flushes immediately. This reduces the calculated automatic rotation count from 225 to 30 per 15 minutes. It does not prove live recording continuity or resolve reported Finder indicator behavior.

Configured frame queue depth changes from 6 to 3. This halves queued slots, not total system memory. Helper shutdown awaits capture stop, native stdin EOF exits the helper, replay-only files can expire during long recordings, and hidden dashboards stop scheduled polling.

Mac exports use VideoToolbox H.264 at a resolution/frame-rate-scaled bitrate, with a two-thread libx264 fallback. Windows exports remain software encoded. Changing encoders changes visual quality and file size.

## Synthetic export comparison

Reproduce with `node scripts/benchmark-export.mjs` on an Apple Silicon Mac with the packaged FFmpeg resources available. It generates 10 seconds of 1920×1080/30 FPS `testsrc2`, without audio or personal media, and runs the old and new encoders sequentially with a 30-second timeout.

| Metric | Original libx264 veryfast/CRF 23 | VideoToolbox, 8 Mbps |
| --- | ---: | ---: |
| User + system CPU time | 4.13 s | 0.42 s |
| Wall time | 0.49 s | 0.93 s |
| Maximum resident size | 617,119,744 bytes | 155,959,296 bytes |
| File size | 7,073,599 bytes | 9,931,206 bytes |
| Decoded frames | 300 | 300 |

This fixture used 89.8% less CPU time and 74.7% lower peak resident size, but took 89.8% longer and made a 40.4% larger file. Both exports completed faster than real time. No perceptual equivalence is claimed.

## What is and isn't validated

Unit/service tests cover bounded retention, shutdown, explicit pause/resume, hidden UI polling, and export fallback with a fake recorder. Packaged smoke checks verify the desktop shell and local service start paused, with no buffer files or login registration. CI does not record the desktop.

Live capture CPU/GPU/encoder load, WindowServer behavior, memory trends, disk-write rates, audio sync, segment continuity, and the reported Finder privacy-indicator symptoms remain unverified for these changes. Synthetic export and paused-app results do not establish that active capture is lightweight.

For a useful real-device comparison, run only one recorder at a time with identical display/1080p/30 FPS/audio settings. Start with a bounded 60–90 second non-sensitive fixture, measure both builds, verify playback/flush continuity and audio sync, and stop the recorder afterward. Broaden testing only when the first results justify it. Record OS, architecture, settings, exact source revision, and measurement method with any report.
