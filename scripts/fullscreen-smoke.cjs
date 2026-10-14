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
    if (process.platform !== 'darwin') assert.equal(win.isMenuBarVisible(), false);
    const originalBounds = win.getBounds();
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('h1')?.textContent"), 'OpenStreamPlayer');
    for (const label of ['Movies', 'Series', 'Player / Live']) {
      await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('nav button')).find(button => button.textContent === ${JSON.stringify(label)}).click()`);
      await delay(100);
      if (label !== 'Player / Live') assert.equal(await win.webContents.executeJavaScript("document.querySelector('.vod-browser h2')?.textContent"), label);
    }
    // A moving canvas stream exercises video presentation without provider credentials.
    await win.webContents.executeJavaScript(`(() => {
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const ctx = canvas.getContext('2d');
      setInterval(() => {
        ctx.fillStyle = '#123456'; ctx.fillRect(0, 0, 1280, 720);
        ctx.fillStyle = '#ffffff'; ctx.font = '40px sans-serif';
        ctx.fillText('OpenStreamPlayer fullscreen regression test', 70, 150);
        ctx.fillText(new Date().toISOString(), 70, 230);
        ctx.fillRect((Date.now() / 8) % 1100, 350, 120, 120);
      }, 33);
      const shell = document.createElement('div'); shell.className = 'video-shell';
      shell.style.cssText = 'position:fixed;left:30px;top:200px;width:640px;height:360px;z-index:999;background:black';
      const video = document.createElement('video'); video.muted = true; video.autoplay = true;
      video.srcObject = canvas.captureStream(30); shell.appendChild(video); document.body.appendChild(shell);
      window.electronAPI.onFullscreenChange(full => {
        shell.style.cssText = full ? 'position:fixed;inset:0;width:100vw;height:100vh;z-index:999;background:black' : 'position:fixed;left:30px;top:200px;width:640px;height:360px;z-index:999;background:black';
      });
      return video.play();
    })()`);
    for (let cycle = 0; cycle < 4; cycle++) {
      await win.webContents.executeJavaScript('window.electronAPI.setFullscreen(true)');
      await delay(250);
      if (process.platform === 'win32') assert.equal(win.isFullScreen(), false, 'Windows must avoid native fullscreen');
      assert.equal(await win.webContents.executeJavaScript('window.electronAPI.getFullscreen()'), true);
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
    assert.deepEqual(win.getBounds(), originalBounds);
    win.maximize();
    await delay(200);
    await win.webContents.executeJavaScript('window.electronAPI.setFullscreen(true)');
    await win.webContents.executeJavaScript('window.electronAPI.setFullscreen(true)');
    await win.webContents.executeJavaScript('window.electronAPI.setFullscreen(false)');
    assert.equal(win.isMaximized(), true, 'Restore maximized state');
    win.unmaximize();
    if (process.argv.includes('--interactive')) {
      win.setTitle('OpenStreamPlayer fullscreen test');
      await win.webContents.executeJavaScript('window.electronAPI.setFullscreen(true)');
      console.log('READY: isolated fullscreen video test; F11/Escape toggles, close to exit.');
      return;
    }
    console.log('PASS: four fullscreen/minimize/restore cycles retain the same single window.');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
