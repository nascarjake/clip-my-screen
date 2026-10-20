const software = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-threads', '2'];

// Export work must leave CPU available for the foreground app. VideoToolbox
// runs on the Mac's media engine; keep a bounded software fallback for failures.
export async function encodeVideo(run, command, input, output, { platform, height = 1080, fps = 30, timeout }) {
  if (platform === 'darwin') {
    const bitrate = Math.round(Math.min(60_000_000, Math.max(2_000_000, 8_000_000 * (height / 1080) ** 2 * fps / 30)));
    try {
      await run(command, [...input, '-c:v', 'h264_videotoolbox', '-allow_sw', '0', '-b:v', String(bitrate), ...output], timeout);
      return 'videotoolbox';
    } catch (error) {
      if (error.code === 'CMS_SHUTDOWN') throw error;
    }
  }
  await run(command, [...input, ...software, ...output], timeout);
  return 'software';
}
