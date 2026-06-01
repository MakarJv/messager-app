Messenger App - Чат-приложение с реальным временем
Современное веб-приложение для обмена сообщениями с поддержкой push-уведомлений, вложений, аватаров и темной темы.

📱 Особенности
Реальное время - мгновенная доставка сообщений через Supabase Realtime

Push-уведомления - получайте сообщения даже при закрытом браузере

Вложения - отправка фото, видео, документов (до 50MB)

Аватары пользователей - загрузка и сжатие изображений

Статус "онлайн/оффлайн" - видите когда собеседник в сети

Индикатор печатания - показывает когда собеседник набирает текст

Отметки о прочтении - двойные галочки как в Telegram

Непрочитанные сообщения - счетчик и визуальное выделение

Темная тема - комфортное использование в любое время

Адаптивный дизайн - работает на ПК, планшетах и телефонах

Live Reload - автоматическое обновление при разработке

🚀 Технологии
Frontend: HTML5, CSS3, JavaScript (ES6+)

Backend: Node.js + WebSocket

База данных: Supabase (PostgreSQL)

Realtime: Supabase Realtime

Push-уведомления: Web Push API + VAPID

Авторизация: Supabase Auth

📋 Требования
Node.js (v14 или выше)

Аккаунт Supabase (бесплатный)

Современный браузер с поддержкой Service Workers

🔧 Установка и запуск
1. Клонирование репозитория
bash
git clone https://github.com/your-username/messenger-app.git
cd messenger-app
2. Настройка Supabase
Создайте проект на Supabase

Выполните SQL-запросы для создания таблиц:

sql
-- Профили пользователей
CREATE TABLE profiles (
    id UUID REFERENCES auth.users PRIMARY KEY,
    username TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Чаты
CREATE TABLE chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Участники чатов
CREATE TABLE chat_participants (
    chat_id UUID REFERENCES chats ON DELETE CASCADE,
    user_id UUID REFERENCES profiles ON DELETE CASCADE,
    PRIMARY KEY (chat_id, user_id)
);

-- Сообщения
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID REFERENCES chats ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles,
    receiver_id UUID REFERENCES profiles,
    text TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Вложения
CREATE TABLE attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES messages ON DELETE CASCADE,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_type TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Статус пользователя
CREATE TABLE user_status (
    id UUID REFERENCES profiles PRIMARY KEY,
    status TEXT DEFAULT 'offline',
    last_seen TIMESTAMP,
    updated_at TIMESTAMP
);

-- Статус печатания
CREATE TABLE typing_status (
    user_id UUID REFERENCES profiles,
    chat_id UUID REFERENCES chats,
    is_typing BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP,
    PRIMARY KEY (user_id, chat_id)
);
Настройте Storage buckets:

avatars - для аватаров пользователей

chat-attachments - для вложений

3. Настройка приложения
Откройте src/app.js и замените SUPABASE_CONFIG на свои данные:

javascript
const SUPABASE_CONFIG = {
    url: 'YOUR_SUPABASE_URL',
    key: 'YOUR_SUPABASE_ANON_KEY'
};
4. Генерация VAPID ключей (для push-уведомлений)
bash
npx web-push generate-vapid-keys
Замените ключи в:

src/app.js - VAPID_PUBLIC_KEY

server.js - VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY

5. Запуск сервера
bash
npm init -y
npm install ws web-push
node server.js
6. Доступ к приложению
Локально: http://localhost:3000

В сети: http://[IP-адрес]:3000

📁 Структура проекта
text
messenger-app/
├── index.html          # Главная страница
├── server.js           # Node.js сервер
├── manifest.json       # PWA манифест
├── sw.js              # Service Worker
├── src/
│   ├── app.js         # Основная логика приложения
│   └── style.css      # Стили
└── README.md          # Документация
🎯 Основные функции
Сообщения
Отправка текста, эмодзи, фото и файлов

Сжатие изображений перед отправкой

Удаление своих сообщений

Отметки о прочтении (✓ и ✓✓)

Чаты
Список активных чатов

Поиск по пользователям

Отображение последнего сообщения

Счетчик непрочитанных

Профиль
Изменение имени

Загрузка и удаление аватара

Сжатие аватаров до 300px

Настройки
Включение/отключение уведомлений

Настройка звука

Темная тема

Push-уведомления

🔒 Безопасность
JWT-аутентификация через Supabase

Row Level Security (RLS) в Supabase

Валидация и санитизация входных данных

Защита от XSS через escapeHtml

📱 Мобильная версия
Свайп для возврата к списку чатов

Адаптивная клавиатура с safe-area-inset

Оптимизированные размеры элементов

Отдельное мобильное меню

🐛 Известные проблемы и решения
Push-уведомления не работают:

Проверьте разрешения браузера

Убедитесь что сервер запущен на HTTPS (для production)

Проверьте корректность VAPID ключей

Файлы не загружаются:

Проверьте настройки Storage в Supabase

Убедитесь что размер файла не превышает 50MB

📄 Лицензия
MIT License

🤝 Вклад в проект
Форкните репозиторий

Создайте ветку для вашей функции

Сделайте коммит с изменениями

Отправьте пулл-реквест

📞 Контакты
Автор: Makar_Jv

Email: makar_igor1997@mail.ru

GitHub: Makar_Jv

🙏 Благодарности
Supabase - отличная Backend платформа

Ionicons - красивые иконки

Web Push API - современные уведомления

⭐ Если проект вам помог, поставьте звезду на GitHub!
