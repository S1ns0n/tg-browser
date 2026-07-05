const { ipcMain } = require('electron');

class IPCHandlers {
    constructor(config, sshTunnel, mainWindow, loginWindow) {
        this.config = config;
        this.sshTunnel = sshTunnel;
        this.mainWindow = mainWindow;
        this.loginWindow = loginWindow;
        
        this._register();
    }

    _register() {
        ipcMain.handle('start-tunnel', async (event, userConfig) => {
            try {
                this.config.appUrl = userConfig.appUrl || this.config.appUrl;
                this.config.vps.host = userConfig.vpsHost || this.config.vps.host;
                this.config.vps.port = userConfig.vpsPort || this.config.vps.port;
                this.config.vps.username = userConfig.vpsUsername || this.config.vps.username;
                this.config.proxy.host = userConfig.proxyHost || this.config.proxy.host;
                this.config.proxy.port = userConfig.proxyPort || this.config.proxy.port;
                
                this.config.saveFullConfig(userConfig);
                this.sshTunnel.updateConfig(this.config);
                
                await this.sshTunnel.start(userConfig.vpsPassword);
                
                this.loginWindow.close();
                this.mainWindow.create();
                
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('get-config', () => {
            return {
                appUrl: this.config.appUrl,
                vpsHost: this.config.vps.host,
                vpsPort: this.config.vps.port,
                vpsUsername: this.config.vps.username,
                proxyHost: this.config.proxy.host,
                proxyPort: this.config.proxy.port,
                hasPassword: !!this.config.vps.password
            };
        });

        ipcMain.handle('get-tunnel-status', () => {
            return this.sshTunnel.getStatus();
        });

        ipcMain.handle('open-settings', async () => {
            // Останавливаем туннель
            await this.sshTunnel.stop();
            
            // Закрываем основное окно
            this.mainWindow.close();
            
            // Открываем окно входа (настроек)
            this.loginWindow.create();
        });
    }
}

module.exports = IPCHandlers;