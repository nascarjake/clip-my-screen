// Windows capture agent. Emits the same newline-delimited events as the macOS helper.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const directory = argument('--dir', '.');
const displayIndex = Number(argument('--display', '0'));
const quality = Number(argument('--height', '1080'));
const fps = Number(argument('--fps', '30'));
const ffmpeg = process.env.CMS_FFMPEG || 'ffmpeg';
const displays = JSON.parse(process.env.CMS_DISPLAYS || '[]');
const display = displays[displayIndex];
const emit = value => process.stdout.write(JSON.stringify(value) + '\n');

if (!display) {
  emit({ event: 'displays', displays });
  emit({ event: 'error', message: 'Selected display is unavailable. Choose another screen in Settings.' });
  process.exit(2);
}

const scale = Math.min(1, quality / display.height);
const width = Math.max(2, Math.floor(display.captureBounds.width * scale / 2) * 2);
const height = Math.max(2, Math.floor(display.captureBounds.height * scale / 2) * 2);
let child;
let listPath;
let baseTime;
let emitted = new Set();
let nextIndex = 0;
let pendingFlushes = [];
let quitting = false;
let started = false;
let stderr = '';
let scanning = null;

async function scanSegments() {
  if (scanning) return scanning;
  scanning = readSegments();
  try { await scanning; } finally { scanning = null; }
}

async function readSegments() {
  if (!listPath) return;
  let csv;
  try { csv = await fs.readFile(listPath, 'utf8'); } catch { return; }
  for (const line of csv.trim().split(/\r?\n/)) {
    const match = /^(.*segment-(\d+)\.mp4),([\d.]+),([\d.]+)$/.exec(line.trim());
    if (!match) continue;
    const index = Number(match[2]);
    if (emitted.has(index)) continue;
    const file = path.join(directory, path.basename(match[1].replace(/^"|"$/g, '')));
    try {
      const stat = await fs.stat(file);
      if (!baseTime) baseTime = stat.birthtimeMs / 1000 - Number(match[3]);
      emit({ event: 'segment', index, path: file, start: baseTime + Number(match[3]), end: baseTime + Number(match[4]) });
      emitted.add(index);
      nextIndex = Math.max(nextIndex, index + 1);
      for (const previous of emitted) if (previous < nextIndex - 16) emitted.delete(previous);
    } catch { /* The muxer has not finished making this file visible yet. */ }
  }
}

function startCapture() {
  baseTime = 0;
  listPath = path.join(directory, `segment-list-${nextIndex}.csv`);
  const bounds = display.captureBounds;
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'gdigrab', '-framerate', String(fps),
    '-offset_x', String(bounds.x), '-offset_y', String(bounds.y),
    '-video_size', `${bounds.width}x${bounds.height}`, '-i', 'desktop',
    '-vf', `scale=${width}:${height}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
    '-pix_fmt', 'yuv420p', '-g', String(fps * 4), '-keyint_min', String(fps * 4), '-sc_threshold', '0',
    '-f', 'segment', '-segment_time', '4', '-segment_start_number', String(nextIndex),
    '-reset_timestamps', '1', '-segment_list', listPath, '-segment_list_type', 'csv', '-segment_list_size', '2',
    path.join(directory, 'segment-%08d.mp4')
  ];
  stderr = '';
  child = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4000); });
  child.on('error', error => { emit({ event: 'error', message: error.message }); process.exit(2); });
  child.on('close', async code => {
    child = null;
    await scanSegments();
    await fs.rm(listPath, { force: true }).catch(() => {});
    const lastIndex = nextIndex - 1;
    for (const id of pendingFlushes.splice(0)) {
      if (lastIndex >= 0) emit({ event: 'flushed', id, index: lastIndex });
      else emit({ event: 'flushError', id, message: 'No recording segment is available yet' });
    }
    if (quitting) process.exit(0);
    if (code !== 0) {
      emit({ event: 'error', message: stderr || `Windows screen recorder exited (${code})` });
      process.exit(2);
    }
    startCapture();
  });
  if (!started) {
    started = true;
    emit({ event: 'ready', width, height, fps, displayCount: displays.length, displayIndex, displays });
  }
}

await fs.mkdir(directory, { recursive: true });
emit({ event: 'displays', displays });
startCapture();
setInterval(() => { scanSegments().catch(error => emit({ event: 'error', message: error.message })); }, 500).unref();
readline.createInterface({ input: process.stdin }).on('line', line => {
  let command;
  try { command = JSON.parse(line); } catch { return; }
  if (command.action === 'quit') {
    quitting = true;
    if (child?.stdin.writable) child.stdin.write('q\n');
    else process.exit(0);
  }
  if (command.action === 'flush' && command.id) {
    pendingFlushes.push(command.id);
    if (pendingFlushes.length === 1 && child?.stdin.writable) child.stdin.write('q\n');
  }
});
