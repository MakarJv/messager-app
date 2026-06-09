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
const VAPID_PRIVAT_KEY = 'ZWFD_3X5KR0B1GVld9cTzNy-352lOY7gbFcbDMYduo8';

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
let replyToMessage = null;
let editingMessageId = null;
const EDIT_TIMEOUT_MINUTES = 5;
let contextMenuMessageId = null;
let contextMenuMessageElement = null;

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
    } catch (e) {
        console.log('Звук не поддерживается:', e);
        notificationSound = {
            play: () => {
            }
        };
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
            const {data: {user}} = await window.sbClient.auth.getUser();
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
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
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
        const {data, error} = await window.sbClient
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
                    resolve(new File([blob], file.name, {type: file.type, lastModified: Date.now()}));
                }, file.type, 0.8);
            };
        };
    });
}

async function uploadAvatar(file) {
    const {data: {user}} = await window.sbClient.auth.getUser();
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
        const {data: profile} = await window.sbClient
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
        const {error: uploadError} = await window.sbClient.storage
            .from('avatars')
            .upload(filePath, compressedFile, {upsert: true});
        if (uploadError) throw uploadError;
        const {data: publicUrlData} = window.sbClient.storage
            .from('avatars')
            .getPublicUrl(filePath);
        const publicUrl = publicUrlData.publicUrl;
        const {error: updateError} = await window.sbClient
            .from('profiles')
            .update({avatar_url: publicUrl})
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
    const {data: {user}} = await window.sbClient.auth.getUser();
    if (!user) return false;
    try {
        const {data: profile} = await window.sbClient
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
        const {error} = await window.sbClient
            .from('profiles')
            .update({avatar_url: null})
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
    if (!email || !password || !username) {
        alert('Заполните все поля');
        return;
    }
    if (password.length < 4) {
        alert('Пароль минимум 4 символа');
        return;
    }

    await loaderManager.withLoader(async () => {
        const {data, error} = await window.sbClient.auth.signUp({email, password, options: {data: {username}}});
        if (error) throw new Error(error.message);

        if (data.session) {
            localStorage.setItem('currentUsername', username);
            loginWindow.classList.add('close');
            registerWindow.classList.add('close');
            chatWindow.classList.remove('close');
            regUsername.value = regEmail.value = regPassword.value = '';
            await loadUsers();
            await loadUserChats();
            await registerServiceWorker();
            console.log('Добро пожаловать,', username);
        } else {
            alert('Регистрация успешна! Подтвердите email и войдите.');
            loginWindow.classList.remove('close');
            registerWindow.classList.add('close');
        }
    }, {button: regBtn, buttonText: 'Регистрация...'}).catch(err => {
        alert('Ошибка: ' + err.message);
    });
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
        swRegistration = await navigator.serviceWorker.register('/sw.js', {scope: '/'});
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
    if (!email || !password) {
        alert('Заполните все поля');
        return;
    }

    await loaderManager.withLoader(async () => {
        const {data, error} = await window.sbClient.auth.signInWithPassword({email, password});
        if (error) throw new Error(error.message);

        if (data.user) {
            localStorage.setItem('currentUsername', data.user.user_metadata?.username || 'Пользователь');
            loginWindow.classList.add('close');
            registerWindow.classList.add('close');
            chatWindow.classList.remove('close');
            loginUsername.value = loginPassword.value = '';
            await loadUsers();
            await loadUserChats();
            startStatusTracking();
            subscribeToStatus();
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
    }, {button: enterBtn, buttonText: 'Вход...'}).catch(err => {
        alert('Ошибка: ' + err.message);
    });

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
    await window.sbClient.auth.signOut();
    stopStatusTracking();
    loginWindow.classList.remove('close');
    registerWindow.classList.add('close');
    chatWindow.classList.add('close');
    localStorage.removeItem('currentUsername');
    currentChatUser = null;
    currentChatId = null;
    if (messagesContainer) messagesContainer.innerHTML = '';
    updateDesktopEmptyState();
    document.querySelector('.chat')?.classList.remove('chat-opened');
}

// =========================== 6. РАБОТА С ПОЛЬЗОВАТЕЛЯМИ И ЧАТАМИ ===========================
async function loadUsers() {
    if (!window.sbClient) return;
    const {data: {user: currentUser}} = await window.sbClient.auth.getUser();
    if (!currentUser) return;

    const {data, error} = await window.sbClient.from('profiles').select('id, username').neq('id', currentUser.id);
    if (error) {
        console.error('Ошибка загрузки пользователей:', error);
        return;
    }

    // Показываем индикатор загрузки в списке
    const container = document.getElementById('usersListContainer');
    if (container && (!data || data.length === 0)) {
        loaderManager.showUsersSkeleton();
    }

    const usersWithStatus = [];
    for (const user of (data || [])) {
        const statusData = await getUserStatusWithLastSeen(user.id);
        usersWithStatus.push({
            ...user, status: statusData.status, lastSeen: statusData.rawLastSeen || new Date(0)
        });
    }

    usersWithStatus.sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        const timeA = new Date(a.lastSeen);
        const timeB = new Date(b.lastSeen);
        return timeB - timeA;
    });

    allUsers = usersWithStatus;
    renderUsersList();
}

