/**
 * ЧАТ-ПРИЛОЖЕНИЕ (Messenger App)
 */

// =========================== 0. SUPABASE ===========================
const SUPABASE_CONFIG = {
    url: 'https://jdbezebvvrduevkdxvsh.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYmV6ZWJ2dnJkdWV2a2R4dnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5Mzg5OTQsImV4cCI6MjA5NDUxNDk5NH0.YgCK8_BapCOpB07qYWqO3JeFUT6mY5celJfXBrZ7I_0'
};
window.sbClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
console.log('Supabase client ready');

// =========================== 1. ЭЛЕМЕНТЫ DOM ===========================
const loginBtn = document.querySelector('#login');
const registerBtn = document.querySelector('#register');
const enterBtn = document.querySelector('#enterBtn');
const regBtn = document.querySelector('#regBtn');
const loginWindow = document.querySelector('.login');
const registerWindow = document.querySelector('.register');
const chatWindow = document.querySelector('.chat');
let messageInput = document.getElementById('message');
const messagesContainer = document.getElementById('messageText');
const sendButton = document.getElementById('sendBtn');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const regUsername = document.getElementById('regUsername');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const messager = document.getElementById('messager');
const emptyChatScreen = document.getElementById('emptyChatScreen');
const mobileBackBtn = document.getElementById('mobileBackBtn');

// VAPID ключи
const VAPID_PUBLIC_KEY = 'BC9M1hyw0UrO65wjYz-VV3Zy_GzCgH1J1Dp94pOboqRLLC4jM5LocV1CfZDF-FzzNlMtUmpkG2-ESDwIwzHGAv0';

// =========================== 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===========================
let currentChatUser = null, currentChatId = null, allUsers = [], userChats = [];
let activeTab = 'chats', searchQuery = '';
let messagesSubscription = null, profilesSubscription = null, statusSubscription = null;
let statusUpdateInterval = null;
let pendingFile = null;
let isSending = false;
let preventAutoSend = false;
let originalTitle = document.title;
let notificationCount = 0;
let notificationSound = null;
let notificationsEnabled = false;
let soundEnabled = true;
let lastNotificationTime = 0;
let typingTimeout = null;
let isTypingCurrently = false;
let typingSubscription = null;
let swRegistration = null;

// =========================== УВЕДОМЛЕНИЯ ===========================
function initNotificationSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        notificationSound = {
            play: () => {
                const now = Date.now();
                if (now - lastNotificationTime < 2000) return;
                lastNotificationTime = now;
                if (!soundEnabled) return;
                audioContext.resume().then(() => {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(audioContext.destination);
                    osc.frequency.value = 880;
                    gain.gain.value = 0.15;
                    osc.start();
                    gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
                    osc.stop(audioContext.currentTime + 0.3);
                    setTimeout(() => {
                        const osc2 = audioContext.createOscillator();
                        const gain2 = audioContext.createGain();
                        osc2.connect(gain2);
                        gain2.connect(audioContext.destination);
                        osc2.frequency.value = 660;
                        gain2.gain.value = 0.1;
                        osc2.start();
                        gain2.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
                        osc2.stop(audioContext.currentTime + 0.2);
                    }, 150);
                }).catch(e => console.log('Audio error:', e));
            }
        };
    } catch(e) {
        console.log('Звук не поддерживается:', e);
        notificationSound = { play: () => {} };
    }
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
        notificationsEnabled = true;
        return true;
    }
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        notificationsEnabled = permission === 'granted';
        return notificationsEnabled;
    }
    return false;
}

async function showNotification(title, body, tag = 'message', senderId = null) {
    try {
        if (localStorage.getItem('notifications') === 'false') return;
        if (!document.hidden) return;
        if (senderId) {
            const { data: { user } } = await window.sbClient.auth.getUser();
            if (user && user.id === senderId) return;
        }
        const now = Date.now();
        if (now - lastNotificationTime < 3000 && notificationCount > 0) {
            notificationCount++;
            updateTitleNotification();
            return;
        }
        lastNotificationTime = now;
        if (localStorage.getItem('sound') !== 'false' && notificationSound) {
            notificationSound.play();
        }
        if (notificationsEnabled && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body: body,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: tag,
                silent: false,
                vibrate: [200, 100, 200],
                requireInteraction: false
            });
            notification.onclick = () => {
                window.focus();
                notification.close();
                if (senderId && window.openChatWithUser) {
                    openChatWithUser(senderId, title);
                }
            };
            setTimeout(() => notification.close(), 8000);
        }
        notificationCount++;
        updateTitleNotification();
    } catch (error) {
        console.error('Ошибка в showNotification:', error);
    }
}

function updateTitleNotification() {
    if (document.hidden && notificationCount > 0) {
        document.title = `📩 (${notificationCount}) ${originalTitle}`;
    } else {
        document.title = originalTitle;
        notificationCount = 0;
    }
}

window.addEventListener('focus', () => {
    notificationCount = 0;
    updateTitleNotification();
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        notificationCount = 0;
        updateTitleNotification();
    }
});

// =========================== 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===========================
function getShortTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function truncateFileName(filename, maxLength = 30) {
    if (!filename) return '';
    if (filename.length <= maxLength) return filename;
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return filename.slice(0, maxLength - 3) + '...';
    const ext = filename.slice(lastDot);
    const name = filename.slice(0, lastDot);
    const availableLength = maxLength - ext.length - 3;
    if (availableLength <= 0) return '...' + ext;
    return name.slice(0, availableLength) + '...' + ext;
}

// =========================== 4. РЕГИСТРАЦИЯ, ВХОД, ВЫХОД ===========================
async function registerUser() {
    const username = regUsername?.value.trim(), email = regEmail?.value.trim(), password = regPassword?.value;
    if (!email || !password || !username) { alert('Заполните все поля'); return; }
    if (password.length < 4) { alert('Пароль минимум 4 символа'); return; }
    const btn = regBtn, originalText = btn.textContent;
    btn.textContent = 'Загрузка...'; btn.disabled = true;
    const { data, error } = await window.sbClient.auth.signUp({ email, password, options: { data: { username } } });
    btn.textContent = originalText; btn.disabled = false;
    if (error) { alert('Ошибка: ' + error.message); return; }
    if (data.session) {
        localStorage.setItem('currentUsername', username);
        loginWindow.classList.add('close'); registerWindow.classList.add('close'); chatWindow.classList.remove('close');
        regUsername.value = regEmail.value = regPassword.value = '';
        await loadUsers(); await loadUserChats();
        await registerServiceWorker();
        console.log('Добро пожаловать,', username);
    } else {
        alert('Регистрация успешна! Подтвердите email и войдите.');
        loginWindow.classList.remove('close'); registerWindow.classList.add('close');
    }
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return false;
    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            if (registration.active && registration.active.scriptURL.includes('sw.js')) {
                swRegistration = registration;
                console.log('✅ Service Worker уже зарегистрирован');
                const subscription = await swRegistration.pushManager.getSubscription();
                if (subscription) {
                    console.log('✅ Существующая push-подписка найдена');
                    await saveSubscriptionToServer(subscription);
                }
                return true;
            }
        }
        swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Новый Service Worker зарегистрирован');
        await navigator.serviceWorker.ready;
        return true;
    } catch (error) {
        console.error('❌ Ошибка регистрации SW:', error);
        return false;
    }
}

