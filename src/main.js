const { app } = require('electron');
const path = require('path');
const Config = require(path.join(__dirname, 'config.js'));
const SSHTunnel = require(path.join(__dirname, 'tunnel', 'ssh-tunnel.js'));
const MainWindow = require(path.join(__dirname, 'windows', 'main-window.js'));
const LoginWindow = require(path.join(__dirname, 'windows', 'login-window.js'));
const IPCHandlers = require(path.join(__dirname, 'ipc', 'ipc-handlers.js'));

class Application {
    constructor() {
        this.config = null;
        this.sshTunnel = null;
        this.mainWindow = null;
        this.loginWindow = null;
    }

    async start() {
        this.config = new Config();
        this.sshTunnel = new SSHTunnel(this.config);
        this.mainWindow = new MainWindow(this.config);
        this.loginWindow = new LoginWindow();
        
        new IPCHandlers(
            this.config, 
            this.sshTunnel, 
            this.mainWindow, 
            this.loginWindow
        );

        if (this.config.vps.password) {
            try {
                await this.sshTunnel.start(this.config.vps.password);
                this.mainWindow.create();
            } catch (error) {
                console.error('Авто-подключение не удалось:', error.message);
                this.loginWindow.create();
            }
        } else {
            this.loginWindow.create();
        }
    }

    async stop() {
        await this.sshTunnel.stop();
    }
}

const appInstance = new Application();

app.whenReady().then(() => {
    appInstance.start();
});

app.on('window-all-closed', async () => {
    await appInstance.stop();
    app.quit();
});

app.on('before-quit', async () => {
    await appInstance.stop();
});