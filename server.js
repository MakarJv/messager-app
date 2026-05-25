// ===========================
// ЧАТ-СЕРВЕР С LIVE RELOAD И PUSH-УВЕДОМЛЕНИЯМИ
// ===========================

// Подключаем модули
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const webpush = require('web-push');

// =========================== VAPID КЛЮЧИ ===========================
const VAPID_PUBLIC_KEY = 'BC9M1hyw0UrO65wjYz-VV3Zy_GzCgH1J1Dp94pOboqRLLC4jM5LocV1CfZDF-FzzNlMtUmpkG2-ESDwIwzHGAv0';
const VAPID_PRIVATE_KEY = 'iutXQVSDHod_azE-4btJreheWv3bnhs6W5iTSGKKkzE';

// Настройка web-push
webpush.setVapidDetails(
    'mailto:messenger@app.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// =========================== ХРАНИЛИЩЕ ПОДПИСОК ===========================
const pushSubscriptions = new Map();

// =========================== НАСТРОЙКИ СЕРВЕРА ===========================
const PORT = 3000;
const HOST = '0.0.0.0';

// MIME-типы
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// ========== ФУНКЦИЯ ПОЛУЧЕНИЯ IP-АДРЕСА ==========
function getLocalIp() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

// ========== ФУНКЦИЯ ВНЕДРЕНИЯ LIVE RELOAD ==========
function injectLiveReload(html) {
    const liveReloadScript = `
    <script>
        (function() {
            const ws = new WebSocket('ws://' + window.location.hostname + ':3001');
            ws.onmessage = (event) => {
                if (event.data === 'reload') {
                    console.log('🔄 Обнаружены изменения, перезагружаем страницу...');
                    window.location.reload();
                }
            };
            ws.onopen = () => console.log('✅ Live Reload подключён');
            ws.onerror = (err) => console.log('❌ Live Reload ошибка:', err);
        })();
    </script>
    `;
    return html.replace('</body>', liveReloadScript + '</body>');
}

// ========== ОБРАБОТКА API ЗАПРОСОВ ==========
function handleApiRequest(req, res, url) {
    console.log(`📡 API запрос: ${req.method} ${url}`);

    // CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            console.log(`📦 Получены данные:`, body.substring(0, 200));

            const data = JSON.parse(body);

            // Сохранение push-подписки
            if (url === '/api/save-subscription') {
                const { userId, subscription } = data;

                console.log(`💾 Сохранение подписки для userId: ${userId}`);

                if (!userId || !subscription) {
                    console.error('❌ Отсутствуют userId или subscription');
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing userId or subscription' }));
                    return;
                }

                pushSubscriptions.set(userId, subscription);
                console.log(`✅ Подписка сохранена для: ${userId}`);
                console.log(`📊 Всего подписок в памяти: ${pushSubscriptions.size}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Subscription saved' }));
                return;
            }

            // Удаление push-подписки
            if (url === '/api/delete-subscription') {
                const { userId } = data;

                if (userId && pushSubscriptions.has(userId)) {
                    pushSubscriptions.delete(userId);
                    console.log(`❌ Подписка удалена для: ${userId}`);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                return;
            }

            // Отправка тестового push-уведомления
            if (url === '/api/send-push') {
                const { toUserId, title, body: pushBody, icon } = data;

                console.log(`📨 Отправка push для: ${toUserId}`);

                const subscription = pushSubscriptions.get(toUserId);
                if (!subscription) {
                    console.error(`❌ Нет подписки для: ${toUserId}`);
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'User not subscribed' }));
                    return;
                }

                const payload = JSON.stringify({
                    title: title || 'Новое сообщение',
                    body: pushBody || 'У вас новое сообщение',
                    icon: icon || '/favicon.ico',
                    data: { url: '/', timestamp: Date.now() }
                });

                try {
                    await webpush.sendNotification(subscription, payload);
                    console.log(`✅ Push успешно отправлен: ${toUserId}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    console.error(`❌ Ошибка отправки push:`, error);
                    if (error.statusCode === 410) {
                        pushSubscriptions.delete(toUserId);
                        console.log(`🗑️ Удалена недействительная подписка: ${toUserId}`);
                    }
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
                return;
            }

            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'API endpoint not found' }));

        } catch (error) {
            console.error('❌ API ошибка:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    });
}

// ========== ОСНОВНОЙ HTTP-СЕРВЕР ==========
const server = http.createServer((req, res) => {
    console.log(`📥 Запрос: ${req.method} ${req.url}`);

    // Обработка API запросов
    if (req.url.startsWith('/api/')) {
        handleApiRequest(req, res, req.url);
        return;
    }

    // Обработка статических файлов
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                console.log(`❌ Файл не найден: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - Файл не найден</h1>');
            } else {
                console.log(`❌ Ошибка чтения файла: ${error.code}`);
                res.writeHead(500);
                res.end(`Ошибка сервера: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });

            if (contentType === 'text/html') {
                let html = content.toString('utf-8');
                html = injectLiveReload(html);
                res.end(html, 'utf-8');
            } else {
                res.end(content);
            }
        }
    });
});