async function enterChat() {
    const email = loginUsername?.value.trim(), password = loginPassword?.value;
    if (!email || !password) { alert('Заполните все поля'); return; }
    const btn = enterBtn, originalText = btn.textContent;
    btn.textContent = 'Вход...'; btn.disabled = true;
    const { data, error } = await window.sbClient.auth.signInWithPassword({ email, password });
    btn.textContent = originalText; btn.disabled = false;
    if (error) { alert('Ошибка: ' + error.message); return; }
    if (data.user) {
        localStorage.setItem('currentUsername', data.user.user_metadata?.username || 'Пользователь');
        loginWindow.classList.add('close'); registerWindow.classList.add('close'); chatWindow.classList.remove('close');
        loginUsername.value = loginPassword.value = '';
        await loadUsers(); await loadUserChats();
        startStatusTracking(); subscribeToStatus();
        initNotificationSound();
        requestNotificationPermission();
        await registerServiceWorker();
    }
    if (!localStorage.getItem('notificationPermissionAsked')) {
        setTimeout(async () => {
            const granted = await requestNotificationPermission();
            if (granted) {
                console.log('✅ Уведомления разрешены');
                setTimeout(() => showNotification('Мессенджер', 'Уведомления настроены!', 'welcome'), 1000);
            }
            localStorage.setItem('notificationPermissionAsked', 'true');
        }, 2000);
    }
    await registerServiceWorker();
    const savedPushEnabled = localStorage.getItem('pushEnabled') === 'true';
    if (savedPushEnabled) {
        const isSubscribed = await checkPushSubscription();
        if (!isSubscribed) {
            console.log('🔄 Восстанавливаем push-подписку...');
            await subscribeToPush();
        } else {
            const subscription = await swRegistration.pushManager.getSubscription();
            if (subscription) {
                await saveSubscriptionToServer(subscription);
            }
        }
    }
}

async function logout() {
    await window.sbClient.auth.signOut(); stopStatusTracking();
    loginWindow.classList.remove('close'); registerWindow.classList.add('close'); chatWindow.classList.add('close');
    localStorage.removeItem('currentUsername');
    currentChatUser = null; currentChatId = null;
    if (messagesContainer) messagesContainer.innerHTML = '';
    updateDesktopEmptyState();
    document.querySelector('.chat')?.classList.remove('chat-opened');
}

// =========================== 5. РАБОТА С ПОЛЬЗОВАТЕЛЯМИ И ЧАТАМИ ===========================
async function loadUsers() {
    if (!window.sbClient) return;
    const { data: { user: currentUser } } = await window.sbClient.auth.getUser();
    if (!currentUser) return;
    const { data, error } = await window.sbClient.from('profiles').select('id, username').neq('id', currentUser.id);
    if (error) { console.error('Ошибка загрузки пользователей:', error); return; }
    allUsers = data || [];
    renderUsersList();
}

async function loadUserChats() {
    if (!window.sbClient) return;
    const { data: { user: currentUser } } = await window.sbClient.auth.getUser();
    if (!currentUser) return;
    const { data: participants, error } = await window.sbClient.from('chat_participants').select('chat_id').eq('user_id', currentUser.id);
    if (error) { console.error('Ошибка загрузки чатов:', error); return; }
    if (!participants?.length) { userChats = []; renderChatsList(); return; }
    userChats = [];
    for (const p of participants) {
        const { data: other } = await window.sbClient.from('chat_participants').select('user_id').eq('chat_id', p.chat_id).neq('user_id', currentUser.id);
        if (!other?.length) continue;
        const { data: profile } = await window.sbClient.from('profiles').select('username').eq('id', other[0].user_id).single();

        // Получаем последнее сообщение с учетом вложений
        const { data: lastMessage } = await window.sbClient
            .from('messages')
            .select('id, text, created_at, sender_id')
            .eq('chat_id', p.chat_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(); // используем maybeSingle вместо single

        let lastMessageText = 'Нет сообщений';
        let lastMessageTime = null;

        if (lastMessage) {
            lastMessageTime = lastMessage.created_at;

            // Проверяем есть ли вложение у последнего сообщения
            const { data: attachment } = await window.sbClient
                .from('attachments')
                .select('file_type, file_name')
                .eq('message_id', lastMessage.id)
                .maybeSingle();

            if (attachment) {
                // Определяем тип файла для отображения
                const fileType = attachment.file_type || '';

                if (fileType.startsWith('image/')) {
                    lastMessageText = '📸 Фото';
                } else if (fileType.startsWith('video/')) {
                    lastMessageText = '🎬 Видео';
                } else if (fileType.startsWith('audio/')) {
                    lastMessageText = '🎵 Аудио';
                } else {
                    lastMessageText = '📎 Файл';
                }

                // Добавляем отправителя
                if (lastMessage.sender_id !== currentUser.id) {
                    const { data: senderProfile } = await window.sbClient
                        .from('profiles')
                        .select('username')
                        .eq('id', lastMessage.sender_id)
                        .single();
                    if (senderProfile) {
                        lastMessageText = `${senderProfile.username}: ${lastMessageText}`;
                    }
                } else {
                    lastMessageText = `Вы: ${lastMessageText}`;
                }
            } else if (lastMessage.text && lastMessage.text.trim()) {
                let msgText = lastMessage.text.trim();
                if (msgText.length > 50) msgText = msgText.slice(0, 47) + '...';

                // Добавляем отправителя для текстовых сообщений
                if (lastMessage.sender_id !== currentUser.id) {
                    const { data: senderProfile } = await window.sbClient
                        .from('profiles')
                        .select('username')
                        .eq('id', lastMessage.sender_id)
                        .single();
                    if (senderProfile) {
                        lastMessageText = `${senderProfile.username}: ${msgText}`;
                    } else {
                        lastMessageText = msgText;
                    }
                } else {
                    lastMessageText = msgText;
                }
            }
        }

        userChats.push({
            chatId: p.chat_id,
            userId: other[0].user_id,
            username: profile?.username || 'Пользователь',
            lastMessage: lastMessageText,
            lastTime: lastMessageTime || null
        });
    }
    renderChatsList();
}

function renderChatsList() {
    const container = document.getElementById('chatsList');
    if (!container) return;

    // Очищаем контейнер
    container.innerHTML = '';

    if (!userChats.length) {
        container.innerHTML = `<div class="empty-state"><ion-icon name="chatbubbles-outline"></ion-icon><span>Нет активных чатов</span></div>`;
        return;
    }

    // Убираем возможные дубликаты по userId перед рендерингом
    const uniqueChats = [];
    const seenUserIds = new Set();

    for (const chat of userChats) {
        if (!seenUserIds.has(chat.userId)) {
            seenUserIds.add(chat.userId);
            uniqueChats.push(chat);
        }
    }

    const filtered = uniqueChats.filter(c => c.username.toLowerCase().includes(searchQuery.toLowerCase()));

    filtered.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-item';
        if (currentChatUser?.id === chat.userId) item.classList.add('active');
        item.setAttribute('data-user-id', chat.userId);
        item.setAttribute('data-chat-id', chat.chatId);
        const time = chat.lastTime ? new Date(chat.lastTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';

        item.innerHTML = `<div class="chat-avatar"><ion-icon name="person-outline"></ion-icon></div>
                          <div class="chat-info">
                              <div class="chat-name">${escapeHtml(chat.username)}</div>
                              <div class="chat-last-message">${escapeHtml(chat.lastMessage)}</div>
                          </div>
                          <div class="chat-time">${time}</div>`;
        item.onclick = () => openChatWithUser(chat.userId, chat.username, chat.chatId);
        container.appendChild(item);
    });
}

