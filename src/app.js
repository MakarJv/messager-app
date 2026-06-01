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
const VAPID_PUBLIC_KEY = 'BD-Cv932C5rP0_50uvVg102h85E5HTDY1ZgSYlMpgAG9HGLI1SuYr7D5yyAEgEiB0qvBMuOfQSq8_xVB6Wh0UoQ';
const VAPID_PRIVAT_KEY ='ZWFD_3X5KR0B1GVld9cTzNy-352lOY7gbFcbDMYduo8';

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
let avatarSubscription = null;
let readReceiptsSubscription = null;
let pushSubscription = null;
let isPushSupported = false;
const avatarCache = new Map();

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

function urlBase64ToUint8Array(base64String) {
    if (!base64String || typeof base64String !== 'string') {
        console.error('❌ base64String is undefined or null');
        return new Uint8Array([0, 0, 0, 0]);
    }
    try {
        let cleanBase64 = base64String.trim();
        while (cleanBase64.length % 4 !== 0) {
            cleanBase64 += '=';
        }
        cleanBase64 = cleanBase64.replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(cleanBase64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        console.log('✅ VAPID ключ преобразован успешно, длина:', outputArray.length);
        return outputArray;
    } catch (error) {
        console.error('❌ Ошибка преобразования base64:', error);
        return new Uint8Array([0x04, 0x08, 0x12, 0x16, 0x20]);
    }
}

function checkPushSupport() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
}

// =========================== 4. АВАТАРЫ ===========================
async function getUserAvatar(userId) {
    if (!userId) return null;
    try {
        const { data, error } = await window.sbClient
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .single();
        if (error || !data || !data.avatar_url) return null;
        return data.avatar_url;
    } catch (err) {
        console.error('Ошибка загрузки аватара:', err);
        return null;
    }
}

async function getAvatarUrl(userId, forceRefresh = false) {
    if (!forceRefresh && avatarCache.has(userId)) {
        return avatarCache.get(userId);
    }
    const url = await getUserAvatar(userId);
    avatarCache.set(userId, url);
    return url;
}

async function compressAvatarImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                const maxSize = 300;
                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
                }, file.type, 0.8);
            };
        };
    });
}

async function uploadAvatar(file) {
    const { data: { user } } = await window.sbClient.auth.getUser();
    if (!user) return null;
    if (file.size > 5 * 1024 * 1024) {
        alert('❌ Размер файла не должен превышать 5MB');
        return null;
    }
    if (!file.type.startsWith('image/')) {
        alert('❌ Пожалуйста, выберите изображение');
        return null;
    }
    const compressedFile = await compressAvatarImage(file);
    const fileExt = compressedFile.name.split('.').pop();
    const fileName = `avatar_${user.id}_${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;
    try {
        const { data: profile } = await window.sbClient
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();
        if (profile?.avatar_url) {
            const oldPath = profile.avatar_url.split('/avatars/')[1];
            if (oldPath) {
                await window.sbClient.storage.from('avatars').remove([`avatars/${oldPath}`]);
            }
        }
        const { error: uploadError } = await window.sbClient.storage
            .from('avatars')
            .upload(filePath, compressedFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = window.sbClient.storage
            .from('avatars')
            .getPublicUrl(filePath);
        const publicUrl = publicUrlData.publicUrl;
        const { error: updateError } = await window.sbClient
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);
        if (updateError) throw updateError;
        avatarCache.delete(user.id);
        return publicUrl;
    } catch (err) {
        console.error('❌ Ошибка загрузки аватара:', err);
        alert('Ошибка загрузки: ' + err.message);
        return null;
    }
}

async function deleteAvatar() {
    const { data: { user } } = await window.sbClient.auth.getUser();
    if (!user) return false;
    try {
        const { data: profile } = await window.sbClient
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();
        if (profile?.avatar_url) {
            const oldPath = profile.avatar_url.split('/avatars/')[1];
            if (oldPath) {
                await window.sbClient.storage.from('avatars').remove([`avatars/${oldPath}`]);
            }
        }
        const { error } = await window.sbClient
            .from('profiles')
            .update({ avatar_url: null })
            .eq('id', user.id);
        if (error) throw error;
        avatarCache.delete(user.id);
        return true;
    } catch (err) {
        console.error('❌ Ошибка удаления аватара:', err);
        return false;
    }
}

async function updateAllAvatars() {
    avatarCache.clear();
    await renderChatsList();
    await renderUsersList();
    if (currentChatUser) {
        const avatarUrl = await getAvatarUrl(currentChatUser.id);
        const profileIcon = document.querySelector('.profile-icon');
        if (profileIcon) {
            if (avatarUrl) {
                profileIcon.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(currentChatUser.name)}">`;
            } else {
                profileIcon.innerHTML = `<ion-icon name="person-circle-outline"></ion-icon>`;
            }
        }
    }
}

// =========================== 5. РЕГИСТРАЦИЯ, ВХОД, ВЫХОД ===========================
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
        swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('✅ Новый Service Worker зарегистрирован');
        await navigator.serviceWorker.ready;
        console.log('✅ Service Worker готов к работе');
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

// =========================== 6. РАБОТА С ПОЛЬЗОВАТЕЛЯМИ И ЧАТАМИ ===========================
async function loadUsers() {
    if (!window.sbClient) return;
    const { data: { user: currentUser } } = await window.sbClient.auth.getUser();
    if (!currentUser) return;
    const { data, error } = await window.sbClient.from('profiles').select('id, username').neq('id', currentUser.id);
    if (error) { console.error('Ошибка загрузки пользователей:', error); return; }

    // Получаем статусы для всех пользователей
    const usersWithStatus = [];
    for (const user of (data || [])) {
        const statusData = await getUserStatusWithLastSeen(user.id);
        usersWithStatus.push({
            ...user,
            status: statusData.status,
            lastSeen: statusData.rawLastSeen || new Date(0)
        });
    }

    // Сортируем: сначала онлайн, затем по времени последней активности (сначала те, кто был недавно)
    usersWithStatus.sort((a, b) => {
        // Онлайн всегда вверху
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;

        // Если оба онлайн или оба оффлайн - сортируем по времени последней активности
        const timeA = new Date(a.lastSeen);
        const timeB = new Date(b.lastSeen);
        return timeB - timeA; // Более поздние сверху
    });

    allUsers = usersWithStatus;
    renderUsersList();
}

