const { spawnSync } = require('node:child_process');

// CRA embeds REACT_APP_* values in the public JavaScript bundle. Packaged apps
// must use Settings rather than ship this developer's local playlist credentials.
const result = spawnSync(process.execPath, [require.resolve('react-scripts/scripts/build')], {
  stdio: 'inherit',
  env: { ...process.env, REACT_APP_M3U_URL: '', REACT_APP_EPG_URL: '' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