async function renderUsersList() {
    const container = document.getElementById('usersListContainer');
    if (!container) return;
    container.innerHTML = '';
    const filtered = allUsers.filter(u => u.username?.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!filtered.length) { container.innerHTML = `<div class="empty-state"><ion-icon name="people-outline"></ion-icon><span>Нет других пользователей</span></div>`; return; }
    for (const user of filtered) {
        const status = await getUserStatus(user.id);
        const item = document.createElement('div');
        item.className = 'user-item';
        item.setAttribute('data-user-id', user.id);
        item.innerHTML = `<div class="user-avatar"><ion-icon name="person-outline"></ion-icon></div><div class="user-info"><div class="user-name">${escapeHtml(user.username || 'Пользователь')}</div><div class="user-status ${status === 'online' ? 'online' : 'offline'}"></div></div>`;
        item.onclick = () => openChatWithUser(user.id, user.username);
        container.appendChild(item);
    }
}

async function getOrCreateChatId(u1, u2) {
    console.log('Поиск чата между:', u1, u2);
    try {
        const { data: u1Chats } = await window.sbClient.from('chat_participants').select('chat_id').eq('user_id', u1);
        if (u1Chats?.length) {
            const { data: common } = await window.sbClient.from('chat_participants').select('chat_id').eq('user_id', u2).in('chat_id', u1Chats.map(c => c.chat_id));
            if (common?.length) { console.log('Найден чат:', common[0].chat_id); return common[0].chat_id; }
        }
        console.log('Создаём новый чат...');
        const { data: newChat, error } = await window.sbClient.from('chats').insert({}).select().single();
        if (error) throw error;
        await window.sbClient.from('chat_participants').insert([{ chat_id: newChat.id, user_id: u1 }, { chat_id: newChat.id, user_id: u2 }]);
        return newChat.id;
    } catch (err) { console.error(err); return null; }
}

// =========================== 6. ОТКРЫТИЕ ЧАТА ===========================
async function openChatWithUser(userId, userName, existingChatId = null) {
    const { data: { user: cur } } = await window.sbClient.auth.getUser();
    if (!cur) return;
    resetTypingStatus();
    currentChatUser = { id: userId, name: userName };
    const title = document.getElementById('currentChatTitle');
    const status = await getUserStatus(userId);
    if (title) {
        title.innerHTML = `${escapeHtml(userName)} <span class="user-status-indicator ${status}"></span>`;
    }
    currentChatId = existingChatId || await getOrCreateChatId(cur.id, userId);
    if (!currentChatId) {
        console.error('Не удалось получить ID чата');
        return;
    }
    console.log('Открыт чат:', currentChatId);
    await loadMessages();
    updateDesktopEmptyState();
    if (window.innerWidth <= 767) {
        document.querySelector('.chat').classList.add('chat-opened');
    }
    document.querySelectorAll('.chat-item, .user-item').forEach(i => i.classList.remove('active'));
    const activeItem = document.querySelector(`.chat-item[data-user-id="${userId}"]`);
    if (activeItem) activeItem.classList.add('active');
}

async function loadMessages() {
    if (!currentChatId) {
        updateDesktopEmptyState();
        return;
    }

    const { data: { user: cur } } = await window.sbClient.auth.getUser();
    if (!cur) return;

    const { data: messages, error: msgError } = await window.sbClient
        .from('messages')
        .select('*')
        .eq('chat_id', currentChatId)
        .order('created_at', { ascending: true });

    if (msgError) {
        console.error(msgError);
        return;
    }

    if (messagesContainer) messagesContainer.innerHTML = '';

    if (messages?.length) {
        for (const msg of messages) {
            const { data: attachments } = await window.sbClient
                .from('attachments')
                .select('*')
                .eq('message_id', msg.id)
                .maybeSingle();

            const isOwn = msg.sender_id === cur.id;
            let attachment = null;
            if (attachments) {
                attachment = {
                    url: attachments.file_url || attachments.title_id,
                    name: attachments.file_name,
                    size: attachments.file_size,
                    type: attachments.file_type
                };
            }
            displayMessageWithAttachment(msg.text, isOwn, msg.created_at, msg.id, attachment);
        }
        setTimeout(() => messagesContainer && (messagesContainer.scrollTop = messagesContainer.scrollHeight), 100);
    } else {
        // Показываем приветственное сообщение только если нет ни одного сообщения
        const welcome = document.createElement('div');
        welcome.className = 'message-container system';
        welcome.innerHTML = `<span class="message-content">💬 Напишите первое сообщение ${escapeHtml(currentChatUser?.name || 'собеседнику')}</span>`;
        messagesContainer?.appendChild(welcome);
    }

    updateDesktopEmptyState();
}

// =========================== 7. ОТПРАВКА И УДАЛЕНИЕ ===========================
async function deleteMessage(msgId, el) {
    if (!msgId) return;

    const chatIdToUpdate = currentChatId;

    const { error } = await window.sbClient.from('messages').delete().eq('id', msgId);
    if (error) { console.error(error); return; }

    const msg = el?.closest('.message-container');
    if (msg) msg.remove();

    await loadUserChats();
    if (window.innerWidth <= 767) await loadMobileChats();

    // Проверяем, остались ли сообщения в чате
    const remainingMessages = document.querySelectorAll('.message-container:not(.system)');
    if (remainingMessages.length === 0) {
        // Если сообщений нет, показываем приветственное
        const welcome = document.createElement('div');
        welcome.className = 'message-container system';
        welcome.innerHTML = `<span class="message-content">💬 Напишите первое сообщение ${escapeHtml(currentChatUser?.name || 'собеседнику')}</span>`;
        messagesContainer?.appendChild(welcome);
    }

    if (chatIdToUpdate === currentChatId) {
        renderChatsList();
    }
}

