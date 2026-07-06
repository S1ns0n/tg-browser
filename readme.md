# Telegram Browser

Браузер для Telegram Web с SSH-туннелем через VPS. Открывает Telegram в чистом окне без элементов управления, весь трафик идёт через ваш сервер.

## Горячие клавиши

- `Ctrl+Shift+R` — возврат к окну настроек при зависании

## Запуск

```bash
npm install
npm start
```

## Сборка

```bash
npm run build-win   # Windows
npm run build-mac   # macOS
```

## Настройка VPS

В `/etc/ssh/sshd_config` должно быть:

```
AllowTcpForwarding yes
PasswordAuthentication yes
```

## Использование

1. При первом запуске введите данные VPS
2. Настройки сохранятся для следующих запусков
3. Для сброса — удалите папку `tg-browser` в `%appdata%`

## Лицензия

MIT