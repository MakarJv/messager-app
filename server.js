// Подключаем встроенные модули Node.js:
// http — для создания HTTP-сервера
// fs — для работы с файловой системой (чтение файлов)
// path — для удобной работы с путями к файлам
// os — для получения информации об операционной системе (например, IP-адреса)
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Задаём порт, на котором будет работать сервер (3000)
// HOST = '0.0.0.0' — означает, что сервер будет доступен не только с этого компьютера,
// но и с других устройств в сети (для тестирования на телефоне)
const PORT = 3000;
const HOST = '0.0.0.0';

// ========== MIME-ТИПЫ ==========
// MIME-тип — это способ сказать браузеру, как обрабатывать файл.
// Например, .html → text/html (браузер отобразит как страницу),
// .css → text/css (как стили), .js → text/javascript (как скрипт).
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

// ========== ФУНКЦИЯ ПОЛУЧЕНИЯ IP-АДРЕСА В СЕТИ ==========
// Проходит по всем сетевым интерфейсам компьютера (Wi-Fi, Ethernet и т.д.)
// и находит первый НЕ внутренний IPv4-адрес (например, 192.168.0.109).
// Этот адрес показывается в консоли, чтобы вы могли открыть чат с телефона.
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
// Принимает HTML-код страницы и добавляет в него специальный скрипт
// Этот скрипт открывает WebSocket-соединение к порту 3001.
// Когда сервер обнаруживает изменения в файлах, он посылает сигнал 'reload',
// и скрипт перезагружает страницу в браузере автоматически.
function injectLiveReload(html) {
    const liveReloadScript = `
    <script>
        // Подключаемся к WebSocket-серверу (порт 3001)
        const ws = new WebSocket('ws://' + window.location.hostname + ':3001');
        // Ждём команду 'reload' от сервера
        ws.onmessage = (event) => {
            if (event.data === 'reload') {
                console.log('🔄 Обнаружены изменения, перезагружаем страницу...');
                window.location.reload();
            }
        };
        ws.onopen = () => console.log('✅ Live Reload подключён');
        ws.onerror = (err) => console.log('❌ Live Reload ошибка:', err);
    </script>
    `;
    // Вставляем скрипт перед закрывающим тегом </body>
    return html.replace('</body>', liveReloadScript + '</body>');
}

// ========== ОСНОВНОЙ HTTP-СЕРВЕР ==========
// Создаём сервер, который обрабатывает входящие запросы.
// При каждом запросе (например, на index.html, style.css, app.js) сервер:
// 1. Определяет путь к файлу
// 2. Определяет MIME-тип по расширению
// 3. Читает файл с диска
// 4. Отправляет его браузеру
// Если файл — HTML, то перед отправкой добавляет в него скрипт Live Reload.
const server = http.createServer((req, res) => {
    console.log(`📥 Запрос: ${req.url}`);

    // Если запрошен корень "/" — отдаём index.html
    let filePath = req.url === '/' ? '/index.html' : req.url;
    // Превращаем относительный путь в абсолютный, начиная с папки проекта
    filePath = path.join(__dirname, filePath);

    // Определяем расширение файла и соответствующий MIME-тип
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Пытаемся прочитать файл
    fs.readFile(filePath, (error, content) => {
        if (error) {
            // Если файл не найден — 404
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - Файл не найден</h1>');
            } else {
                // Любая другая ошибка — 500
                res.writeHead(500);
                res.end(`Ошибка сервера: ${error.code}`);
            }
        } else {
            // Файл найден — отправляем его с правильным Content-Type
            res.writeHead(200, { 'Content-Type': contentType });

            // Если это HTML-файл, внедряем в него Live Reload скрипт
            if (contentType === 'text/html') {
                let html = content.toString('utf-8');
                html = injectLiveReload(html);
                res.end(html, 'utf-8');
            } else {
                // Для CSS, JS и других файлов — просто отправляем как есть
                res.end(content);
            }
        }
    });
});

// ========== WEBSOCKET-СЕРВЕР ДЛЯ LIVE RELOAD ==========
// Подключаем библиотеку 'ws' (WebSocket) и создаём сервер на порту 3001.
// WebSocket позволяет серверу и браузеру общаться в реальном времени.
// Когда клиент (браузер) загружает страницу, он подключается к этому серверу.
// Мы сохраняем всех подключённых клиентов в массив clients.
const WebSocket = require('ws');
const wsServer = new WebSocket.Server({ port: 3001 });

// Массив для хранения всех активных WebSocket-соединений
let clients = [];

// Обработчик новых подключений
wsServer.on('connection', (ws) => {
    console.log('🔌 Клиент подключён к Live Reload');
    clients.push(ws);

    // Когда клиент закрывает вкладку или обновляет страницу — удаляем его из списка
    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
        console.log('🔌 Клиент отключён');
    });
});

// ========== ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ ФАЙЛОВ ==========
// Функция, которая следит за файлами в папке проекта и в папке src.
// При любом изменении файлов .html, .css или .js она отправляет всем
// подключённым клиентам команду 'reload' через WebSocket.
function watchFiles() {
    // Папки, за которыми следим: корень проекта ('.') и папка 'src'
    const watchPaths = ['.', 'src'];

    // Для каждой папки устанавливаем наблюдатель (fs.watch)
    watchPaths.forEach(dir => {
        fs.watch(path.join(__dirname, dir), { recursive: true }, (eventType, filename) => {
            // Если изменился HTML, CSS или JS — отправляем сигнал перезагрузки
            if (filename && (filename.endsWith('.html') || filename.endsWith('.css') || filename.endsWith('.js'))) {
                console.log(`📝 Изменён файл: ${filename}`);
                console.log('🔄 Отправляем сигнал перезагрузки клиентам...');

                // Отправляем 'reload' каждому подключённому клиенту
                clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send('reload');
                    }
                });
            }
        });
    });
}

// ========== ЗАПУСК СЕРВЕРА ==========
// Запускаем HTTP-сервер на порту 3000 и хост-адресе 0.0.0.0
// После успешного запуска выводим в консоль адреса для доступа
server.listen(PORT, HOST, () => {
    console.log('\n=========================================');
    console.log('🚀 СЕРВЕР ЗАПУЩЕН С LIVE RELOAD!');
    console.log('=========================================');
    console.log(`📱 Локальный доступ: http://localhost:${PORT}`);
    console.log(`🌐 Доступ в сети: https://${getLocalIp()}:${PORT}`);
    console.log(`🔌 WebSocket порт для live reload: 3001`);
    console.log('=========================================');
    console.log('💡 При изменении HTML/CSS/JS страница обновится автоматически');
    console.log('💡 Чтобы остановить сервер: Ctrl + C');
    console.log('=========================================\n');

    // Начинаем следить за изменениями файлов (после запуска сервера)
    watchFiles();
});