const { app, BrowserWindow, dialog, globalShortcut, Menu, nativeImage, screen, Tray } = require('electron');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const servicePort = Number(process.env.CMS_PORT || 3917);
const dashboard = `http://localhost:${servicePort}/`;
const statusUrl = `http://127.0.0.1:${servicePort}/api/status`;
if (process.env.CMS_APP_USER_DATA_DIR) {
  fs.mkdirSync(process.env.CMS_APP_USER_DATA_DIR, { recursive: true });
  app.setPath('userData', process.env.CMS_APP_USER_DATA_DIR);
}
let mainWindow;
let tray;
let trayTimer;
let lastTrayState;
let service;
let serviceFailures = 0;
let quitting = false;

async function serviceStatus() {
  try {
    const response = await fetch(statusUrl, { signal: AbortSignal.timeout(1500) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

async function serviceReady() {
  const status = await serviceStatus();
  return status?.desktopOwnerPid === process.pid;
}

function removeLegacyLoginService() {
  if (process.platform !== 'darwin') return;
  const plist = path.join(app.getPath('home'), 'Library', 'LaunchAgents', 'dev.jakedoes.clipmyscreen.plist');
  if (!fs.existsSync(plist) || !fs.readFileSync(plist, 'utf8').includes('/server.mjs')) return;
  try { execFileSync('launchctl', ['bootout', `gui/${process.getuid()}/dev.jakedoes.clipmyscreen`], { stdio: 'ignore' }); }
  catch { /* The service may already be stopped. */ }
  fs.rmSync(plist, { force: true });
}

function displays() {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((display, index) => {
    const scale = display.scaleFactor || 1;
    const bounds = display.bounds;
    const physical = process.platform === 'win32' ? screen.dipToScreenRect(null, bounds) : {
      x: Math.round(bounds.x * scale), y: Math.round(bounds.y * scale),
      width: Math.round(bounds.width * scale), height: Math.round(bounds.height * scale)
    };
    return {
      index, id: display.id, main: display.id === primaryId,
      width: physical.width, height: physical.height, captureBounds: physical
    };
  });
}

function startService() {
  const startedAt = Date.now();
  const project = app.getAppPath();
  const loginItem = app.isPackaged && !process.argv.includes('--no-login') ? app.getLoginItemSettings() : null;
  const developmentFfmpeg = path.join(project, 'vendor', 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'bin/ffmpeg');
  const ffmpeg = app.isPackaged
    ? path.join(process.resourcesPath, 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'bin/ffmpeg')
    : process.env.CMS_FFMPEG || (fs.existsSync(developmentFfmpeg) ? developmentFfmpeg : 'ffmpeg');
  const nativeHelper = app.isPackaged
    ? path.join(process.resourcesPath, 'Clip My Screen Capture.app', 'Contents', 'MacOS', 'clip-capture')
    : path.join(project, 'build', 'Clip My Screen Capture.app', 'Contents', 'MacOS', 'clip-capture');
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    CMS_DATA_DIR: process.env.CMS_DATA_DIR || path.join(app.getPath('videos'), 'Clip My Screen'),
    CMS_FFMPEG: ffmpeg,
    CMS_NATIVE_HELPER: nativeHelper,
    CMS_DESKTOP_OWNER_PID: String(process.pid),
    CMS_LOGIN_ITEM_SETTINGS: JSON.stringify(loginItem ? { openAtLogin: loginItem.openAtLogin, status: loginItem.status } : null),
    ...(process.argv.includes('--paused') ? { CMS_START_PAUSED: '1' } : {}),
    CMS_DISPLAYS: JSON.stringify(displays())
  };
  const logPath = path.join(app.getPath('userData'), 'service.log');
  const log = chunk => { try { fs.appendFileSync(logPath, chunk); } catch {} };
  service = spawn(process.execPath, [path.join(project, 'server.mjs')], {
    cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  service.stdout.on('data', log);
  service.stderr.on('data', log);
  service.on('error', error => log(`${error.stack || error}\n`));
  service.on('close', () => {
    service = null;
    if (quitting) return;
    if (Date.now() - startedAt > 60_000) serviceFailures = 0;
    serviceFailures += 1;
    const delay = Math.min(180_000, 3000 * 2 ** Math.min(serviceFailures - 1, 6));
    setTimeout(async () => { if (!quitting && !(await serviceReady())) startService(); }, delay);
  });
}

async function post(route, payload = {}) {
  try {
    const response = await fetch(`http://127.0.0.1:${servicePort}/api/${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `Capture request failed (${response.status})`);
    }
  } catch (error) { dialog.showErrorBox('Capture unavailable', error.message); }
}

async function refreshTrayMenu() {
  const status = await serviceStatus();
  if (!tray || quitting) return;
  const state = status?.paused ? 'Capture paused' : status?.ready ? `Capturing display ${status.settings.display + 1}`
    : status?.error ? 'Capture needs attention' : 'Starting capture';
  if (state === lastTrayState) return;
  lastTrayState = state;
  tray.setToolTip(`Clip My Screen · ${state}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: state, enabled: false },
    { type: 'separator' },
    { label: 'Open Clip My Screen', click: showWindow },
    { label: status?.paused ? 'Resume capture' : 'Pause capture', click: async () => { await post('capture', { enabled: Boolean(status?.paused) }); await refreshTrayMenu(); } },
    { type: 'separator' },
    { label: 'Clip last 1 minute', enabled: Boolean(status?.ready), click: () => post('grab', { seconds: 60 }) },
    { label: 'Clip last 5 minutes', enabled: Boolean(status?.ready), click: () => post('grab', { seconds: 300 }) },
    { label: 'Clip last 15 minutes', enabled: Boolean(status?.ready), click: () => post('grab', { seconds: 900 }) },
    { type: 'separator' },
    { label: 'Quit Clip My Screen', click: () => app.quit() }
  ]));
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), 'assets', 'tray.png'));
  tray = new Tray(process.platform === 'darwin' ? icon.resize({ width: 18, height: 18 }) : icon);
  if (process.platform === 'darwin') tray.setTitle('Clip');
  if (process.platform === 'win32') tray.on('double-click', showWindow);
  refreshTrayMenu();
  trayTimer = setInterval(refreshTrayMenu, 10_000);
}

