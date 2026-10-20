const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../electron/main.cjs'), 'utf8');
async function startup({ atLogin = false, args = [] } = {}) {
  let windows = 0, dockHidden = false, loginSettings;
  const app = {
    isPackaged: true, requestSingleInstanceLock: () => true,
    on() {}, whenReady: () => Promise.resolve(),
    getPath: () => '/unused', setLoginItemSettings: value => { loginSettings = value; },
    getLoginItemSettings: () => ({ wasOpenedAtLogin: atLogin }),
    getAppPath: () => '/unused', dock: { hide: () => { dockHidden = true; } }
  };
  const electron = { app,
    BrowserWindow: class { constructor() { windows++; this.webContents = { setWindowOpenHandler() {}, on() {} }; } loadURL() {} on() {} },
    Tray: class { setTitle() {} setToolTip() {} setContextMenu() {} },
    nativeImage: { createFromPath: () => ({ resize() {} }) },
    Menu: { buildFromTemplate: value => value },
    dialog: { showErrorBox: assert.fail }
  };
  const context = vm.createContext({
    require: name => name === 'electron' ? electron : name === 'node:fs' ? { existsSync: () => false } : require(name),
    process: { platform: 'darwin', pid: 42, env: {}, argv: ['app', ...args] },
    fetch: async () => ({ ok: true, json: async () => ({ desktopOwnerPid: 42, ready: true, settings: { display: 0 } }) }),
    AbortSignal, URL, setInterval: () => 1, clearInterval() {}, setTimeout
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { windows, dockHidden, loginSettings };
}
test('supported macOS login configuration starts in the menu bar without a renderer', async () => {
  const result = await startup({ atLogin: true });
  assert.equal(result.windows, 0);
  assert.equal(result.dockHidden, true);
  assert.equal(result.loginSettings.openAtLogin, true);
  assert.equal(result.loginSettings.args, undefined); // Electron supports login args on Windows only.
});
test('explicit launch opens a dashboard; --hidden suppresses it', async () => {
  assert.equal((await startup()).windows, 1);
  assert.equal((await startup({ args: ['--hidden'] })).windows, 0);
});
test('local validation can run without registering a login item', async () => {
  const result = await startup({ args: ['--paused', '--no-login'] });
  assert.equal(result.loginSettings, undefined);
  assert.equal(result.windows, 1);
});
