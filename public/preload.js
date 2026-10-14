const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  windowAction: (action) => ipcRenderer.invoke('window-action', action),
  setFullscreen: (enabled) => ipcRenderer.invoke('set-fullscreen', enabled),
  getFullscreen: () => ipcRenderer.invoke('get-fullscreen'),
  onFullscreenChange: (callback) => {
    const listener = (_event, enabled) => callback(enabled);
    ipcRenderer.on('fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('fullscreen-changed', listener);
  },
  fetchM3U: (url) => ipcRenderer.invoke('fetch-m3u', url),
  fetchEPG: (url) => ipcRenderer.invoke('fetch-epg', url),
  fetchJSON: (url, options = {}) => ipcRenderer.invoke('fetch-json', url, options),
  getPlaylistCache: () => ipcRenderer.invoke('get-playlist-cache'),
  setPlaylistCache: (cache) => ipcRenderer.invoke('set-playlist-cache', cache),
});
