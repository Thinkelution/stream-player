const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const isDev = require('electron-is-dev');
const axios = require('axios');

const PLAYLIST_TIMEOUT_MS = 60000;
const EPG_TIMEOUT_MS = 20000;
const JSON_TIMEOUT_MS = 60000;

const playerHeaders = {
  'User-Agent': 'IPTVSmartersPro',
  Accept: 'application/json,text/plain,*/*',
};

const playlistCachePath = () => path.join(app.getPath('userData'), 'playlist-cache.json');

let mainWindow;
let windowsFullscreen = false;
let windowedState = null;
const isPlayerFullscreen = () => process.platform === 'win32'
  ? windowsFullscreen : Boolean(mainWindow?.isFullScreen());
const notifyFullscreen = () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('fullscreen-changed', isPlayerFullscreen());
};
const setPlayerFullscreen = (enabled) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  enabled = Boolean(enabled);
  if (process.platform !== 'win32') {
    mainWindow.setFullScreen(enabled);
    return mainWindow.isFullScreen();
  }
  // Avoid Chromium's native Windows fullscreen transitions: Explorer can retain
  // duplicate Alt+Tab thumbnails even when there is only one BrowserWindow.
  // Keep the same frameless HWND and change its bounds without stealing focus.
  if (windowsFullscreen === enabled) return enabled;
  if (enabled) {
    windowedState = { bounds: mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized() };
    const display = screen.getDisplayMatching(mainWindow.getBounds());
    windowsFullscreen = true;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    mainWindow.setResizable(false);
    mainWindow.setBounds(display.bounds);
  } else {
    windowsFullscreen = false;
    mainWindow.setResizable(true);
    if (windowedState) {
      mainWindow.setBounds(windowedState.bounds);
      if (windowedState.maximized) mainWindow.maximize();
    }
    windowedState = null;
  }
  notifyFullscreen();
  return windowsFullscreen;
};
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

const createWindow = () => {
  if (mainWindow && !mainWindow.isDestroyed()) return;
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    frame: process.platform !== 'win32',
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  if (process.platform !== 'darwin') mainWindow.setMenu(null);
  mainWindow.loadURL(startUrl);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.on('enter-full-screen', notifyFullscreen);
  mainWindow.on('leave-full-screen', notifyFullscreen);
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    if (input.key === 'F11' || (input.key === 'Escape' && isPlayerFullscreen())) {
      event.preventDefault();
      setPlayerFullscreen(input.key === 'F11' && !isPlayerFullscreen());
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    windowsFullscreen = false;
    windowedState = null;
  });
};

if (ownsInstance) app.on('ready', createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

ipcMain.handle('fetch-m3u', async (event, url) => {
  try {
    const response = await axios.get(url, { timeout: PLAYLIST_TIMEOUT_MS, headers: playerHeaders });
    return response.data;
  } catch (error) {
    console.error('Error fetching M3U:', error);
    throw error;
  }
});

ipcMain.handle('fetch-epg', async (event, url) => {
  try {
    const response = await axios.get(url, { timeout: EPG_TIMEOUT_MS, headers: playerHeaders });
    return response.data;
  } catch (error) {
    console.error('Error fetching EPG:', error);
    throw error;
  }
});

ipcMain.handle('fetch-json', async (event, url, options = {}) => {
  try {
    const response = await axios.get(url, { timeout: options.timeout || JSON_TIMEOUT_MS, headers: playerHeaders });
    return response.data;
  } catch (error) {
    console.error('Error fetching JSON:', error);
    throw error;
  }
});


ipcMain.handle('get-playlist-cache', async () => {
  try {
    const text = await fs.readFile(playlistCachePath(), 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error?.code !== 'ENOENT') console.warn('Unable to read playlist cache:', error);
    return null;
  }
});

ipcMain.handle('set-playlist-cache', async (event, cache) => {
  try {
    await fs.mkdir(path.dirname(playlistCachePath()), { recursive: true });
    await fs.writeFile(playlistCachePath(), JSON.stringify(cache), 'utf8');
    return true;
  } catch (error) {
    console.warn('Unable to write playlist cache:', error);
    return false;
  }
});

ipcMain.handle('set-fullscreen', (event, enabled) => {
  if (event.sender !== mainWindow?.webContents) return false;
  return setPlayerFullscreen(enabled);
});
ipcMain.handle('get-fullscreen', () => isPlayerFullscreen());

ipcMain.handle('window-action', (event, action) => {
  if (event.sender !== mainWindow?.webContents) return;
  if (action === 'minimize') mainWindow.minimize();
  if (action === 'maximize' && !isPlayerFullscreen()) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
  if (action === 'close') mainWindow.close();
});
