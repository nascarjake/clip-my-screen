# Contributing

Thanks for helping make Clip My Screen a useful little desktop tool.

Start with the [source-build guide](README.md#build-from-source). Use Node 22+, run `npm ci`, and run `npm test` before sending a pull request. Keep changes focused and explain the problem, the resulting behavior, and how you checked it. Screenshots help for interface changes.

## What would help

- Reproducible Mac and Windows bug reports, including OS, CPU architecture, app version, display setup, frame rate, resolution, and audio settings.
- Capture continuity and audio-sync checks using non-sensitive content you have permission to record.
- Bounded CPU, memory, buffer-size, and export measurements on one recorder at a time. See [performance notes](docs/performance.md).
- Accessibility and keyboard improvements, Windows audio support, and first-time microphone permission setup on Mac.

## Capture and privacy

The test suite uses a fake capture helper and temporary files. The screenshot script renders demo data into the actual dashboard; it never imports your capture library or records the desktop. Packaged smoke tests force capture off and skip login registration.

Do not include personal recordings, library databases, private share tokens, credentials, or diagnostic logs containing private paths in a PR or issue. When testing real capture, ask before recording anyone else's content. Keep operating-system recording indicators and security checks intact.

## Releases

Tagging `vX.Y.Z` runs `.github/workflows/release.yml`. The tag must match the version in `package.json`. Apple Silicon, Intel Mac, and Windows runners build and test their own packages; publishing waits for all of them. Stable download filenames keep README and AI Lab links valid across releases. Releases include SHA-256 checksums and third-party license/source notices.

Signing is currently local ad-hoc signing on Mac and unsigned on Windows. Do not claim Developer ID, notarization, trusted-publisher status, or live-capture validation unless those checks actually ran.