async function getUnreadCount(chatId, userId) {
    if (!chatId || !userId) return 0;
    try {
        const { count, error } = await window.sbClient
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('chat_id', chatId)
            .eq('receiver_id', userId)
            .eq('is_read', false);
        if (error) {
            console.error('Ошибка получения счетчика непрочитанных:', error);
            return 0;
        }
        return count || 0;
    } catch (err) {
        console.error('Ошибка в getUnreadCount:', err);
        return 0;
    }
}

async function loadUserChats() {
    if (!window.sbClient) return;
    const { data: { user: currentUser } } = await window.sbClient.auth.getUser();
    if (!currentUser) return;
    const { data: participants, error } = await window.sbClient
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', currentUser.id);
    if (error) {
        console.error('Ошибка загрузки чатов:', error);
        return;
    }
    if (!participants?.length) {
        userChats = [];
        renderChatsList();
        return;
    }
    userChats = [];
    for (const p of participants) {
        const { data: other } = await window.sbClient
            .from('chat_participants')
            .select('user_id')
            .eq('chat_id', p.chat_id)
            .neq('user_id', currentUser.id);
        if (!other?.length) continue;
        const { data: profile } = await window.sbClient
            .from('profiles')
            .select('username')
            .eq('id', other[0].user_id)
            .single();
        const { data: lastMessage } = await window.sbClient
            .from('messages')
            .select('id, text, created_at, sender_id, is_read')
            .eq('chat_id', p.chat_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const unreadCount = await getUnreadCount(p.chat_id, currentUser.id);
        let lastMessageText = 'Нет сообщений';
        let lastMessageTime = null;
        let lastMessageSender = null;
        if (lastMessage) {
            lastMessageTime = lastMessage.created_at;
            lastMessageSender = lastMessage.sender_id;
            const { data: attachment } = await window.sbClient
                .from('attachments')
                .select('file_type, file_name')
                .eq('message_id', lastMessage.id)
                .maybeSingle();
            let messagePreview = '';
            if (attachment) {
                const fileType = attachment.file_type || '';
                if (fileType.startsWith('image/')) messagePreview = '📸 Фото';
                else if (fileType.startsWith('video/')) messagePreview = '🎬 Видео';
                else if (fileType.startsWith('audio/')) messagePreview = '🎵 Аудио';
                else messagePreview = '📎 Файл';
            } else if (lastMessage.text && lastMessage.text.trim()) {
                messagePreview = lastMessage.text.trim();
                if (messagePreview.length > 50) messagePreview = messagePreview.slice(0, 47) + '...';
            }
            if (lastMessage.sender_id !== currentUser.id) {
                const { data: senderProfile } = await window.sbClient
                    .from('profiles')
                    .select('username')
                    .eq('id', lastMessage.sender_id)
                    .single();
                if (senderProfile) {
                    lastMessageText = `${senderProfile.username}: ${messagePreview}`;
                } else {
                    lastMessageText = messagePreview;
                }
            } else {
                const readMark = lastMessage.is_read ? '✓✓' : '✓';
                lastMessageText = `Вы: ${messagePreview} ${readMark}`;
            }
        }
        userChats.push({
            chatId: p.chat_id,
            userId: other[0].user_id,
            username: profile?.username || 'Пользователь',
            lastMessage: lastMessageText,
            lastMessageTime: lastMessageTime,
            lastMessageSender: lastMessageSender,
            unreadCount: unreadCount
        });
    }
    userChats.sort((a, b) => {
        if (!a.lastMessageTime && !b.lastMessageTime) return 0;
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });
    renderChatsList();
}

async function renderChatsList() {
    const container = document.getElementById('chatsList');
    if (!container) return;
    container.innerHTML = '';
    if (!userChats.length) {
        container.innerHTML = `<div class="empty-state"><ion-icon name="chatbubbles-outline"></ion-icon><span>Нет активных чатов</span></div>`;
        return;
    }
    const uniqueChats = [];
    const seenUserIds = new Set();
    for (const chat of userChats) {
        if (!seenUserIds.has(chat.userId)) {
            seenUserIds.add(chat.userId);
            uniqueChats.push(chat);
        }
    }
    const filtered = uniqueChats.filter(c => c.username.toLowerCase().includes(searchQuery.toLowerCase()));
    for (const chat of filtered) {
        const item = document.createElement('div');
        item.className = 'chat-item';
        if (currentChatUser?.id === chat.userId) item.classList.add('active');
        if (chat.unreadCount > 0) item.classList.add('has-unread');
        item.setAttribute('data-user-id', chat.userId);
        item.setAttribute('data-chat-id', chat.chatId);
        const time = chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
        const avatarUrl = await getAvatarUrl(chat.userId);
        let unreadBadge = '';
        if (chat.unreadCount > 0) {
            unreadBadge = `<div class="unread-badge">${chat.unreadCount > 99 ? '99+' : chat.unreadCount}</div>`;
        }
        item.innerHTML = `<div class="chat-avatar">
                            ${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeHtml(chat.username)}" loading="lazy">` : `<ion-icon name="person-outline"></ion-icon>`}
                            ${unreadBadge}
                          </div>
                          <div class="chat-info">
                              <div class="chat-name">${escapeHtml(chat.username)}</div>
                              <div class="chat-last-message ${chat.unreadCount > 0 ? 'unread' : ''}">${escapeHtml(chat.lastMessage)}</div>
                          </div>
                          <div class="chat-time">${time}</div>`;
        item.onclick = () => openChatWithUser(chat.userId, chat.username, chat.chatId);
        container.appendChild(item);
    }
}

async function renderUsersList() {
    const container = document.getElementById('usersListContainer');
    if (!container) return;
    container.innerHTML = '';

    // Фильтрация по поисковому запросу
    const filtered = allUsers.filter(u => u.username?.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!filtered.length) {
        container.innerHTML = `<div class="empty-state"><ion-icon name="people-outline"></ion-icon><span>Нет других пользователей</span></div>`;
        return;
    }

    for (const user of filtered) {
        const statusData = await getUserStatusWithLastSeen(user.id);
        const avatarUrl = await getAvatarUrl(user.id);
        const item = document.createElement('div');
        item.className = 'user-item';
        if (statusData.status === 'online') {
            item.classList.add('user-online');
        }
        item.setAttribute('data-user-id', user.id);
        item.setAttribute('data-last-seen', user.lastSeen || '');

        item.innerHTML = `<div class="user-avatar">
                            ${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeHtml(user.username || 'Пользователь')}" loading="lazy">` : `<ion-icon name="person-outline"></ion-icon>`}
                            ${statusData.status === 'online' ? '<span class="online-indicator"></span>' : ''}
                          </div>
                          <div class="user-info">
                              <div class="user-name">${escapeHtml(user.username || 'Пользователь')}</div>
                              <div class="user-status-badge ${statusData.status === 'online' ? 'online' : 'offline'}">
                                  ${statusData.status === 'online' ? '🟢 Онлайн' : `🕒 ${statusData.lastSeen}`}
                              </div>
                          </div>`;
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

// =========================== 7. ОТКРЫТИЕ ЧАТА ===========================
async function openChatWithUser(userId, userName, existingChatId = null) {
    const { data: { user: cur } } = await window.sbClient.auth.getUser();
    if (!cur) return;
    resetTypingStatus();
    currentChatUser = { id: userId, name: userName };
    const title = document.getElementById('currentChatTitle');
    const statusData = await getUserStatusWithLastSeen(userId);
    const avatarUrl = await getAvatarUrl(userId);
    const profileIcon = document.querySelector('.profile-icon');
    if (profileIcon) {
        if (avatarUrl) {
            profileIcon.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(userName)}">`;
        } else {
            profileIcon.innerHTML = `<ion-icon name="person-circle-outline"></ion-icon>`;
        }
    }
    if (title) {
        if (statusData.status === 'online') {
            title.innerHTML = `${escapeHtml(userName)} <span class="user-status-indicator online"></span><span class="user-last-seen">онлайн</span>`;
        } else {
            title.innerHTML = `${escapeHtml(userName)} <span class="user-status-indicator offline"></span><span class="user-last-seen">${statusData.lastSeen}</span>`;
        }
    }
    currentChatId = existingChatId || await getOrCreateChatId(cur.id, userId);
    if (!currentChatId) {
        console.error('Не удалось получить ID чата');
        return;
    }
    console.log('Открыт чат:', currentChatId);
    await markMessagesAsRead(currentChatId);
    await loadMessages();
    updateDesktopEmptyState();
    if (window.innerWidth <= 767) {
        document.querySelector('.chat').classList.add('chat-opened');
    }
    document.querySelectorAll('.chat-item, .user-item').forEach(i => i.classList.remove('active'));
    const activeItem = document.querySelector(`.chat-item[data-user-id="${userId}"]`);
    if (activeItem) activeItem.classList.add('active');
}

