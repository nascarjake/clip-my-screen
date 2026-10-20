import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeVideo } from '../video-encoding.mjs';
const input = ['-y', '-i', 'input.mp4', '-t', '5'];
const output = ['-c:a', 'aac', 'output.mp4'];
test('Mac export uses hardware without software emulation and keeps seek/output args', async () => {
  const calls = [];
  const result = await encodeVideo(async (...args) => calls.push(args), 'ffmpeg', input, output, { platform: 'darwin', timeout: 123 });
  assert.equal(result, 'videotoolbox');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'ffmpeg');
  assert.deepEqual(calls[0][1].slice(0, input.length), input);
  assert.deepEqual(calls[0][1].slice(-output.length), output);
  assert.equal(calls[0][1][calls[0][1].indexOf('-allow_sw') + 1], '0');
  assert.equal(calls[0][2], 123);
});
test('hardware failure retries once with bounded CPU encoding', async () => {
  const calls = [];
  const result = await encodeVideo(async (_command, args) => {
    calls.push(args); if (calls.length === 1) throw new Error('Hardware encoder busy');
  }, 'ffmpeg', input, output, { platform: 'darwin' });
  assert.equal(result, 'software');
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes('libx264'));
  assert.equal(calls[1][calls[1].indexOf('-threads') + 1], '2');
});
test('shutdown does not retry hardware export', async () => {
  let calls = 0;
  await assert.rejects(encodeVideo(async () => { calls++; throw Object.assign(new Error('Shutting down'), { code: 'CMS_SHUTDOWN' }); }, 'ffmpeg', input, output, { platform: 'darwin' }), /Shutting down/);
  assert.equal(calls, 1);
});
test('Windows stays on software; a software failure reaches the caller', async () => {
  let calls = 0;
  await assert.rejects(encodeVideo(async (_command, args) => {
    calls++; assert.ok(args.includes('libx264')); throw new Error('Invalid source');
  }, 'ffmpeg', input, output, { platform: 'win32' }), /Invalid source/);
  assert.equal(calls, 1);
});