// =========================== 8. REALTIME ПОДПИСКИ ===========================
function subscribeToMessages() {
    if (messagesSubscription) window.sbClient.removeChannel(messagesSubscription);
    messagesSubscription = window.sbClient.channel('messages-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async p => {
            const msg = p.new;
            const { data: { user: cur } } = await window.sbClient.auth.getUser();
            if (!cur) return;
            const isOwn = msg.sender_id === cur.id;
            // Удаляем системное сообщение при первом сообщении в чате
            if (msg.chat_id === currentChatId) {
            const systemMessage = document.querySelector('.message-container.system');
            if (systemMessage) {
                systemMessage.remove();
                }
            }
            if (!isOwn) {
                const { data: profile } = await window.sbClient.from('profiles').select('username').eq('id', msg.sender_id).single();
                const senderName = profile?.username || 'Пользователь';
                const messageText = msg.text?.substring(0, 50) || '📎 Файл';
                await showNotification(senderName, messageText, `chat_${msg.sender_id}`, msg.sender_id);
                await loadUserChats();
                if (window.innerWidth <= 767) await loadMobileChats();
                try {
                    await fetch('/api/send-push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ toUserId: cur.id, title: senderName, body: messageText, icon: '/favicon.ico' })
                    });
                } catch (pushError) { console.error('❌ Ошибка отправки push:', pushError); }
            }
            if (msg.chat_id === currentChatId && !isOwn) {
                const { data: attachments } = await window.sbClient.from('attachments').select('*').eq('message_id', msg.id).maybeSingle();
                let attachment = null;
                if (attachments) {
                    attachment = { url: attachments.file_url || attachments.title_id, name: attachments.file_name, size: attachments.file_size, type: attachments.file_type };
                }
                displayMessageWithAttachment(msg.text, false, msg.created_at, msg.id, attachment);
                setTimeout(() => messagesContainer && (messagesContainer.scrollTop = messagesContainer.scrollHeight), 50);
            }
            if (!isOwn) { await loadUserChats(); }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, async p => {
            const del = p.old;
            const el = document.querySelector(`.message-container[data-message-id="${del.id}"]`);
            if (el) el.remove();

            // Перезагружаем список чатов один раз
            await loadUserChats();
            if (window.innerWidth <= 767) await loadMobileChats();

            if (currentChatId === del.chat_id && messagesContainer && !messagesContainer.children.length) {
                const welcome = document.createElement('div');
                welcome.className = 'message-container system';
                welcome.innerHTML = `<span class="message-content">💬 Напишите первое сообщение ${currentChatUser?.name || 'собеседнику'}</span>`;
                messagesContainer.appendChild(welcome);
            }
        })
        .subscribe(s => s === 'SUBSCRIBED' && console.log('✅ Подписка на сообщения активна'));
}

function subscribeToProfiles() {
    if (profilesSubscription) window.sbClient.removeChannel(profilesSubscription);
    profilesSubscription = window.sbClient.channel('profiles-realtime')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, async p => {
            const up = p.new;
            if (currentChatUser?.id === up.id) {
                currentChatUser.name = up.username;
                const title = document.getElementById('currentChatTitle');
                if (title) title.textContent = up.username;
            }
            await loadUsers(); await loadUserChats();
        })
        .subscribe(s => s === 'SUBSCRIBED' && console.log('✅ Подписка на профили активна'));
}

function subscribeToStatus() {
    if (statusSubscription) window.sbClient.removeChannel(statusSubscription);
    statusSubscription = window.sbClient.channel('status-realtime')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_status' }, async p => {
            const up = p.new;
            if (currentChatUser?.id === up.id) {
                const title = document.getElementById('currentChatTitle');
                if (title) title.innerHTML = `${currentChatUser.name} <span class="user-status-indicator ${up.status}"></span>`;
            }
            const userEl = document.querySelector(`.user-item[data-user-id="${up.id}"] .user-status`);
            if (userEl) userEl.className = `user-status ${up.status === 'online' ? 'online' : 'offline'}`;
            await loadUsers();
        })
        .subscribe(s => s === 'SUBSCRIBED' && console.log('✅ Подписка на статусы активна'));
}

// =========================== 9. СТАТУС ОНЛАЙН/ОФФЛАЙН ===========================
async function updateUserStatus(status) {
    const { data: { user } } = await window.sbClient.auth.getUser();
    if (!user) return;
    await window.sbClient.from('user_status').upsert({ id: user.id, status, last_seen: new Date().toISOString(), updated_at: new Date().toISOString() });
}

async function getUserStatus(uid) {
    const { data } = await window.sbClient.from('user_status').select('status, last_seen').eq('id', uid).single();
    if (!data) return 'offline';
    if (data.status === 'online' && data.last_seen && (new Date() - new Date(data.last_seen)) / 1000 / 60 > 2) return 'offline';
    return data.status || 'offline';
}

function startStatusTracking() {
    updateUserStatus('online');
    if (statusUpdateInterval) clearInterval(statusUpdateInterval);
    statusUpdateInterval = setInterval(() => updateUserStatus('online'), 30000);
    window.addEventListener('beforeunload', () => updateUserStatus('offline'));
    document.addEventListener('visibilitychange', () => updateUserStatus(document.hidden ? 'offline' : 'online'));
}

function stopStatusTracking() {
    if (statusUpdateInterval) { clearInterval(statusUpdateInterval); statusUpdateInterval = null; }
    updateUserStatus('offline');
}

// =========================== 10. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК И ПОИСК ===========================
function switchTab(tab) {
    activeTab = tab;
    const chats = document.getElementById('chatsList'), users = document.getElementById('usersListContainer');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (tab === 'chats') {
        document.querySelector('.tab[data-tab="chats"]')?.classList.add('active');
        chats?.classList.remove('hidden'); users?.classList.add('hidden');
        renderChatsList();
    } else {
        document.querySelector('.tab[data-tab="users"]')?.classList.add('active');
        chats?.classList.add('hidden'); users?.classList.remove('hidden');
        renderUsersList();
    }
}

function setupSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    input.addEventListener('input', e => { searchQuery = e.target.value; activeTab === 'chats' ? renderChatsList() : renderUsersList(); });
}

// =========================== 11. МОДАЛЬНЫЕ ОКНА ===========================
document.querySelector('.profile-icon')?.addEventListener('click', () => currentChatUser ? showUserProfileModal(currentChatUser.id, currentChatUser.name) : alert('Сначала выберите собеседника'));

