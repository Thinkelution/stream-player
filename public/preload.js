const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  fetchM3U: (url) => ipcRenderer.invoke('fetch-m3u', url),
  fetchEPG: (url) => ipcRenderer.invoke('fetch-epg', url),
});