async function markMessagesAsRead(chatId) {
    if (!chatId) return;
    const { data: { user } } = await window.sbClient.auth.getUser();
    if (!user) return;
    try {
        const { data: unreadMessages, error } = await window.sbClient
            .from('messages')
            .select('id')
            .eq('chat_id', chatId)
            .eq('receiver_id', user.id)
            .eq('is_read', false);
        if (error) {
            console.error('Ошибка получения непрочитанных сообщений:', error);
            return;
        }
        if (unreadMessages && unreadMessages.length > 0) {
            const { error: updateError } = await window.sbClient
                .from('messages')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .in('id', unreadMessages.map(m => m.id));
            if (updateError) {
                console.error('Ошибка обновления статуса прочтения:', updateError);
            } else {
                console.log(`✅ Помечено как прочитано: ${unreadMessages.length} сообщений`);
                await loadUserChats();
            }
        }
    } catch (err) {
        console.error('Ошибка в markMessagesAsRead:', err);
    }
}

async function loadMessages() {
    if (!currentChatId) {
        updateDesktopEmptyState();
        return;
    }
    const { data: { user: cur } } = await window.sbClient.auth.getUser();
    if (!cur) return;
    await markMessagesAsRead(currentChatId);
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
            displayMessageWithAttachment(msg.text, isOwn, msg.created_at, msg.id, attachment, msg.is_read);
        }
        setTimeout(() => messagesContainer && (messagesContainer.scrollTop = messagesContainer.scrollHeight), 100);
    } else {
        const welcome = document.createElement('div');
        welcome.className = 'message-container system';
        welcome.innerHTML = `<span class="message-content">💬 Напишите первое сообщение ${escapeHtml(currentChatUser?.name || 'собеседнику')}</span>`;
        messagesContainer?.appendChild(welcome);
    }
    updateDesktopEmptyState();
}

// =========================== 8. ОТПРАВКА И УДАЛЕНИЕ ===========================
async function deleteMessage(msgId, el) {
    if (!msgId) return;
    const chatIdToUpdate = currentChatId;
    const { error } = await window.sbClient.from('messages').delete().eq('id', msgId);
    if (error) { console.error(error); return; }
    const msg = el?.closest('.message-container');
    if (msg) msg.remove();
    await loadUserChats();
    if (window.innerWidth <= 767) await loadMobileChats();
    const remainingMessages = document.querySelectorAll('.message-container:not(.system)');
    if (remainingMessages.length === 0) {
        const welcome = document.createElement('div');
        welcome.className = 'message-container system';
        welcome.innerHTML = `<span class="message-content">💬 Напишите первое сообщение ${escapeHtml(currentChatUser?.name || 'собеседнику')}</span>`;
        messagesContainer?.appendChild(welcome);
    }
    if (chatIdToUpdate === currentChatId) {
        renderChatsList();
    }
}

async function loadMobileChats() {
    await loadUserChats();
}

