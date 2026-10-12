const { app, BrowserWindow, dialog, globalShortcut, Menu, screen, Tray } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const dashboard = 'http://localhost:3917/';
const statusUrl = 'http://127.0.0.1:3917/api/status';
let mainWindow;
let tray;
let service;
let quitting = false;

async function serviceReady() {
  try {
    const response = await fetch(statusUrl, { signal: AbortSignal.timeout(1500) });
    const status = await response.json();
    return response.ok && typeof status.bufferSeconds === 'number';
  } catch { return false; }
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
  const project = app.getAppPath();
  const ffmpeg = app.isPackaged
    ? path.join(process.resourcesPath, 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'bin/ffmpeg')
    : process.env.CMS_FFMPEG || path.join(project, 'vendor', process.platform === 'win32' ? 'ffmpeg.exe' : 'bin/ffmpeg');
  const nativeHelper = app.isPackaged
    ? path.join(resources, 'Clip My Screen Capture.app', 'Contents', 'MacOS', 'clip-capture')
    : path.join(project, 'build', 'Clip My Screen Capture.app', 'Contents', 'MacOS', 'clip-capture');
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    CMS_DATA_DIR: path.join(app.getPath('videos'), 'Clip My Screen'),
    CMS_FFMPEG: ffmpeg,
    CMS_NATIVE_HELPER: nativeHelper,
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
    if (!quitting) setTimeout(async () => { if (!(await serviceReady())) startService(); }, 3000);
  });
}

async function post(route, payload = {}) {
  try {
    await fetch(`http://127.0.0.1:3917/api/${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
  } catch (error) { dialog.showErrorBox('Capture unavailable', error.message); }
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
  mainWindow.on('close', event => { if (!quitting) { event.preventDefault(); mainWindow.hide(); } });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function showWindow() {
  if (!mainWindow) createWindow();
  else { mainWindow.show(); mainWindow.focus(); }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    if (app.isPackaged) app.setLoginItemSettings({
      openAtLogin: true,
      ...(process.platform === 'win32' ? { path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath } : {})
    });
    if (!(await serviceReady())) startService();
    for (let attempt = 0; attempt < 60 && !(await serviceReady()); attempt++) await new Promise(resolve => setTimeout(resolve, 500));
    if (process.platform === 'win32') {
      registerWindowsShortcuts();
      tray = new Tray(path.join(app.getAppPath(), 'assets', 'tray.png'));
      tray.setToolTip('Clip My Screen');
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Open Clip My Screen', click: showWindow },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ]));
      tray.on('double-click', showWindow);
    }
    createWindow();
    app.on('activate', showWindow);
  });
  app.on('before-quit', () => {
    quitting = true;
    if (service) {
      if (process.platform === 'win32') spawn('taskkill', ['/T', '/F', '/PID', String(service.pid)], { windowsHide: true });
      else service.kill('SIGTERM');
    }
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
