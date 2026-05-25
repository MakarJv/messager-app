// sw.js - исправленная версия
const CACHE_NAME = 'messenger-v1';

self.addEventListener('install', (event) => {
    console.log('✅ Service Worker установлен');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {  // ← ИСПРАВЛЕНО: добавлено =>
    console.log('✅ Service Worker активирован');
    event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
    console.log('📨 Получен push:', event);

    let title = 'Новое сообщение';
    let options = {
        body: 'У вас новое сообщение',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: {
            url: '/',
            timestamp: Date.now()
        }
    };

    if (event.data) {
        try {
            const pushData = event.data.json();
            title = pushData.title || title;
            options.body = pushData.body || options.body;
            options.icon = pushData.icon || options.icon;
            options.data = pushData.data || options.data;
            options.tag = pushData.tag || 'message';
            console.log('📨 Данные уведомления:', { title, options });
        } catch(e) {
            console.error('Ошибка парсинга push данных:', e);
            options.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(title, options)
            .then(() => console.log('✅ Уведомление показано'))
            .catch(err => console.error('❌ Ошибка показа уведомления:', err))
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Клик по уведомлению:', event);
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});