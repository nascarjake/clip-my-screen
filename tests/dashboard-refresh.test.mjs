import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const refreshSource = source.slice(source.indexOf('let refreshPending;'), source.indexOf('function renderStatus()'));
test('coalesces overlapping requests and avoids rebuilding unchanged clip cards', async () => {
  let calls = 0, renders = 0, statusRenders = 0;
  const state = { status: null, clips: [] };
  const context = vm.createContext({ state, api: async route => {
    calls++; await new Promise(resolve => setTimeout(resolve, 10));
    return route.endsWith('/status') ? { ready: true } : [];
  }, renderClips: () => renders++, renderStatus: () => statusRenders++, toast: assert.fail });
  vm.runInContext(refreshSource, context);
  await Promise.all([context.refresh(), context.refresh(), context.refresh()]);
  assert.equal(calls, 2);
  assert.equal(renders, 1); // Initial empty state must render too.
  await context.refresh();
  assert.equal(calls, 4);
  assert.equal(renders, 1);
  assert.equal(statusRenders, 2);
});
test('hidden dashboard makes no scheduled requests; showing it refreshes immediately', async () => {
  let tick, visible, calls = 0;
  const document = { hidden: true, addEventListener: (name, callback) => {
    assert.equal(name, 'visibilitychange'); visible = callback;
  } };
  const context = vm.createContext({ document, setInterval: callback => { tick = callback; }, refresh: () => calls++ });
  vm.runInContext(source.slice(source.lastIndexOf('setInterval(')), context);
  for (let i = 0; i < 12; i++) tick();
  assert.equal(calls, 0);
  document.hidden = false;
  visible(); tick();
  assert.equal(calls, 2);
});

test('paused dashboard states that recording is off and disables capture actions', () => {
  const elements = new Map();
  const element = name => {
    if (!elements.has(name)) elements.set(name, { style: {}, classList: { toggle() {} } });
    return elements.get(name);
  };
  const controls = [{}, {}, {}];
  const context = vm.createContext({
    state: { status: { paused: true, ready: false, settings: { clipSeconds: 30, quality: 1080, fps: 30, display: 0 }, displays: [], storageBytes: 0 }, clips: [] },
    $: element, $$: () => controls, clipLength: () => '30 sec', displayLabel: () => 'Display 1', bytes: () => '0 KB'
  });
  vm.runInContext(source.slice(source.indexOf('function renderStatus()'), source.indexOf('function emptyState(')), context);
  context.renderStatus();
  assert.equal(element('#capture-label').textContent, 'CAPTURE PAUSED');
  assert.equal(element('#capture-headline').textContent, 'Your screen is not being recorded.');
  assert.equal(element('#capture-toggle').textContent, 'Resume capture');
  assert.equal(element('#hero-clip').disabled, true);
  assert.ok(controls.every(control => control.disabled));
});
