module.exports = {
  appId: 'dev.jakedoes.clipmyscreen',
  productName: 'Clip My Screen',
  directories: { output: 'dist' },
  asar: false,
  electronDist: 'node_modules/electron/dist',
  afterPack: './scripts/sign-local-mac.cjs',
  files: [
    'electron/**/*', 'server.mjs', 'capture-policy.mjs', 'video-encoding.mjs', 'public/**/*', 'windows/**/*', 'assets/tray.png',
    'package.json', '!**/node_modules/ffmpeg-static/ffmpeg*'
  ],
  extraResources: [
    { from: 'vendor/ffmpeg', to: 'ffmpeg' },
    ...(process.platform === 'darwin' ? [{ from: 'build/Clip My Screen Capture.app', to: 'Clip My Screen Capture.app' }] : [])
  ],
  mac: {
    target: ['dmg'], icon: 'assets/icon.icns', identity: null,
    minimumSystemVersion: '15.0', category: 'public.app-category.video',
    artifactName: 'Clip-My-Screen-macOS-${arch}.${ext}'
  },
  dmg: {
    title: 'Clip My Screen', window: { width: 610, height: 360 }, iconSize: 112,
    contents: [{ x: 160, y: 170, type: 'file' }, { x: 450, y: 170, type: 'link', path: '/Applications' }]
  },
  win: { target: ['nsis', 'portable'], icon: 'assets/icon.ico' },
  nsis: {
    artifactName: 'Clip-My-Screen-Windows-${arch}-Setup.${ext}',
    oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true,
    createDesktopShortcut: false, shortcutName: 'Clip My Screen'
  },
  portable: { artifactName: 'Clip-My-Screen-Windows-${arch}-Portable.${ext}' },
  npmRebuild: false
};
