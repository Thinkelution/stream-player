const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const axios = require('axios');

const PLAYLIST_TIMEOUT_MS = 30000;
const EPG_TIMEOUT_MS = 20000;

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
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
    const response = await axios.get(url, { timeout: PLAYLIST_TIMEOUT_MS });
    return response.data;
  } catch (error) {
    console.error('Error fetching M3U:', error);
    throw error;
  }
});

ipcMain.handle('fetch-epg', async (event, url) => {
  try {
    const response = await axios.get(url, { timeout: EPG_TIMEOUT_MS });
    return response.data;
  } catch (error) {
    console.error('Error fetching EPG:', error);
    throw error;
  }
});
