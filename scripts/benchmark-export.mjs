// Synthetic video only: no screen, microphone, library files, or network access.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encodeVideo } from '../video-encoding.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const directory = path.join(root, 'build/performance/encode');
const ffmpeg = process.env.CMS_FFMPEG || path.join(root, 'vendor/ffmpeg/bin/ffmpeg');
await fs.mkdir(directory, { recursive: true });
let label;
const measurements = [];
async function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/time', ['-lp', command, ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let log = '';
    child.stderr.on('data', data => { log += data; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 30_000);
    child.on('error', reject);
    child.on('close', async code => {
      clearTimeout(timer);
      await fs.writeFile(path.join(directory, `${label}-time.txt`), log);
      if (code !== 0) return reject(new Error(log));
      const metric = name => Number(log.match(new RegExp(`^${name} ([\\d.]+)$`, 'm'))?.[1]);
      measurements.push({ label, wallSeconds: metric('real'), cpuSeconds: metric('user') + metric('sys'), maxResidentBytes: Number(log.match(/(\d+)\s+maximum resident set size/)?.[1]) });
      resolve();
    });
  });
}
const input = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30', '-t', '10'];
const output = name => ['-an', '-movflags', '+faststart', path.join(directory, `${name}.mp4`)];
label = 'software';
await run(ffmpeg, [...input, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', ...output(label)]);
label = 'optimized';
const encoder = await encodeVideo(run, ffmpeg, input, output(label), { platform: process.platform, height: 1080, fps: 30, timeout: 30_000 });
const result = { fixture: '10 seconds of generated testsrc2, 1920x1080, 30 FPS, no audio', encoder, measurements };
await fs.writeFile(path.join(directory, 'results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
