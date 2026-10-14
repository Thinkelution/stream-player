// Runs against an isolated profile; never reads the user's saved provider settings.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'openstreamplayer-smoke-'));
app.setPath('userData', profile);
process.env.ELECTRON_IS_DEV = '0';
require('../public/electron');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  try {
    assert.ok(fs.existsSync(path.join(__dirname, '../build/index.html')), 'Run npm run react-build first');
    await delay(1200);
    const win = BrowserWindow.getAllWindows()[0];
    assert.ok(win);
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('h1')?.textContent"), 'OpenStreamPlayer');
    for (const label of ['Movies', 'Series', 'Player / Live']) {
      await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('nav button')).find(button => button.textContent === ${JSON.stringify(label)}).click()`);
      await delay(100);
      if (label !== 'Player / Live') assert.equal(await win.webContents.executeJavaScript("document.querySelector('.vod-browser h2')?.textContent"), label);
    }
    for (let cycle = 0; cycle < 4; cycle++) {
      await win.webContents.executeJavaScript('window.electronAPI.setFullscreen(true)');
      await delay(250);
      win.minimize();
      await delay(100);
      win.restore();
      win.focus();
      await delay(100);
      assert.equal(BrowserWindow.getAllWindows().length, 1);
      assert.equal(BrowserWindow.getAllWindows()[0], win);
      await win.webContents.executeJavaScript('window.electronAPI.setFullscreen(false)');
      await delay(250);
    }
    console.log('PASS: four fullscreen/minimize/restore cycles retain the same single window.');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
