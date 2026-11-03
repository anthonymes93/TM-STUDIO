const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('tmStudio', {
  saveProject: (data) => ipcRenderer.invoke('project:save', data),
  openProject: () => ipcRenderer.invoke('project:open'),
  importAudio: () => ipcRenderer.invoke('audio:import'),
});
