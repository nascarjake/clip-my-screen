import test from 'node:test';
import assert from 'node:assert/strict';
import { canPruneSegment } from '../capture-policy.mjs';
const context = { now: 2000, bufferSeconds: 900, recording: null, protectedPaths: new Set() };
const segment = { end: 1000, path: '/buffer/old.mp4' };
test('retains the replay window and finalization margin', () => {
  assert.equal(canPruneSegment({ ...segment, end: 1080 }, context), false);
  assert.equal(canPruneSegment({ ...segment, end: 1079 }, context), true);
});
test('retains exported files until the export releases them', () => {
  assert.equal(canPruneSegment(segment, { ...context, protectedPaths: new Set([segment.path]) }), false);
});
test('long recording releases older replay segments but preserves its own start', () => {
  const recording = { startedAt: 1001 };
  assert.equal(canPruneSegment(segment, { ...context, recording }), true);
  assert.equal(canPruneSegment({ ...segment, end: 1001 }, { ...context, recording }), false);
  assert.equal(canPruneSegment({ ...segment, end: 1020 }, { ...context, recording }), false);
});
test('90 minutes of simulated standby stays bounded without a long recording', () => {
  let segments = [];
  for (let now = 0; now < 5400; now += 30) {
    segments.push({ end: now, path: String(now) });
    while (canPruneSegment(segments[0], { ...context, now })) segments.shift();
    assert.ok(segments.length <= 32);
  }
});
