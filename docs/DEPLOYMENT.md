# Инструкции по развертыванию

## 1. Применение миграций базы данных

Выполните миграции в Supabase SQL Editor в следующем порядке:

### Шаг 1: Основная схема
```sql
-- Файл: supabase-schema.sql
-- Создает таблицы: players, games, guesses
```

### Шаг 2: Добавление логинов
```sql
-- Файл: supabase-migration-add-login.sql
-- Добавляет поле login в таблицу players
```

### Шаг 3: Система приглашений
```sql
-- Файл: supabase-migration-invitations.sql
-- Создает таблицу invitations
-- Добавляет поля для Telegram интеграции
-- Добавляет поле game_name
```

### Шаг 4: Длина слова
```sql
-- Файл: supabase-migration-word-length.sql
-- Добавляет поле word_length для настройки длины слова
```

## 2. Настройка Telegram бота

### Установка зависимостей
```bash
cd telegram-bot
pip install -r requirements.txt
```

### Настройка .env
```bash
cp .env.example .env
nano .env  # Отредактируйте файл
```

Заполните `.env`:
```env
BOT_TOKEN=8131071089:AAEf_oNUIDV-HGYzptZ5ZAiWSHyriA9co3s
WEBAPP_URL=https://your-webapp-url.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### Запуск бота

#### Вариант 1: Два отдельных процесса
```bash
# Терминал 1: Основной бот
python bot.py

# Терминал 2: Слушатель приглашений
python invitations_listener.py
```

#### Вариант 2: Screen/Tmux
```bash
screen -dmS bot python bot.py
screen -dmS listener python invitations_listener.py

# Просмотр логов
screen -r bot
screen -r listener
```

#### Вариант 3: Systemd (Linux)
Создайте файлы сервисов:

`/etc/systemd/system/igra-bot.service`:
```ini
[Unit]
Description=Igra Telegram Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/igra/telegram-bot
ExecStart=/usr/bin/python3 bot.py
Restart=always

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/igra-listener.service`:
```ini
[Unit]
Description=Igra Invitations Listener
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/igra/telegram-bot
ExecStart=/usr/bin/python3 invitations_listener.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Запуск:
```bash
sudo systemctl enable igra-bot igra-listener
sudo systemctl start igra-bot igra-listener
sudo systemctl status igra-bot igra-listener
```

## 3. Настройка WebApp

### Переменные окружения
Создайте `.env` в корне проекта:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Сборка и развертывание
```bash
npm install
npm run build

# Развертывание (например, на Vercel/Netlify)
npm run deploy
```

### Подключение к Telegram
1. Откройте @BotFather в Telegram
2. Используйте команду `/newapp`
3. Укажите URL вашего WebApp
4. Получите ссылку на приложение

## 4. Проверка работоспособности

### Checklist
- [ ] Миграции БД применены успешно
- [ ] Telegram бот запущен и отвечает на /start
- [ ] Слушатель приглашений работает
- [ ] WebApp открывается через бота
- [ ] Можно создать игру
- [ ] Приходят уведомления о приглашениях
- [ ] Виброотклик работает в Telegram
- [ ] Игра синхронизируется между игроками

## 5. Troubleshooting

### Бот не отвечает
```bash
# Проверьте логи
journalctl -u igra-bot -f
journalctl -u igra-listener -f

# Проверьте токен бота
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
```

### Приглашения не приходят
```bash
# Проверьте логи слушателя
python invitations_listener.py

# Проверьте что Supabase настроен
psql -h your-db-host -U postgres -d postgres
SELECT * FROM invitations WHERE status = 'PENDING';
```

### Виброотклик не работает
- Убедитесь что приложение открыто через Telegram
- Проверьте консоль браузера на ошибки
- Telegram WebApp доступен только в Telegram клиентах

## 6. Мониторинг

### Логи бота
```bash
tail -f /path/to/logs/bot.log
```

### Мониторинг Supabase
- Dashboard > Database > Logs
- Dashboard > API > Logs
- Dashboard > Realtime > Inspector

### Метрики
- Количество онлайн игроков: `SELECT COUNT(*) FROM players WHERE is_online = true;`
- Активные игры: `SELECT COUNT(*) FROM games WHERE status = 'PLAYING';`
- Приглашения: `SELECT COUNT(*) FROM invitations WHERE status = 'PENDING';`

## 7. Обновление

### WebApp
```bash
git pull
npm install
npm run build
npm run deploy
```

### Telegram бот
```bash
git pull
pip install -r requirements.txt
sudo systemctl restart igra-bot igra-listener
```

### База данных
- Применяйте новые миграции через SQL Editor
- Создавайте бэкапы перед миграциями
