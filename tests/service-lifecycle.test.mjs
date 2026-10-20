import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
async function freePair() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const first = net.createServer();
    await new Promise(resolve => first.listen(0, '127.0.0.1', resolve));
    const port = first.address().port;
    const second = net.createServer();
    const free = await new Promise(resolve => {
      second.once('error', () => resolve(false));
      second.listen(port + 1, '127.0.0.1', () => resolve(true));
    });
    await new Promise(resolve => first.close(resolve));
    if (free) { await new Promise(resolve => second.close(resolve)); return port; }
  }
  throw new Error('No test ports available');
}
test('shutdown waits for the one capture helper and exposes capture diagnostics', { timeout: 15000 }, async t => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'cms-lifecycle-'));
  await fs.writeFile(path.join(data, 'library.json'), JSON.stringify({ settings: { captureEnabled: true }, clips: [] }));
  const port = await freePair();
  const child = spawn(process.execPath, [path.join(root, 'server.mjs')], {
    cwd: root, env: { ...process.env, CMS_DATA_DIR: data, CMS_HOST: '127.0.0.1', CMS_PORT: String(port), CMS_NATIVE_HELPER: path.join(root, 'tests/fixtures/capture-helper.cjs') },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  const closed = once(child, 'close');
  t.after(async () => { if (child.exitCode === null) child.kill('SIGTERM'); await closed; await fs.rm(data, { recursive: true, force: true }); });
  let status;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { status = await (await fetch(`http://127.0.0.1:${port}/api/status`)).json(); if (status.ready) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  assert.ok(status?.ready, log);
  assert.equal(status.captureDiagnostics.segmentSeconds, 30);
  assert.equal(status.captureDiagnostics.queueDepth, 3);
  child.kill('SIGTERM');
  const [code] = await closed;
  assert.equal(code, 0, log);
  const marker = JSON.parse(await fs.readFile(path.join(data, '.buffer/helper-stopped.json')));
  assert.equal(marker.pid, status.captureDiagnostics.helperPid);
});

async function launchService(t, data, extra = {}) {
  const port = await freePair();
  const child = spawn(process.execPath, [path.join(root, 'server.mjs')], {
    cwd: root, env: { ...process.env, CMS_DISABLE_CAPTURE: '0', CMS_DATA_DIR: data, CMS_HOST: '127.0.0.1', CMS_PORT: String(port), CMS_NATIVE_HELPER: path.join(root, 'tests/fixtures/capture-helper.cjs'), ...extra },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  const closed = once(child, 'close');
  const stop = async () => { if (child.exitCode === null) child.kill('SIGTERM'); await closed; };
  t.after(stop);
  const request = async (route, value) => fetch(`http://127.0.0.1:${port}/api/${route}`, value === undefined ? {} : {
    method: route === 'settings' ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value)
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const status = await request('status'); if (status.ok) return { request, stop, log: () => log }; } catch {}
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error('Service did not start: ' + log);
}

test('first launch stays paused, blocks every capture route, and persists across restart', { timeout: 15000 }, async t => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'cms-paused-'));
  t.after(() => fs.rm(data, { recursive: true, force: true }));
  const service = await launchService(t, data);
  let status = await (await service.request('status')).json();
  assert.equal(status.paused, true);
  assert.equal(status.ready, false);
  for (const route of ['grab', 'recording', 'screenshot']) {
    assert.equal((await service.request(route, {})).status, 503, route);
  }
  assert.equal((await service.request('settings', { quality: 720, fps: 24 })).status, 200);
  assert.equal((await service.request('capture', { enabled: false })).status, 200);
  assert.equal((await service.request('capture', { enabled: 'true' })).status, 400);
  await assert.rejects(fs.access(path.join(data, '.buffer/helper-started.json')), { code: 'ENOENT' });
  await service.stop();
  const reopened = await launchService(t, data);
  status = await (await reopened.request('status')).json();
  assert.equal(status.paused, true);
  assert.equal(status.settings.captureEnabled, false);
  assert.equal(status.settings.quality, 720);
  await assert.rejects(fs.access(path.join(data, '.buffer/helper-started.json')), { code: 'ENOENT' });
  await reopened.stop();
});

test('forced paused launch overrides prior recording preference without starting a helper', { timeout: 15000 }, async t => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'cms-forced-pause-'));
  t.after(() => fs.rm(data, { recursive: true, force: true }));
  await fs.writeFile(path.join(data, 'library.json'), JSON.stringify({ settings: { captureEnabled: true }, clips: [] }));
  const service = await launchService(t, data, { CMS_START_PAUSED: '1' });
  assert.equal((await (await service.request('status')).json()).paused, true);
  const saved = JSON.parse(await fs.readFile(path.join(data, 'library.json')));
  assert.equal(saved.settings.captureEnabled, false);
  await assert.rejects(fs.access(path.join(data, '.buffer/helper-started.json')), { code: 'ENOENT' });
  await service.stop();
});

test('explicit resume starts only the fake helper; pause waits for it and survives restart', { timeout: 15000 }, async t => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'cms-resume-'));
  t.after(() => fs.rm(data, { recursive: true, force: true }));
  const service = await launchService(t, data);
  assert.equal((await service.request('capture', { enabled: true })).status, 200);
  let status;
  for (let i = 0; i < 100; i++) {
    status = await (await service.request('status')).json();
    if (status.ready) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(status.ready, true, service.log());
  assert.equal(status.paused, false);
  assert.equal((await service.request('capture', { enabled: false })).status, 200);
  const marker = JSON.parse(await fs.readFile(path.join(data, '.buffer/helper-stopped.json')));
  assert.equal(marker.pid, status.captureDiagnostics.helperPid);
  status = await (await service.request('status')).json();
  assert.equal(status.paused, true);
  assert.equal(status.ready, false);
  assert.equal(status.captureDiagnostics, null);
  await service.stop();
  await fs.rm(path.join(data, '.buffer/helper-started.json'));
  const reopened = await launchService(t, data);
  assert.equal((await (await reopened.request('status')).json()).paused, true);
  await assert.rejects(fs.access(path.join(data, '.buffer/helper-started.json')), { code: 'ENOENT' });
  await reopened.stop();
});
