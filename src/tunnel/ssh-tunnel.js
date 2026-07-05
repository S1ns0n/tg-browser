const { Client } = require('ssh2');
const net = require('net');

class SSHTunnel {
    constructor(config) {
        this.config = config;
        this.client = null;
        this.server = null;
        this.isConnected = false;
    }

     updateConfig(config) {
        this.config = config;
    }

    async start(password) {
        if (this.isConnected) {
            console.log('Туннель уже запущен');
            return true;
        }

        

        return new Promise((resolve, reject) => {
            this.client = new Client();

            this.client.on('ready', () => {
                console.log('SSH подключен успешно');
                this._startProxy(resolve, reject);
            });

            this.client.on('error', (err) => {
                console.error('SSH ошибка:', err.message);
                this.isConnected = false;
                reject(new Error(`Ошибка SSH: ${err.message}`));
            });

            this.client.on('close', () => {
                console.log('SSH соединение закрыто');
                this.isConnected = false;
            });

            this.client.connect({
                host: this.config.vps.host,
                port: this.config.vps.port,
                username: this.config.vps.username,
                password: password,
                readyTimeout: 10000,
                keepaliveInterval: 10000
            });
        });
    }

    _startProxy(resolve, reject) {
        const self = this;
        
        // Создаём TCP сервер
        this.server = net.createServer((clientSocket) => {
            let buffer = Buffer.alloc(0);
            let state = 'handshake'; // handshake -> request -> connected
            
            clientSocket.on('data', (data) => {
                buffer = Buffer.concat([buffer, data]);
                
                if (state === 'handshake' && buffer.length >= 3) {
                    // SOCKS5 handshake
                    const version = buffer[0];
                    const nmethods = buffer[1];
                    
                    if (version !== 5) {
                        clientSocket.end();
                        return;
                    }
                    
                    // Принимаем любую аутентификацию (включая "нет аутентификации")
                    clientSocket.write(Buffer.from([5, 0]));
                    buffer = Buffer.alloc(0);
                    state = 'request';
                }
                else if (state === 'request' && buffer.length >= 10) {
                    // SOCKS5 request
                    const version = buffer[0];
                    const cmd = buffer[1];
                    const addrType = buffer[3];
                    
                    if (version !== 5 || cmd !== 1) { // Только CONNECT
                        clientSocket.end();
                        return;
                    }
                    
                    let host;
                    let port;
                    let headerLength;
                    
                    if (addrType === 1) { // IPv4
                        host = `${buffer[4]}.${buffer[5]}.${buffer[6]}.${buffer[7]}`;
                        port = buffer.readUInt16BE(8);
                        headerLength = 10;
                    }
                    else if (addrType === 3) { // Domain name
                        const domainLen = buffer[4];
                        host = buffer.slice(5, 5 + domainLen).toString();
                        port = buffer.readUInt16BE(5 + domainLen);
                        headerLength = 7 + domainLen;
                    }
                    else if (addrType === 4) { // IPv6
                        host = buffer.slice(4, 20).toString('hex');
                        port = buffer.readUInt16BE(20);
                        headerLength = 22;
                    }
                    else {
                        clientSocket.end();
                        return;
                    }
                    
                    console.log(`Туннель: ${host}:${port}`);
                    
                    // Создаём SSH туннель
                    self.client.forwardOut(
                        '127.0.0.1',
                        0,
                        host,
                        port,
                        (err, stream) => {
                            if (err) {
                                console.error('Ошибка форвардинга:', err);
                                // Отправляем ошибку
                                const response = Buffer.alloc(headerLength);
                                buffer.copy(response, 0, 0, headerLength);
                                response[1] = 1; // General failure
                                clientSocket.write(response);
                                clientSocket.end();
                                return;
                            }
                            
                            // Отправляем успешный ответ
                            const response = Buffer.alloc(headerLength);
                            buffer.copy(response, 0, 0, headerLength);
                            response[1] = 0; // Success
                            clientSocket.write(response);
                            
                            // Проксируем данные
                            clientSocket.pipe(stream);
                            stream.pipe(clientSocket);
                            
                            clientSocket.on('error', () => {
                                stream.end();
                            });
                            
                            stream.on('error', () => {
                                clientSocket.end();
                            });
                            
                            clientSocket.on('close', () => {
                                stream.end();
                            });
                            
                            stream.on('close', () => {
                                clientSocket.end();
                            });
                        }
                    );
                    
                    state = 'connected';
                }
            });
            
            clientSocket.on('error', (err) => {
                console.error('Ошибка клиента:', err);
            });
        });

        this.server.on('error', (err) => {
            console.error('Ошибка SOCKS5 сервера:', err);
            reject(err);
        });

        this.server.listen(this.config.proxy.port, this.config.proxy.host, () => {
            console.log(`SOCKS5 на ${this.config.proxy.host}:${this.config.proxy.port}`);
            this.isConnected = true;
            resolve(true);
        });
    }

    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('SOCKS прокси остановлен');
                });
            }
            
            if (this.client) {
                this.client.on('close', () => {
                    console.log('SSH клиент закрыт');
                    this.isConnected = false;
                    resolve();
                });
                this.client.end();
            } else {
                resolve();
            }
        });
    }

    getStatus() {
        return {
            connected: this.isConnected,
            proxy: `${this.config.proxy.host}:${this.config.proxy.port}`
        };
    }
}

module.exports = SSHTunnel;