// Keep the rolling window, any active long recording, and files in an export.
export function canPruneSegment(segment, { now, bufferSeconds, recording, protectedPaths }) {
  return segment.end < now - bufferSeconds - 20
    && (!recording || segment.end < recording.startedAt)
    && !protectedPaths.has(segment.path);
}