async function showProfileModal() {
    const { data: { user } } = await window.sbClient.auth.getUser();
    if (!user) {
        alert('Ошибка');
        return;
    }

    const { data: profile } = await window.sbClient.from('profiles').select('*').eq('id', user.id).single();
    const username = profile?.username || user.user_metadata?.username || localStorage.getItem('currentUsername') || 'Пользователь';
    const email = user.email || '';
    const date = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : 'Неизвестно';

    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `<div class="custom-modal-content">
        <div class="custom-modal-header">
            <ion-icon name="person-circle-outline"></ion-icon>
            <h3>Профиль</h3>
            <button class="modal-close-btn"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <div class="custom-modal-body">
            <div class="profile-avatar">
                <ion-icon name="person-circle-outline"></ion-icon>
            </div>
            <div class="profile-field">
                <label>👤 Имя пользователя</label>
                <input type="text" id="profileName" value="${escapeHtml(username)}">
                <small class="profile-hint">Может содержать буквы, цифры и пробелы</small>
            </div>
            <div class="profile-field">
                <label>📧 Email</label>
                <input type="email" value="${escapeHtml(email)}" disabled>
                <small class="profile-hint">Email нельзя изменить</small>
            </div>
            <div class="profile-field">
                <label>📅 Дата регистрации</label>
                <input type="text" value="${date}" disabled>
            </div>
            <div class="profile-status">
                <ion-icon name="sync-outline"></ion-icon>
                <span>Статус: онлайн</span>
            </div>
            <button id="saveProfileBtn" class="modal-btn">💾 Сохранить изменения</button>
        </div>
    </div>`;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => modal.remove();
    }

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    const save = modal.querySelector('#saveProfileBtn');
    const nameInput = modal.querySelector('#profileName');

    if (save && nameInput) {
        save.onclick = async () => {
            const newName = nameInput.value.trim();
            if (!newName || newName.length < 2) {
                alert('❌ Имя должно быть не менее 2 символов');
                return;
            }
            save.disabled = true;
            save.textContent = '⏳ Сохранение...';

            const { error } = await window.sbClient.from('profiles').update({ username: newName }).eq('id', user.id);
            if (error) {
                alert('❌ Ошибка: ' + error.message);
                save.disabled = false;
                save.textContent = '💾 Сохранить изменения';
                return;
            }

            await window.sbClient.auth.updateUser({ data: { username: newName } });
            localStorage.setItem('currentUsername', newName);

            if (currentChatUser?.id === user.id) {
                currentChatUser.name = newName;
                const title = document.getElementById('currentChatTitle');
                if (title) title.textContent = newName;
            }

            await loadUsers();
            await loadUserChats();

            alert('✅ Имя изменено!');
            modal.remove();
        };
    }
}

async function showSettingsModal() {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `
        <div class="custom-modal-content">
            <div class="custom-modal-header">
                <ion-icon name="settings-outline"></ion-icon>
                <h3>Настройки</h3>
                <button class="modal-close-btn"><ion-icon name="close-outline"></ion-icon></button>
            </div>
            <div class="custom-modal-body">
                <div class="settings-item">
                    <label>Уведомления</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="notificationsCheckbox" ${localStorage.getItem('notifications') !== 'false' ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-item">
                    <label>Звук сообщений</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="soundCheckbox" ${localStorage.getItem('sound') !== 'false' ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-item">
                    <label>Тёмная тема</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="darkThemeCheckbox" ${localStorage.getItem('darkTheme') === 'true' ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-item">
                    <label>Push-уведомления</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="pushNotificationsCheckbox">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => modal.remove();
    }

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    const notificationsCheckbox = modal.querySelector('#notificationsCheckbox');
    if (notificationsCheckbox) {
        notificationsCheckbox.onchange = (e) => localStorage.setItem('notifications', e.target.checked);
    }

    const soundCheckbox = modal.querySelector('#soundCheckbox');
    if (soundCheckbox) {
        soundCheckbox.onchange = (e) => {
            soundEnabled = e.target.checked;
            localStorage.setItem('sound', e.target.checked);
        };
    }

    const darkThemeCheckbox = modal.querySelector('#darkThemeCheckbox');
    if (darkThemeCheckbox) {
        darkThemeCheckbox.onchange = (e) => {
            if (e.target.checked) {
                document.body.classList.add('dark');
                localStorage.setItem('darkTheme', 'true');
            } else {
                document.body.classList.remove('dark');
                localStorage.setItem('darkTheme', 'false');
            }
        };
    }

    const pushCheckbox = modal.querySelector('#pushNotificationsCheckbox');
    if (pushCheckbox) {
        if (!swRegistration) await registerServiceWorker();
        const isSubscribed = await checkPushSubscription();
        pushCheckbox.checked = isSubscribed;
        pushCheckbox.onchange = async (e) => {
            if (e.target.checked) {
                await subscribeToPush();
            } else {
                await unsubscribeFromPush();
            }
            pushCheckbox.checked = await checkPushSubscription();
        };
    }
}

async function showUserProfileModal(uid, uname) {
    if (!uid) { alert('Пользователь не выбран'); return; }
    const { data: profile } = await window.sbClient.from('profiles').select('*').eq('id', uid).single();
    if (!profile) { alert('Не удалось загрузить профиль'); return; }
    const date = profile.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : 'Неизвестно';
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `<div class="custom-modal-content"><div class="custom-modal-header"><ion-icon name="person-circle-outline"></ion-icon><h3>Профиль пользователя</h3><button class="modal-close-btn"><ion-icon name="close-outline"></ion-icon></button></div><div class="custom-modal-body"><div class="profile-avatar"><ion-icon name="person-circle-outline"></ion-icon></div><div class="profile-field"><label>👤 Имя пользователя</label><input type="text" value="${escapeHtml(profile.username || uname || 'Пользователь')}" disabled></div><div class="profile-field"><label>📅 Дата регистрации</label><input type="text" value="${date}" disabled></div><div class="profile-status"><ion-icon name="chatbubble-outline"></ion-icon><span>Ваш собеседник</span></div></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
}

// =========================== 12. ФУНКЦИИ ДЛЯ ОТПРАВКИ СООБЩЕНИЙ ===========================
function autoResizeTextarea() {
    if (!messageInput) return;
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

function updateCharCounter() {
    const counter = document.getElementById('charCounter');
    if (!counter || !messageInput) return;
    const length = messageInput.value.length;
    const maxLength = 4096;
    if (length > maxLength - 100) {
        counter.textContent = `${maxLength - length}`;
        counter.classList.add('visible');
        counter.style.color = length >= maxLength ? '#ff4444' : '#888';
    } else {
        counter.classList.remove('visible');
    }
}

function initEmojiPicker() {
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emojiPicker');
    if (!emojiBtn || !emojiPicker) return;
    emojiBtn.addEventListener('click', (e) => { e.stopPropagation(); emojiPicker.style.display = emojiPicker.style.display === 'flex' ? 'none' : 'flex'; });
    document.querySelectorAll('.emoji-list span').forEach(emoji => {
        emoji.addEventListener('click', () => {
            if (!messageInput) return;
            const start = messageInput.selectionStart;
            const end = messageInput.selectionEnd;
            const emojiChar = emoji.textContent;
            messageInput.value = messageInput.value.substring(0, start) + emojiChar + messageInput.value.substring(end);
            messageInput.selectionStart = messageInput.selectionEnd = start + emojiChar.length;
            messageInput.focus();
            autoResizeTextarea();
            updateCharCounter();
            emojiPicker.style.display = 'none';
        });
    });
    document.addEventListener('click', (e) => { if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) emojiPicker.style.display = 'none'; });
}