// =========================== 9. REALTIME ПОДПИСКИ ===========================
function subscribeToMessages() {
    if (messagesSubscription) window.sbClient.removeChannel(messagesSubscription);
    messagesSubscription = window.sbClient.channel('messages-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async p => {
            const msg = p.new;
            const { data: { user: cur } } = await window.sbClient.auth.getUser();
            if (!cur) return;
            const isOwn = msg.sender_id === cur.id;
            if (msg.chat_id === currentChatId) {
                const systemMessage = document.querySelector('.message-container.system');
                if (systemMessage) systemMessage.remove();
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
                } catch (pushError) {
                    console.error('❌ Ошибка отправки push:', pushError);
                }
            }
            if (msg.chat_id === currentChatId) {
                if (!isOwn) {
                    await markMessagesAsRead(currentChatId);
                    const { data: attachments } = await window.sbClient
                        .from('attachments')
                        .select('*')
                        .eq('message_id', msg.id)
                        .maybeSingle();
                    let attachment = null;
                    if (attachments) {
                        attachment = {
                            url: attachments.file_url || attachments.title_id,
                            name: attachments.file_name,
                            size: attachments.file_size,
                            type: attachments.file_type
                        };
                    }
                    displayMessageWithAttachment(msg.text, false, msg.created_at, msg.id, attachment, false);
                    setTimeout(() => messagesContainer && (messagesContainer.scrollTop = messagesContainer.scrollHeight), 50);
                }
            }
            if (!isOwn) {
                await loadUserChats();
            }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'is_read=eq.true' }, async p => {
            const updated = p.new;
            const { data: { user: cur } } = await window.sbClient.auth.getUser();
            if (!cur) return;
            if (updated.sender_id === cur.id && updated.is_read === true) {
                const messageElement = document.querySelector(`.message-container[data-message-id="${updated.id}"]`);
                if (messageElement) {
                    const readStatus = messageElement.querySelector('.message-read-status');
                    if (readStatus) {
                        readStatus.textContent = '✓✓';
                        readStatus.classList.add('read');
                        messageElement.classList.add('read');
                    }
                }
                await loadUserChats();
            }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, async p => {
            const del = p.old;
            const el = document.querySelector(`.message-container[data-message-id="${del.id}"]`);
            if (el) el.remove();
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

            // Обновляем статус в allUsers
            const userIndex = allUsers.findIndex(u => u.id === up.id);
            if (userIndex !== -1) {
                const statusData = await getUserStatusWithLastSeen(up.id);
                allUsers[userIndex].status = statusData.status;
                allUsers[userIndex].lastSeen = statusData.rawLastSeen || new Date(0);

                // Пересортировываем массив
                allUsers.sort((a, b) => {
                    if (a.status === 'online' && b.status !== 'online') return -1;
                    if (a.status !== 'online' && b.status === 'online') return 1;
                    const timeA = new Date(a.lastSeen);
                    const timeB = new Date(b.lastSeen);
                    return timeB - timeA;
                });

                // Обновляем отображение
                await renderUsersList();
            }

            // Обновляем текущий открытый чат
            if (currentChatUser?.id === up.id) {
                const statusData = await getUserStatusWithLastSeen(up.id);
                const title = document.getElementById('currentChatTitle');
                if (title) {
                    if (statusData.status === 'online') {
                        title.innerHTML = `${currentChatUser.name} <span class="user-status-indicator online"></span><span class="user-last-seen">онлайн</span>`;
                    } else {
                        title.innerHTML = `${currentChatUser.name} <span class="user-status-indicator offline"></span><span class="user-last-seen">${statusData.lastSeen}</span>`;
                    }
                }
            }

            await loadUsers(); // Полная перезагрузка для синхронизации
        })
        .subscribe(s => s === 'SUBSCRIBED' && console.log('✅ Подписка на статусы активна'));
}

function subscribeToAvatars() {
    if (avatarSubscription) window.sbClient.removeChannel(avatarSubscription);
    avatarSubscription = window.sbClient.channel('avatars-realtime')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'avatar_url=neq.' }, async (payload) => {
            const updated = payload.new;
            if (updated.avatar_url !== undefined) {
                avatarCache.delete(updated.id);
                await updateAllAvatars();
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log('✅ Подписка на аватары активна');
        });
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
            if (newStatus.is_typing) {
                chatTitle.innerHTML = `${currentChatUser?.name || ''} <span class="typing-indicator" style="font-size: 12px; color: #43ca00;">✍️ печатает...</span>`;
            } else {
                const userStatus = await getUserStatus(newStatus.user_id);
                chatTitle.innerHTML = `${currentChatUser?.name || ''} <span class="user-status-indicator ${userStatus}"></span>`;
            }
        })
        .subscribe((status) => { if (status === 'SUBSCRIBED') console.log('✅ Подписка на статусы печатания активна'); });
}

// =========================== 10. СТАТУС ОНЛАЙН/ОФФЛАЙН ===========================
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

// =========================== 11. СТАТУС "ПЕЧАТАЕТ" ===========================
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
// Добавьте эти функции в раздел СТАТУС ОНЛАЙН/ОФФЛАЙН (после getUserStatus)

// =========================== 11.5. ПОСЛЕДНЯЯ АКТИВНОСТЬ ===========================
function formatLastSeen(lastSeen) {
    if (!lastSeen) return 'был(а) недавно';

    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Онлайн (был менее 2 минут назад)
    if (diffMins < 2) {
        return 'онлайн';
    }

    // Сегодня
    if (diffDays === 0) {
        if (diffHours < 1) {
            return `был(а) ${diffMins} мин. назад`;
        }
        const hours = diffHours;
        const minutes = diffMins % 60;
        if (minutes === 0) {
            return `был(а) ${hours} ${getHourWord(hours)} назад`;
        }
        return `был(а) ${hours} ${getHourWord(hours)} ${minutes} мин. назад`;
    }

    // Вчера
    if (diffDays === 1) {
        const timeStr = lastSeenDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return `был(а) вчера в ${timeStr}`;
    }

    // Недавно (2-7 дней)
    if (diffDays < 7) {
        const weekday = lastSeenDate.toLocaleDateString('ru-RU', { weekday: 'long' });
        const timeStr = lastSeenDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return `был(а) ${weekday} в ${timeStr}`;
    }

    // Давно
    const dateStr = lastSeenDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const timeStr = lastSeenDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `был(а) ${dateStr} в ${timeStr}`;
}

function getHourWord(hours) {
    const lastDigit = hours % 10;
    const lastTwoDigits = hours % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
        return 'часов';
    }

    switch (lastDigit) {
        case 1: return 'час';
        case 2:
        case 3:
        case 4: return 'часа';
        default: return 'часов';
    }
}

