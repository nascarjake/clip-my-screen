# Third-party notices

Clip My Screen source code is licensed under MIT; see [LICENSE](LICENSE).

## Electron

The desktop shell uses [Electron](https://www.electronjs.org/), which includes Chromium and Node.js. Its license and third-party notices ship with the Electron distribution and packaged app.

## FFmpeg

Desktop releases bundle the **v9.0.1** distribution from [ispysoftware/agentdvr-ffmpeg-build](https://github.com/ispysoftware/agentdvr-ffmpeg-build/releases/tag/v9.0.1). It is invoked as a separate executable process. Download scripts pin the archive and SHA-256 digest, verify `--enable-gpl` / `--disable-nonfree`, and verify the H.264 encoder before packaging.

- [Distribution source, build scripts, and upstream correspondence](https://github.com/ispysoftware/agentdvr-ffmpeg-build/tree/v9.0.1)
- [FFmpeg source and license information](https://ffmpeg.org/legal.html)
- License texts and the distribution's corresponding-source notice are copied unchanged into `Resources/ffmpeg/licenses` on Mac and `resources/ffmpeg/licenses` on Windows.

The app's MIT license does not replace FFmpeg's or its dependencies' licenses. Keep the bundled notices and source information when redistributing a release.
