module.exports = {
  appId: 'dev.jakedoes.clipmyscreen',
  productName: 'Clip My Screen',
  directories: { output: 'dist' },
  asar: false,
  electronDist: 'node_modules/electron/dist',
  files: [
    'electron/**/*', 'server.mjs', 'public/**/*', 'windows/**/*', 'assets/tray.png',
    'package.json', '!**/node_modules/ffmpeg-static/ffmpeg*'
  ],
  extraResources: [
    { from: 'vendor/ffmpeg', to: 'ffmpeg' },
    ...(process.platform === 'darwin' ? [{ from: 'build/Clip My Screen Capture.app', to: 'Clip My Screen Capture.app' }] : [])
  ],
  mac: { target: 'dir', icon: 'assets/icon.icns', identity: null, category: 'public.app-category.video' },
  win: { target: 'portable', icon: 'assets/icon.ico' },
  portable: { artifactName: '${productName}-${version}-Windows-${arch}-portable.exe' },
  npmRebuild: false
};
