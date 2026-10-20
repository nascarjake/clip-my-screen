Save the moment after it happens. A free, open-source screen replay tool for Mac and Windows, with a local clip library and no account or subscription.

### Download

| Your computer | Recommended | Alternative |
| --- | --- | --- |
| Mac with Apple Silicon (M1 or newer), macOS 15+ | **Clip-My-Screen-macOS-arm64.dmg** | arm64 ZIP |
| Intel Mac, macOS 15+ | **Clip-My-Screen-macOS-x64.dmg** | x64 ZIP |
| Windows 10/11, 64-bit Intel/AMD | **Clip-My-Screen-Windows-x64-Setup.exe** | Portable EXE |

On Mac, open the DMG and drag **Clip My Screen** into **Applications**. On Windows, run **Setup.exe**; the portable version can run without installation. Both start with capture **paused**. Use Settings to choose your display, then Resume capture when ready. Mac screen-recording authorization must be granted in System Settings first; see the [first-run guide](https://github.com/nascarjake/clip-my-screen#your-first-clip).

These early builds do not have a trusted publisher signature: Mac bundles are locally ad-hoc signed and unnotarized; Windows executables are unsigned. macOS/Gatekeeper or Windows/SmartScreen may block or warn about them. No security-bypass launcher is included. You can inspect and build the source instead. SHA-256 checksums are attached as **SHA256SUMS.txt**.

### In this release

- Mac DMG installers and ZIPs for Apple Silicon and Intel; Windows installer and portable builds.
- Capture paused by default, with explicit Pause/Resume and a pause preference that survives restart/login.
- 1-, 5-, and 15-minute replay shortcuts; screenshots, longer recordings, search, tags, favorites, trimming, and revocable share links.
- Fewer scheduled Mac recording-output rotations, a smaller frame queue, awaited helper shutdown, and bounded replay retention during long recordings.
- Hardware-assisted Mac clip exports with bounded software fallback; idle dashboards stop scheduled polling when hidden.
- Brighter app artwork, illustrated setup docs, and an AI Lab project page.

### Validation and limitations

All release platforms run the unit/service tests and a packaged-app smoke test with capture disabled and temporary data before publishing. Tests exercise a fake recorder; they do not record a desktop. Windows capture is video-only. Intel Mac and Windows builds are validated by CI, not physical-device capture tests.

Live before/after screen capture, Finder privacy indicators, audio sync, rotation continuity, and long-running capture load have **not** been validated for these changes. A synthetic export benchmark is not evidence those capture issues are fixed. Microphone capture on Mac requires existing OS authorization; first-time microphone permission setup is not automated yet. Native trusted publisher signing/notarization and broader real-device capture validation remain follow-up work.

[Quick start and shortcuts](https://github.com/nascarjake/clip-my-screen#your-first-clip) · [Report a bug](https://github.com/nascarjake/clip-my-screen/issues/new/choose) · [Source and MIT license](https://github.com/nascarjake/clip-my-screen)
