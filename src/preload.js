const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Туннель
    startTunnel: (config) => ipcRenderer.invoke('start-tunnel', config),
    getTunnelStatus: () => ipcRenderer.invoke('get-tunnel-status'),
    
    // Конфиг
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getConfig: () => ipcRenderer.invoke('get-config')
});