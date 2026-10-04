const { app, BrowserWindow, Menu, ipcMain } = require('electron');
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

const createWindow = () => {
  mainWindow = new BrowserWindow({
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

  mainWindow.loadURL(startUrl);
  if (isDev) mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', createWindow);
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
