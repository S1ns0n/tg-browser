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
                contextIsolation: true
            }
        });

        // Исправленная настройка прокси
        const proxyRules = `socks5://${this.config.proxy.host}:${this.config.proxy.port}`;
        
        this.window.webContents.session.setProxy({
            proxyRules: proxyRules,
            proxyBypassRules: ''  // Не обходить прокси
        }).then(() => {
            console.log('Прокси настроен:', proxyRules);
            
            // Загружаем URL после настройки прокси
            this.window.loadURL(this.config.appUrl);
        }).catch((err) => {
            console.error('Ошибка настройки прокси:', err);
            // Пробуем загрузить без прокси
            this.window.loadURL(this.config.appUrl);
        });

        // Фиксируем заголовок
        this.window.on('page-title-updated', (e) => {
            e.preventDefault();
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