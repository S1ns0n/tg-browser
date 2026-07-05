const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startTunnel: (config) => ipcRenderer.invoke('start-tunnel', config),
    getTunnelStatus: () => ipcRenderer.invoke('get-tunnel-status'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getConfig: () => ipcRenderer.invoke('get-config'),
    openSettings: () => {
        // Вызываем без передачи объекта
        ipcRenderer.send('open-settings');
    }
});