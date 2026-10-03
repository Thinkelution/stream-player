const { signAsync } = require('@electron/osx-sign');
const { execFileSync } = require('node:child_process');

// Seal the entire Electron bundle before electron-builder creates the DMG/ZIP.
// Ad-hoc signatures support manual approval, but do not provide notarization.
exports.default = async (options) => {
  const identity = options.identity || '-';
  console.log(`Signing macOS app with ${identity === '-' ? 'an ad-hoc identity (manual approval required)' : 'the configured certificate'}`);
  await signAsync({
    ...options,
    identity,
    identityValidation: false,
    ...(identity === '-' ? {
      preAutoEntitlements: false,
      preEmbedProvisioningProfile: false,
    } : {}),
  });
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', options.app], {
    stdio: 'inherit',
  });
};
