const { BrowserWindow } = require('electron');
const path = require('path');

class MainWindow {
    constructor(config) {
        this.config = config;
        this.window = null;
    }

    create() {
        this.window = new BrowserWindow({
            width: this.config.window.width,
            height: this.config.window.height,
            title: 'Telegram',
            autoHideMenuBar: true,
            center: true,
            webPreferences: {
                preload: path.join(__dirname, '..', 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false
            }
        });

        // Так же как в test-proxy
        this.window.webContents.session.setCertificateVerifyProc((request, callback) => {
            callback(0);
        });

        const proxyRules = this.config.getProxyString();
        
        this.window.webContents.session.setProxy({
            proxyRules: proxyRules,
            proxyBypassRules: ''
        }).then(() => {
            console.log('Прокси настроен, загружаем:', this.config.appUrl);
            this.window.loadURL(this.config.appUrl);
        }).catch((err) => {
            console.error('Ошибка прокси:', err);
            this.window.loadURL(this.config.appUrl);
        });

        this.window.webContents.on('did-finish-load', () => {
            console.log('Страница загружена');
        });

        this.window.webContents.on('did-fail-load', (event, errorCode, errorDescription, url) => {
            console.error('Ошибка загрузки:', errorDescription, url);
        });

        this.window.on('closed', () => {
            this.window = null;
        });

        return this.window;
    }

    close() {
        if (this.window) {
            this.window.close();
        }
    }
}

module.exports = MainWindow;