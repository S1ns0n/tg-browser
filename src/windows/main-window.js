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

        const proxyRules = this.config.getProxyString();
        
        this.window.webContents.session.setProxy({
            proxyRules: proxyRules,
            proxyBypassRules: ''
        }).then(() => {
            console.log('Прокси настроен:', proxyRules);
            this.window.loadURL(this.config.appUrl);
        }).catch((err) => {
            console.error('Ошибка настройки прокси:', err);
            this.window.loadURL(this.config.appUrl);
        });

        // Перехватываем открытие новых окон
        this.window.webContents.setWindowOpenHandler(({ url }) => {
            // Загружаем URL в текущем окне вместо открытия нового
            this.window.loadURL(url);
            
            // Запрещаем создание нового окна
            return { action: 'deny' };
        });

        // Перехватываем навигацию внутри WebView
        this.window.webContents.on('will-navigate', (event, url) => {
            // Разрешаем только URL внутри домена приложения
            const appDomain = new URL(this.config.appUrl).hostname;
            const targetDomain = new URL(url).hostname;
            
            if (targetDomain !== appDomain && !targetDomain.endsWith('.' + appDomain.split('.').slice(-2).join('.'))) {
                // Для внешних ссылок открываем в том же окне
                event.preventDefault();
                this.window.loadURL(url);
            }
        });

        this.window.webContents.on('did-finish-load', () => {
            this._injectSettingsButton();
        });

        this.window.on('page-title-updated', (e) => {
            e.preventDefault();
        });

        this.window.on('closed', () => {
            this.window = null;
        });

        return this.window;
    }

    _injectSettingsButton() {
        const css = `
            #app-settings-btn {
                position: fixed;
                top: 10px;
                right: 10px;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: white;
                font-size: 18px;
                cursor: pointer;
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(10px);
                transition: all 0.3s;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            #app-settings-btn:hover {
                background: rgba(0, 136, 204, 0.8);
                transform: scale(1.1);
            }
        `;

        const js = `
            const btn = document.createElement('button');
            btn.id = 'app-settings-btn';
            btn.innerHTML = '⚙';
            btn.title = 'Настройки подключения';
            btn.addEventListener('click', () => {
                window.electronAPI.openSettings();
            });
            document.body.appendChild(btn);
        `;

        this.window.webContents.insertCSS(css);
        this.window.webContents.executeJavaScript(js);
    }

    close() {
        if (this.window) {
            this.window.close();
        }
    }
}

module.exports = MainWindow;