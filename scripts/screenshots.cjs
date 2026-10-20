// Render the real dashboard with deterministic demo metadata. No recorder, user
// library, desktop capture, login item, permission request, or external network.
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs', 'images');
const clips = [
  ['small-fix', 'A tiny bug, a satisfying fix', 'clip', 60, true],
  ['design-review', 'Design review · interaction study', 'screenshot', 0, true],
  ['one-more-run', 'One more run', 'session', 188, false],
  ['prototype', 'That prototype finally works', 'clip', 300, false],
  ['walkthrough', 'A quick walkthrough for the team', 'clip', 60, false],
  ['color-study', 'A little color exploration', 'screenshot', 0, true]
].map(([id, title, type, duration, favorite], i) => ({ id, title, type, duration, favorite,
  createdAt: new Date(Date.now() - (i + 1) * 600000).toISOString(),
  bytes: (12 + i * 8) * 1024 * 1024, tags: ['demo'], thumb: `${id}.svg`, shareUrl: null }));
const status = { paused: true, ready: false, recording: null, error: '', platform: 'darwin',
  bufferAvailableSeconds: 0, storageBytes: clips.reduce((n,c) => n+c.bytes, 0),
  dataDir: '~/Movies/Clip My Screen', tunnelStatus: 'off', tunnelAvailable: false,
  displays: [{index: 0, main: true, width: 2560, height: 1440}],
  settings: { captureEnabled: false, clipSeconds: 60, quality: 1080, fps: 30, display: 0,
    systemAudio: true, microphone: false, lanSharing: true, publicBaseUrl: '' } };
function thumbnail(id) {
  const index = clips.findIndex(c => c.id === id);
  const palettes = [['#29263e','#a68cff','#f5cc74'],['#efc3ac','#543e69','#faf1df'],['#10333e','#54d9c0','#edbf62']];
  const [bg,accent,ink] = palettes[index % 3];
  let art;
  if (index % 3 === 0) art = `<rect x="55" y="36" width="530" height="290" rx="12" fill="#181824"/><circle cx="76" cy="55" r="4" fill="#e27b8d"/><circle cx="91" cy="55" r="4" fill="${ink}"/><circle cx="106" cy="55" r="4" fill="#66cba7"/><path d="M55 75H585" stroke="#353244"/><text x="85" y="112" fill="#b3a3d3" font-size="14" font-family="monospace">replay.js</text><g stroke-linecap="round" stroke-width="9"><path d="M85 147H240M100 178H195M100 209H290M100 240H228M85 271H180" stroke="${accent}"/><path d="M261 147H390M218 178H445M313 209H475M250 240H351" stroke="#59516a"/></g><rect x="407" y="270" width="145" height="30" rx="15" fill="#294638"/><text x="479" y="290" text-anchor="middle" fill="#98dcb5" font-size="13" font-family="sans-serif">all checks passed</text>`;
  else if (index % 3 === 1) art = `<rect x="55" y="35" width="530" height="292" rx="14" fill="#faf3e9"/><rect x="55" y="35" width="143" height="292" rx="14" fill="${accent}"/><circle cx="87" cy="69" r="13" fill="${bg}"/><g stroke="#d5c4da" stroke-width="7" stroke-linecap="round"><path d="M78 113H164M78 143H141M78 173H155M78 203H132"/></g><rect x="225" y="65" width="199" height="18" rx="7" fill="${accent}"/><rect x="225" y="102" width="329" height="75" rx="12" fill="${bg}"/><circle cx="263" cy="139" r="18" fill="${accent}"/><path d="M305 128H516M305 148H451" stroke="#c28e79" stroke-width="8" stroke-linecap="round"/><rect x="225" y="199" width="153" height="96" rx="12" fill="#e4d9ea"/><rect x="400" y="199" width="153" height="96" rx="12" fill="#f1d3a1"/>`;
  else art = `<defs><linearGradient id="road" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#234455"/><stop offset="1" stop-color="#151827"/></linearGradient></defs><circle cx="459" cy="102" r="48" fill="${ink}"/><path d="M0 193L130 88L263 199L371 122L523 206L640 139V360H0Z" fill="#225567"/><path d="M0 251L159 169L303 242L469 164L640 259V360H0Z" fill="#153944"/><path d="M287 217L349 217L523 360H116Z" fill="url(#road)"/><path d="M320 229V256M320 280V330" stroke="${ink}" stroke-width="7"/><path d="M287 217L116 360M349 217L523 360" stroke="${accent}" stroke-width="5"/><rect x="282" y="278" width="77" height="45" rx="10" fill="${ink}"/><rect x="292" y="284" width="57" height="16" rx="5" fill="#204153"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="${bg}"/>${art}</svg>`;
}
let server, window;
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  server = http.createServer(async (req,res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    if (url.pathname === '/api/status' || url.pathname === '/api/clips') {
      res.setHeader('Content-Type','application/json');
      return res.end(JSON.stringify(url.pathname.endsWith('status') ? status : clips));
    }
    const thumb = url.pathname.match(/^\/api\/clips\/([^/]+)\/(thumb|file)$/);
    if (thumb) { res.setHeader('Content-Type','image/svg+xml'); return res.end(thumbnail(thumb[1])); }
    const file = {'/':'index.html','/app.js':'app.js','/style.css':'style.css','/logo.svg':'logo.svg'}[url.pathname];
    if (!file) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
    res.end(await fs.readFile(path.join(root,'public',file)));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  window = new BrowserWindow({width:1440,height:1200,show:false,useContentSize:true,
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
  await window.loadURL(`http://127.0.0.1:${server.address().port}`);
  await window.webContents.executeJavaScript(`new Promise(resolve => { const poll = () => document.querySelectorAll('.clip-card').length ? resolve() : setTimeout(poll, 40); poll(); })`);
  await window.webContents.executeJavaScript(`document.querySelector('#top-time').textContent='DEMO LIBRARY · CAPTURE PAUSED'; document.fonts.ready`);
  await fs.mkdir(output,{recursive:true});
  const save = async name => { await new Promise(r=>setTimeout(r,350)); await fs.writeFile(path.join(output,`${name}.png`),(await window.webContents.capturePage()).toPNG()); };
  await save('dashboard');
  window.setContentSize(1440, 1000);
  await window.webContents.executeJavaScript(`document.querySelector('[data-page="library"]').click()`);
  await save('library');
  await window.webContents.executeJavaScript(`document.querySelector('#settings-open').click()`);
  await save('settings');
  console.log('Saved dashboard, library, and settings screenshots. Demo fixtures only; no screen capture.');
}).catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{window?.destroy();server?.close();app.quit();});
