const path = require('node:path');

// electron-builder copies/renames Electron and adds resources. Its old linker
// signature no longer seals that bundle. Seal the final local build ad hoc;
// never discover or use a personal certificate, keychain, or provisioning profile.
module.exports = async context => {
  if (context.electronPlatformName !== 'darwin') return;
  const { signAsync } = require('@electron/osx-sign');
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  await signAsync({
    app, platform: 'darwin', identity: '-', identityValidation: false,
    preAutoEntitlements: false, preEmbedProvisioningProfile: false,
    optionsForFile: file => ({
      // Electron needs JIT; native capture/FFmpeg need no added entitlements.
      entitlements: file.includes('/Contents/Resources/') ? [] : ['com.apple.security.cs.allow-jit'],
      hardenedRuntime: false, timestamp: 'none'
    })
  });
  console.log('Verified local ad-hoc app signature (no Developer ID or notarization).');
};