// ========== WEBSOCKET-СЕРВЕР ДЛЯ LIVE RELOAD ==========
const wsServer = new WebSocket.Server({ port: 3001 });
let wsClients = [];

wsServer.on('connection', (ws) => {
    console.log('🔌 Клиент подключён к Live Reload');
    wsClients.push(ws);

    ws.on('close', () => {
        wsClients = wsClients.filter(client => client !== ws);
        console.log('🔌 Клиент отключён');
    });
});

// ========== ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ ФАЙЛОВ ==========
function watchFiles() {
    const watchPaths = ['.', 'src'];

    watchPaths.forEach(dir => {
        const fullPath = path.join(__dirname, dir);
        if (fs.existsSync(fullPath)) {
            fs.watch(fullPath, { recursive: true }, (eventType, filename) => {
                if (filename && (filename.endsWith('.html') || filename.endsWith('.css') || filename.endsWith('.js'))) {
                    console.log(`📝 Изменён файл: ${filename}`);
                    console.log('🔄 Отправляем сигнал перезагрузки...');

                    wsClients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send('reload');
                        }
                    });
                }
            });
        }
    });
}

// ========== ЗАПУСК СЕРВЕРА ==========
server.listen(PORT, HOST, () => {
    console.log('\n=========================================');
    console.log('🚀 СЕРВЕР ЗАПУЩЕН!');
    console.log('=========================================');
    console.log(`📱 Локальный доступ: http://localhost:${PORT}`);
    console.log(`🌐 Доступ в сети: http://${getLocalIp()}:${PORT}`);
    console.log(`🔌 WebSocket порт: 3001`);
    console.log(`📊 Push-уведомления: АКТИВНЫ`);
    console.log('=========================================');
    console.log('💡 API endpoints:');
    console.log('   POST /api/save-subscription');
    console.log('   POST /api/delete-subscription');
    console.log('   POST /api/send-push');
    console.log('=========================================');
    console.log('💡 Чтобы остановить сервер: Ctrl + C');
    console.log('=========================================\n');

    watchFiles();
});

// Экспорт функций для использования в других модулях
module.exports = {
    sendPushNotification: async (userId, title, body, icon) => {
        const subscription = pushSubscriptions.get(userId);
        if (!subscription) return false;

        const payload = JSON.stringify({ title, body, icon, data: { url: '/' } });
        try {
            await webpush.sendNotification(subscription, payload);
            console.log(`📨 Push отправлен: ${userId}`);
            return true;
        } catch (error) {
            console.error('Ошибка отправки push:', error);
            return false;
        }
    },
    getSubscriptionsCount: () => pushSubscriptions.size
};