async function getUnreadCount(chatId, userId) {
    if (!chatId || !userId) return 0;
    try {
        const {count, error} = await window.sbClient
            .from('messages')
            .select('id', {count: 'exact', head: true})
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
    const {data: {user: currentUser}} = await window.sbClient.auth.getUser();
    if (!currentUser) return;
    const {data: participants, error} = await window.sbClient
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
        const {data: other} = await window.sbClient
            .from('chat_participants')
            .select('user_id')
            .eq('chat_id', p.chat_id)
            .neq('user_id', currentUser.id);
        if (!other?.length) continue;
        const {data: profile} = await window.sbClient
            .from('profiles')
            .select('username')
            .eq('id', other[0].user_id)
            .single();
        const {data: lastMessage} = await window.sbClient
            .from('messages')
            .select('id, text, created_at, sender_id, is_read')
            .eq('chat_id', p.chat_id)
            .order('created_at', {ascending: false})
            .limit(1)
            .maybeSingle();
        const unreadCount = await getUnreadCount(p.chat_id, currentUser.id);
        let lastMessageText = 'Нет сообщений';
        let lastMessageTime = null;
        let lastMessageSender = null;
        if (lastMessage) {
            lastMessageTime = lastMessage.created_at;
            lastMessageSender = lastMessage.sender_id;
            const {data: attachment} = await window.sbClient
                .from('attachments')
                .select('file_type, file_name')
                .eq('message_id', lastMessage.id)
                .maybeSingle();
            let messagePreview = '';
            if (attachment) {
                const fileType = attachment.file_type || '';
                if (fileType.startsWith('image/')) messagePreview = '📸 Фото'; else if (fileType.startsWith('video/')) messagePreview = '🎬 Видео'; else if (fileType.startsWith('audio/')) messagePreview = '🎵 Аудио'; else messagePreview = '📎 Файл';
            } else if (lastMessage.text && lastMessage.text.trim()) {
                messagePreview = lastMessage.text.trim();
                if (messagePreview.length > 50) messagePreview = messagePreview.slice(0, 47) + '...';
            }
            if (lastMessage.sender_id !== currentUser.id) {
                const {data: senderProfile} = await window.sbClient
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
        const time = chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString('ru-RU', {
            hour: '2-digit', minute: '2-digit'
        }) : '';
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
        const {data: u1Chats} = await window.sbClient.from('chat_participants').select('chat_id').eq('user_id', u1);
        if (u1Chats?.length) {
            const {data: common} = await window.sbClient.from('chat_participants').select('chat_id').eq('user_id', u2).in('chat_id', u1Chats.map(c => c.chat_id));
            if (common?.length) {
                console.log('Найден чат:', common[0].chat_id);
                return common[0].chat_id;
            }
        }
        console.log('Создаём новый чат...');
        const {data: newChat, error} = await window.sbClient.from('chats').insert({}).select().single();
        if (error) throw error;
        await window.sbClient.from('chat_participants').insert([{
            chat_id: newChat.id, user_id: u1
        }, {chat_id: newChat.id, user_id: u2}]);
        return newChat.id;
    } catch (err) {
        console.error(err);
        return null;
    }
}

// =========================== 7. ОТКРЫТИЕ ЧАТА ===========================
async function openChatWithUser(userId, userName, existingChatId = null) {
    const {data: {user: cur}} = await window.sbClient.auth.getUser();
    if (!cur) return;

    // Показываем индикатор загрузки в заголовке
    const title = document.getElementById('currentChatTitle');
    if (title) {
        title.innerHTML = `${escapeHtml(userName)} <span class="typing-indicator" style="font-size: 12px;">
            <span class="message-loader" style="display: inline-flex; background: transparent; padding: 0; margin-left: 8px;">
                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </span>
        </span>`;
    }

    resetTypingStatus();
    currentChatUser = {id: userId, name: userName};

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

    // Загружаем сообщения с индикатором загрузки
    await loaderManager.withLoader(async () => {
        await loadMessages();
    }, {showFullscreen: false});

    setTimeout(() => {
        if (currentChatId && !document.hidden) {
            markMessagesAsRead(currentChatId);
        }
    }, 500);

    updateDesktopEmptyState();

    if (window.innerWidth > 767) {
        const backBtn = document.querySelector('.desktop-back-btn');
        if (backBtn) {
            backBtn.style.display = 'flex';
            backBtn.style.opacity = '0';
            backBtn.style.animation = 'fadeIn 0.2s forwards';
        }
    }

    if (window.innerWidth <= 767) {
        document.querySelector('.chat').classList.add('chat-opened');
    }
    document.querySelectorAll('.chat-item, .user-item').forEach(i => i.classList.remove('active'));
    const activeItem = document.querySelector(`.chat-item[data-user-id="${userId}"]`);
    if (activeItem) activeItem.classList.add('active');
}

async function markMessagesAsRead(chatId) {
    // Отмечаем сообщения как прочитанные ТОЛЬКО если этот чат открыт
    if (!chatId || chatId !== currentChatId) return;

    const {data: {user}} = await window.sbClient.auth.getUser();
    if (!user) return;

    try {
        // Получаем ID непрочитанных сообщений, где текущий пользователь получатель
        const {data: unreadMessages, error} = await window.sbClient
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
            console.log(`Отмечаем как прочитанные: ${unreadMessages.length} сообщений`);

            // Обновляем статус прочтения
            const {error: updateError} = await window.sbClient
                .from('messages')
                .update({
                    is_read: true, read_at: new Date().toISOString()
                })
                .in('id', unreadMessages.map(m => m.id));

            if (updateError) {
                console.error('Ошибка обновления статуса прочтения:', updateError);
            } else {
                console.log(`✅ Помечено как прочитано: ${unreadMessages.length} сообщений`);

                // Обновляем UI для этих сообщений
                for (const msg of unreadMessages) {
                    const messageElement = document.querySelector(`.message-container[data-message-id="${msg.id}"]`);
                    if (messageElement) {
                        const readStatus = messageElement.querySelector('.message-read-status');
                        if (readStatus) {
                            readStatus.textContent = '✓✓';
                            readStatus.classList.add('read');
                        }
                        messageElement.classList.add('read');
                    }
                }

                // Обновляем список чатов
                await loadUserChats();
                if (window.innerWidth <= 767) await loadMobileChats();
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
    const {data: {user: cur}} = await window.sbClient.auth.getUser();
    if (!cur) return;

    console.log('Загрузка сообщений для чата:', currentChatId);

    const {data: messages, error: msgError} = await window.sbClient
        .from('messages')
        .select('*')
        .eq('chat_id', currentChatId)
        .order('created_at', {ascending: true});

    if (msgError) {
        console.error('Ошибка загрузки сообщений:', msgError);
        return;
    }

    console.log('Загружено сообщений:', messages?.length || 0);

    if (messagesContainer) messagesContainer.innerHTML = '';

    if (messages?.length) {
        for (const msg of messages) {
            console.log(`Сообщение ${msg.id}: text="${msg.text?.substring(0, 30)}", is_edited=${msg.is_edited}`);

            const {data: attachments} = await window.sbClient
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

            // Получаем имя отправителя для ответа
            let senderName = null;
            if (msg.reply_to_id) {
                const {data: replyMsg} = await window.sbClient
                    .from('messages')
                    .select('sender_id')
                    .eq('id', msg.reply_to_id)
                    .single();
                if (replyMsg) {
                    const {data: profile} = await window.sbClient
                        .from('profiles')
                        .select('username')
                        .eq('id', replyMsg.sender_id)
                        .single();
                    senderName = profile?.username || 'Пользователь';
                }
            }

            displayMessageWithAttachment(msg.text, isOwn, msg.created_at, msg.id, attachment, msg.is_read, senderName, msg.is_edited === true  // Важно: строгое сравнение
            );
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

// Отмечаем сообщения как прочитанные когда пользователь их видит
function markVisibleMessagesAsRead() {
    if (!currentChatId || !messagesContainer) return;

    // Проверяем, видит ли пользователь сообщения (чат открыт и активен)
    const isChatVisible = currentChatUser && currentChatId && !document.hidden;
    if (!isChatVisible) return;

    // Находим все непрочитанные сообщения (чужие, которые не прочитаны)
    const unreadMessageElements = document.querySelectorAll('.message-container.other:not(.read)');

    if (unreadMessageElements.length > 0) {
        console.log(`Найдено непрочитанных сообщений: ${unreadMessageElements.length}`);

        // Небольшая задержка, чтобы пользователь успел увидеть
        setTimeout(() => {
            markMessagesAsRead(currentChatId);
        }, 500);
    }
}

// Добавляем наблюдатель за видимостью сообщений
function setupReadReceipts() {
    if (!messagesContainer) return;

    // Функция для проверки видимости
    const checkVisibility = () => {
        if (!currentChatId) return;

        // Проверяем, есть ли в области видимости непрочитанные сообщения
        const messages = document.querySelectorAll('.message-container.other:not(.read)');
        if (messages.length === 0) return;

        // Используем Intersection Observer для точного определения
        const observer = new IntersectionObserver((entries) => {
            const visibleUnread = entries.some(entry => entry.isIntersecting && entry.target.classList.contains('other') && !entry.target.classList.contains('read'));

            if (visibleUnread) {
                setTimeout(() => markMessagesAsRead(currentChatId), 300);
            }
        }, {threshold: 0.3});

        messages.forEach(msg => observer.observe(msg));

        // Отключаем observer после первого срабатывания
        setTimeout(() => observer.disconnect(), 5000);
    };

    // При скролле
    messagesContainer.addEventListener('scroll', () => {
        setTimeout(() => checkVisibility(), 100);
    });

    // При загрузке сообщений
    const observer = new MutationObserver(() => {
        checkVisibility();
    });
    observer.observe(messagesContainer, {childList: true, subtree: true});

    // При фокусе окна
    window.addEventListener('focus', () => {
        if (currentChatId) {
            setTimeout(() => markMessagesAsRead(currentChatId), 500);
        }
    });

    // При открытии чата
    checkVisibility();

    return observer;
}

// =========================== 8. ОТПРАВКА И УДАЛЕНИЕ ===========================
async function deleteMessage(msgId, el) {
    if (!msgId) return;

    closeContextMenu(); // Закрываем контекстное меню если открыто

    const chatIdToUpdate = currentChatId;
    const {error} = await window.sbClient.from('messages').delete().eq('id', msgId);
    if (error) {
        console.error(error);
        return;
    }
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

// =========================== РЕДАКТИРОВАНИЕ СООБЩЕНИЙ ===========================
function canEditMessage(messageCreatedAt) {
    const createdTime = new Date(messageCreatedAt).getTime();
    const currentTime = Date.now();
    const minutesDiff = (currentTime - createdTime) / 1000 / 60;
    return minutesDiff <= EDIT_TIMEOUT_MINUTES;
}

function getRemainingEditTime(messageCreatedAt) {
    const createdTime = new Date(messageCreatedAt).getTime();
    const currentTime = Date.now();
    const minutesDiff = (currentTime - createdTime) / 1000 / 60;
    const remainingMinutes = EDIT_TIMEOUT_MINUTES - minutesDiff;

    if (remainingMinutes <= 0) return null;

    const mins = Math.floor(remainingMinutes);
    const secs = Math.floor((remainingMinutes - mins) * 60);

    if (mins > 0) {
        return `${mins} мин. ${secs} сек.`;
    } else {
        return `${secs} сек.`;
    }
}

async function editMessage(messageId, newText) {
    if (!messageId || !newText || !newText.trim()) return false;

    try {
        console.log('Редактируем сообщение:', messageId, 'новый текст:', newText);

        const now = new Date().toISOString();

        // Обновляем сообщение - ПРОСТОЙ СИНТАКСИС
        const {error} = await window.sbClient
            .from('messages')
            .update({
                text: newText.trim(), is_edited: true, edited_at: now
            })
            .eq('id', messageId);

        if (error) {
            console.error('Ошибка при UPDATE:', error);
            alert('Ошибка при редактировании: ' + error.message);
            return false;
        }

        console.log('✅ UPDATE выполнен успешно');

        // Проверяем результат отдельным запросом
        const {data: updatedMsg, error: fetchError} = await window.sbClient
            .from('messages')
            .select('id, text, is_edited, edited_at')
            .eq('id', messageId)
            .single();

        if (fetchError) {
            console.error('Не могу проверить результат:', fetchError);
        } else {
            console.log('Проверка в БД:', updatedMsg);
        }

        // Обновляем UI
        const messageElement = document.querySelector(`.message-container[data-message-id="${messageId}"]`);
        if (messageElement) {
            const contentSpan = messageElement.querySelector('.message-content');
            if (contentSpan) {
                // Сохраняем часть с ответом если есть
                let displayText = newText.trim();
                const oldText = contentSpan.textContent;
                if (oldText.includes('📎 Ответ на сообщение')) {
                    const replyMatch = oldText.match(/(📎 Ответ на сообщение[^:]+:[^\n]+\n---\n)/);
                    if (replyMatch) {
                        displayText = replyMatch[1] + newText.trim();
                    }
                }
                contentSpan.innerHTML = escapeHtml(displayText);

                // Добавляем отметку о редактировании
                let editMark = contentSpan.querySelector('.message-edited-mark');
                if (!editMark) {
                    editMark = document.createElement('span');
                    editMark.className = 'message-edited-mark';
                    editMark.setAttribute('data-message-id', messageId);
                    editMark.onclick = (e) => {
                        e.stopPropagation();
                        showEditHistory(messageId);
                    };
                    contentSpan.appendChild(editMark);
                }
                editMark.textContent = ' (ред.)';

                // Анимация
                messageElement.classList.add('message-updated');
                setTimeout(() => messageElement.classList.remove('message-updated'), 500);
            }
        }

        // Обновляем список чатов
        await loadUserChats();
        if (window.innerWidth <= 767) await loadMobileChats();

        return true;
    } catch (err) {
        console.error('Ошибка:', err);
        return false;
    }
}

function showEditMessageUI(messageId, currentText, createdAt) {
    closeContextMenu();

    // Проверяем можно ли редактировать
    if (!canEditMessage(createdAt)) {
        const remainingTime = getRemainingEditTime(createdAt);
        alert(`❌ Редактирование недоступно\n\nВремя на редактирование истекло.\nСообщения можно редактировать только в течение ${EDIT_TIMEOUT_MINUTES} минут после отправки.`);
        return;
    }

    // Удаляем старый UI если есть
    const oldEditUI = document.getElementById('editMessageUI');
    if (oldEditUI) oldEditUI.remove();

    editingMessageId = messageId;

    // Создаем UI для редактирования
    const editUI = document.createElement('div');
    editUI.className = 'edit-message-ui';
    editUI.id = 'editMessageUI';

    const remainingTime = getRemainingEditTime(createdAt);
    const timeWarning = remainingTime ? `<div class="edit-time-warning">⏱️ Осталось времени: ${remainingTime}</div>` : '';

    editUI.innerHTML = `
        <div class="edit-message-overlay">
            <div class="edit-message-container">
                <div class="edit-message-header">
                    <ion-icon name="create-outline"></ion-icon>
                    <span>Редактирование сообщения</span>
                    <button class="edit-message-cancel" onclick="cancelEditMessage()">
                        <ion-icon name="close-outline"></ion-icon>
                    </button>
                </div>
                <div class="edit-message-body">
                    <textarea id="editMessageText" class="edit-message-textarea" placeholder="Введите новый текст...">${escapeHtml(currentText)}</textarea>
                    ${timeWarning}
                    <div class="edit-message-actions">
                        <button class="edit-message-btn cancel-btn" onclick="cancelEditMessage()">Отмена</button>
                        <button class="edit-message-btn save-btn" onclick="saveEditMessage('${messageId}')">
                            <span class="btn-loader" style="display: none;"><span class="spinner"></span> Сохранение...</span>
                            <span class="btn-text">💾 Сохранить</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(editUI);

    // Фокусируемся на textarea
    const textarea = document.getElementById('editMessageText');
    if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        textarea.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        });
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                saveEditMessage(messageId);
            }
            if (e.key === 'Escape') {
                cancelEditMessage();
            }
        });
    }

    // Обновляем таймер обратного отсчета
    if (remainingTime) {
        const timerInterval = setInterval(() => {
            const newRemainingTime = getRemainingEditTime(createdAt);
            const warningDiv = editUI.querySelector('.edit-time-warning');
            if (warningDiv) {
                if (newRemainingTime) {
                    warningDiv.innerHTML = `⏱️ Осталось времени: ${newRemainingTime}`;
                } else {
                    warningDiv.innerHTML = `⚠️ Время на редактирование истекло!`;
                    warningDiv.style.color = '#ff4444';
                    const saveBtn = editUI.querySelector('.save-btn');
                    if (saveBtn) {
                        saveBtn.disabled = true;
                        saveBtn.style.opacity = '0.5';
                    }
                    clearInterval(timerInterval);
                }
            }
        }, 1000);
        editUI.timerInterval = timerInterval;
    }
}

async function saveEditMessage(messageId) {
    const textarea = document.getElementById('editMessageText');
    if (!textarea) return;

    const newText = textarea.value.trim();
    if (!newText) {
        alert('Сообщение не может быть пустым');
        return;
    }

    // Показываем индикатор загрузки на кнопке
    const saveBtn = document.querySelector('#editMessageUI .save-btn');
    const btnText = saveBtn?.querySelector('.btn-text');
    const btnLoader = saveBtn?.querySelector('.btn-loader');

    if (saveBtn && btnText && btnLoader) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-flex';
        saveBtn.disabled = true;
    }

    // Получаем оригинальное сообщение для проверки времени
    const messageElement = document.querySelector(`.message-container[data-message-id="${messageId}"]`);
    if (messageElement) {
        const createdAt = messageElement.getAttribute('data-created-at');
        if (createdAt && !canEditMessage(createdAt)) {
            alert('❌ Время на редактирование истекло');
            cancelEditMessage();
            return;
        }
    }

    const success = await editMessage(messageId, newText);

    if (saveBtn && btnText && btnLoader) {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        saveBtn.disabled = false;
    }

    if (success) {
        cancelEditMessage();
        // Показываем уведомление об успехе
        const notification = document.createElement('div');
        notification.className = 'copy-notification success';
        notification.innerHTML = '<ion-icon name="checkmark-circle-outline"></ion-icon> Сообщение отредактировано';
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}

function cancelEditMessage() {
    const editUI = document.getElementById('editMessageUI');
    if (editUI) {
        if (editUI.timerInterval) {
            clearInterval(editUI.timerInterval);
        }
        editUI.remove();
    }
    editingMessageId = null;
}

// =========================== КОНТЕКСТНОЕ МЕНЮ ДЛЯ СООБЩЕНИЙ ===========================
function showContextMenu(event, messageId, messageElement) {
    event.preventDefault();
    event.stopPropagation();

    // Закрываем предыдущее меню
    closeContextMenu();

    contextMenuMessageId = messageId;
    contextMenuMessageElement = messageElement;

    // Получаем данные сообщения
    const isOwn = messageElement.classList.contains('read') || (!messageElement.classList.contains('other'));
    const createdAt = messageElement.getAttribute('data-created-at');
    const canEdit = isOwn && canEditMessage(createdAt);

    // Проверяем наличие вложения в сообщении
    const attachmentElement = messageElement.querySelector('.message-attachment');
    let hasAttachment = false;
    let attachmentUrl = null;
    let attachmentName = null;
    let isImage = false;
    let isVideo = false;
    let isAudio = false;

    if (attachmentElement) {
        hasAttachment = true;

        // Ищем ссылку на файл
        const img = attachmentElement.querySelector('img');
        const video = attachmentElement.querySelector('video');
        const audio = attachmentElement.querySelector('audio');
        const downloadBtn = attachmentElement.querySelector('.file-download-btn');

        if (img && img.src) {
            attachmentUrl = img.src;
            attachmentName = 'image_' + Date.now() + '.jpg';
            isImage = true;
        } else if (video && video.querySelector('source')) {
            attachmentUrl = video.querySelector('source').src;
            attachmentName = 'video_' + Date.now() + '.mp4';
            isVideo = true;
        } else if (audio && audio.querySelector('source')) {
            attachmentUrl = audio.querySelector('source').src;
            attachmentName = 'audio_' + Date.now() + '.mp3';
            isAudio = true;
        } else if (downloadBtn) {
            const onclickAttr = downloadBtn.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/downloadFile\('([^']+)',\s*'([^']+)'\)/);
                if (match) {
                    attachmentUrl = match[1];
                    attachmentName = match[2];
                }
            }
        }

        // Также ищем ссылку в файловой информации
        const fileLink = attachmentElement.querySelector('.file-info');
        if (!attachmentUrl && fileLink) {
            const downloadBtnInFile = fileLink.querySelector('.file-download-btn');
            if (downloadBtnInFile) {
                const onclickAttr = downloadBtnInFile.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/downloadFile\('([^']+)',\s*'([^']+)'\)/);
                    if (match) {
                        attachmentUrl = match[1];
                        attachmentName = match[2];
                    }
                }
            }
        }
    }

    // Создаем контекстное меню
    const menu = document.createElement('div');
    menu.className = 'message-context-menu';
    menu.id = 'messageContextMenu';

    let menuItems = '';

    // Кнопка ответа (всегда первая)
    menuItems += `
        <div class="context-menu-item" data-action="reply">
            <ion-icon name="return-up-back-outline"></ion-icon>
            <span>Ответить</span>
        </div>
    `;

    // Кнопка копирования текста
    menuItems += `
        <div class="context-menu-item" data-action="copy">
            <ion-icon name="copy-outline"></ion-icon>
            <span>Копировать текст</span>
        </div>
    `;

    // Кнопка скачивания файла (второй по важности, если есть вложение)
    if (hasAttachment && attachmentUrl) {
        let icon = 'download-outline';
        let label = 'Скачать файл';

        if (isImage) {
            icon = 'image-outline';
            label = 'Сохранить изображение';
        } else if (isVideo) {
            icon = 'videocam-outline';
            label = 'Скачать видео';
        } else if (isAudio) {
            icon = 'musical-notes-outline';
            label = 'Скачать аудио';
        }

        menuItems += `
            <div class="context-menu-item download-item" data-action="download">
                <ion-icon name="${icon}"></ion-icon>
                <span>${label}</span>
                <span class="download-hint">📥</span>
            </div>
        `;
    }

    // Разделитель перед действиями с сообщением
    if (canEdit || (hasAttachment && attachmentUrl)) {
        menuItems += `<div class="context-menu-divider"></div>`;
    }

    // Кнопка редактирования (только для своих сообщений, если можно редактировать)
    if (canEdit) {
        const remainingTime = getRemainingEditTime(createdAt);
        const timeText = remainingTime ? ` <span style="font-size: 11px; opacity: 0.7;">(${remainingTime})</span>` : '';
        menuItems += `
        <div class="context-menu-item" data-action="edit">
            <ion-icon name="create-outline"></ion-icon>
            <span>Редактировать${timeText}</span>
        </div>
    `;
    }

    // Кнопка удаления (последняя, красная)
    if (isOwn) {
        menuItems += `
            <div class="context-menu-divider"></div>
            <div class="context-menu-item danger" data-action="delete">
                <ion-icon name="trash-outline"></ion-icon>
                <span>Удалить</span>
            </div>
        `;
    }

    menu.innerHTML = menuItems;
    document.body.appendChild(menu);

    // Получаем размеры меню
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;

    // Получаем координаты клика
    let mouseX = event.clientX;
    let mouseY = event.clientY;

    // Корректируем позицию
    let left = mouseX;
    let top = mouseY;

    // Если меню выходит за правый край
    if (mouseX + menuWidth > window.innerWidth) {
        left = mouseX - menuWidth;
    }

    // Если меню выходит за левый край
    if (left < 5) {
        left = 5;
    }

    // Если меню выходит за нижний край
    if (mouseY + menuHeight > window.innerHeight) {
        top = mouseY - menuHeight;
    }

    // Если меню выходит за верхний край
    if (top < 5) {
        top = 5;
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    setTimeout(() => {
        menu.classList.add('visible');
    }, 10);

    // Обработчики для пунктов меню
    menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = item.getAttribute('data-action');

            switch (action) {
                case 'reply':
                    await replyToMessageById(messageId);
                    break;
                case 'copy':
                    await copyMessageText(messageId);
                    break;
                case 'download':
                    if (attachmentUrl && attachmentName) {
                        await downloadFile(attachmentUrl, attachmentName);
                    }
                    break;
                case 'edit':
                    const textSpan = messageElement.querySelector('.message-content');
                    const text = textSpan ? textSpan.textContent.replace(' (ред.)', '') : '';
                    await showEditMessageUI(messageId, text, createdAt);
                    break;
                case 'delete':
                    if (confirm('Удалить это сообщение?')) {
                        await deleteMessage(messageId, messageElement);
                    }
                    break;
            }

            closeContextMenu();
        });
    });

    // Закрываем меню при клике вне его
    const closeHandler = (e) => {
        if (!menu.contains(e.target)) {
            closeContextMenu();
            document.removeEventListener('click', closeHandler);
            document.removeEventListener('scroll', closeHandler);
            document.removeEventListener('keydown', keydownHandler);
        }
    };

    const keydownHandler = (e) => {
        if (e.key === 'Escape') {
            closeContextMenu();
            document.removeEventListener('click', closeHandler);
            document.removeEventListener('scroll', closeHandler);
            document.removeEventListener('keydown', keydownHandler);
        }
    };

    setTimeout(() => {
        document.addEventListener('click', closeHandler);
        document.addEventListener('scroll', closeHandler);
        document.addEventListener('keydown', keydownHandler);
    }, 10);
}

function closeContextMenu() {
    const menu = document.getElementById('messageContextMenu');
    if (menu) {
        menu.classList.remove('visible');
        setTimeout(() => {
            if (menu.parentNode) menu.remove();
        }, 200);
    }
    contextMenuMessageId = null;
    contextMenuMessageElement = null;
    // Удаляем обработчики событий
    document.removeEventListener('click', closeContextMenu);
    document.removeEventListener('scroll', closeContextMenu);
    document.removeEventListener('keydown', handleContextMenuKeydown);
}

function handleContextMenuKeydown(event) {
    if (event.key === 'Escape') {
        closeContextMenu();
    }
}

async function copyMessageText(messageId) {
    const messageElement = document.querySelector(`.message-container[data-message-id="${messageId}"]`);
    if (!messageElement) return;

    const contentSpan = messageElement.querySelector('.message-content');
    if (!contentSpan) return;

    let text = contentSpan.textContent || '';
    // Убираем отметку о редактировании
    text = text.replace(' (ред.)', '');
    // Убираем лишние пробелы и переносы
    text = text.trim();

    // Функция для показа уведомления
    const showCopyNotification = (success, errorMsg = '') => {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        if (success) {
            notification.innerHTML = '<ion-icon name="checkmark-circle-outline"></ion-icon> Текст скопирован';
            notification.style.background = 'rgba(67, 202, 0, 0.95)';
        } else {
            notification.innerHTML = `<ion-icon name="close-circle-outline"></ion-icon> ${errorMsg || 'Не удалось скопировать'}`;
            notification.style.background = 'rgba(255, 59, 48, 0.95)';
        }
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    };

    // Способ 1: Современный Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            console.log('✅ Текст скопирован через Clipboard API');
            showCopyNotification(true);
            return;
        } catch (err) {
            console.warn('Clipboard API failed:', err);
            // Пробуем fallback метод
        }
    }

    // Способ 2: Fallback для мобильных устройств и старых браузеров
    try {
        // Создаем временное текстовое поле
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);

        // Выделяем текст
        textarea.select();
        textarea.setSelectionRange(0, text.length);

        // Пытаемся скопировать
        const success = document.execCommand('copy');

        // Удаляем временное поле
        document.body.removeChild(textarea);

        if (success) {
            console.log('✅ Текст скопирован через execCommand');
            showCopyNotification(true);

        } else {
            throw new Error('execCommand copy failed');
        }
    } catch (err) {
        console.error('Ошибка копирования:', err);

        // Способ 3: Для мобильных - показываем текст для ручного копирования
        showCopyNotification(false, 'Нажмите и удерживайте для копирования');

        // Дополнительно: показываем текст в диалоге для ручного копирования
        setTimeout(() => {
            const manualCopy = confirm(`Не удалось скопировать автоматически.\n\nВыделите и скопируйте текст вручную:\n\n"${text.substring(0, 200)}${text.length > 200 ? '...' : ''}"`);
            if (manualCopy) {
                // Создаем временное поле с текстом
                const tempInput = document.createElement('input');
                tempInput.value = text;
                tempInput.style.position = 'fixed';
                tempInput.style.top = '-100px';
                tempInput.style.left = '-100px';
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                showCopyNotification(true);
            }
        }, 100);
    }
}

async function updateMessageContentUI(messageId, newText, isEdited = true) {
    console.log('Обновляем UI для сообщения:', messageId, 'isEdited:', isEdited);

    const messageElement = document.querySelector(`.message-container[data-message-id="${messageId}"]`);
    if (!messageElement) {
        console.warn('Элемент сообщения не найден в DOM, возможно чат не открыт');
        return;
    }

    const contentSpan = messageElement.querySelector('.message-content');
    if (!contentSpan) return;

    // Сохраняем часть с ответом если есть
    let displayText = newText;
    const oldText = contentSpan.textContent;
    if (oldText.includes('📎 Ответ на сообщение')) {
        const replyMatch = oldText.match(/(📎 Ответ на сообщение[^:]+:[^\n]+\n---\n)/);
        if (replyMatch) {
            displayText = replyMatch[1] + newText;
        }
    }

    // Обновляем текст
    contentSpan.innerHTML = escapeHtml(displayText);

    // Обновляем отметку о редактировании
    let editMark = contentSpan.querySelector('.message-edited-mark');

    if (isEdited) {
        if (!editMark) {
            editMark = document.createElement('span');
            editMark.className = 'message-edited-mark';
            editMark.setAttribute('data-message-id', messageId);
            editMark.onclick = (e) => {
                e.stopPropagation();
                showEditHistory(messageId);
            };
            contentSpan.appendChild(editMark);
        }
        editMark.textContent = ' (ред.)';
        editMark.title = 'Сообщение было отредактировано';
    } else if (editMark && !isEdited) {
        editMark.remove();
    }

    // Обновляем атрибуты
    messageElement.setAttribute('data-text', newText);
    if (isEdited) {
        messageElement.setAttribute('data-edited', 'true');
    }

    // Анимация
    messageElement.classList.add('message-updated');
    setTimeout(() => {
        messageElement.classList.remove('message-updated');
    }, 500);

    console.log('✅ UI обновлен, новый текст:', newText);
}

async function loadMobileChats() {
    await loadUserChats();
}

// =========================== 9. REALTIME ПОДПИСКИ ===========================
function subscribeToMessages() {
    if (messagesSubscription) window.sbClient.removeChannel(messagesSubscription);
    messagesSubscription = window.sbClient.channel('messages-realtime')
        .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'messages'
        }, async p => {
            const updated = p.new;
            const {data: {user: cur}} = await window.sbClient.auth.getUser();
            if (!cur) return;

            // Обновляем отображение статуса прочтения
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
                if (window.innerWidth <= 767) await loadMobileChats();
            }

            // ===== ВАЖНО: Обновление для отредактированных сообщений =====
            // Проверяем, изменился ли текст или флаг is_edited
            const oldMessageElement = document.querySelector(`.message-container[data-message-id="${updated.id}"]`);
            if (oldMessageElement && updated.text) {
                // Обновляем текст сообщения
                const contentSpan = oldMessageElement.querySelector('.message-content');
                if (contentSpan) {
                    let displayText = updated.text || '';
                    displayText = displayText.replace(/ \(ред\.\)/g, '');

                    // Сохраняем часть с ответом если есть
                    const oldText = contentSpan.textContent;
                    if (oldText.includes('📎 Ответ на сообщение')) {
                        const replyMatch = oldText.match(/(📎 Ответ на сообщение[^:]+:[^\n]+\n---\n)/);
                        if (replyMatch) {
                            displayText = replyMatch[1] + displayText;
                        }
                    }

                    contentSpan.innerHTML = escapeHtml(displayText);

                    // Обновляем отметку о редактировании
                    let editMark = contentSpan.querySelector('.message-edited-mark');
                    if (updated.is_edited === true) {
                        if (!editMark) {
                            editMark = document.createElement('span');
                            editMark.className = 'message-edited-mark';
                            editMark.setAttribute('data-message-id', updated.id);
                            editMark.onclick = (e) => {
                                e.stopPropagation();
                                showEditHistory(updated.id);
                            };
                            contentSpan.appendChild(editMark);
                        }
                        editMark.textContent = ' (ред.)';
                    } else if (editMark && updated.is_edited !== true) {
                        editMark.remove();
                    }

                    // Анимация
                    oldMessageElement.classList.add('message-updated');
                    setTimeout(() => oldMessageElement.classList.remove('message-updated'), 500);
                }

                // Обновляем список чатов
                await loadUserChats();
                if (window.innerWidth <= 767) await loadMobileChats();
            }
        })
        .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'messages'}, async p => {
            const msg = p.new;
            const {data: {user: cur}} = await window.sbClient.auth.getUser();
            if (!cur) return;
            const isOwn = msg.sender_id === cur.id;

            if (msg.chat_id === currentChatId) {
                const systemMessage = document.querySelector('.message-container.system');
                if (systemMessage) systemMessage.remove();
            }

            if (!isOwn) {
                const {data: profile} = await window.sbClient.from('profiles').select('username').eq('id', msg.sender_id).single();
                const senderName = profile?.username || 'Пользователь';
                const messageText = msg.text?.substring(0, 50) || '📎 Файл';
                await showNotification(senderName, messageText, `chat_${msg.sender_id}`, msg.sender_id);
                await loadUserChats();
                if (window.innerWidth <= 767) await loadMobileChats();
            }

            if (msg.chat_id === currentChatId && !isOwn) {
                const {data: attachments} = await window.sbClient
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
                displayMessageWithAttachment(msg.text, false, msg.created_at, msg.id, attachment, false, null, msg.is_edited || false);
                setTimeout(() => messagesContainer && (messagesContainer.scrollTop = messagesContainer.scrollHeight), 50);
            }
        })
        .on('postgres_changes', {event: 'DELETE', schema: 'public', table: 'messages'}, async p => {
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
        .on('postgres_changes', {event: 'UPDATE', schema: 'public', table: 'profiles'}, async p => {
            const up = p.new;
            if (currentChatUser?.id === up.id) {
                currentChatUser.name = up.username;
                const title = document.getElementById('currentChatTitle');
                if (title) title.textContent = up.username;
            }
            await loadUsers();
            await loadUserChats();
        })
        .subscribe(s => s === 'SUBSCRIBED' && console.log('✅ Подписка на профили активна'));
}

function subscribeToStatus() {
    if (statusSubscription) window.sbClient.removeChannel(statusSubscription);
    statusSubscription = window.sbClient.channel('status-realtime')
        .on('postgres_changes', {event: 'UPDATE', schema: 'public', table: 'user_status'}, async p => {
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
        .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'avatar_url=neq.'
        }, async (payload) => {
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
        .on('postgres_changes', {event: '*', schema: 'public', table: 'typing_status'}, async (payload) => {
            const newStatus = payload.new;
            if (payload.eventType === 'DELETE' || !newStatus) return;
            if (newStatus.chat_id !== currentChatId) return;
            const {data: {user}} = await window.sbClient.auth.getUser();
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
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log('✅ Подписка на статусы печатания активна');
        });
}

// =========================== 10. СТАТУС ОНЛАЙН/ОФФЛАЙН ===========================
async function updateUserStatus(status) {
    const {data: {user}} = await window.sbClient.auth.getUser();
    if (!user) return;
    await window.sbClient.from('user_status').upsert({
        id: user.id, status, last_seen: new Date().toISOString(), updated_at: new Date().toISOString()
    });
}

async function getUserStatus(uid) {
    const {data} = await window.sbClient.from('user_status').select('status, last_seen').eq('id', uid).single();
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
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
        statusUpdateInterval = null;
    }
    updateUserStatus('offline');
}

// =========================== 11. СТАТУС "ПЕЧАТАЕТ" ===========================
async function updateTypingStatus(chatId, isTyping) {
    if (!window.sbClient || !chatId) return;
    const {data: {user}} = await window.sbClient.auth.getUser();
    if (!user) return;
    try {
        await window.sbClient.from('typing_status').upsert({
            user_id: user.id, chat_id: chatId, is_typing: isTyping, updated_at: new Date().toISOString()
        }, {onConflict: 'user_id,chat_id'});
    } catch (err) {
        console.error('Ошибка:', err);
    }
}

function sendTypingStatus() {
    if (!currentChatId) return;
    if (isTypingCurrently) return;
    isTypingCurrently = true;
    updateTypingStatus(currentChatId, true);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        isTypingCurrently = false;
        updateTypingStatus(currentChatId, false);
    }, 2000);
}

function resetTypingStatus() {
    if (typingTimeout) clearTimeout(typingTimeout);
    if (isTypingCurrently) {
        isTypingCurrently = false;
        if (currentChatId) updateTypingStatus(currentChatId, false);
    }
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
        const timeStr = lastSeenDate.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
        return `был(а) вчера в ${timeStr}`;
    }

    // Недавно (2-7 дней)
    if (diffDays < 7) {
        const weekday = lastSeenDate.toLocaleDateString('ru-RU', {weekday: 'long'});
        const timeStr = lastSeenDate.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
        return `был(а) ${weekday} в ${timeStr}`;
    }

    // Давно
    const dateStr = lastSeenDate.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'});
    const timeStr = lastSeenDate.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
    return `был(а) ${dateStr} в ${timeStr}`;
}

function getHourWord(hours) {
    const lastDigit = hours % 10;
    const lastTwoDigits = hours % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
        return 'часов';
    }

    switch (lastDigit) {
        case 1:
            return 'час';
        case 2:
        case 3:
        case 4:
            return 'часа';
        default:
            return 'часов';
    }
}

async function getUserLastSeen(userId) {
    try {
        const {data, error} = await window.sbClient
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
        const {data, error} = await window.sbClient
            .from('user_status')
            .select('status, last_seen, updated_at')
            .eq('id', uid)
            .maybeSingle();

        if (error || !data) {
            return {
                status: 'offline', lastSeen: 'был(а) недавно', rawLastSeen: new Date(0)
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
            status, lastSeen: lastSeenText, rawLastSeen: rawLastSeen || new Date(0)
        };
    } catch (err) {
        console.error('Ошибка получения статуса:', err);
        return {
            status: 'offline', lastSeen: 'был(а) недавно', rawLastSeen: new Date(0)
        };
    }
}

// Обновляем существующую функцию getUserStatus для обратной совместимости
async function getUserStatus(uid) {
    const {status} = await getUserStatusWithLastSeen(uid);
    return status;
}

// =========================== 12. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК И ПОИСК ===========================
function switchTab(tab) {
    activeTab = tab;
    const chats = document.getElementById('chatsList'), users = document.getElementById('usersListContainer');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (tab === 'chats') {
        document.querySelector('.tab[data-tab="chats"]')?.classList.add('active');
        chats?.classList.remove('hidden');
        users?.classList.add('hidden');
        renderChatsList();
    } else {
        document.querySelector('.tab[data-tab="users"]')?.classList.add('active');
        chats?.classList.add('hidden');
        users?.classList.remove('hidden');
        renderUsersList();
    }
}

function setupSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    input.addEventListener('input', e => {
        searchQuery = e.target.value;
        activeTab === 'chats' ? renderChatsList() : renderUsersList();
    });
}

// =========================== 13. МОДАЛЬНЫЕ ОКНА ===========================
document.querySelector('.profile-icon')?.addEventListener('click', () => currentChatUser ? showUserProfileModal(currentChatUser.id, currentChatUser.name) : alert('Сначала выберите собеседника'));

async function showProfileModal() {
    const {data: {user}} = await window.sbClient.auth.getUser();
    if (!user) {
        alert('Ошибка');
        return;
    }
    const {data: profile} = await window.sbClient.from('profiles').select('*').eq('id', user.id).single();
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
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
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
        changeAvatarBtn.onclick = () => {
            avatarInput.click();
        };
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
            if (!newName || newName.length < 2) {
                alert('❌ Имя должно быть не менее 2 символов');
                return;
            }
            save.disabled = true;
            save.textContent = '⏳ Сохранение...';
            const {error} = await window.sbClient.from('profiles').update({username: newName}).eq('id', user.id);
            if (error) {
                alert('❌ Ошибка: ' + error.message);
                save.disabled = false;
                save.textContent = '💾 Сохранить изменения';
                return;
            }
            await window.sbClient.auth.updateUser({data: {username: newName}});
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
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
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
                    if (success) testPushItem.style.display = 'block'; else e.target.checked = false;
                } else {
                    await unsubscribeFromPush();
                    testPushItem.style.display = 'none';
                }
                pushCheckbox.checked = await checkPushSubscription();
            };
        }
    }
    const testPushBtn = modal.querySelector('#testPushBtn');
    if (testPushBtn) testPushBtn.onclick = async () => {
        await testPushNotification();
    };
}

async function showUserProfileModal(uid, uname) {
    if (!uid) {
        alert('Пользователь не выбран');
        return;
    }
    const {data: profile} = await window.sbClient.from('profiles').select('*').eq('id', uid).single();
    if (!profile) {
        alert('Не удалось загрузить профиль');
        return;
    }
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
    modal.onclick = e => {
        if (e.target === modal) modal.remove();
    };
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
    emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPicker.style.display = emojiPicker.style.display === 'flex' ? 'none' : 'flex';
    });
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
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) emojiPicker.style.display = 'none';
    });
}

function initMessageInput() {
    let textarea = document.getElementById('message');
    if (!textarea) return;
    const newTextarea = textarea.cloneNode(true);
    textarea.parentNode.replaceChild(newTextarea, textarea);
    messageInput = newTextarea;
    newTextarea.addEventListener('input', () => {
        autoResizeTextarea();
        updateCharCounter();
        if (currentChatId) sendTypingStatus();
    });
    newTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            resetTypingStatus();
            sendMessage();
        }
    });
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
    attachBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        attachMenu.style.display = attachMenu.style.display === 'flex' ? 'none' : 'flex';
    });
    document.addEventListener('click', (e) => {
        if (!attachMenu.contains(e.target) && e.target !== attachBtn) attachMenu.style.display = 'none';
    });
    if (attachPhotoBtn && photoInput) {
        attachPhotoBtn.addEventListener('click', () => {
            photoInput.click();
            attachMenu.style.display = 'none';
        });
        photoInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                if (file.size > 50 * 1024 * 1024) {
                    alert('Файл слишком большой. Максимум 50MB');
                    return;
                }
                if (!file.type.startsWith('image/')) {
                    alert('Пожалуйста, выберите изображение');
                    return;
                }
                const compressedFile = await compressImage(file);
                pendingFile = compressedFile;
                preventAutoSend = true;
                showFilePreview(compressedFile);
                setTimeout(() => {
                    preventAutoSend = false;
                }, 500);
            }
            photoInput.value = '';
        });
    }
    if (attachFileBtn && fileInput) {
        attachFileBtn.addEventListener('click', () => {
            fileInput.click();
            attachMenu.style.display = 'none';
        });
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                if (file.size > 50 * 1024 * 1024) {
                    alert('Файл слишком большой. Максимум 50MB');
                    return;
                }
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
                    resolve(new File([blob], file.name, {type: file.type, lastModified: Date.now()}));
                }, file.type, 0.8);
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
        if (isImage && imageSrc) {
            container.innerHTML = `<img src="${imageSrc}" class="preview-image" alt=""><div class="preview-info"><span class="preview-name">${escapeHtml(file.name)}</span><span class="preview-size">${fileSize}</span></div><button class="preview-remove" onclick="removeFilePreview()">✕</button>`;
        } else {
            container.innerHTML = `<div class="file-icon"><ion-icon name="document-outline"></ion-icon></div><div class="preview-info"><span class="preview-name">${escapeHtml(file.name)}</span><span class="preview-size">${fileSize}</span></div><button class="preview-remove" onclick="removeFilePreview()">✕</button>`;
        }
        const inputDiv = document.querySelector('.input');
        const messagerEl = document.getElementById('messager');
        if (messagerEl && inputDiv) messagerEl.insertBefore(container, inputDiv);
    };
    if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => updatePreview(e.target.result);
        reader.readAsDataURL(file);
    } else {
        updatePreview(null);
    }
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
        const {error} = await window.sbClient.storage.from('chat-attachments').upload(filePath, file, {
            cacheControl: '3600', upsert: false
        });
        if (error) {
            console.error('❌ Ошибка загрузки:', error);
            alert('Ошибка загрузки: ' + error.message);
            return null;
        }
        const SUPABASE_URL = SUPABASE_CONFIG.url;
        const bucketName = 'chat-attachments';
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;
        return {url: publicUrl, name: file.name, size: file.size, type: file.type};
    } catch (err) {
        console.error('❌ Ошибка:', err);
        return null;
    }
}

function initPhotoViewer() {
    const viewer = document.getElementById('photoViewer');
    const closeBtn = document.getElementById('photoViewerClose');
    const viewerImg = document.getElementById('photoViewerImg');
    if (!viewer) return;
    closeBtn?.addEventListener('click', () => {
        viewer.style.display = 'none';
        viewerImg.src = '';
    });
    viewer.addEventListener('click', (e) => {
        if (e.target === viewer) {
            viewer.style.display = 'none';
            viewerImg.src = '';
        }
    });
}

function openPhotoViewer(url) {
    const viewer = document.getElementById('photoViewer');
    const viewerImg = document.getElementById('photoViewerImg');
    if (viewer && viewerImg) {
        viewerImg.src = url;
        viewer.style.display = 'flex';
    }
}

function displayMessageWithAttachment(text, isOwn, createdAt, messageId, attachment, isRead = false, senderName = null, isEdited = false, editHistory = null) {

    const existingMessage = document.querySelector(`.message-container[data-message-id="${messageId}"]`);
    if (existingMessage) {
        console.log('Сообщение уже существует в DOM, пропускаем:', messageId);

        // Если это отредактированное сообщение, просто обновляем текст
        if (isEdited) {
            const contentSpan = existingMessage.querySelector('.message-content');
            if (contentSpan) {
                let displayText = text || '';
                displayText = displayText.replace(/ \(ред\.\)/g, '');
                contentSpan.innerHTML = escapeHtml(displayText);

                // Добавляем отметку о редактировании
                let editMark = contentSpan.querySelector('.message-edited-mark');
                if (!editMark) {
                    editMark = document.createElement('span');
                    editMark.className = 'message-edited-mark';
                    editMark.setAttribute('data-message-id', messageId);
                    editMark.onclick = (e) => {
                        e.stopPropagation();
                        showEditHistory(messageId);
                    };
                    contentSpan.appendChild(editMark);
                }
                editMark.textContent = ' (ред.)';

                // Анимация
                existingMessage.classList.add('message-updated');
                setTimeout(() => existingMessage.classList.remove('message-updated'), 500);
            }
        }
        return;
    }

    const systemMessage = document.querySelector('.message-container.system');
    if (systemMessage) systemMessage.remove();

    const container = document.createElement('div');
    container.className = 'message-container';
    container.setAttribute('data-message-id', messageId);
    container.setAttribute('data-created-at', createdAt);
    if (!isOwn) container.classList.add('other');
    if (isOwn && isRead) container.classList.add('read');
    if (isEdited) container.setAttribute('data-edited', 'true');

    // Добавляем обработчик контекстного меню
    container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, messageId, container);
    });

    // Обработчик долгого нажатия для мобильных
    let pressTimer;
    container.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => {
            const touch = e.touches[0];
            const fakeEvent = {
                clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {
                }, stopPropagation: () => {
                }
            };
            showContextMenu(fakeEvent, messageId, container);
        }, 300);
    });
    container.addEventListener('touchend', () => clearTimeout(pressTimer));
    container.addEventListener('touchmove', () => clearTimeout(pressTimer));

    const time = createdAt ? new Date(createdAt).toLocaleTimeString('ru-RU', {
        hour: '2-digit', minute: '2-digit'
    }) : getShortTime();

    let innerHTML = '';

    // Очищаем текст от отметок о редактировании для отображения
    let displayText = text || '';
    displayText = displayText.replace(/ \(ред\.\)/g, '');

    // Если это ответ на сообщение
    if (displayText && displayText.includes('📎 Ответ на сообщение')) {
        innerHTML += `<span class="message-content">${escapeHtml(displayText)}</span>`;
    } else {
        innerHTML += `<span class="message-content">${escapeHtml(displayText)}</span>`;
    }

    // Вложения
    if (attachment && attachment.url) {
        const fileType = attachment.type || '';
        const fileName = attachment.name || 'file';
        const isImage = fileType.startsWith('image/');
        const isVideo = fileType.startsWith('video/');
        const isAudio = fileType.startsWith('audio/');
        const shortName = truncateFileName(fileName, window.innerWidth <= 480 ? 20 : 35);

        if (isImage) {
            innerHTML += `<div class="message-attachment"><img src="${attachment.url}" alt="${escapeHtml(fileName)}" loading="lazy" onclick="openPhotoViewer('${attachment.url}')"></div>`;
        } else if (isVideo) {
            innerHTML += `<div class="message-attachment video-attachment"><video controls preload="metadata" class="video-player"><source src="${attachment.url}" type="${fileType}"></video><div class="file-info"><div class="file-name">🎬 ${escapeHtml(shortName)}</div><div class="file-size">${formatFileSize(attachment.size)}</div></div></div>`;
        } else if (isAudio) {
            innerHTML += `<div class="message-attachment audio-attachment"><div class="audio-player-wrapper"><audio controls preload="metadata" class="audio-player"><source src="${attachment.url}" type="${fileType}"></audio></div><div class="file-info"><div class="file-name">🎵 ${escapeHtml(shortName)}</div><div class="file-size">${formatFileSize(attachment.size)}</div></div></div>`;
        } else {
            innerHTML += `<div class="message-attachment"><div class="file-icon"><ion-icon name="document-outline"></ion-icon></div><div class="file-info"><div class="file-name">${escapeHtml(shortName)}</div><div class="file-size">${formatFileSize(attachment.size)}</div></div></div>`;
        }
    }

    // Отметка о прочтении (только для своих сообщений)
    let readReceiptSpan = '';
    if (isOwn) {
        readReceiptSpan = `<span class="message-read-status ${isRead ? 'read' : 'sent'}">${isRead ? '✓✓' : '✓'}</span>`;
    }

    // Отметка о редактировании
    let editedMark = '';
    if (isEdited) {
        editedMark = `<span class="message-edited-mark" data-message-id="${messageId}" onclick="event.stopPropagation(); showEditHistory('${messageId}')" title="История изменений"> (ред.)</span>`;
    }

    // Собираем всё вместе
    innerHTML += `<span class="message-time">${time} ${editedMark} ${readReceiptSpan}</span>`;

    container.innerHTML = innerHTML;
    messagesContainer?.appendChild(container);

    setTimeout(() => {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, 50);
}

// =========================== ФУНКЦИИ ДЛЯ ОТВЕТА НА СООБЩЕНИЯ ===========================
function setReplyToMessage(messageId, senderName, messageText, attachment = null) {
    // Удаляем старый превью ответа если есть
    removeReplyPreview();

    replyToMessage = {
        id: messageId, senderName: senderName, text: messageText, attachment: attachment
    };

    // Создаем превью ответа
    const replyPreview = document.createElement('div');
    replyPreview.className = 'reply-preview';
    replyPreview.id = 'replyPreview';

    let previewHtml = `
        <div class="reply-preview-content">
            <div class="reply-preview-header">
                <ion-icon name="return-up-back-outline"></ion-icon>
                <span>Ответ для <strong>${escapeHtml(senderName)}</strong></span>
                <button class="reply-preview-cancel" onclick="cancelReply()">
                    <ion-icon name="close-outline"></ion-icon>
                </button>
            </div>
            <div class="reply-preview-message">
    `;

    if (attachment) {
        const fileType = attachment.type || '';
        if (fileType.startsWith('image/')) {
            previewHtml += `<div class="reply-attachment"><ion-icon name="image-outline"></ion-icon> 📷 Фото</div>`;
        } else if (fileType.startsWith('video/')) {
            previewHtml += `<div class="reply-attachment"><ion-icon name="videocam-outline"></ion-icon> 🎬 Видео</div>`;
        } else if (fileType.startsWith('audio/')) {
            previewHtml += `<div class="reply-attachment"><ion-icon name="musical-notes-outline"></ion-icon> 🎵 Аудио</div>`;
        } else {
            previewHtml += `<div class="reply-attachment"><ion-icon name="document-outline"></ion-icon> 📎 ${escapeHtml(attachment.name || 'Файл')}</div>`;
        }
    } else if (messageText) {
        const truncatedText = messageText.length > 60 ? messageText.substring(0, 57) + '...' : messageText;
        previewHtml += `<span class="reply-preview-text">${escapeHtml(truncatedText)}</span>`;
    }

    previewHtml += `
            </div>
        </div>
    `;

    replyPreview.innerHTML = previewHtml;

    // Вставляем перед полем ввода
    const inputDiv = document.querySelector('.input');
    const messagerEl = document.getElementById('messager');
    if (messagerEl && inputDiv) {
        messagerEl.insertBefore(replyPreview, inputDiv);
    }

    // Фокусируемся на поле ввода
    if (messageInput) {
        messageInput.focus();
    }
}

function removeReplyPreview() {
    const preview = document.getElementById('replyPreview');
    if (preview) {
        preview.remove();
    }
}

function cancelReply() {
    replyToMessage = null;
    removeReplyPreview();
}

async function replyToMessageById(messageId) {
    closeContextMenu();
    const messageElement = document.querySelector(`.message-container[data-message-id="${messageId}"]`);
    if (!messageElement) return;

    // Получаем данные сообщения
    const messageContent = messageElement.querySelector('.message-content');
    const messageText = messageContent ? messageContent.textContent : '';

    // Определяем отправителя
    const isOwn = messageElement.classList.contains('read') || (!messageElement.classList.contains('other'));
    let senderName = '';

    if (isOwn) {
        const {data: {user}} = await window.sbClient.auth.getUser();
        senderName = user?.user_metadata?.username || 'Вы';
    } else {
        senderName = currentChatUser?.name || 'Пользователь';
    }

    // Проверяем наличие вложения
    const attachmentElement = messageElement.querySelector('.message-attachment');
    let attachment = null;
    if (attachmentElement) {
        const img = attachmentElement.querySelector('img');
        const video = attachmentElement.querySelector('video');
        const audio = attachmentElement.querySelector('audio');
        const fileInfo = attachmentElement.querySelector('.file-info');

        if (img) {
            attachment = {type: 'image/', url: img.src, name: 'Фото'};
        } else if (video) {
            attachment = {type: 'video/', name: 'Видео'};
        } else if (audio) {
            attachment = {type: 'audio/', name: 'Аудио'};
        } else if (fileInfo) {
            const fileName = fileInfo.querySelector('.file-name')?.textContent || 'Файл';
            attachment = {type: 'application/', name: fileName};
        }
    }

    setReplyToMessage(messageId, senderName, messageText, attachment);
}

async function sendMessage() {
    if (preventAutoSend || isSending) return;
    let value = messageInput?.value.trim();
    if (!value && !pendingFile) return;
    if (!currentChatUser) {
        alert('Сначала выберите собеседника');
        return;
    }
    isSending = true;
    const fileToSend = pendingFile;
    pendingFile = null;
    const preview = document.getElementById('previewContainer');
    if (preview) preview.remove();
    const systemMessage = document.querySelector('.message-container.system');
    if (systemMessage) systemMessage.remove();

    // Формируем текст с ответом если есть
    let finalText = value || '';
    if (replyToMessage) {
        const replyText = replyToMessage.text || (replyToMessage.attachment ? '[Вложение]' : 'Сообщение');
        const replyPreview = `📎 Ответ на сообщение от ${replyToMessage.senderName}:\n"${replyText.substring(0, 100)}${replyText.length > 100 ? '...' : ''}"\n---\n`;
        finalText = replyPreview + (value ? value : '');
    }

    try {
        const {data: {user: currentUser}} = await window.sbClient.auth.getUser();
        if (!currentUser) {
            isSending = false;
            return;
        }
        if (!currentChatId) {
            const chatId = await getOrCreateChatId(currentUser.id, currentChatUser.id);
            if (!chatId) {
                alert('Ошибка создания чата');
                isSending = false;
                return;
            }
            currentChatId = chatId;
        }

        let attachment = null;
        if (fileToSend) {
            attachment = await uploadFile(fileToSend);
            if (!attachment) {
                alert('Не удалось загрузить файл');
                isSending = false;
                return;
            }
        }

        // Сохраняем ID сообщения на которое отвечаем
        const replyToId = replyToMessage ? replyToMessage.id : null;

        const {data, error} = await window.sbClient
            .from('messages')
            .insert({
                chat_id: currentChatId,
                sender_id: currentUser.id,
                receiver_id: currentChatUser.id,
                text: finalText || '',
                is_read: false,
                reply_to_id: replyToId
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

        displayMessageWithAttachment(finalText, true, data.created_at, data.id, attachment, false);
        messageInput.value = '';
        autoResizeTextarea();
        updateCharCounter();

        // Очищаем ответ после отправки
        cancelReply();

        await loadUserChats();
        if (window.innerWidth <= 767) await loadMobileChats();
        setTimeout(() => {
            if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
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
    const {data: {user}} = await window.sbClient.auth.getUser();
    if (!user) {
        console.log('❌ Пользователь не авторизован');
        return false;
    }
    try {
        const response = await fetch('/api/save-subscription', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({userId: user.id, subscription: subscription})
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
            setTimeout(() => {
                testPushNotification();
            }, 1000);
            return true;
        }
        const publicKey = await getVapidPublicKey();
        const convertedKey = urlBase64ToUint8Array(publicKey);
        subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true, applicationServerKey: convertedKey
        });
        console.log('✅ Push-подписка создана', subscription);
        await saveSubscriptionToServer(subscription);
        localStorage.setItem('pushEnabled', 'true');
        await testPushNotification();
        alert('✅ Push-уведомления включены! Теперь вы будете получать уведомления даже при закрытом браузере');
        return true;
    } catch (error) {
        console.error('❌ Ошибка подписки:', error);
        if (error.name === 'NotAllowedError') alert('⚠️ Необходимо разрешить уведомления в настройках браузера'); else if (error.name === 'InvalidStateError') alert('⚠️ Service Worker не готов. Попробуйте обновить страницу (F5)'); else if (error.message.includes('ApplicationServerKey')) alert('⚠️ Ошибка ключа шифрования. Попробуйте перезагрузить страницу'); else alert('❌ Ошибка подключения push: ' + error.message);
        return false;
    }
}

async function unsubscribeFromPush() {
    if (!swRegistration) {
        await registerServiceWorker();
    }
    if (!swRegistration) return false;
    try {
        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            const {data: {user}} = await window.sbClient.auth.getUser();
            if (user) {
                await fetch('/api/delete-subscription', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({userId: user.id})
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
    if (!swRegistration) {
        await registerServiceWorker();
    }
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
    const {data: {user}} = await window.sbClient.auth.getUser();
    if (!user) {
        console.log('❌ Пользователь не авторизован');
        return;
    }
    try {
        const response = await fetch('/api/send-push', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({
                toUserId: user.id,
                title: '🔔 Тестовое уведомление',
                body: 'Если вы видите это сообщение, push-уведомления работают!',
                requireInteraction: true,
                data: {senderId: user.id, chatId: null, timestamp: Date.now()}
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
    // Показываем индикатор загрузки
    const loadingNotification = document.createElement('div');
    loadingNotification.className = 'copy-notification';
    loadingNotification.innerHTML = '<ion-icon name="download-outline" class="spin"></ion-icon> Скачивание...';
    document.body.appendChild(loadingNotification);
    setTimeout(() => loadingNotification.classList.add('show'), 10);

    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        // Убираем индикатор
        loadingNotification.classList.remove('show');
        setTimeout(() => loadingNotification.remove(), 300);

        // Показываем уведомление об успехе
        const successNotification = document.createElement('div');
        successNotification.className = 'copy-notification success';
        successNotification.innerHTML = '<ion-icon name="checkmark-circle-outline"></ion-icon> Файл скачан!';
        document.body.appendChild(successNotification);
        setTimeout(() => successNotification.classList.add('show'), 10);

        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            successNotification.classList.remove('show');
            setTimeout(() => successNotification.remove(), 300);
        }, 100);
    } catch (error) {
        console.error('Ошибка скачивания:', error);

        // Убираем индикатор
        loadingNotification.classList.remove('show');
        setTimeout(() => loadingNotification.remove(), 300);

        // Показываем ошибку
        const errorNotification = document.createElement('div');
        errorNotification.className = 'copy-notification error';
        errorNotification.innerHTML = '<ion-icon name="close-circle-outline"></ion-icon> Ошибка скачивания';
        document.body.appendChild(errorNotification);
        setTimeout(() => errorNotification.classList.add('show'), 10);
        setTimeout(() => {
            errorNotification.classList.remove('show');
            setTimeout(() => errorNotification.remove(), 300);
        }, 2000);

        // Fallback: открыть в новой вкладке
        window.open(url, '_blank');
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('darkTheme');
    if (savedTheme === 'true') document.body.classList.add('dark'); else document.body.classList.remove('dark');
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

        // Скрываем кнопку "Назад" на ПК
        const backBtn = document.querySelector('.desktop-back-btn');
        if (backBtn) backBtn.style.display = 'none';
    } else {
        messagerEl.classList.remove('empty-state-active');
        if (emptyScreen) emptyScreen.style.display = 'none';
        if (messageText) messageText.classList.remove('hidden');
        if (inputDiv) inputDiv.classList.remove('hidden');

        // Показываем кнопку "Назад" на ПК если чат открыт
        if (window.innerWidth > 767 && currentChatUser) {
            const backBtn = document.querySelector('.desktop-back-btn');
            if (backBtn) backBtn.style.display = 'flex';
        }
    }
}

function closeCurrentChat() {
    if (!currentChatUser && !currentChatId) return;

    // Очищаем текущий чат
    currentChatUser = null;
    currentChatId = null;

    // Очищаем заголовок чата
    const title = document.getElementById('currentChatTitle');
    if (title) {
        title.innerHTML = 'Выберите чат';
    }

    // Очищаем иконку профиля
    const profileIcon = document.querySelector('.profile-icon');
    if (profileIcon) {
        profileIcon.innerHTML = '<ion-icon name="person-circle-outline"></ion-icon>';
    }

    // Очищаем сообщения
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }

    // Убираем активный класс у выбранного чата
    document.querySelectorAll('.chat-item.active, .user-item.active').forEach(item => {
        item.classList.remove('active');
    });

    // Показываем экран выбора чата
    updateDesktopEmptyState();

    // Сбрасываем статус печатания
    resetTypingStatus();

    // Отменяем ответ на сообщение если был
    if (replyToMessage) {
        cancelReply();
    }

    console.log('Чат закрыт');
}

// Функция для обработки клавиши ESC
// Функция для обработки клавиши ESC с приоритетом закрытия контекстного меню
function handleEscKey(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {

        // 1. Сначала проверяем контекстное меню
        const contextMenu = document.getElementById('messageContextMenu');
        if (contextMenu && contextMenu.classList.contains('visible')) {
            event.preventDefault();
            closeContextMenu();
            console.log('❌ Контекстное меню закрыто по ESC');
            return;
        }

        // 2. Затем проверяем модальные окна
        const modals = document.querySelectorAll('.custom-modal');
        if (modals.length > 0) {
            modals.forEach(modal => modal.remove());
            console.log('❌ Модальное окно закрыто по ESC');
            return;
        }

        // 3. Проверяем UI редактирования сообщения
        const editUI = document.getElementById('editMessageUI');
        if (editUI) {
            cancelEditMessage();
            console.log('❌ Редактирование отменено по ESC');
            return;
        }

        // 4. Проверяем превью ответа (можно отменить ответ)
        const replyPreview = document.getElementById('replyPreview');
        if (replyPreview) {
            cancelReply();
            console.log('❌ Ответ отменен по ESC');
            return;
        }

        // 5. Закрываем эмодзи-пикер
        const emojiPicker = document.getElementById('emojiPicker');
        if (emojiPicker && emojiPicker.style.display === 'flex') {
            emojiPicker.style.display = 'none';
            console.log('❌ Эмодзи-пикер закрыт по ESC');
            return;
        }

        // 6. Закрываем меню вложений
        const attachMenu = document.getElementById('attachMenu');
        if (attachMenu && attachMenu.style.display === 'flex') {
            attachMenu.style.display = 'none';
            console.log('❌ Меню вложений закрыто по ESC');
            return;
        }

        // 7. Закрываем просмотр фото
        const photoViewer = document.getElementById('photoViewer');
        if (photoViewer && photoViewer.style.display === 'flex') {
            photoViewer.style.display = 'none';
            console.log('❌ Просмотр фото закрыт по ESC');
            return;
        }

        // 8. Если ничего из вышеперечисленного не открыто, закрываем чат
        // На ПК закрываем текущий чат
        if (window.innerWidth > 767 && currentChatUser) {
            closeCurrentChat();
            console.log('❌ Чат закрыт по ESC');
            return;
        }

        // На мобилке закрываем чат и возвращаемся к списку
        if (window.innerWidth <= 767 && document.querySelector('.chat')?.classList.contains('chat-opened')) {
            closeChatOnMobile();
            console.log('❌ Чат закрыт на мобилке по ESC');

        }
    }
}

// Функция для создания кнопки "Назад" на ПК
function addDesktopBackButton() {
    const navBar = document.querySelector('#messager .navBar');
    if (!navBar) return;

    // Проверяем, есть ли уже кнопка назад на ПК
    let backBtn = navBar.querySelector('.desktop-back-btn');
    if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.className = 'desktop-back-btn';
        backBtn.setAttribute('aria-label', 'Назад к списку чатов');
        backBtn.innerHTML = '<ion-icon name="arrow-back-outline"></ion-icon>';
        backBtn.title = 'Назад (Esc)';

        // Добавляем кнопку перед заголовком
        const titleContainer = navBar.querySelector('div[style*="display:flex"]') || navBar.firstChild;
        if (titleContainer && titleContainer !== backBtn) {
            backBtn.style.display = 'none'; // Скрываем на ПК по умолчанию
            titleContainer.insertBefore(backBtn, titleContainer.firstChild);
        } else {
            navBar.insertBefore(backBtn, navBar.firstChild);
        }

        // Обработчик клика по кнопке
        backBtn.addEventListener('click', closeCurrentChat);
    }

    // Показываем/скрываем кнопку в зависимости от наличия открытого чата
    const updateBackButtonVisibility = () => {
        if (backBtn) {
            if (window.innerWidth > 767 && currentChatUser) {
                backBtn.style.display = 'flex';
                backBtn.style.opacity = '0';
                backBtn.style.animation = 'fadeIn 0.2s forwards';
            } else {
                backBtn.style.display = 'none';
            }
        }
    };

    // Создаем наблюдатель за изменениями currentChatUser
    const originalOpenChat = openChatWithUser;
    window.openChatWithUser = async function (userId, userName, existingChatId = null) {
        await originalOpenChat(userId, userName, existingChatId);
        updateBackButtonVisibility();
    };

    // Оригинальная функция closeCurrentChat уже обновляет видимость
    const originalClose = closeCurrentChat;
    window.closeCurrentChat = function () {
        originalClose();
        updateBackButtonVisibility();
    };

    updateBackButtonVisibility();
    return backBtn;
}

// =========================== 17. НАЗНАЧЕНИЕ ОБРАБОТЧИКОВ ===========================
if (registerBtn) registerBtn.onclick = e => {
    e.preventDefault();
    registerWindow.classList.remove('close');
    loginWindow.classList.add('close');
};
if (loginBtn) loginBtn.onclick = e => {
    e.preventDefault();
    loginWindow.classList.remove('close');
    registerWindow.classList.add('close');
};
if (enterBtn) enterBtn.onclick = enterChat;
if (regBtn) regBtn.onclick = registerUser;
if (sendButton) sendButton.addEventListener('click', sendMessage);

const addEnterHandler = (el, cb) => el?.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
        e.preventDefault();
        cb();
    }
});
addEnterHandler(loginUsername, enterChat);
addEnterHandler(loginPassword, enterChat);
addEnterHandler(regUsername, registerUser);
addEnterHandler(regEmail, registerUser);
addEnterHandler(regPassword, registerUser);

if (messageInput) messageInput.addEventListener('focus', () => setTimeout(() => messagesContainer && (messagesContainer.scrollTop = messagesContainer.scrollHeight), 300));
const setMobileHeight = () => {
    const m = document.getElementById('messager');
    if (m) m.style.height = window.innerHeight + 'px';
};
window.addEventListener('resize', setMobileHeight);
setMobileHeight();

window.closeChatOnMobile = closeChatOnMobile;
window.updateDesktopEmptyState = updateDesktopEmptyState;
window.updateDesktopEntryState = updateDesktopEmptyState;

if (mobileBackBtn) mobileBackBtn.addEventListener('click', closeChatOnMobile);

let touchStartX = 0;
document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
});
document.addEventListener('touchend', (e) => {
    if (window.innerWidth > 767) return;
    const diff = e.changedTouches[0].screenX - touchStartX;
    if (diff < -50 && document.querySelector('.chat')?.classList.contains('chat-opened')) closeChatOnMobile();
});

// Мобильные и десктопные кнопки
const mobileProfileBtn = document.getElementById('mobileProfileBtn');
const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
const mobileExitBtn = document.getElementById('mobileExitBtn');
if (mobileProfileBtn) mobileProfileBtn.addEventListener('click', () => {
    showProfileModal();
    if (window.innerWidth <= 767 && document.querySelector('.chat')?.classList.contains('chat-opened')) closeChatOnMobile();
});
if (mobileSettingsBtn) mobileSettingsBtn.addEventListener('click', () => {
    showSettingsModal();
    if (window.innerWidth <= 767 && document.querySelector('.chat')?.classList.contains('chat-opened')) closeChatOnMobile();
});
if (mobileExitBtn) mobileExitBtn.addEventListener('click', logout);

const profileDesktopBtn = document.getElementById('profileDesktopBtn');
const settingsDesktopBtn = document.getElementById('settingsDesktopBtn');
const exitDesktopBtn = document.getElementById('exitDesktopBtn');
if (profileDesktopBtn) profileDesktopBtn.addEventListener('click', showProfileModal);
if (settingsDesktopBtn) settingsDesktopBtn.addEventListener('click', showSettingsModal);
if (exitDesktopBtn) exitDesktopBtn.addEventListener('click', logout);

// =========================== 18. ЗАГРУЗКА СТРАНИЦЫ ===========================
document.addEventListener('DOMContentLoaded', async () => {
    // Показываем скелетон пока грузится
    loaderManager.showChatsSkeleton();
    loaderManager.showUsersSkeleton();

    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.getAttribute('data-tab'))));
    setupSearch();

    // Добавляем обработчик ESC
    document.addEventListener('keydown', handleEscKey);

    // Добавляем кнопку "Назад" для ПК
    addDesktopBackButton();

    const {data: {session}} = await window.sbClient.auth.getSession();
    if (session) {
        loginWindow?.classList.add('close');
        registerWindow?.classList.add('close');
        chatWindow?.classList.remove('close');

        // Загружаем данные с лоадером
        await loaderManager.withLoader(async () => {
            await loadUsers();
            await loadUserChats();
        }, {showSkeleton: true, skeletonType: 'chats'});

        subscribeToMessages();
        subscribeToProfiles();
        subscribeToStatus();
        subscribeToAvatars();
        startStatusTracking();
        initAttachMenu();
        initMessageInput();
        initEmojiPicker();
        initPhotoViewer();
        loadSavedTheme();
        subscribeToTypingStatus();
        await registerServiceWorker();
        setTimeout(() => updateDesktopEmptyState(), 100);
        setTimeout(() => {
            setupReadReceipts();
        }, 1000);

        // Скрываем глобальный лоадер
        loaderManager.hidePageLoader();
    } else {
        loginWindow?.classList.remove('close');
        registerWindow?.classList.add('close');
        chatWindow?.classList.add('close');
        loaderManager.hidePageLoader();
    }

    window.addEventListener('resize', () => {
        updateDesktopEmptyState();
        if (window.innerWidth > 767) {
            document.querySelector('.chat')?.classList.remove('chat-opened');
            const backBtn = document.querySelector('.desktop-back-btn');
            if (backBtn) {
                if (currentChatUser) {
                    backBtn.style.display = 'flex';
                } else {
                    backBtn.style.display = 'none';
                }
            }
        } else {
            const backBtn = document.querySelector('.desktop-back-btn');
            if (backBtn) backBtn.style.display = 'none';
        }
    });
    // После загрузки сообщений, принудительно очищаем кэш сообщений
    window.addEventListener('load', () => {
        // Очищаем возможный кэш сообщений
        if (messagesContainer) {
            // Не удаляем, а обновляем если нужно
            console.log('Страница загружена, кэш сообщений очищен');
        }
    });
});

// =========================== ЛОАДЕРЫ ===========================

class LoaderManager {
    constructor() {
        this.pageLoader = document.getElementById('pageLoader');
        this.fullscreenLoader = document.getElementById('fullscreenLoader');
        this.activeRequests = 0;
        this.timeoutId = null;
    }

    // Скрыть глобальный лоадер страницы
    hidePageLoader() {
        if (this.pageLoader) {
            this.pageLoader.classList.add('hidden');
            setTimeout(() => {
                if (this.pageLoader) this.pageLoader.style.display = 'none';
            }, 500);
        }
    }

    // Показать полноэкранный лоадер
    showFullscreenLoader(text = 'Загрузка...') {
        if (this.fullscreenLoader) {
            const textEl = this.fullscreenLoader.querySelector('#fullscreenLoaderText');
            if (textEl) textEl.textContent = text;
            this.fullscreenLoader.classList.add('active');
        }
    }

    // Скрыть полноэкранный лоадер
    hideFullscreenLoader() {
        if (this.fullscreenLoader) {
            this.fullscreenLoader.classList.remove('active');
        }
    }

    // Показать лоадер на кнопке
    setButtonLoading(button, isLoading, loadingText = 'Загрузка...') {
        if (!button) return;

        if (isLoading) {
            button._originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `<span class="btn-loader"><span class="spinner"></span>${loadingText}</span>`;
        } else {
            button.disabled = false;
            if (button._originalText) {
                button.innerHTML = button._originalText;
                delete button._originalText;
            }
        }
    }

    // Показать скелетон в списке чатов
    showChatsSkeleton() {
        const container = document.getElementById('chatsList');
        if (!container) return;

        container.innerHTML = `
            <div class="chats-skeleton">
                ${Array(5).fill(`
                    <div class="skeleton-item">
                        <div class="skeleton-avatar"></div>
                        <div class="skeleton-info">
                            <div class="skeleton-line short"></div>
                            <div class="skeleton-line long"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Показать скелетон в списке пользователей
    showUsersSkeleton() {
        const container = document.getElementById('usersListContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="chats-skeleton">
                ${Array(5).fill(`
                    <div class="skeleton-item">
                        <div class="skeleton-avatar"></div>
                        <div class="skeleton-info">
                            <div class="skeleton-line short"></div>
                            <div class="skeleton-line long"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Показать лоадер "печатает" в чате
    showTypingLoader(chatTitle, userName = 'Собеседник') {
        const title = document.getElementById('currentChatTitle');
        if (title && chatTitle === currentChatId) {
            title.innerHTML = `${userName} <span class="typing-indicator" style="font-size: 12px;">
                <span class="message-loader" style="display: inline-flex; background: transparent; padding: 0; margin-left: 8px;">
                    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                </span>
            </span>`;
        }
    }

    // Показать лоадер при отправке сообщения
    showSendingLoader(messageContainer) {
        if (messageContainer) {
            const timeSpan = messageContainer.querySelector('.message-time');
            if (timeSpan && !timeSpan.querySelector('.sending-loader')) {
                const loader = document.createElement('span');
                loader.className = 'sending-loader';
                loader.innerHTML = '<span class="spinner"></span> Отправка...';
                timeSpan.appendChild(loader);
            }
        }
    }

    // Убрать лоадер отправки
    hideSendingLoader(messageContainer) {
        if (messageContainer) {
            const loader = messageContainer.querySelector('.sending-loader');
            if (loader) loader.remove();
        }
    }

    // Показать лоадер загрузки изображения
    showImageLoader(imgElement) {
        if (!imgElement) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'image-loader';
        wrapper.style.cssText = imgElement.style.cssText;
        imgElement.style.display = 'none';
        imgElement.parentNode.insertBefore(wrapper, imgElement);
        imgElement._loaderWrapper = wrapper;

        imgElement.onload = () => {
            if (imgElement._loaderWrapper) {
                imgElement._loaderWrapper.remove();
                imgElement.style.display = '';
            }
        };
    }

    // Показать прогресс загрузки файла
    showFileUploadProgress(fileName, onCancel) {
        const existingProgress = document.getElementById('fileUploadProgress');
        if (existingProgress) existingProgress.remove();

        const progressDiv = document.createElement('div');
        progressDiv.id = 'fileUploadProgress';
        progressDiv.className = 'file-upload-loader';
        progressDiv.innerHTML = `
            <ion-icon name="cloud-upload-outline"></ion-icon>
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <span class="file-name">${escapeHtml(fileName)}</span>
            <button class="preview-remove" onclick="document.getElementById('fileUploadProgress')?.remove()">✕</button>
        `;

        const inputDiv = document.querySelector('.input');
        const messagerEl = document.getElementById('messager');
        if (messagerEl && inputDiv) {
            messagerEl.insertBefore(progressDiv, inputDiv);
        }

        return {
            updateProgress: (percent) => {
                const fill = progressDiv.querySelector('.progress-fill');
                if (fill) fill.style.width = `${percent}%`;
            }, remove: () => progressDiv.remove()
        };
    }

    // Обертка для асинхронных операций с автоматическим лоадером
    async withLoader(asyncFn, options = {}) {
        const {
            showFullscreen = false,
            fullscreenText = 'Загрузка...',
            button = null,
            buttonText = 'Загрузка...',
            showSkeleton = false,
            skeletonType = 'chats' // 'chats' или 'users'
        } = options;

        try {
            if (showFullscreen) this.showFullscreenLoader(fullscreenText);
            if (button) this.setButtonLoading(button, true, buttonText);
            if (showSkeleton) {
                if (skeletonType === 'chats') this.showChatsSkeleton(); else if (skeletonType === 'users') this.showUsersSkeleton();
            }

            const result = await asyncFn();
            return result;
        } catch (error) {
            console.error('Ошибка:', error);
            throw error;
        } finally {
            if (showFullscreen) this.hideFullscreenLoader();
            if (button) this.setButtonLoading(button, false);
        }
    }
}

// Создаем глобальный экземпляр менеджера лоадеров
const loaderManager = new LoaderManager();

// Функция для отображения уведомления о загрузке (вместо alert)
function showLoadingToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'copy-notification';
    toast.innerHTML = `<ion-icon name="refresh-outline" class="spin"></ion-icon> ${message}`;
    toast.style.background = 'rgba(0, 132, 255, 0.95)';
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

async function showEditHistory(messageId) {
    const {data: message, error} = await window.sbClient
        .from('messages')
        .select('text, edited_at, created_at, is_edited')
        .eq('id', messageId)
        .single();

    if (error || !message) {
        console.error('Ошибка загрузки истории:', error);
        // Если нет истории, показываем простое уведомление
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.innerHTML = '<ion-icon name="information-circle-outline"></ion-icon> Сообщение было отредактировано';
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
        return;
    }

    // Если сообщение не редактировалось
    if (!message.is_edited) {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.innerHTML = '<ion-icon name="information-circle-outline"></ion-icon> Сообщение не редактировалось';
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
        return;
    }

    // Создаем тултип с информацией
    const tooltip = document.createElement('div');
    tooltip.className = 'edit-history-tooltip';
    const editedDate = message.edited_at ? new Date(message.edited_at).toLocaleString() : 'неизвестно';

    tooltip.innerHTML = `
        <div class="edit-history-title">
            <ion-icon name="time-outline"></ion-icon>
            Информация о сообщении
        </div>
        <div class="edit-history-item">
            <strong>📝 Отредактировано:</strong> ${editedDate}
        </div>
        <div class="edit-history-item">
            <strong>💬 Текущий текст:</strong><br>
            ${escapeHtml(message.text.substring(0, 150))}${message.text.length > 150 ? '...' : ''}
        </div>
    `;

    document.body.appendChild(tooltip);

    // Позиционируем тултип
    const mark = document.querySelector(`.message-edited-mark[data-message-id="${messageId}"]`);
    if (mark) {
        const rect = mark.getBoundingClientRect();
        tooltip.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
        tooltip.style.top = (rect.bottom + 5) + 'px';
    } else {
        tooltip.style.left = '50%';
        tooltip.style.top = '50%';
        tooltip.style.transform = 'translate(-50%, -50%)';
    }

    // Закрываем при клике вне
    const closeHandler = (e) => {
        if (!tooltip.contains(e.target)) {
            tooltip.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeHandler);
    }, 100);

    // Автоматическое закрытие через 4 секунды
    setTimeout(() => {
        if (tooltip.parentNode) tooltip.remove();
    }, 4000);
}

function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    return `${diffDays} д. назад`;
}

window.replyToMessageById = replyToMessageById;
window.cancelReply = cancelReply;
window.closeCurrentChat = closeCurrentChat;
window.handleEscKey = handleEscKey;
window.showEditMessageUI = showEditMessageUI;
window.saveEditMessage = saveEditMessage;
window.cancelEditMessage = cancelEditMessage;
window.showContextMenu = showContextMenu;
window.closeContextMenu = closeContextMenu;
window.copyMessageText = copyMessageText;