async function getUserLastSeen(userId) {
    try {
        const { data, error } = await window.sbClient
            .from('user_status')
            .select('status, last_seen, updated_at')
            .eq('id', userId)
            .single();

        if (error || !data) {
            return 'был(а) недавно';
        }

        // Если пользователь онлайн
        if (data.status === 'online') {
            const lastSeenDate = new Date(data.last_seen);
            const now = new Date();
            const diffMins = Math.floor((now - lastSeenDate) / 60000);

            if (diffMins < 2) {
                return 'онлайн';
            }
        }

        // Используем last_seen или updated_at
        const lastSeenTime = data.last_seen || data.updated_at;
        return formatLastSeen(lastSeenTime);

    } catch (err) {
        console.error('Ошибка получения последней активности:', err);
        return 'был(а) недавно';
    }
}

// Обновляем функцию getUserStatus, чтобы она возвращала полный статус
async function getUserStatusWithLastSeen(uid) {
    try {
        const { data, error } = await window.sbClient
            .from('user_status')
            .select('status, last_seen, updated_at')
            .eq('id', uid)
            .maybeSingle();

        if (error || !data) {
            return {
                status: 'offline',
                lastSeen: 'был(а) недавно',
                rawLastSeen: new Date(0)
            };
        }

        let status = data.status || 'offline';
        let rawLastSeen = data.last_seen || data.updated_at;
        let lastSeenText = formatLastSeen(rawLastSeen);

        // Проверяем онлайн статус с учетом времени (если последняя активность больше 2 минут назад)
        if (data.status === 'online' && rawLastSeen) {
            const diffMins = (new Date() - new Date(rawLastSeen)) / 1000 / 60;
            if (diffMins > 2) {
                status = 'offline';
                lastSeenText = formatLastSeen(rawLastSeen);
            } else {
                lastSeenText = 'онлайн';
            }
        }

        return {
            status,
            lastSeen: lastSeenText,
            rawLastSeen: rawLastSeen || new Date(0)
        };
    } catch (err) {
        console.error('Ошибка получения статуса:', err);
        return {
            status: 'offline',
            lastSeen: 'был(а) недавно',
            rawLastSeen: new Date(0)
        };
    }
}

// Обновляем существующую функцию getUserStatus для обратной совместимости
async function getUserStatus(uid) {
    const { status } = await getUserStatusWithLastSeen(uid);
    return status;
}
// =========================== 12. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК И ПОИСК ===========================
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

// =========================== 13. МОДАЛЬНЫЕ ОКНА ===========================
document.querySelector('.profile-icon')?.addEventListener('click', () => currentChatUser ? showUserProfileModal(currentChatUser.id, currentChatUser.name) : alert('Сначала выберите собеседника'));

