import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.CMS_DATA_DIR || path.join(os.homedir(), process.platform === 'win32' ? 'Videos' : 'Movies', 'Clip My Screen');
const ffmpegPath = process.env.CMS_FFMPEG || 'ffmpeg';
const h264Encode = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23'];
const clipDir = path.join(dataDir, 'Clips');
const bufferDir = path.join(dataDir, '.buffer');
const publicDir = path.join(root, 'public');
const libraryPath = path.join(dataDir, 'library.json');
const port = Number(process.env.CMS_PORT || 3917);
const sharePort = port + 1;
const defaults = {
  clipSeconds: 60, quality: 1080, fps: 30, display: 0,
  systemAudio: process.platform !== 'win32', microphone: false, lanSharing: true,
  publicBaseUrl: ''
};

for (const dir of [dataDir, clipDir, bufferDir]) await fsp.mkdir(dir, { recursive: true });
let library;
try { library = JSON.parse(await fsp.readFile(libraryPath, 'utf8')); }
catch { library = { settings: { ...defaults }, clips: [] }; }
library.settings = { ...defaults, ...library.settings };
if (process.platform === 'win32') {
  library.settings.systemAudio = false;
  library.settings.microphone = false;
}
library.clips ||= [];
let saveChain = Promise.resolve();
function save() {
  const snapshot = JSON.stringify(library, null, 2);
  saveChain = saveChain.then(async () => {
    const temp = libraryPath + '.tmp';
    await fsp.writeFile(temp, snapshot);
    await fsp.rename(temp, libraryPath);
  });
  return saveChain;
}
await save();

const runtime = { ready: false, error: '', width: 0, height: 0, displayCount: 0, displays: [], startedAt: Date.now(), recording: null, tunnelUrl: null, tunnelStatus: 'off', tunnelError: '' };
const bufferSeconds = 900;
const jobs = new Map();
const segments = [];
const pendingFlushes = new Map();
const protectedPaths = new Set();
let helper;
let helperBuffer = '';
let captureQueue = Promise.resolve();
let restartRequested = false;
let tunnelProcess;

function executable(name) {
  for (const folder of [path.join(root, 'bin'), ...(process.env.PATH || '').split(path.delimiter)]) {
    const candidate = path.join(folder, process.platform === 'win32' ? `${name}.exe` : name);
    try { fs.accessSync(candidate, fs.constants.X_OK); return candidate; } catch {}
  }
  return null;
}

