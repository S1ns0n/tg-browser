const { BrowserWindow } = require('electron');
const path = require('path');

class LoginWindow {
    constructor() {
        this.window = null;
    }

    create() {
        this.window = new BrowserWindow({
            width: 460,
            height: 620,
            resizable: false,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            webPreferences: {
                preload: path.join(__dirname, '..', 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        this.window.loadFile(path.join(__dirname, '..', '..', 'static', 'login.html'));

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

module.exports = LoginWindow;