async function showProfileModal() {
    const { data: { user } } = await window.sbClient.auth.getUser();
    if (!user) { alert('Ошибка'); return; }
    const { data: profile } = await window.sbClient.from('profiles').select('*').eq('id', user.id).single();
    const username = profile?.username || user.user_metadata?.username || localStorage.getItem('currentUsername') || 'Пользователь';
    const email = user.email || '';
    const date = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : 'Неизвестно';
    const avatarUrl = profile?.avatar_url || null;
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
                <div class="avatar-preview">
                    ${avatarUrl ? `<img src="${avatarUrl}" alt="Avatar" class="profile-avatar-img" id="avatarPreview">` : `<ion-icon name="person-circle-outline" class="profile-avatar-icon" id="avatarPreview"></ion-icon>`}
                </div>
                <div class="profile-avatar-buttons">
                    <button class="profile-change-avatar-btn" id="changeAvatarBtn" title="Изменить аватар">
                        <ion-icon name="camera-outline"></ion-icon>
                    </button>
                    ${avatarUrl ? `<button class="profile-delete-avatar-btn" id="deleteAvatarBtn" title="Удалить аватар">
                        <ion-icon name="trash-outline"></ion-icon>
                    </button>` : ''}
                </div>
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
    if (closeBtn) closeBtn.onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    const save = modal.querySelector('#saveProfileBtn');
    const nameInput = modal.querySelector('#profileName');
    const changeAvatarBtn = modal.querySelector('#changeAvatarBtn');
    const deleteAvatarBtn = modal.querySelector('#deleteAvatarBtn');
    const avatarInput = document.createElement('input');
    avatarInput.type = 'file';
    avatarInput.accept = 'image/*';
    avatarInput.style.display = 'none';
    modal.appendChild(avatarInput);
    if (changeAvatarBtn) {
        changeAvatarBtn.onclick = () => { avatarInput.click(); };
        avatarInput.onchange = async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                const newAvatarUrl = await uploadAvatar(file);
                if (newAvatarUrl) {
                    const avatarPreview = modal.querySelector('#avatarPreview');
                    if (avatarPreview) {
                        if (avatarPreview.tagName === 'ION-ICON') {
                            const img = document.createElement('img');
                            img.id = 'avatarPreview';
                            img.className = 'profile-avatar-img';
                            img.src = newAvatarUrl;
                            img.alt = 'Avatar';
                            avatarPreview.parentNode.replaceChild(img, avatarPreview);
                        } else {
                            avatarPreview.src = newAvatarUrl;
                        }
                    }
                    const buttonsDiv = modal.querySelector('.profile-avatar-buttons');
                    if (buttonsDiv && !modal.querySelector('#deleteAvatarBtn')) {
                        const newDeleteBtn = document.createElement('button');
                        newDeleteBtn.className = 'profile-delete-avatar-btn';
                        newDeleteBtn.id = 'deleteAvatarBtn';
                        newDeleteBtn.title = 'Удалить аватар';
                        newDeleteBtn.innerHTML = '<ion-icon name="trash-outline"></ion-icon>';
                        buttonsDiv.appendChild(newDeleteBtn);
                        newDeleteBtn.onclick = async () => {
                            if (confirm('Удалить аватар?')) {
                                const deleted = await deleteAvatar();
                                if (deleted) {
                                    const preview = modal.querySelector('#avatarPreview');
                                    if (preview && preview.tagName === 'IMG') {
                                        const icon = document.createElement('ion-icon');
                                        icon.name = 'person-circle-outline';
                                        icon.id = 'avatarPreview';
                                        icon.className = 'profile-avatar-icon';
                                        preview.parentNode.replaceChild(icon, preview);
                                    }
                                    newDeleteBtn.remove();
                                    await updateAllAvatars();
                                }
                            }
                        };
                    }
                    await updateAllAvatars();
                }
            }
            avatarInput.value = '';
        };
    }
    if (deleteAvatarBtn) {
        deleteAvatarBtn.onclick = async () => {
            if (confirm('Удалить аватар?')) {
                const deleted = await deleteAvatar();
                if (deleted) {
                    const avatarPreview = modal.querySelector('#avatarPreview');
                    if (avatarPreview && avatarPreview.tagName === 'IMG') {
                        const icon = document.createElement('ion-icon');
                        icon.name = 'person-circle-outline';
                        icon.id = 'avatarPreview';
                        icon.className = 'profile-avatar-icon';
                        avatarPreview.parentNode.replaceChild(icon, avatarPreview);
                    }
                    deleteAvatarBtn.remove();
                    await updateAllAvatars();
                }
            }
        };
    }
    if (save && nameInput) {
        save.onclick = async () => {
            const newName = nameInput.value.trim();
            if (!newName || newName.length < 2) { alert('❌ Имя должно быть не менее 2 символов'); return; }
            save.disabled = true;
            save.textContent = '⏳ Сохранение...';
            const { error } = await window.sbClient.from('profiles').update({ username: newName }).eq('id', user.id);
            if (error) { alert('❌ Ошибка: ' + error.message); save.disabled = false; save.textContent = '💾 Сохранить изменения'; return; }
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
                    <label>🔔 Уведомления</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="notificationsCheckbox" ${localStorage.getItem('notifications') !== 'false' ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-item">
                    <label>🔊 Звук сообщений</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="soundCheckbox" ${localStorage.getItem('sound') !== 'false' ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-item">
                    <label>🌙 Тёмная тема</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="darkThemeCheckbox" ${localStorage.getItem('darkTheme') === 'true' ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-item">
                    <label>📱 Push-уведомления (закрытый браузер)</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="pushNotificationsCheckbox">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-item" id="testPushItem" style="display: none;">
                    <button id="testPushBtn" class="modal-btn" style="margin-top: 0; background: #43ca00;">📨 Отправить тестовое уведомление</button>
                </div>
                <div class="settings-info" style="margin-top: 12px; padding: 12px; background: var(--gray-light); border-radius: 12px; font-size: 12px; color: var(--gray-text);">
                    <ion-icon name="information-circle-outline" style="vertical-align: middle;"></ion-icon>
                    Push-уведомления работают даже при закрытом браузере. Для их работы необходимо разрешить уведомления в браузере.
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) closeBtn.onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    const notificationsCheckbox = modal.querySelector('#notificationsCheckbox');
    if (notificationsCheckbox) notificationsCheckbox.onchange = (e) => localStorage.setItem('notifications', e.target.checked);
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
            if (e.target.checked) { document.body.classList.add('dark'); localStorage.setItem('darkTheme', 'true'); }
            else { document.body.classList.remove('dark'); localStorage.setItem('darkTheme', 'false'); }
        };
    }
    const pushCheckbox = modal.querySelector('#pushNotificationsCheckbox');
    const testPushItem = modal.querySelector('#testPushItem');
    if (pushCheckbox) {
        if (!checkPushSupport()) {
            pushCheckbox.disabled = true;
            pushCheckbox.parentElement.style.opacity = '0.5';
            const info = modal.querySelector('.settings-info');
            if (info) info.innerHTML += '<br>⚠️ Ваш браузер не поддерживает push-уведомления.';
        } else {
            await registerServiceWorker();
            const isSubscribed = await checkPushSubscription();
            pushCheckbox.checked = isSubscribed;
            if (isSubscribed) testPushItem.style.display = 'block';
            pushCheckbox.onchange = async (e) => {
                if (e.target.checked) {
                    const permission = await requestNotificationPermission();
                    if (!permission) {
                        alert('❌ Необходимо разрешить уведомления в браузере');
                        e.target.checked = false;
                        return;
                    }
                    const success = await subscribeToPush();
                    if (success) testPushItem.style.display = 'block';
                    else e.target.checked = false;
                } else {
                    await unsubscribeFromPush();
                    testPushItem.style.display = 'none';
                }
                pushCheckbox.checked = await checkPushSubscription();
            };
        }
    }
    const testPushBtn = modal.querySelector('#testPushBtn');
    if (testPushBtn) testPushBtn.onclick = async () => { await testPushNotification(); };
}

async function showUserProfileModal(uid, uname) {
    if (!uid) { alert('Пользователь не выбран'); return; }
    const { data: profile } = await window.sbClient.from('profiles').select('*').eq('id', uid).single();
    if (!profile) { alert('Не удалось загрузить профиль'); return; }
    const date = profile.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : 'Неизвестно';
    const avatarUrl = profile.avatar_url || null;
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `<div class="custom-modal-content">
        <div class="custom-modal-header">
            <ion-icon name="person-circle-outline"></ion-icon>
            <h3>Профиль пользователя</h3>
            <button class="modal-close-btn"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <div class="custom-modal-body">
            <div class="profile-avatar">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeHtml(profile.username || uname || 'Пользователь')}" class="profile-avatar-img">` : `<ion-icon name="person-circle-outline" style="font-size: 80px; color: var(--primary);"></ion-icon>`}
            </div>
            <div class="profile-field">
                <label>👤 Имя пользователя</label>
                <input type="text" value="${escapeHtml(profile.username || uname || 'Пользователь')}" disabled>
            </div>
            <div class="profile-field">
                <label>📅 Дата регистрации</label>
                <input type="text" value="${date}" disabled>
            </div>
            <div class="profile-status">
                <ion-icon name="chatbubble-outline"></ion-icon>
                <span>Ваш собеседник</span>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
}

// =========================== 14. ФУНКЦИИ ДЛЯ ОТПРАВКИ СООБЩЕНИЙ ===========================
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