function initMessageInput() {
    let textarea = document.getElementById('message');
    if (!textarea) return;
    const newTextarea = textarea.cloneNode(true);
    textarea.parentNode.replaceChild(newTextarea, textarea);
    messageInput = newTextarea;
    newTextarea.addEventListener('input', () => { autoResizeTextarea(); updateCharCounter(); if (currentChatId) sendTypingStatus(); });
    newTextarea.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); resetTypingStatus(); sendMessage(); } });
    autoResizeTextarea();
    updateCharCounter();
}

function initAttachMenu() {
    const attachBtn = document.getElementById('attachBtn');
    const attachMenu = document.getElementById('attachMenu');
    const attachPhotoBtn = document.getElementById('attachPhotoBtn');
    const attachFileBtn = document.getElementById('attachFileBtn');
    const photoInput = document.getElementById('photoInput');
    const fileInput = document.getElementById('fileInput');
    if (!attachBtn || !attachMenu) return;
    attachBtn.addEventListener('click', (e) => { e.stopPropagation(); attachMenu.style.display = attachMenu.style.display === 'flex' ? 'none' : 'flex'; });
    document.addEventListener('click', (e) => { if (!attachMenu.contains(e.target) && e.target !== attachBtn) attachMenu.style.display = 'none'; });
    if (attachPhotoBtn && photoInput) {
        attachPhotoBtn.addEventListener('click', () => { photoInput.click(); attachMenu.style.display = 'none'; });
        photoInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                if (file.size > 50 * 1024 * 1024) { alert('Файл слишком большой. Максимум 50MB'); return; }
                if (!file.type.startsWith('image/')) { alert('Пожалуйста, выберите изображение'); return; }
                const compressedFile = await compressImage(file);
                pendingFile = compressedFile;
                preventAutoSend = true;
                showFilePreview(compressedFile);
                setTimeout(() => { preventAutoSend = false; }, 500);
            }
            photoInput.value = '';
        });
    }
    if (attachFileBtn && fileInput) {
        attachFileBtn.addEventListener('click', () => { fileInput.click(); attachMenu.style.display = 'none'; });
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                if (file.size > 50 * 1024 * 1024) { alert('Файл слишком большой. Максимум 50MB'); return; }
                pendingFile = file;
                showFilePreview(file);
            }
            fileInput.value = '';
        });
    }
}

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                const maxSize = 1200;
                if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
                else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => { resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() })); }, file.type, 0.8);
            };
        };
    });
}

function showFilePreview(file) {
    const oldPreview = document.getElementById('previewContainer');
    if (oldPreview) oldPreview.remove();
    const container = document.createElement('div');
    container.className = 'preview-container';
    container.id = 'previewContainer';
    const isImage = file.type?.startsWith('image/');
    const fileSize = formatFileSize(file.size);
    const updatePreview = (imageSrc) => {
        if (isImage && imageSrc) { container.innerHTML = `<img src="${imageSrc}" class="preview-image" alt=""><div class="preview-info"><span class="preview-name">${escapeHtml(file.name)}</span><span class="preview-size">${fileSize}</span></div><button class="preview-remove" onclick="removeFilePreview()">✕</button>`; }
        else { container.innerHTML = `<div class="file-icon"><ion-icon name="document-outline"></ion-icon></div><div class="preview-info"><span class="preview-name">${escapeHtml(file.name)}</span><span class="preview-size">${fileSize}</span></div><button class="preview-remove" onclick="removeFilePreview()">✕</button>`; }
        const inputDiv = document.querySelector('.input');
        const messagerEl = document.getElementById('messager');
        if (messagerEl && inputDiv) messagerEl.insertBefore(container, inputDiv);
    };
    if (isImage) { const reader = new FileReader(); reader.onload = (e) => updatePreview(e.target.result); reader.readAsDataURL(file); }
    else { updatePreview(null); }
}

function removeFilePreview() {
    const preview = document.getElementById('previewContainer');
    if (preview) preview.remove();
    pendingFile = null;
}

async function uploadFile(file) {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `public/${fileName}`;
    try {
        const { error } = await window.sbClient.storage.from('chat-attachments').upload(filePath, file, { cacheControl: '3600', upsert: false });
        if (error) { console.error('❌ Ошибка загрузки:', error); alert('Ошибка загрузки: ' + error.message); return null; }
        const SUPABASE_URL = SUPABASE_CONFIG.url;
        const bucketName = 'chat-attachments';
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;
        return { url: publicUrl, name: file.name, size: file.size, type: file.type };
    } catch (err) { console.error('❌ Ошибка:', err); return null; }
}

function initPhotoViewer() {
    const viewer = document.getElementById('photoViewer');
    const closeBtn = document.getElementById('photoViewerClose');
    const viewerImg = document.getElementById('photoViewerImg');
    if (!viewer) return;
    closeBtn?.addEventListener('click', () => { viewer.style.display = 'none'; viewerImg.src = ''; });
    viewer.addEventListener('click', (e) => { if (e.target === viewer) { viewer.style.display = 'none'; viewerImg.src = ''; } });
}

function openPhotoViewer(url) {
    const viewer = document.getElementById('photoViewer');
    const viewerImg = document.getElementById('photoViewerImg');
    if (viewer && viewerImg) { viewerImg.src = url; viewer.style.display = 'flex'; }
}

