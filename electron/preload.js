const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ElectronAPI', {
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  platform: process.platform,
});
