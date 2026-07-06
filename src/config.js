const path = require('path');
const { app } = require('electron');
const fs = require('fs');

class Config {
    constructor() {
        this.storedConfigPath = path.join(app.getPath('userData'), 'stored-config.json');
        
        this._setDefaults();
        this._loadStored();
    }

    _setDefaults() {
        this.appUrl = 'https://web.telegram.org/';
        this.vps = {
            host: '',
            port: 22,
            username: 'root',
            password: null
        };
        this.proxy = {
            host: '127.0.0.1',
            port: 1080
        };
        this.window = {
            width: 1200,
            height: 800
        };
    }

    _loadStored() {
        if (fs.existsSync(this.storedConfigPath)) {
            const stored = JSON.parse(fs.readFileSync(this.storedConfigPath, 'utf8'));
            
            if (stored.appUrl) this.appUrl = stored.appUrl;
            if (stored.vpsHost) this.vps.host = stored.vpsHost;
            if (stored.vpsPort) this.vps.port = stored.vpsPort;
            if (stored.vpsUsername) this.vps.username = stored.vpsUsername;
            if (stored.vpsPassword) this.vps.password = stored.vpsPassword;
            if (stored.proxyHost) this.proxy.host = stored.proxyHost;
            if (stored.proxyPort) this.proxy.port = stored.proxyPort;
        }
    }

    saveFullConfig(userConfig) {
        const toSave = {
            appUrl: userConfig.appUrl || this.appUrl,
            vpsHost: userConfig.vpsHost || this.vps.host,
            vpsPort: userConfig.vpsPort || this.vps.port,
            vpsUsername: userConfig.vpsUsername || this.vps.username,
            vpsPassword: userConfig.vpsPassword,
            proxyHost: userConfig.proxyHost || this.proxy.host,
            proxyPort: userConfig.proxyPort || this.proxy.port
        };

        const dir = path.dirname(this.storedConfigPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(this.storedConfigPath, JSON.stringify(toSave, null, 2));
        this._loadStored();
    }

    getProxyString() {
        return `socks5://${this.proxy.host}:${this.proxy.port}`;
    }
}

module.exports = Config;