function displayMessageWithAttachment(text, isOwn, createdAt, messageId, attachment) {
    // Удаляем системное сообщение "Напишите первое сообщение", если оно есть
    const systemMessage = document.querySelector('.message-container.system');
    if (systemMessage) {
        systemMessage.remove();
    }

    const container = document.createElement('div');
    container.className = 'message-container';
    container.setAttribute('data-message-id', messageId);
    if (!isOwn) container.classList.add('other');
    const time = createdAt ? new Date(createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : getShortTime();
    let innerHTML = '';
    if (text && text.trim()) innerHTML += `<span class="message-content">${escapeHtml(text)}</span>`;
    if (attachment && attachment.url) {
        const fileType = attachment.type || '';
        const fileName = attachment.name || 'file';
        const isImage = fileType.startsWith('image/');
        const isVideo = fileType.startsWith('video/');
        const isAudio = fileType.startsWith('audio/');
        const shortName = truncateFileName(fileName, window.innerWidth <= 480 ? 20 : 35);
        const downloadBtn = `<button class="file-download-btn" onclick="event.stopPropagation(); downloadFile('${attachment.url}', '${escapeHtml(fileName)}')"><ion-icon name="download-outline"></ion-icon></button>`;
        if (isImage) { innerHTML += `<div class="message-attachment"><img src="${attachment.url}" alt="${escapeHtml(fileName)}" loading="lazy" onclick="openPhotoViewer('${attachment.url}')">${downloadBtn}</div>`; }
        else if (isVideo) { innerHTML += `<div class="message-attachment video-attachment"><video controls preload="metadata" class="video-player"><source src="${attachment.url}" type="${fileType}"></video><div class="file-info"><div class="file-name">🎬 ${escapeHtml(shortName)}</div><div class="file-size">${formatFileSize(attachment.size)}</div>${downloadBtn}</div></div>`; }
        else if (isAudio) { innerHTML += `<div class="message-attachment audio-attachment"><div class="audio-player-wrapper"><audio controls preload="metadata" class="audio-player"><source src="${attachment.url}" type="${fileType}"></audio></div><div class="file-info"><div class="file-name">🎵 ${escapeHtml(shortName)}</div><div class="file-size">${formatFileSize(attachment.size)}</div>${downloadBtn}</div></div>`; }
        else { innerHTML += `<div class="message-attachment"><div class="file-icon"><ion-icon name="document-outline"></ion-icon></div><div class="file-info"><div class="file-name">${escapeHtml(shortName)}</div><div class="file-size">${formatFileSize(attachment.size)}</div>${downloadBtn}</div></div>`; }
    }
    innerHTML += `<span class="message-time">${time}</span>`;
    if (isOwn) innerHTML += `<button class="message-delete-btn" onclick="deleteMessage('${messageId}', this.parentElement)"><ion-icon name="close-outline"></ion-icon></button>`;
    container.innerHTML = innerHTML;
    messagesContainer?.appendChild(container);

    // Прокручиваем к новому сообщению
    setTimeout(() => {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, 50);
}

async function sendMessage() {
    if (preventAutoSend || isSending) return;
    const value = messageInput?.value.trim();
    if (!value && !pendingFile) return;
    if (!currentChatUser) { alert('Сначала выберите собеседника'); return; }
    isSending = true;
    const fileToSend = pendingFile;
    pendingFile = null;
    const preview = document.getElementById('previewContainer');
    if (preview) preview.remove();

    // Удаляем системное сообщение перед отправкой
    const systemMessage = document.querySelector('.message-container.system');
    if (systemMessage) {
        systemMessage.remove();
    }

    try {
        const { data: { user: currentUser } } = await window.sbClient.auth.getUser();
        if (!currentUser) { isSending = false; return; }
        if (!currentChatId) {
            const chatId = await getOrCreateChatId(currentUser.id, currentChatUser.id);
            if (!chatId) { alert('Ошибка создания чата'); isSending = false; return; }
            currentChatId = chatId;
        }
        let attachment = null;
        if (fileToSend) {
            attachment = await uploadFile(fileToSend);
            if (!attachment) { alert('Не удалось загрузить файл'); isSending = false; return; }
        }
        const { data, error } = await window.sbClient.from('messages').insert({ chat_id: currentChatId, sender_id: currentUser.id, receiver_id: currentChatUser.id, text: value || '' }).select().single();
        if (error) { console.error('❌ Ошибка:', error); alert('Ошибка: ' + error.message); isSending = false; return; }
        if (attachment && data) { await window.sbClient.from('attachments').insert({ message_id: data.id, file_url: attachment.url, file_name: attachment.name, file_size: attachment.size, file_type: attachment.type }); }
        displayMessageWithAttachment(value, true, data.created_at, data.id, attachment);
        messageInput.value = '';
        autoResizeTextarea();
        updateCharCounter();
        await loadUserChats();
        if (window.innerWidth <= 767) await loadMobileChats();
        setTimeout(() => { if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight; }, 50);
    } catch (err) { console.error('❌ Ошибка:', err); }
    finally { isSending = false; }
}

// =========================== 13. НАЗНАЧЕНИЕ ОБРАБОТЧИКОВ ===========================
if (registerBtn) registerBtn.onclick = e => { e.preventDefault(); registerWindow.classList.remove('close'); loginWindow.classList.add('close'); };
if (loginBtn) loginBtn.onclick = e => { e.preventDefault(); loginWindow.classList.remove('close'); registerWindow.classList.add('close'); };
if (enterBtn) enterBtn.onclick = enterChat;
if (regBtn) regBtn.onclick = registerUser;
if (sendButton) sendButton.addEventListener('click', sendMessage);

const addEnterHandler = (el, cb) => el?.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); cb(); } });
addEnterHandler(loginUsername, enterChat);
addEnterHandler(loginPassword, enterChat);
addEnterHandler(regUsername, registerUser);
addEnterHandler(regEmail, registerUser);
addEnterHandler(regPassword, registerUser);

if (messageInput) messageInput.addEventListener('focus', () => setTimeout(() => messagesContainer && (messagesContainer.scrollTop = messagesContainer.scrollHeight), 300));
const setMobileHeight = () => { const m = document.getElementById('messager'); if (m) m.style.height = window.innerHeight + 'px'; };
window.addEventListener('resize', setMobileHeight);
setMobileHeight();

// =========================== 14. ФУНКЦИИ ДЛЯ TELEGRAM-СТИЛЯ ===========================
function closeChatOnMobile() {
    if (window.innerWidth <= 767) {
        document.querySelector('.chat').classList.remove('chat-opened');
    }
}

function updateDesktopEmptyState() {
    if (window.innerWidth <= 767) return;
    const messagerEl = document.getElementById('messager');
    const emptyScreen = document.getElementById('emptyChatScreen');
    const messageText = document.getElementById('messageText');
    const inputDiv = document.querySelector('.input');
    if (!messagerEl) return;
    if (!currentChatId || !currentChatUser) {
        messagerEl.classList.add('empty-state-active');
        if (emptyScreen) emptyScreen.style.display = 'flex';
        if (messageText) messageText.classList.add('hidden');
        if (inputDiv) inputDiv.classList.add('hidden');
    } else {
        messagerEl.classList.remove('empty-state-active');
        if (emptyScreen) emptyScreen.style.display = 'none';
        if (messageText) messageText.classList.remove('hidden');
        if (inputDiv) inputDiv.classList.remove('hidden');
    }
}

function updateDesktopEntryState() { updateDesktopEmptyState(); }

window.closeChatOnMobile = closeChatOnMobile;
window.updateDesktopEmptyState = updateDesktopEmptyState;
window.updateDesktopEntryState = updateDesktopEntryState;

if (mobileBackBtn) { mobileBackBtn.addEventListener('click', closeChatOnMobile); }

// Свайпы на мобилке
let touchStartX = 0;
document.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; });
document.addEventListener('touchend', (e) => {
    if (window.innerWidth > 767) return;
    const diff = e.changedTouches[0].screenX - touchStartX;
    if (diff < -50 && document.querySelector('.chat')?.classList.contains('chat-opened')) { closeChatOnMobile(); }
});

// =========================== 15. ОБРАБОТЧИКИ ДЛЯ КНОПОК ===========================
// Мобильные кнопки
const mobileProfileBtn = document.getElementById('mobileProfileBtn');
const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
const mobileExitBtn = document.getElementById('mobileExitBtn');

if (mobileProfileBtn) {
    mobileProfileBtn.addEventListener('click', () => {
        showProfileModal();
        if (window.innerWidth <= 767 && document.querySelector('.chat')?.classList.contains('chat-opened')) {
            closeChatOnMobile();
        }
    });
}

