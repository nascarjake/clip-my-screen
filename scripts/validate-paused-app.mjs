// Bounded packaged-app smoke test. Never starts a recorder or registers login.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const windows = process.platform === 'win32';
const defaultBinary = windows ? 'dist/win-unpacked/Clip My Screen.exe'
  : `dist/${process.arch === 'arm64' ? 'mac-arm64' : 'mac'}/Clip My Screen.app/Contents/MacOS/Clip My Screen`;
const binary = path.resolve(root, process.argv[2] || defaultBinary);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let port;
for (let attempt = 0; attempt < 20 && !port; attempt++) {
  const first = net.createServer();
  await new Promise(resolve => first.listen(0, '127.0.0.1', resolve));
  const candidate = first.address().port;
  const second = net.createServer();
  const free = await new Promise(resolve => {
    second.once('error', () => resolve(false));
    second.listen(candidate + 1, '127.0.0.1', () => resolve(true));
  });
  await new Promise(resolve => first.close(resolve));
  if (free) { await new Promise(resolve => second.close(resolve)); port = candidate; }
}
assert.ok(port, 'No isolated test port pair available');
const endpoint = `http://127.0.0.1:${port}/api/status`;
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cms-paused-app-'));
const child = spawn(binary, ['--paused', '--no-login', '--hidden'], {
  env: { ...process.env, CMS_DATA_DIR: directory, CMS_APP_USER_DATA_DIR: path.join(directory, '.app-profile'), CMS_PORT: String(port), CMS_HOST: '127.0.0.1', CMS_DISABLE_CAPTURE: '1', CMS_START_PAUSED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
});
let log = '', servicePid;
child.stdout.on('data', data => { log += data; });
child.stderr.on('data', data => { log += data; });
const sample = () => {
  if (windows) return null;
  const records = execFileSync('ps', ['-axo', 'pid,ppid,pcpu,rss,comm'], { encoding: 'utf8' }).split('\n').flatMap(line => {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(.+)$/);
    return m ? [{ pid: +m[1], ppid: +m[2], cpuPercent: +m[3], residentKiB: +m[4], executable: m[5] }] : [];
  });
  const owned = new Set([child.pid]);
  for (let i = 0; i < 6; i++) for (const record of records) if (owned.has(record.ppid)) owned.add(record.pid);
  const processes = records.filter(record => owned.has(record.pid));
  assert.equal(processes.some(record => record.executable.endsWith('/clip-capture')), false, 'Unexpected capture helper owned by test app');
  return { processes, sumCpuPercent: processes.reduce((sum, record) => sum + record.cpuPercent, 0), sumResidentKiB: processes.reduce((sum, record) => sum + record.residentKiB, 0) };
};
try {
  let status;
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const current = await (await fetch(endpoint, { signal: AbortSignal.timeout(500) })).json();
      if (current.desktopOwnerPid === child.pid) { status = current; break; }
    } catch {}
    if (child.exitCode !== null) throw new Error(`App exited ${child.exitCode}: ${log}`);
    await wait(100);
  }
  assert.equal(status?.desktopOwnerPid, child.pid, log || 'App did not start');
  servicePid = status.servicePid;
  assert.equal(status.paused, true);
  assert.equal(status.ready, false);
  assert.ok(status.captureDiagnostics == null);
  assert.equal(status.loginItemAtStartup, null);
  await wait(2000);
  const first = sample();
  await wait(3000);
  const second = sample();
  status = await (await fetch(endpoint)).json();
  assert.equal(status.paused, true);
  assert.equal(status.ready, false);
  const saved = JSON.parse(await fs.readFile(path.join(directory, 'library.json')));
  assert.equal(saved.settings.captureEnabled, false);
  assert.deepEqual(await fs.readdir(path.join(directory, '.buffer')), []);
  const result = { platform: process.platform, arch: process.arch, captureStarted: false, paused: true, bufferFiles: 0, loginRegistrationSkipped: true, samples: [first, second].filter(Boolean) };
  await fs.mkdir(path.join(root, 'build/performance'), { recursive: true });
  await fs.writeFile(path.join(root, 'build/performance/paused-validation.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (windows && child.exitCode === null) {
    try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  } else child.kill('SIGTERM');
  if (servicePid) try { process.kill(servicePid, 'SIGTERM'); } catch {}
  await wait(1000);
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(path.join(root, 'build/performance'), { recursive: true });
  await fs.writeFile(path.join(root, 'build/performance/paused-app.log'), log);
}