function id() { return crypto.randomUUID(); }
function token() { return crypto.randomBytes(24).toString('base64url'); }
function titleFor(type) {
  const label = type === 'screenshot' ? 'Screenshot' : type === 'session' ? 'Session' : 'Clip';
  return `${label} · ${new Date().toLocaleString()}`;
}
function localAddress() {
  for (const values of Object.values(os.networkInterfaces())) {
    for (const item of values || []) if (item.family === 'IPv4' && !item.internal) return item.address;
  }
  return 'localhost';
}
function baseUrl() {
  const configured = library.settings.publicBaseUrl.trim().replace(/\/+$/, '');
  return runtime.tunnelUrl || configured || `http://${localAddress()}:${port}`;
}
function isLoopback(address = '') { return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'; }
function localRequest(req) {
  const host = (req.headers.host || '').toLowerCase().split(':')[0].replace(/^\[|\]$/g, '');
  return isLoopback(req.socket.remoteAddress) && ['localhost', '127.0.0.1', '::1'].includes(host);
}
function json(res, code, value) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function fileFor(clip) { return path.join(clipDir, clip.file); }
function publicClip(clip) { return { ...clip, shareUrl: clip.shareToken ? `${baseUrl()}/s/${clip.shareToken}` : null }; }
async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 32_768) throw new Error('Request too large');
  }
  return text ? JSON.parse(text) : {};
}
function run(command, args, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    child.stderr.on('data', chunk => { errors += chunk; errors = errors.slice(-8000); });
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(errors.trim() || `${command} exited ${code}`));
    });
  });
}
function sendHelper(value) {
  if (!helper?.stdin.writable) throw new Error('Capture helper is not running');
  helper.stdin.write(JSON.stringify(value) + '\n');
}
function startHelper() {
  if (process.env.CMS_DISABLE_CAPTURE === '1') return;
  const nativeExecutable = process.env.CMS_NATIVE_HELPER || path.join(root, 'build', 'Clip My Screen Capture.app', 'Contents', 'MacOS', 'clip-capture');
  const windows = process.platform === 'win32';
  if (!windows && !fs.existsSync(nativeExecutable)) {
    runtime.error = 'Native capture helper is missing. Run npm run build:native.';
    return;
  }
  const settings = library.settings;
  const args = ['--dir', bufferDir, '--display', String(settings.display), '--height', String(settings.quality), '--fps', String(settings.fps), '--audio', String(settings.systemAudio), '--mic', String(settings.microphone)];
  helper = windows
    ? spawn(process.execPath, [path.join(root, 'windows', 'capture-agent.mjs'), ...args], { stdio: ['pipe', 'pipe', 'pipe'], env: process.env })
    : spawn(nativeExecutable, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  helperBuffer = '';
  helper.stdout.on('data', chunk => {
    helperBuffer += chunk.toString();
    let newline;
    while ((newline = helperBuffer.indexOf('\n')) !== -1) {
      const line = helperBuffer.slice(0, newline);
      helperBuffer = helperBuffer.slice(newline + 1);
      try { handleHelper(JSON.parse(line)); } catch (error) { console.error('Capture event:', error); }
    }
  });
  helper.stderr.on('data', chunk => console.error('Capture helper:', chunk.toString().trim()));
  helper.on('error', error => { runtime.ready = false; runtime.error = error.message; });
  helper.on('close', async code => {
    runtime.ready = false;
    helper = null;
    for (const [key, pending] of pendingFlushes) { pending.reject(new Error('Capture helper stopped')); pendingFlushes.delete(key); }
    await captureQueue.catch(() => {});
    segments.length = 0;
    runtime.recording = null;
    for (const file of await fsp.readdir(bufferDir).catch(() => [])) {
      if (file.startsWith('segment-')) await fsp.rm(path.join(bufferDir, file), { force: true }).catch(() => {});
    }
    if (restartRequested) {
      restartRequested = false;
      setTimeout(startHelper, 300).unref();
    } else if (code !== 0 && process.env.CMS_DISABLE_CAPTURE !== '1') {
      runtime.error = `Capture helper exited (${code}). Retrying…`;
      setTimeout(startHelper, 3000).unref();
    }
  });
}
function startTunnel() {
  if (tunnelProcess) return;
  const binary = executable('cloudflared');
  if (!binary) throw new Error('cloudflared is not installed. Run: brew install cloudflared');
  runtime.tunnelStatus = 'starting';
  runtime.tunnelError = '';
  runtime.tunnelUrl = null;
  let log = '';
  const child = spawn(binary, ['tunnel', '--url', `http://127.0.0.1:${sharePort}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  tunnelProcess = child;
  const onOutput = chunk => {
    log = (log + chunk.toString()).slice(-10000);
    const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(log);
    if (match) { runtime.tunnelUrl = match[0]; runtime.tunnelStatus = 'online'; runtime.tunnelError = ''; }
  };
  child.stdout.on('data', onOutput);
  child.stderr.on('data', onOutput);
  child.on('error', error => { runtime.tunnelStatus = 'error'; runtime.tunnelError = error.message; tunnelProcess = null; });
  child.on('close', code => {
    if (tunnelProcess !== child) return;
    tunnelProcess = null;
    runtime.tunnelUrl = null;
    runtime.tunnelStatus = code === 0 ? 'off' : 'error';
    if (code !== 0) runtime.tunnelError = log.trim().split('\n').slice(-2).join(' ').slice(0, 250) || `Tunnel exited ${code}`;
  });
  setTimeout(() => {
    if (runtime.tunnelStatus === 'starting') { runtime.tunnelStatus = 'error'; runtime.tunnelError = 'Tunnel did not receive a public URL. Check your connection and cloudflared configuration.'; child.kill('SIGTERM'); }
  }, 30000).unref();
}
function stopTunnel() {
  const child = tunnelProcess;
  tunnelProcess = null;
  runtime.tunnelUrl = null;
  runtime.tunnelStatus = 'off';
  runtime.tunnelError = '';
  child?.kill('SIGTERM');
}
function handleHelper(event) {
  if (event.event === 'displays') {
    runtime.displays = event.displays;
    runtime.displayCount = event.displays.length;
  } else if (event.event === 'ready') {
    Object.assign(runtime, { ready: true, error: '', width: event.width, height: event.height, displayCount: event.displayCount, displays: event.displays });
  } else if (event.event === 'error') {
    runtime.error = event.message;
    if (event.message.startsWith('Screen capture stopped') || event.message.startsWith('Recording failed')) runtime.ready = false;
    console.error('Capture:', event.message);
  } else if (event.event === 'segment') {
    segments.push(event);
    segments.sort((a, b) => a.index - b.index);
  } else if (event.event === 'flushed') {
    const pending = pendingFlushes.get(event.id);
    if (pending) { pendingFlushes.delete(event.id); pending.resolve(event.index); }
  } else if (event.event === 'flushError') {
    const pending = pendingFlushes.get(event.id);
    if (pending) { pendingFlushes.delete(event.id); pending.reject(new Error(event.message)); }
  } else if (event.event === 'hotkey') {
    if (event.action === 'clip') queueClip(event.seconds || library.settings.clipSeconds);
    if (event.action === 'screenshot') takeScreenshot();
    if (event.action === 'record') toggleRecording();
  }
}
function flush() {
  return new Promise((resolve, reject) => {
    if (!runtime.ready) return reject(new Error(runtime.error || 'Recorder is still starting'));
    const key = id();
    const timer = setTimeout(() => {
      pendingFlushes.delete(key);
      reject(new Error('Timed out waiting for the recording segment'));
    }, 15000);
    pendingFlushes.set(key, {
      resolve: index => { clearTimeout(timer); resolve(index); },
      reject: error => { clearTimeout(timer); reject(error); }
    });
    try { sendHelper({ action: 'flush', id: key }); }
    catch (error) { clearTimeout(timer); pendingFlushes.delete(key); reject(error); }
  });
}
function makeJob(type) {
  const job = { id: id(), type, status: 'working', createdAt: new Date().toISOString(), error: null, clipId: null };
  jobs.set(job.id, job);
  setTimeout(() => jobs.delete(job.id), 30 * 60_000).unref();
  return job;
}
function enqueue(job, work) {
  captureQueue = captureQueue.catch(() => {}).then(async () => {
    try { job.clipId = (await work()).id; job.status = 'done'; }
    catch (error) { job.status = 'error'; job.error = error.message; console.error(job.type, error); }
  });
}
async function createFromSegments(type, start, end, maxSeconds, copyOnly = false) {
  const selected = segments.filter(segment => segment.end > start && segment.start <= end).sort((a, b) => a.index - b.index);
  if (!selected.length) throw new Error('No recorded video is available yet');
  selected.forEach(segment => protectedPaths.add(segment.path));
  const clipId = id();
  const filename = `${clipId}.mp4`;
  const output = path.join(clipDir, filename);
  const list = path.join(bufferDir, `concat-${clipId}.txt`);
  try {
    await fsp.writeFile(list, selected.map(segment => `file '${segment.path.replaceAll("'", "'\\''")}'`).join('\n'));
    const offset = Math.max(0, start - selected[0].start);
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
    if (offset > 0.05) args.push('-ss', offset.toFixed(3));
    if (maxSeconds) args.push('-t', String(maxSeconds));
    args.push(...(copyOnly ? ['-c', 'copy'] : [...h264Encode, '-c:a', 'aac']), '-movflags', '+faststart', output);
    await run(ffmpegPath, args, copyOnly ? 300000 : 1200000);
    const stat = await fsp.stat(output);
    if (stat.size < 1000) throw new Error('The recorded clip was empty');
    const thumb = `${clipId}.jpg`;
    await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '1', '-i', output, '-frames:v', '1', '-vf', 'scale=480:-2', path.join(clipDir, thumb)]).catch(() => {});
    const clip = { id: clipId, type, title: titleFor(type), file: filename, thumb: fs.existsSync(path.join(clipDir, thumb)) ? thumb : null,
      createdAt: new Date().toISOString(), duration: Math.max(1, Math.round(end - Math.max(start, selected[0].start))), bytes: stat.size,
      favorite: false, tags: [], shareToken: null };
    library.clips.unshift(clip);
    await save();
    return clip;
  } finally {
    selected.forEach(segment => protectedPaths.delete(segment.path));
    await fsp.rm(list, { force: true }).catch(() => {});
    if (!library.clips.some(clip => clip.id === clipId)) await fsp.rm(output, { force: true }).catch(() => {});
  }
}
function queueClip(seconds) {
  const job = makeJob('clip');
  enqueue(job, async () => {
    const index = await flush();
    const last = segments.find(segment => segment.index === index);
    if (!last) throw new Error('Latest recording segment is unavailable');
    return createFromSegments('clip', last.end - seconds, last.end, seconds);
  });
  return job;
}
function takeScreenshot() {
  const job = makeJob('screenshot');
  enqueue(job, async () => {
    const clipId = id();
    const filename = `${clipId}.png`;
    const output = path.join(clipDir, filename);
    const display = runtime.displays.find(item => item.index === library.settings.display);
    if (!display) throw new Error('Selected display is unavailable');
    if (process.platform === 'win32') {
      const bounds = display.captureBounds;
      await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'gdigrab', '-offset_x', String(bounds.x), '-offset_y', String(bounds.y), '-video_size', `${bounds.width}x${bounds.height}`, '-i', 'desktop', '-frames:v', '1', output], 15000);
    } else {
      await run('screencapture', ['-x', `-D${display.screenshotDisplay}`, output], 15000);
    }
    const stat = await fsp.stat(output);
    const clip = { id: clipId, type: 'screenshot', title: titleFor('screenshot'), file: filename, thumb: filename,
      createdAt: new Date().toISOString(), duration: 0, bytes: stat.size, favorite: false, tags: [], shareToken: null };
    library.clips.unshift(clip);
    await save();
    return clip;
  });
  return job;
}
function toggleRecording() {
  const job = makeJob('session');
  if (!runtime.recording) {
    enqueue(job, async () => {
      const index = await flush();
      const segment = segments.find(item => item.index === index);
      runtime.recording = { startedAt: segment?.end || Date.now() / 1000 };
      return { id: 'recording' };
    });
  } else {
    enqueue(job, async () => {
      const startedAt = runtime.recording.startedAt;
      const index = await flush();
      const segment = segments.find(item => item.index === index);
      runtime.recording = null;
      if (!segment) throw new Error('Latest recording segment is unavailable');
      return createFromSegments('session', startedAt, segment.end, null, true);
    });
  }
  return job;
}

async function pruneBuffer() {
  const cutoff = Date.now() / 1000 - bufferSeconds - 20;
  while (segments.length && segments[0].end < cutoff && !runtime.recording && !protectedPaths.has(segments[0].path)) {
    const segment = segments.shift();
    await fsp.rm(segment.path, { force: true }).catch(() => {});
  }
}
setInterval(pruneBuffer, 20_000).unref();
for (const file of await fsp.readdir(bufferDir)) if (file.startsWith('segment-') || file.startsWith('concat-')) await fsp.rm(path.join(bufferDir, file), { force: true }).catch(() => {});
startHelper();

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
async function sendFile(req, res, file, cache = 'no-store') {
  const stat = await fsp.stat(file);
  const range = req.headers.range;
  const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' };
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return json(res, 416, { error: 'Invalid range' });
    const start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2] || 0));
    const end = match[2] && match[1] ? Math.min(stat.size - 1, Number(match[2])) : stat.size - 1;
    if (start > end || start >= stat.size) return json(res, 416, { error: 'Invalid range' });
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(res);
  }
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function sharedPage(clip) {
  const title = escapeHtml(clip.title);
  const media = `/shared-media/${clip.shareToken}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · Clip My Screen</title><meta property="og:title" content="${title}"><meta property="og:type" content="video.other"><meta property="og:image" content="${escapeHtml(baseUrl() + '/shared-thumb/' + clip.shareToken)}"><meta property="og:video" content="${escapeHtml(baseUrl() + media)}"><style>body{margin:0;background:#0d0e13;color:#f4f4f8;font:16px system-ui;min-height:100vh;display:grid;place-items:center}.wrap{width:min(900px,calc(100% - 32px))}.brand{color:#ffcf53;font-weight:900;letter-spacing:.08em;text-transform:uppercase;font-size:13px}h1{font-size:clamp(25px,4vw,42px);margin:20px 0}video,img{width:100%;border-radius:16px;background:#171a23;box-shadow:0 24px 80px #0009}a{display:inline-block;margin:22px 0;color:#101117;background:#ffcf53;padding:12px 18px;border-radius:9px;text-decoration:none;font-weight:800}.muted{color:#9294a4}</style></head><body><div class="wrap"><div class="brand">◉ Clip My Screen</div><h1>${title}</h1>${clip.type === 'screenshot' ? `<img src="${media}" alt="${title}">` : `<video src="${media}" controls autoplay playsinline></video>`}<a href="${media}?download=1">Download ${clip.type === 'screenshot' ? 'image' : 'clip'} ↓</a><div class="muted">Shared from a personal computer</div></div></body></html>`;
}

async function handleRequest(req, res, shareOnly = false) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const local = localRequest(req);
    const method = req.method;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 's' && parts[1] && method === 'GET') {
      if ((shareOnly || !local) && !library.settings.lanSharing) return json(res, 403, { error: 'Sharing is disabled' });
      const clip = library.clips.find(item => item.shareToken === parts[1]);
      if (!clip) return json(res, 404, { error: 'Share link not found' });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; media-src 'self'; img-src 'self'" });
      return res.end(sharedPage(clip));
    }
    if (parts[0] === 'shared-media' && parts[1] && method === 'GET') {
      if ((shareOnly || !local) && !library.settings.lanSharing) return json(res, 403, { error: 'Sharing is disabled' });
      const clip = library.clips.find(item => item.shareToken === parts[1]);
      if (!clip) return json(res, 404, { error: 'Share link not found' });
      if (url.searchParams.has('download')) res.setHeader('Content-Disposition', `attachment; filename="${clip.file}"`);
      return sendFile(req, res, fileFor(clip), 'private, max-age=3600');
    }
    if (parts[0] === 'shared-thumb' && parts[1] && method === 'GET') {
      if ((shareOnly || !local) && !library.settings.lanSharing) return json(res, 403, { error: 'Sharing is disabled' });
      const clip = library.clips.find(item => item.shareToken === parts[1]);
      if (!clip || !clip.thumb) return json(res, 404, { error: 'Preview not found' });
      return sendFile(req, res, path.join(clipDir, clip.thumb), 'private, max-age=3600');
    }
    if (shareOnly) return json(res, 403, { error: 'Only shared captures are available here' });
    if (!local) return json(res, 403, { error: 'Open the dashboard on this computer using localhost' });
    if (method !== 'GET' && req.headers.origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin)) return json(res, 403, { error: 'Invalid origin' });
    if (parts[0] === 'api') {
      if (parts[1] === 'status' && method === 'GET') {
        return json(res, 200, { ...runtime, settings: library.settings, clipCount: library.clips.length,
          bufferSeconds, bufferAvailableSeconds: runtime.ready && segments.length ? Math.min(bufferSeconds, Math.floor(Date.now() / 1000 - segments[0].start)) : 0,
          platform: process.platform,
          storageBytes: library.clips.reduce((sum, clip) => sum + clip.bytes, 0), dataDir, localUrl: `http://localhost:${port}`, shareBaseUrl: baseUrl(),
          tunnelAvailable: Boolean(executable('cloudflared')), hotkeys: process.platform === 'win32'
            ? ['Ctrl Alt 1', 'Ctrl Alt 2', 'Ctrl Alt 3', 'Ctrl Shift 8', 'Ctrl Shift 9', 'Ctrl Shift 7']
            : ['⌘ ⌥ 1', '⌘ ⌥ 2', '⌘ ⌥ 3', '⌘ ⇧ 8', '⌘ ⇧ 9', '⌘ ⇧ 7'] });
      }
      if (parts[1] === 'tunnel' && parts[2] === 'start' && method === 'POST') { startTunnel(); return json(res, 202, { status: runtime.tunnelStatus }); }
      if (parts[1] === 'tunnel' && parts[2] === 'stop' && method === 'POST') { stopTunnel(); return json(res, 200, { status: runtime.tunnelStatus }); }
      if (parts[1] === 'clips' && parts.length === 2 && method === 'GET') {
        const search = (url.searchParams.get('search') || '').toLowerCase();
        const type = url.searchParams.get('type') || 'all';
        return json(res, 200, library.clips.filter(clip => (type === 'all' || type === clip.type || (type === 'favorites' && clip.favorite)) &&
          (!search || `${clip.title} ${clip.tags.join(' ')}`.toLowerCase().includes(search))).map(publicClip));
      }
      if (parts[1] === 'jobs' && parts[2] && method === 'GET') return json(res, jobs.has(parts[2]) ? 200 : 404, jobs.get(parts[2]) || { error: 'Job not found' });
      if (parts[1] === 'grab' && method === 'POST') {
        const input = await body(req);
        const seconds = Number(input.seconds ?? library.settings.clipSeconds);
        if (!Number.isInteger(seconds) || seconds < 5 || seconds > bufferSeconds) return json(res, 400, { error: 'Clip length must be 5–900 seconds' });
        if (!runtime.ready) return json(res, 503, { error: runtime.error || 'Recorder is still starting' });
        return json(res, 202, queueClip(seconds));
      }
      if (parts[1] === 'screenshot' && method === 'POST') return json(res, 202, takeScreenshot());
      if (parts[1] === 'recording' && method === 'POST') {
        if (!runtime.ready) return json(res, 503, { error: runtime.error || 'Recorder is still starting' });
        return json(res, 202, toggleRecording());
      }
      if (parts[1] === 'settings' && method === 'PATCH') {
        const input = await body(req);
        const next = { ...library.settings };
        if ('clipSeconds' in input) { if (!Number.isInteger(input.clipSeconds) || input.clipSeconds < 5 || input.clipSeconds > bufferSeconds) throw new Error('Clip length must be 5–900 seconds'); next.clipSeconds = input.clipSeconds; }
        if ('quality' in input) { if (![720, 1080, 1440, 2160].includes(input.quality)) throw new Error('Invalid resolution'); next.quality = input.quality; }
        if ('fps' in input) { if (![24, 30, 60].includes(input.fps)) throw new Error('Invalid frame rate'); next.fps = input.fps; }
        if ('display' in input) { if (!Number.isInteger(input.display) || !runtime.displays.some(display => display.index === input.display)) throw new Error('Selected display is unavailable'); next.display = input.display; }
        for (const key of ['systemAudio', 'microphone', 'lanSharing']) if (key in input) next[key] = Boolean(input[key]);
        if (process.platform === 'win32') { next.systemAudio = false; next.microphone = false; }
        if ('publicBaseUrl' in input) {
          const value = String(input.publicBaseUrl).trim();
          if (value && !/^https:\/\/[^\s/]+\/?$/.test(value)) throw new Error('Public URL must be an HTTPS origin');
          next.publicBaseUrl = value;
        }
        const restart = ['quality', 'fps', 'display', 'systemAudio', 'microphone'].some(key => next[key] !== library.settings[key]);
        if (restart && runtime.recording) return json(res, 409, { error: 'Stop the long recording before changing capture settings' });
        library.settings = next;
        await save();
        if (restart && helper) { runtime.ready = false; restartRequested = true; sendHelper({ action: 'quit' }); }
        return json(res, 200, next);
      }
      if (parts[1] === 'clips' && parts[2]) {
        const clip = library.clips.find(item => item.id === parts[2]);
        if (!clip) return json(res, 404, { error: 'Clip not found' });
        if (parts[3] === 'file' && method === 'GET') return sendFile(req, res, fileFor(clip), 'private, max-age=3600');
        if (parts[3] === 'thumb' && method === 'GET') return clip.thumb ? sendFile(req, res, path.join(clipDir, clip.thumb), 'private, max-age=3600') : json(res, 404, { error: 'No thumbnail' });
        if (parts[3] === 'share' && method === 'POST') {
          const input = await body(req);
          clip.shareToken = input.enabled === false ? null : clip.shareToken || token();
          await save();
          return json(res, 200, publicClip(clip));
        }
        if (parts[3] === 'trim' && method === 'POST') {
          if (clip.type === 'screenshot') return json(res, 400, { error: 'Screenshots cannot be trimmed' });
          const input = await body(req);
          const start = Number(input.start), end = Number(input.end);
          if (!(start >= 0 && end > start && end <= clip.duration + 1)) return json(res, 400, { error: 'Invalid trim range' });
          const job = makeJob('trim');
          enqueue(job, async () => {
            const newId = id();
            const filename = `${newId}.mp4`;
            const output = path.join(clipDir, filename);
            await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(start), '-i', fileFor(clip), '-t', String(end - start), ...h264Encode, '-c:a', 'aac', '-movflags', '+faststart', output], 600000);
            const stat = await fsp.stat(output);
            const thumb = `${newId}.jpg`;
            await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '0.5', '-i', output, '-frames:v', '1', '-vf', 'scale=480:-2', path.join(clipDir, thumb)]).catch(() => {});
            const result = { id: newId, type: 'clip', title: `${clip.title} · Trim`, file: filename, thumb: fs.existsSync(path.join(clipDir, thumb)) ? thumb : null,
              createdAt: new Date().toISOString(), duration: Math.round(end - start), bytes: stat.size, favorite: false, tags: [...clip.tags], shareToken: null };
            library.clips.unshift(result); await save(); return result;
          });
          return json(res, 202, job);
        }
        if (parts.length === 3 && method === 'PATCH') {
          const input = await body(req);
          if ('title' in input) clip.title = String(input.title).trim().slice(0, 100) || clip.title;
          if ('favorite' in input) clip.favorite = Boolean(input.favorite);
          if ('tags' in input) clip.tags = Array.isArray(input.tags) ? input.tags.map(tag => String(tag).trim().slice(0, 24)).filter(Boolean).slice(0, 8) : clip.tags;
          await save(); return json(res, 200, publicClip(clip));
        }
        if (parts.length === 3 && method === 'DELETE') {
          library.clips = library.clips.filter(item => item.id !== clip.id);
          await save();
          await Promise.all([fsp.rm(fileFor(clip), { force: true }), clip.thumb && clip.thumb !== clip.file && fsp.rm(path.join(clipDir, clip.thumb), { force: true })].filter(Boolean));
          return json(res, 200, { ok: true });
        }
      }
      return json(res, 404, { error: 'API route not found' });
    }
    if (method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    const file = parts.length === 0 ? 'index.html' : parts.join('/');
    if (!['index.html', 'app.js', 'style.css', 'logo.svg'].includes(file)) return json(res, 404, { error: 'Not found' });
    return sendFile(req, res, path.join(publicDir, file));
  } catch (error) {
    console.error(error);
    json(res, error instanceof SyntaxError ? 400 : 500, { error: error.message });
  }
}
const server = http.createServer((req, res) => handleRequest(req, res));
const shareServer = http.createServer((req, res) => handleRequest(req, res, true));
server.on('error', error => { console.error(`Cannot start the local server: ${error.message}`); process.exitCode = 1; });
server.listen(port, process.env.CMS_HOST || '0.0.0.0', () => console.log(`Clip My Screen: http://localhost:${port}`));
shareServer.on('error', error => { console.error(`Cannot start the share server: ${error.message}`); process.exitCode = 1; });
shareServer.listen(sharePort, '127.0.0.1');
process.on('SIGTERM', () => { stopTunnel(); if (helper) sendHelper({ action: 'quit' }); shareServer.close(); server.close(() => process.exit(0)); });