function displayMessageWithAttachment(text, isOwn, createdAt, messageId, attachment, isRead = false) {
    const systemMessage = document.querySelector('.message-container.system');
    if (systemMessage) systemMessage.remove();
    const container = document.createElement('div');
    container.className = 'message-container';
    container.setAttribute('data-message-id', messageId);
    if (!isOwn) container.classList.add('other');
    if (isOwn && isRead) container.classList.add('read');
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
        if (isImage) {
            innerHTML += `<div class="message-attachment"><img src="${attachment.url}" alt="${escapeHtml(fileName)}" loading="lazy" onclick="openPhotoViewer('${attachment.url}')">${downloadBtn}</div>`;
        } else if (isVideo) {
            innerHTML += `<div class="message-attachment video-attachment"><video controls preload="metadata" class="video-player"><source src="${attachment.url}" type="${fileType}"></video><div class="file-info"><div class="file-name">🎬 ${escapeHtml(shortName)}</div><div class="file-size">${formatFileSize(attachment.size)}</div>${downloadBtn}</div></div>`;
        } else if (isAudio) {
            innerHTML += `<div class="message-attachment audio-attachment"><div class="audio-player-wrapper"><audio controls preload="metadata" class="audio-player"><source src="${attachment.url}" type="${fileType}"></audio></div><div class="file-info"><div class="file-name">🎵 ${escapeHtml(shortName)}</div><div class="file-size">${formatFileSize(attachment.size)}</div>${downloadBtn}</div></div>`;
        } else {
            innerHTML += `<div class="message-attachment"><div class="file-icon"><ion-icon name="document-outline"></ion-icon></div><div class="file-info"><div class="file-name">${escapeHtml(shortName)}</div><div class="file-size">${formatFileSize(attachment.size)}</div>${downloadBtn}</div></div>`;
        }
    }
    let readReceipt = '';
    if (isOwn) {
        readReceipt = `<span class="message-read-status ${isRead ? 'read' : 'sent'}">${isRead ? '✓✓' : '✓'}</span>`;
    }
    innerHTML += `<span class="message-time">${time} ${readReceipt}</span>`;
    if (isOwn) {
        innerHTML += `<button class="message-delete-btn" onclick="deleteMessage('${messageId}', this.parentElement)"><ion-icon name="close-outline"></ion-icon></button>`;
    }
    container.innerHTML = innerHTML;
    messagesContainer?.appendChild(container);
    setTimeout(() => { if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight; }, 50);
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
    const systemMessage = document.querySelector('.message-container.system');
    if (systemMessage) systemMessage.remove();
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
        const { data, error } = await window.sbClient
            .from('messages')
            .insert({
                chat_id: currentChatId,
                sender_id: currentUser.id,
                receiver_id: currentChatUser.id,
                text: value || '',
                is_read: false
            })
            .select()
            .single();
        if (error) {
            console.error('❌ Ошибка:', error);
            alert('Ошибка: ' + error.message);
            isSending = false;
            return;
        }
        if (attachment && data) {
            await window.sbClient.from('attachments').insert({
                message_id: data.id,
                file_url: attachment.url,
                file_name: attachment.name,
                file_size: attachment.size,
                file_type: attachment.type
            });
        }
        displayMessageWithAttachment(value, true, data.created_at, data.id, attachment, false);
        messageInput.value = '';
        autoResizeTextarea();
        updateCharCounter();
        await loadUserChats();
        if (window.innerWidth <= 767) await loadMobileChats();
        setTimeout(() => { if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight; }, 50);
    } catch (err) {
        console.error('❌ Ошибка:', err);
    } finally {
        isSending = false;
    }
}

// =========================== 15. PUSH-УВЕДОМЛЕНИЯ ===========================
async function getVapidPublicKey() {
    try {
        const response = await fetch('/api/vapid-public-key');
        const data = await response.json();
        return data.publicKey;
    } catch (error) {
        console.error('❌ Ошибка получения VAPID ключа:', error);
        return VAPID_PUBLIC_KEY;
    }
}

async function saveSubscriptionToServer(subscription) {
    const { data: { user } } = await window.sbClient.auth.getUser();
    if (!user) { console.log('❌ Пользователь не авторизован'); return false; }
    try {
        const response = await fetch('/api/save-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, subscription: subscription })
        });
        if (response.ok) {
            console.log('✅ Подписка сохранена на сервере');
            return true;
        } else {
            console.error('❌ Ошибка сохранения на сервере');
            return false;
        }
    } catch (error) {
        console.error('❌ Ошибка сети при сохранении подписки:', error);
        return false;
    }
}

async function subscribeToPush() {
    if (!checkPushSupport()) {
        console.log('❌ Push не поддерживается в этом браузере');
        if (confirm('Ваш браузер не поддерживает push-уведомления. Хотите включить обычные уведомления?')) {
            await requestNotificationPermission();
        }
        return false;
    }
    if (Notification.permission !== 'granted') {
        const permission = await requestNotificationPermission();
        if (!permission) {
            alert('❌ Необходимо разрешить уведомления в браузере для получения push-уведомлений');
            return false;
        }
    }
    if (!swRegistration) {
        const registered = await registerServiceWorker();
        if (!registered) {
            alert('Service Worker не зарегистрирован');
            return false;
        }
    }
    try {
        let subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
            console.log('✅ Подписка уже существует:', subscription);
            await saveSubscriptionToServer(subscription);
            localStorage.setItem('pushEnabled', 'true');
            setTimeout(() => { testPushNotification(); }, 1000);
            return true;
        }
        const publicKey = await getVapidPublicKey();
        const convertedKey = urlBase64ToUint8Array(publicKey);
        subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey
        });
        console.log('✅ Push-подписка создана', subscription);
        await saveSubscriptionToServer(subscription);
        localStorage.setItem('pushEnabled', 'true');
        await testPushNotification();
        alert('✅ Push-уведомления включены! Теперь вы будете получать уведомления даже при закрытом браузере');
        return true;
    } catch (error) {
        console.error('❌ Ошибка подписки:', error);
        if (error.name === 'NotAllowedError') alert('⚠️ Необходимо разрешить уведомления в настройках браузера');
        else if (error.name === 'InvalidStateError') alert('⚠️ Service Worker не готов. Попробуйте обновить страницу (F5)');
        else if (error.message.includes('ApplicationServerKey')) alert('⚠️ Ошибка ключа шифрования. Попробуйте перезагрузить страницу');
        else alert('❌ Ошибка подключения push: ' + error.message);
        return false;
    }
}