function registerWindowsShortcuts() {
  const shortcuts = [
    ['CommandOrControl+Alt+1', 'grab', { seconds: 60 }],
    ['CommandOrControl+Alt+2', 'grab', { seconds: 300 }],
    ['CommandOrControl+Alt+3', 'grab', { seconds: 900 }],
    ['CommandOrControl+Shift+8', 'grab', {}],
    ['CommandOrControl+Shift+9', 'screenshot', {}],
    ['CommandOrControl+Shift+7', 'recording', {}]
  ];
  for (const [accelerator, route, payload] of shortcuts) globalShortcut.register(accelerator, () => post(route, payload));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380, height: 900, minWidth: 950, minHeight: 650,
    backgroundColor: '#101014', title: 'Clip My Screen',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  const contents = mainWindow.webContents;
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== new URL(dashboard).origin) event.preventDefault();
  });
  contents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    dialog.showMessageBox(mainWindow, {
      type: 'error', title: 'Clip My Screen could not open',
      message: 'The local dashboard is unavailable.',
      detail: `${description}\n${url}\n\nQuit and reopen Clip My Screen to retry.`
    });
  });
  mainWindow.loadURL(dashboard);
  mainWindow.on('close', event => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
      if (process.platform === 'darwin') app.dock.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function showWindow() {
  if (process.platform === 'darwin') app.dock.show();
  if (!mainWindow) createWindow();
  else { mainWindow.show(); mainWindow.focus(); }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    removeLegacyLoginService();
    if (app.isPackaged && !process.argv.includes('--no-login')) app.setLoginItemSettings({
      openAtLogin: true,
      ...(process.platform === 'win32' ? { path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath } : {})
    });
    const existing = await serviceStatus();
    if (existing && existing.desktopOwnerPid !== process.pid) {
      dialog.showErrorBox('Another recorder is running', 'A recorder outside this desktop app is using port 3917. Stop that recorder, then reopen Clip My Screen.');
      app.quit();
      return;
    }
    if (!existing) startService();
    for (let attempt = 0; attempt < 60 && !(await serviceReady()); attempt++) await new Promise(resolve => setTimeout(resolve, 500));
    if (!(await serviceReady())) {
      dialog.showErrorBox('Capture service unavailable', 'The recorder did not start. Reopen Clip My Screen to try again.');
      app.quit();
      return;
    }
    if (process.platform === 'win32') registerWindowsShortcuts();
    createTray();
    const loginLaunch = process.platform === 'darwin' && (app.getLoginItemSettings().wasOpenedAtLogin || process.argv.includes('--hidden'));
    if (loginLaunch) app.dock.hide();
    else createWindow();
    app.on('activate', showWindow);
  });
  app.on('before-quit', () => {
    quitting = true;
    clearInterval(trayTimer);
    if (service) {
      if (process.platform === 'win32') spawn('taskkill', ['/T', '/F', '/PID', String(service.pid)], { windowsHide: true });
      else service.kill('SIGTERM');
    }
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