if (mobileSettingsBtn) {
    mobileSettingsBtn.addEventListener('click', () => {
        showSettingsModal();
        if (window.innerWidth <= 767 && document.querySelector('.chat')?.classList.contains('chat-opened')) {
            closeChatOnMobile();
        }
    });
}

if (mobileExitBtn) {
    mobileExitBtn.addEventListener('click', logout);
}

// Десктопные кнопки
const profileDesktopBtn = document.getElementById('profileDesktopBtn');
const settingsDesktopBtn = document.getElementById('settingsDesktopBtn');
const exitDesktopBtn = document.getElementById('exitDesktopBtn');

if (profileDesktopBtn) profileDesktopBtn.addEventListener('click', showProfileModal);
if (settingsDesktopBtn) settingsDesktopBtn.addEventListener('click', showSettingsModal);
if (exitDesktopBtn) exitDesktopBtn.addEventListener('click', logout);

// =========================== 16. СТАТУС "ПЕЧАТАЕТ" ===========================
async function updateTypingStatus(chatId, isTyping) {
    if (!window.sbClient || !chatId) return;
    const { data: { user } } = await window.sbClient.auth.getUser();
    if (!user) return;
    try { await window.sbClient.from('typing_status').upsert({ user_id: user.id, chat_id: chatId, is_typing: isTyping, updated_at: new Date().toISOString() }, { onConflict: 'user_id,chat_id' }); }
    catch (err) { console.error('Ошибка:', err); }
}

function sendTypingStatus() {
    if (!currentChatId) return;
    if (isTypingCurrently) return;
    isTypingCurrently = true;
    updateTypingStatus(currentChatId, true);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { isTypingCurrently = false; updateTypingStatus(currentChatId, false); }, 2000);
}

function resetTypingStatus() {
    if (typingTimeout) clearTimeout(typingTimeout);
    if (isTypingCurrently) { isTypingCurrently = false; if (currentChatId) updateTypingStatus(currentChatId, false); }
}

function subscribeToTypingStatus() {
    if (typingSubscription) window.sbClient.removeChannel(typingSubscription);
    typingSubscription = window.sbClient.channel('typing-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_status' }, async (payload) => {
            const newStatus = payload.new;
            if (payload.eventType === 'DELETE' || !newStatus) return;
            if (newStatus.chat_id !== currentChatId) return;
            const { data: { user } } = await window.sbClient.auth.getUser();
            if (!user || newStatus.user_id === user.id) return;
            const chatTitle = document.getElementById('currentChatTitle');
            if (!chatTitle) return;
            if (newStatus.is_typing) { chatTitle.innerHTML = `${currentChatUser?.name || ''} <span class="typing-indicator" style="font-size: 12px; color: #43ca00;">✍️ печатает...</span>`; }
            else { const userStatus = await getUserStatus(newStatus.user_id); chatTitle.innerHTML = `${currentChatUser?.name || ''} <span class="user-status-indicator ${userStatus}"></span>`; }
        })
        .subscribe((status) => { if (status === 'SUBSCRIBED') console.log('✅ Подписка на статусы печатания активна'); });
}

// =========================== 17. PUSH-УВЕДОМЛЕНИЯ ===========================
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
}

async function subscribeToPush() {
    if (!swRegistration) { await registerServiceWorker(); }
    if (!swRegistration) { alert('Service Worker не зарегистрирован'); return false; }
    try {
        let subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) { console.log('Подписка уже существует'); await saveSubscriptionToServer(subscription); localStorage.setItem('pushEnabled', 'true'); alert('✅ Push-уведомления уже включены'); return true; }
        subscription = await swRegistration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
        console.log('✅ Push-подписка создана', subscription);
        await saveSubscriptionToServer(subscription);
        localStorage.setItem('pushEnabled', 'true');
        alert('✅ Push-уведомления включены!');
        return true;
    } catch (error) { console.error('❌ Ошибка подписки:', error); alert('Ошибка: ' + error.message); return false; }
}

async function saveSubscriptionToServer(subscription) {
    const { data: { user } } = await window.sbClient.auth.getUser();
    if (!user) return false;
    try {
        const response = await fetch('/api/save-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, subscription: subscription }) });
        if (response.ok) { console.log('✅ Подписка сохранена на сервере'); return true; }
        else { console.error('Ошибка сохранения на сервере'); return false; }
    } catch (error) { console.error('Ошибка:', error); return false; }
}

async function unsubscribeFromPush() {
    if (!swRegistration) return false;
    try {
        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            const { data: { user } } = await window.sbClient.auth.getUser();
            await fetch('/api/delete-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user?.id }) });
            localStorage.setItem('pushEnabled', 'false');
            console.log('✅ Push-подписка удалена');
            alert('❌ Push-уведомления отключены');
            return true;
        }
    } catch (error) { console.error('Ошибка отписки:', error); }
    return false;
}

async function checkPushSubscription() {
    if (!swRegistration) { await registerServiceWorker(); }
    if (!swRegistration) return false;
    try {
        const subscription = await swRegistration.pushManager.getSubscription();
        const isSubscribed = !!subscription;
        if (isSubscribed !== (localStorage.getItem('pushEnabled') === 'true')) { localStorage.setItem('pushEnabled', isSubscribed); }
        return isSubscribed;
    } catch (error) { console.error('Ошибка проверки подписки:', error); return false; }
}

async function downloadFile(url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(blobUrl); }, 100);
    } catch (error) { console.error('Ошибка скачивания:', error); window.open(url, '_blank'); }
    await registerServiceWorker();
    const isSubscribed = await checkPushSubscription();
    if (isSubscribed) { localStorage.setItem('pushEnabled', 'true'); const subscription = await swRegistration.pushManager.getSubscription(); if (subscription) { await saveSubscriptionToServer(subscription); } }
    else { const savedPushEnabled = localStorage.getItem('pushEnabled') === 'true'; if (savedPushEnabled) { await subscribeToPush(); } }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('darkTheme');
    if (savedTheme === 'true') {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }
}

// =========================== 18. ЗАГРУЗКА СТРАНИЦЫ ===========================
document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.getAttribute('data-tab'))));
    setupSearch();
    const { data: { session } } = await window.sbClient.auth.getSession();
    if (session) {
        loginWindow?.classList.add('close'); registerWindow?.classList.add('close'); chatWindow?.classList.remove('close');
        await loadUsers(); await loadUserChats();
        subscribeToMessages(); subscribeToProfiles(); subscribeToStatus();
        startStatusTracking();
        initAttachMenu(); initMessageInput(); initEmojiPicker(); initPhotoViewer();
        loadSavedTheme();
        subscribeToTypingStatus();
        await registerServiceWorker();
        setTimeout(() => updateDesktopEmptyState(), 100);
    } else {
        loginWindow?.classList.remove('close'); registerWindow?.classList.add('close'); chatWindow?.classList.add('close');
    }
    window.addEventListener('resize', () => { updateDesktopEmptyState(); if (window.innerWidth > 767) { document.querySelector('.chat')?.classList.remove('chat-opened'); } });
});