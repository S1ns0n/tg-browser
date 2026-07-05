const { app } = require('electron');
const Config = require('./config');
const SSHTunnel = require('./tunnel/ssh-tunnel');
const MainWindow = require('./windows/main-window');
const LoginWindow = require('./windows/login-window');
const IPCHandlers = require('./ipc/ipc-handlers');

class Application {
    constructor() {
        this.config = null;
        this.sshTunnel = null;
        this.mainWindow = null;
        this.loginWindow = null;
    }

    async start() {
        // Инициализация конфига
        this.config = new Config();
        
        // Создаём туннель
        this.sshTunnel = new SSHTunnel(this.config);
        
        // Создаём окна
        this.mainWindow = new MainWindow(this.config);
        this.loginWindow = new LoginWindow();
        
        // Регистрируем IPC обработчики
        new IPCHandlers(
            this.config, 
            this.sshTunnel, 
            this.mainWindow, 
            this.loginWindow
        );

        // Запускаемся
        if (this.config.vps.password) {
            // Пароль сохранён - пробуем авто-подключение
            try {
                await this.sshTunnel.start(this.config.vps.password);
                this.mainWindow.create();
            } catch (error) {
                console.error('Авто-подключение не удалось:', error.message);
                this.loginWindow.create();
            }
        } else {
            // Первый запуск - показываем окно входа
            this.loginWindow.create();
        }
    }

    async stop() {
        await this.sshTunnel.stop();
    }
}

// Запуск приложения
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