async function unsubscribeFromPush() {
    if (!swRegistration) { await registerServiceWorker(); }
    if (!swRegistration) return false;
    try {
        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            const { data: { user } } = await window.sbClient.auth.getUser();
            if (user) {
                await fetch('/api/delete-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id })
                });
            }
            localStorage.setItem('pushEnabled', 'false');
            console.log('✅ Push-подписка удалена');
            alert('❌ Push-уведомления отключены');
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Ошибка отписки:', error);
        return false;
    }
}

async function checkPushSubscription() {
    if (!checkPushSupport()) return false;
    if (!swRegistration) { await registerServiceWorker(); }
    if (!swRegistration) return false;
    try {
        const subscription = await swRegistration.pushManager.getSubscription();
        const isSubscribed = !!subscription;
        if (isSubscribed !== (localStorage.getItem('pushEnabled') === 'true')) {
            localStorage.setItem('pushEnabled', isSubscribed);
        }
        return isSubscribed;
    } catch (error) {
        console.error('❌ Ошибка проверки подписки:', error);
        return false;
    }
}

async function testPushNotification() {
    const { data: { user } } = await window.sbClient.auth.getUser();
    if (!user) { console.log('❌ Пользователь не авторизован'); return; }
    try {
        const response = await fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                toUserId: user.id,
                title: '🔔 Тестовое уведомление',
                body: 'Если вы видите это сообщение, push-уведомления работают!',
                requireInteraction: true,
                data: { senderId: user.id, chatId: null, timestamp: Date.now() }
            })
        });
        const result = await response.json();
        if (response.ok) {
            console.log('✅ Тестовое уведомление отправлено');
            alert('✅ Тестовое уведомление отправлено! Проверьте, пришло ли оно.');
        } else {
            console.error('❌ Ошибка:', result);
            alert('❌ Ошибка отправки тестового уведомления: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('❌ Ошибка соединения:', error);
        if (Notification.permission === 'granted') {
            const notification = new Notification('🔔 Тест уведомлений', {
                body: 'Если вы видите это уведомление, но push не работает - проверьте настройки браузера',
                icon: '/favicon.ico',
                requireInteraction: true
            });
            setTimeout(() => notification.close(), 5000);
        }
    }
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
    if (isSubscribed) {
        localStorage.setItem('pushEnabled', 'true');
        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) await saveSubscriptionToServer(subscription);
    } else {
        const savedPushEnabled = localStorage.getItem('pushEnabled') === 'true';
        if (savedPushEnabled) await subscribeToPush();
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('darkTheme');
    if (savedTheme === 'true') document.body.classList.add('dark');
    else document.body.classList.remove('dark');
}

// =========================== 16. ДЕСКТОП/МОБИЛЬНЫЕ ФУНКЦИИ ===========================
function closeChatOnMobile() {
    if (window.innerWidth <= 767) document.querySelector('.chat').classList.remove('chat-opened');
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

// =========================== 17. НАЗНАЧЕНИЕ ОБРАБОТЧИКОВ ===========================
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

window.closeChatOnMobile = closeChatOnMobile;
window.updateDesktopEmptyState = updateDesktopEmptyState;
window.updateDesktopEntryState = updateDesktopEmptyState;

if (mobileBackBtn) mobileBackBtn.addEventListener('click', closeChatOnMobile);

let touchStartX = 0;
document.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; });
document.addEventListener('touchend', (e) => {
    if (window.innerWidth > 767) return;
    const diff = e.changedTouches[0].screenX - touchStartX;
    if (diff < -50 && document.querySelector('.chat')?.classList.contains('chat-opened')) closeChatOnMobile();
});

// Мобильные и десктопные кнопки
const mobileProfileBtn = document.getElementById('mobileProfileBtn');
const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
const mobileExitBtn = document.getElementById('mobileExitBtn');
if (mobileProfileBtn) mobileProfileBtn.addEventListener('click', () => { showProfileModal(); if (window.innerWidth <= 767 && document.querySelector('.chat')?.classList.contains('chat-opened')) closeChatOnMobile(); });
if (mobileSettingsBtn) mobileSettingsBtn.addEventListener('click', () => { showSettingsModal(); if (window.innerWidth <= 767 && document.querySelector('.chat')?.classList.contains('chat-opened')) closeChatOnMobile(); });
if (mobileExitBtn) mobileExitBtn.addEventListener('click', logout);

const profileDesktopBtn = document.getElementById('profileDesktopBtn');
const settingsDesktopBtn = document.getElementById('settingsDesktopBtn');
const exitDesktopBtn = document.getElementById('exitDesktopBtn');
if (profileDesktopBtn) profileDesktopBtn.addEventListener('click', showProfileModal);
if (settingsDesktopBtn) settingsDesktopBtn.addEventListener('click', showSettingsModal);
if (exitDesktopBtn) exitDesktopBtn.addEventListener('click', logout);

// =========================== 18. ЗАГРУЗКА СТРАНИЦЫ ===========================
document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.getAttribute('data-tab'))));
    setupSearch();
    const { data: { session } } = await window.sbClient.auth.getSession();
    if (session) {
        loginWindow?.classList.add('close'); registerWindow?.classList.add('close'); chatWindow?.classList.remove('close');
        await loadUsers(); await loadUserChats();
        subscribeToMessages(); subscribeToProfiles(); subscribeToStatus(); subscribeToAvatars();
        startStatusTracking();
        initAttachMenu(); initMessageInput(); initEmojiPicker(); initPhotoViewer();
        loadSavedTheme();
        subscribeToTypingStatus();
        await registerServiceWorker();
        setTimeout(() => updateDesktopEmptyState(), 100);
    } else {
        loginWindow?.classList.remove('close'); registerWindow?.classList.add('close'); chatWindow?.classList.add('close');
    }
    window.addEventListener('resize', () => { updateDesktopEmptyState(); if (window.innerWidth > 767) document.querySelector('.chat')?.classList.remove('chat-opened'); });
});