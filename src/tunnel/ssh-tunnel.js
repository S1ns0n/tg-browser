const { Client } = require('ssh2');
const net = require('net');

class SSHTunnel {
    constructor(config) {
        this.config = config;
        this.client = null;
        this.server = null;
        this.isConnected = false;
        this.reconnectTimer = null;
        this.password = null;
    }

    async start(password) {
        this.password = password;
        
        if (this.isConnected) {
            console.log('Туннель уже запущен');
            return true;
        }

        return this._connect(password);
    }

    async _connect(password) {
        return new Promise((resolve, reject) => {
            // Закрываем старое соединение если есть
            if (this.client) {
                try { this.client.end(); } catch (e) {}
            }

            this.client = new Client();

            this.client.on('ready', () => {
                console.log('SSH подключен успешно');
                this.isConnected = true;
                this._startProxy(resolve, reject);
            });

            this.client.on('error', (err) => {
                console.error('SSH ошибка:', err.message);
                this.isConnected = false;
                
                // Если была ошибка после успешного подключения - пробуем переподключиться
                if (this.reconnectTimer === null) {
                    this._scheduleReconnect();
                }
                
                reject(new Error(`Ошибка SSH: ${err.message}`));
            });

            this.client.on('close', () => {
                console.log('SSH соединение закрыто');
                this.isConnected = false;
                
                // Переподключаемся если соединение было активным
                if (this.password && this.reconnectTimer === null) {
                    this._scheduleReconnect();
                }
            });

            this.client.connect({
                host: this.config.vps.host,
                port: this.config.vps.port,
                username: this.config.vps.username,
                password: password,
                readyTimeout: 10000,
                keepaliveInterval: 30000,    // Пингуем каждые 30 секунд
                keepaliveCountMax: 3,        // Максимум 3 пропущенных пинга
                debug: false
            });
        });
    }

    _scheduleReconnect() {
        if (this.reconnectTimer) return;
        
        console.log('Планируем переподключение через 5 секунд...');
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            console.log('Пытаемся переподключиться...');
            
            try {
                await this._connect(this.password);
                console.log('Переподключение успешно');
            } catch (err) {
                console.error('Ошибка переподключения:', err.message);
                // Пробуем снова через 10 секунд
                setTimeout(() => {
                    this.reconnectTimer = null;
                    this._scheduleReconnect();
                }, 10000);
            }
        }, 5000);
    }

    _startProxy(resolve, reject) {
        const self = this;
        
        // Закрываем старый сервер если есть
        if (this.server) {
            try { this.server.close(); } catch (e) {}
        }
        
        this.server = net.createServer((clientSocket) => {
            let buffer = Buffer.alloc(0);
            let state = 'handshake';
            
            clientSocket.on('data', (data) => {
                buffer = Buffer.concat([buffer, data]);
                
                if (state === 'handshake' && buffer.length >= 3) {
                    const version = buffer[0];
                    
                    if (version !== 5) {
                        clientSocket.end();
                        return;
                    }
                    
                    clientSocket.write(Buffer.from([5, 0]));
                    buffer = Buffer.alloc(0);
                    state = 'request';
                }
                else if (state === 'request' && buffer.length >= 10) {
                    const version = buffer[0];
                    const cmd = buffer[1];
                    const addrType = buffer[3];
                    
                    if (version !== 5 || cmd !== 1) {
                        clientSocket.end();
                        return;
                    }
                    
                    let host;
                    let port;
                    let headerLength;
                    
                    if (addrType === 1) {
                        host = `${buffer[4]}.${buffer[5]}.${buffer[6]}.${buffer[7]}`;
                        port = buffer.readUInt16BE(8);
                        headerLength = 10;
                    }
                    else if (addrType === 3) {
                        const domainLen = buffer[4];
                        host = buffer.slice(5, 5 + domainLen).toString();
                        port = buffer.readUInt16BE(5 + domainLen);
                        headerLength = 7 + domainLen;
                    }
                    else {
                        clientSocket.end();
                        return;
                    }
                    
                    // Проверяем что клиент ещё подключен
                    if (!self.client || !self.isConnected) {
                        const response = Buffer.alloc(headerLength);
                        buffer.copy(response, 0, 0, headerLength);
                        response[1] = 1; // Ошибка
                        clientSocket.write(response);
                        clientSocket.end();
                        return;
                    }
                    
                    try {
                        self.client.forwardOut(
                            '127.0.0.1',
                            0,
                            host,
                            port,
                            (err, stream) => {
                                if (err) {
                                    console.error('Ошибка форвардинга:', err.message);
                                    const response = Buffer.alloc(headerLength);
                                    buffer.copy(response, 0, 0, headerLength);
                                    response[1] = 1;
                                    clientSocket.write(response);
                                    clientSocket.end();
                                    return;
                                }
                                
                                const response = Buffer.alloc(headerLength);
                                buffer.copy(response, 0, 0, headerLength);
                                response[1] = 0;
                                clientSocket.write(response);
                                
                                clientSocket.on('data', (chunk) => {
                                    try { stream.write(chunk); } catch (e) {}
                                });
                                
                                stream.on('data', (chunk) => {
                                    try { clientSocket.write(chunk); } catch (e) {}
                                });
                                
                                clientSocket.on('error', () => {
                                    try { stream.end(); } catch (e) {}
                                });
                                
                                stream.on('error', () => {
                                    try { clientSocket.end(); } catch (e) {}
                                });
                                
                                clientSocket.on('close', () => {
                                    try { stream.end(); } catch (e) {}
                                });
                                
                                stream.on('close', () => {
                                    try { clientSocket.end(); } catch (e) {}
                                });
                            }
                        );
                    } catch (err) {
                        console.error('Ошибка forwardOut:', err.message);
                        const response = Buffer.alloc(headerLength);
                        buffer.copy(response, 0, 0, headerLength);
                        response[1] = 1;
                        clientSocket.write(response);
                        clientSocket.end();
                    }
                    
                    state = 'connected';
                }
            });
            
            clientSocket.on('error', (err) => {
                console.error('Ошибка клиента:', err.message);
            });
        });

        this.server.on('error', (err) => {
            console.error('Ошибка SOCKS5 сервера:', err.message);
            if (!this.isConnected) {
                reject(err);
            }
        });

        this.server.listen(this.config.proxy.port, this.config.proxy.host, () => {
            console.log(`SOCKS5 на ${this.config.proxy.host}:${this.config.proxy.port}`);
            this.isConnected = true;
            resolve(true);
        });
    }

    stop() {
        // Очищаем таймер переподключения
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('SOCKS прокси остановлен');
                });
            }
            
            if (this.client) {
                this.client.removeAllListeners(); // Убираем обработчики чтобы не переподключался
                this.client.on('close', () => {
                    console.log('SSH клиент закрыт');
                    this.isConnected = false;
                    this.password = null;
                    resolve();
                });
                try {
                    this.client.end();
                } catch (e) {
                    resolve();
                }
            } else {
                resolve();
            }
        });
    }

    updateConfig(config) {
        this.config = config;
    }

    getStatus() {
        return {
            connected: this.isConnected,
            proxy: `${this.config.proxy.host}:${this.config.proxy.port}`
        };
    }
}

module.exports = SSHTunnel;