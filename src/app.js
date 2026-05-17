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
const messageInput = document.getElementById('message');
const messagesContainer = document.getElementById('messageText');
const sendButton = document.getElementById('sendBtn');
const menuBtn = document.querySelector('#menuBtn');
const closeBtn = document.querySelector('#closeBtn');
const menuList = document.querySelector('.menuList');
const exitBtn = document.querySelector('.exitBtn');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const regUsername = document.getElementById('regUsername');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarContent = document.getElementById('sidebarContent');
const menuBtns = document.querySelectorAll('.menu-btn, #menuBtn');
const profileMenuItem = document.getElementById('profileMenuItem');
const settingsMenuItem = document.getElementById('settingsMenuItem');
const exitMenuItem = document.getElementById('exitMenuItem');
const profileDesktopBtn = document.getElementById('profileDesktopBtn');
const settingsDesktopBtn = document.getElementById('settingsDesktopBtn');
const exitDesktopBtn = document.getElementById('exitDesktopBtn');

// =========================== 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===========================
let currentChatUser = null, currentChatId = null, allUsers = [], userChats = [];
let activeTab = 'chats', searchQuery = '', mobileActiveTab = 'chats', mobileSearchQuery = '';
let messagesSubscription = null, profilesSubscription = null, statusSubscription = null;
let statusUpdateInterval = null, currentUserStatus = 'online', touchStartXGlobal = 0;

// =========================== 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===========================
function getShortTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
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
        console.log('Добро пожаловать,', username);
    } else {
        alert('Регистрация успешна! Подтвердите email и войдите.');
        loginWindow.classList.remove('close'); registerWindow.classList.add('close');
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
    }
}

async function logout() {
    await window.sbClient.auth.signOut(); stopStatusTracking();
    loginWindow.classList.remove('close'); registerWindow.classList.add('close'); chatWindow.classList.add('close');
    sidebar?.classList.remove('open'); sidebarOverlay?.classList.remove('active'); menuList?.classList.add('close');
    localStorage.removeItem('currentUsername');
    currentChatUser = null; currentChatId = null;
    if (messagesContainer) messagesContainer.innerHTML = '';
    localStorage.removeItem('lastChatUser'); localStorage.removeItem('lastActiveTab');
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
        const { data: last } = await window.sbClient.from('messages').select('text, created_at').eq('chat_id', p.chat_id).order('created_at', { ascending: false }).limit(1);
        userChats.push({ chatId: p.chat_id, userId: other[0].user_id, username: profile?.username || 'Пользователь', lastMessage: last?.[0]?.text || 'Нет сообщений', lastTime: last?.[0]?.created_at || null });
    }
    renderChatsList();
}

function renderChatsList() {
    const container = document.getElementById('chatsList');
    if (!container) return;
    container.innerHTML = '';
    if (!userChats.length) { container.innerHTML = `<div class="empty-state"><ion-icon name="chatbubbles-outline"></ion-icon><span>Нет активных чатов</span></div>`; return; }
    const filtered = userChats.filter(c => c.username.toLowerCase().includes(searchQuery.toLowerCase()));
    filtered.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-item';
        if (currentChatUser?.id === chat.userId) item.classList.add('active');
        item.setAttribute('data-user-id', chat.userId);
        item.setAttribute('data-chat-id', chat.chatId);
        const time = chat.lastTime ? new Date(chat.lastTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
        item.innerHTML = `<div class="chat-avatar"><ion-icon name="person-outline"></ion-icon></div><div class="chat-info"><div class="chat-name">${escapeHtml(chat.username)}</div><div class="chat-last-message">${escapeHtml(chat.lastMessage.slice(0,50))}</div></div><div class="chat-time">${time}</div>`;
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
    currentChatUser = { id: userId, name: userName };
    const title = document.getElementById('currentChatTitle');
    const status = await getUserStatus(userId);
    if (title) title.innerHTML = `${userName} <span class="user-status-indicator ${status}">${status === 'online' ? '●' : '○'}</span>`;
    currentChatId = existingChatId || await getOrCreateChatId(cur.id, userId);
    if (!currentChatId) { console.error('Не удалось получить ID чата'); return; }
    console.log('Открыт чат:', currentChatId);
    await loadMessages();
    document.querySelectorAll('.chat-item, .user-item, .sidebar-chat-item, .sidebar-user-item').forEach(i => i.classList.remove('active'));
    if (window.innerWidth <= 767) closeSidebar();
    saveCurrentState();
}

async function loadMessages() {
    if (!currentChatId) return;
    const { data: { user: cur } } = await window.sbClient.auth.getUser();
    if (!cur) return;
    const { data, error } = await window.sbClient.from('messages').select('*').eq('chat_id', currentChatId).order('created_at', { ascending: true });
    if (error) { console.error(error); return; }
    if (messagesContainer) messagesContainer.innerHTML = '';
    if (data?.length) data.forEach(m => displayMessage(m.text, m.sender_id === cur.id, m.created_at, m.id));
    else {
        const welcome = document.createElement('div');
        welcome.className = 'message-container system';
        welcome.innerHTML = `<span class="message-content">💬 Напишите первое сообщение ${currentChatUser?.name || 'собеседнику'}</span>`;
        messagesContainer?.appendChild(welcome);
    }
    setTimeout(() => messagesContainer && (messagesContainer.scrollTop = messagesContainer.scrollHeight), 100);
}

function displayMessage(text, isOwn, createdAt, msgId) {
    const container = document.createElement('div');
    container.className = 'message-container';
    container.setAttribute('data-message-id', msgId);
    if (!isOwn) container.classList.add('other');
    const time = createdAt ? new Date(createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : getShortTime();
    let html = `<span class="message-content">${escapeHtml(text)}</span><span class="message-time">${time}</span>`;
    if (isOwn) html += `<button class="message-delete-btn" onclick="deleteMessage('${msgId}', this.parentElement)"><ion-icon name="close-outline"></ion-icon></button>`;
    container.innerHTML = html;
    messagesContainer?.appendChild(container);
    setTimeout(() => messagesContainer && (messagesContainer.scrollTop = messagesContainer.scrollHeight), 50);
}

// =========================== 7. ОТПРАВКА И УДАЛЕНИЕ ===========================
async function sendMessage() {
    const val = messageInput?.value.trim();
    if (!val) { alert('Введите сообщение'); return; }
    if (!currentChatUser) { alert('Выберите собеседника'); return; }
    const { data: { user: cur } } = await window.sbClient.auth.getUser();
    if (!cur) return;
    if (!currentChatId) {
        const cid = await getOrCreateChatId(cur.id, currentChatUser.id);
        if (!cid) { alert('Ошибка создания чата'); return; }
        currentChatId = cid;
    }
    const { data, error } = await window.sbClient.from('messages').insert({ chat_id: currentChatId, sender_id: cur.id, receiver_id: currentChatUser.id, text: val }).select().single();
    if (error) { console.error(error); alert('Ошибка: ' + error.message); return; }
    if (data) displayMessage(val, true, data.created_at, data.id);
    messageInput.value = '';
    await loadUserChats();
    if (window.innerWidth <= 767) await loadMobileChats();
    setTimeout(() => messagesContainer && (messagesContainer.scrollTop = messagesContainer.scrollHeight), 50);
}

async function deleteMessage(msgId, el) {
    if (!msgId) return;
    const { error } = await window.sbClient.from('messages').delete().eq('id', msgId);
    if (error) { console.error(error); return; }
    const msg = el?.closest('.message-container');
    if (msg) msg.remove();
    await loadUserChats();
    if (window.innerWidth <= 767) await loadMobileChats();
    if (messagesContainer && !messagesContainer.children.length) {
        const welcome = document.createElement('div');
        welcome.className = 'message-container system';
        welcome.innerHTML = `<span class="message-content">💬 Напишите первое сообщение ${currentChatUser?.name || 'собеседнику'}</span>`;
        messagesContainer.appendChild(welcome);
    }
}

// =========================== 8. REALTIME ПОДПИСКИ ===========================
function subscribeToMessages() {
    if (messagesSubscription) window.sbClient.removeChannel(messagesSubscription);
    messagesSubscription = window.sbClient.channel('messages-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async p => {
            const msg = p.new, { data: { user: cur } } = await window.sbClient.auth.getUser();
            if (!cur) return;
            const isOwn = msg.sender_id === cur.id;
            if (msg.chat_id === currentChatId && !isOwn) {
                displayMessage(msg.text, false, msg.created_at, msg.id);
                setTimeout(() => messagesContainer && (messagesContainer.scrollTop = messagesContainer.scrollHeight), 50);
            }
            if (!isOwn) { await loadUserChats(); if (window.innerWidth <= 767) await loadMobileChats(); }
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
            if (window.innerWidth <= 767) await loadMobileChats();
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
                if (title) title.innerHTML = `${currentChatUser.name} <span class="user-status-indicator ${up.status}">${up.status === 'online' ? '●' : '○'}</span>`;
            }
            const userEl = document.querySelector(`.user-item[data-user-id="${up.id}"] .user-status`);
            if (userEl) userEl.className = `user-status ${up.status === 'online' ? 'online' : 'offline'}`;
            const mobileEl = document.querySelector(`.sidebar-user-item[data-user-id="${up.id}"] .sidebar-user-status`);
            if (mobileEl) { mobileEl.className = `sidebar-user-status ${up.status}`; mobileEl.textContent = up.status === 'online' ? 'онлайн' : 'офлайн'; }
            await loadUsers();
            if (window.innerWidth <= 767) await loadMobileUsers();
        })
        .subscribe(s => s === 'SUBSCRIBED' && console.log('✅ Подписка на статусы активна'));
}

// =========================== 9. СТАТУС ОНЛАЙН/ОФФЛАЙН ===========================
async function updateUserStatus(status) {
    const { data: { user } } = await window.sbClient.auth.getUser();
    if (!user) return;
    currentUserStatus = status;
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
    saveCurrentState();
}
function setupSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    input.addEventListener('input', e => { searchQuery = e.target.value; activeTab === 'chats' ? renderChatsList() : renderUsersList(); });
}

// =========================== 11. БОКОВОЕ МЕНЮ ===========================
function openSidebar() { sidebar?.classList.add('open'); sidebarOverlay?.classList.add('active'); document.body.style.overflow = 'hidden'; loadMobileChats(); loadMobileUsers(); }
function closeSidebar() { sidebar?.classList.remove('open'); sidebarOverlay?.classList.remove('active'); document.body.style.overflow = ''; }
document.getElementById('sidebarCloseBtn')?.addEventListener('click', closeSidebar);
document.querySelectorAll('.menu-btn, #menuBtn').forEach(btn => btn?.addEventListener('click', e => { e.stopPropagation(); if (window.innerWidth <= 767) openSidebar(); }));
sidebarOverlay?.addEventListener('click', closeSidebar);

function setupMobileTabs() {
    const tabs = document.querySelectorAll('.sidebar-tab'), chats = document.getElementById('sidebarChatsList'), users = document.getElementById('sidebarUsersList');
    tabs.forEach(tab => tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        mobileActiveTab = tabName;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (tabName === 'chats') { chats?.classList.remove('hidden'); users?.classList.add('hidden'); loadMobileChats(); }
        else { chats?.classList.add('hidden'); users?.classList.remove('hidden'); loadMobileUsers(); }
    }));
}
function setupMobileSearch() {
    const input = document.getElementById('sidebarSearchInput');
    if (!input) return;
    input.addEventListener('input', e => { mobileSearchQuery = e.target.value.toLowerCase(); mobileActiveTab === 'chats' ? loadMobileChats() : loadMobileUsers(); });
}

async function loadMobileChats() {
    const container = document.getElementById('sidebarChatsList');
    if (!container) return;
    const { data: { user: cur } } = await window.sbClient.auth.getUser();
    if (!cur) { container.innerHTML = '<div class="sidebar-empty"><span>Войдите в аккаунт</span></div>'; return; }
    const { data: parts } = await window.sbClient.from('chat_participants').select('chat_id').eq('user_id', cur.id);
    if (!parts?.length) { container.innerHTML = '<div class="sidebar-empty"><ion-icon name="chatbubbles-outline"></ion-icon><span>Нет чатов</span></div>'; return; }
    const chats = [];
    for (const p of parts) {
        const { data: other } = await window.sbClient.from('chat_participants').select('user_id').eq('chat_id', p.chat_id).neq('user_id', cur.id);
        if (!other?.length) continue;
        const { data: prof } = await window.sbClient.from('profiles').select('username').eq('id', other[0].user_id).single();
        const { data: last } = await window.sbClient.from('messages').select('text, created_at').eq('chat_id', p.chat_id).order('created_at', { ascending: false }).limit(1);
        let time = '';
        if (last?.[0]?.created_at) {
            const d = new Date(last[0].created_at);
            time = d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        }
        chats.push({ chatId: p.chat_id, userId: other[0].user_id, username: prof?.username || 'Пользователь', lastMsg: last?.[0]?.text || 'Нет сообщений', time });
    }
    const filtered = chats.filter(c => c.username.toLowerCase().includes(mobileSearchQuery));
    if (!filtered.length) { container.innerHTML = '<div class="sidebar-empty"><ion-icon name="search-outline"></ion-icon><span>Ничего не найдено</span></div>'; return; }
    container.innerHTML = '';
    filtered.forEach(c => {
        const item = document.createElement('div');
        item.className = 'sidebar-chat-item';
        if (currentChatUser?.id === c.userId) item.classList.add('active');
        item.innerHTML = `<div class="sidebar-chat-avatar"><ion-icon name="person-outline"></ion-icon></div><div class="sidebar-chat-info"><div class="sidebar-chat-name">${escapeHtml(c.username)}</div><div class="sidebar-chat-last-message">${escapeHtml(c.lastMsg.slice(0,40))}</div></div><div class="sidebar-chat-time">${c.time}</div>`;
        item.onclick = () => { openChatWithUser(c.userId, c.username, c.chatId); closeSidebar(); };
        container.appendChild(item);
    });
}

async function loadMobileUsers() {
    const container = document.getElementById('sidebarUsersList');
    if (!container) return;
    const { data: { user: cur } } = await window.sbClient.auth.getUser();
    if (!cur) { container.innerHTML = '<div class="sidebar-empty"><span>Войдите в аккаунт</span></div>'; return; }
    const { data: users } = await window.sbClient.from('profiles').select('id, username').neq('id', cur.id);
    if (!users?.length) { container.innerHTML = '<div class="sidebar-empty"><ion-icon name="people-outline"></ion-icon><span>Нет других пользователей</span></div>'; return; }
    const filtered = users.filter(u => u.username?.toLowerCase().includes(mobileSearchQuery));
    if (!filtered.length) { container.innerHTML = '<div class="sidebar-empty"><ion-icon name="search-outline"></ion-icon><span>Ничего не найдено</span></div>'; return; }
    container.innerHTML = '';
    for (const u of filtered) {
        const status = await getUserStatus(u.id);
        const item = document.createElement('div');
        item.className = 'sidebar-user-item';
        item.innerHTML = `<div class="sidebar-user-avatar"><ion-icon name="person-outline"></ion-icon></div><div class="sidebar-user-info"><div class="sidebar-user-name">${escapeHtml(u.username || 'Пользователь')}</div><div class="sidebar-user-status ${status}">${status === 'online' ? 'онлайн' : 'офлайн'}</div></div>`;
        item.onclick = () => { openChatWithUser(u.id, u.username); closeSidebar(); };
        container.appendChild(item);
    }
}

// Свайпы
document.addEventListener('touchstart', e => touchStartXGlobal = e.changedTouches[0].screenX);
document.addEventListener('touchend', e => {
    if (window.innerWidth > 767) return;
    const diff = e.changedTouches[0].screenX - touchStartXGlobal;
    if (diff < -50 && sidebar?.classList.contains('open')) closeSidebar();
    if (diff > 50 && !sidebar?.classList.contains('open') && touchStartXGlobal < 50) openSidebar();
});
window.addEventListener('resize', () => window.innerWidth > 767 && closeSidebar());

// =========================== 12. МОДАЛЬНЫЕ ОКНА ===========================
profileMenuItem?.addEventListener('click', () => { if (window.innerWidth <= 767) closeSidebar(); showProfileModal(); });
settingsMenuItem?.addEventListener('click', () => { if (window.innerWidth <= 767) closeSidebar(); showSettingsModal(); });
profileDesktopBtn?.addEventListener('click', showProfileModal);
settingsDesktopBtn?.addEventListener('click', showSettingsModal);

async function showProfileModal() {
    const { data: { user } } = await window.sbClient.auth.getUser();
    if (!user) { alert('Ошибка'); return; }
    const { data: profile } = await window.sbClient.from('profiles').select('*').eq('id', user.id).single();
    const username = profile?.username || user.user_metadata?.username || localStorage.getItem('currentUsername') || 'Пользователь';
    const email = user.email || '';
    const date = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : 'Неизвестно';
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `<div class="custom-modal-content"><div class="custom-modal-header"><ion-icon name="person-circle-outline"></ion-icon><h3>Профиль</h3><button class="modal-close-btn"><ion-icon name="close-outline"></ion-icon></button></div><div class="custom-modal-body"><div class="profile-avatar"><ion-icon name="person-circle-outline"></ion-icon></div><div class="profile-field"><label>👤 Имя пользователя</label><input type="text" id="profileName" value="${escapeHtml(username)}"><small class="profile-hint">Может содержать буквы, цифры и пробелы</small></div><div class="profile-field"><label>📧 Email</label><input type="email" value="${escapeHtml(email)}" disabled><small class="profile-hint">Email нельзя изменить</small></div><div class="profile-field"><label>📅 Дата регистрации</label><input type="text" value="${date}" disabled></div><div class="profile-status"><ion-icon name="sync-outline"></ion-icon><span>Статус: онлайн</span></div><button id="saveProfileBtn" class="modal-btn">💾 Сохранить изменения</button></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    const save = modal.querySelector('#saveProfileBtn'), nameInput = modal.querySelector('#profileName');
    save.onclick = async () => {
        const newName = nameInput.value.trim();
        if (!newName || newName.length < 2) { alert('❌ Имя должно быть не менее 2 символов'); return; }
        save.disabled = true; save.textContent = '⏳ Сохранение...';
        const { error } = await window.sbClient.from('profiles').update({ username: newName }).eq('id', user.id);
        if (error) { alert('❌ Ошибка: ' + error.message); save.disabled = false; save.textContent = '💾 Сохранить изменения'; return; }
        await window.sbClient.auth.updateUser({ data: { username: newName } });
        localStorage.setItem('currentUsername', newName);
        if (currentChatUser?.id === user.id) { currentChatUser.name = newName; document.getElementById('currentChatTitle').textContent = newName; }
        await loadUsers(); await loadUserChats();
        if (window.innerWidth <= 767) await loadMobileChats();
        alert('✅ Имя изменено!');
        modal.remove();
    };
}

function showSettingsModal() {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `<div class="custom-modal-content"><div class="custom-modal-header"><ion-icon name="settings-outline"></ion-icon><h3>Настройки</h3><button class="modal-close-btn"><ion-icon name="close-outline"></ion-icon></button></div><div class="custom-modal-body"><div class="settings-item"><label>Уведомления</label><input type="checkbox" id="notificationsCheckbox" ${localStorage.getItem('notifications') !== 'false' ? 'checked' : ''}></div><div class="settings-item"><label>Тёмная тема</label><input type="checkbox" id="darkThemeCheckbox" ${localStorage.getItem('darkTheme') === 'true' ? 'checked' : ''}></div></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    modal.querySelector('#notificationsCheckbox').onchange = e => localStorage.setItem('notifications', e.target.checked);
    modal.querySelector('#darkThemeCheckbox').onchange = e => {
        localStorage.setItem('darkTheme', e.target.checked);
        document.body.style.background = e.target.checked ? '#1a1a2e' : '#250250';
    };
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

document.querySelector('.profile-icon')?.addEventListener('click', () => currentChatUser ? showUserProfileModal(currentChatUser.id, currentChatUser.name) : alert('Сначала выберите собеседника'));

// =========================== 13. СОХРАНЕНИЕ СОСТОЯНИЯ ===========================
function saveCurrentState() {
    if (currentChatUser) localStorage.setItem('lastChatUser', JSON.stringify({ id: currentChatUser.id, name: currentChatUser.name }));
    localStorage.setItem('lastActiveTab', activeTab);
}
async function loadLastState() {
    const lastUser = localStorage.getItem('lastChatUser'), lastTab = localStorage.getItem('lastActiveTab');
    if (lastTab && (lastTab === 'chats' || lastTab === 'users')) {
        activeTab = lastTab;
        const chats = document.getElementById('chatsList'), users = document.getElementById('usersListContainer');
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        if (lastTab === 'chats') {
            document.querySelector('.tab[data-tab="chats"]')?.classList.add('active');
            chats?.classList.remove('hidden'); users?.classList.add('hidden');
            renderChatsList();
        } else {
            document.querySelector('.tab[data-tab="users"]')?.classList.add('active');
            chats?.classList.add('hidden'); users?.classList.remove('hidden');
            renderUsersList();
        }
    }
    if (lastUser) {
        try {
            const lu = JSON.parse(lastUser);
            if (allUsers.some(u => u.id === lu.id) || userChats.some(c => c.userId === lu.id)) {
                await openChatWithUser(lu.id, lu.name);
                console.log('Восстановлен чат с:', lu.name);
            } else localStorage.removeItem('lastChatUser');
        } catch(e) { console.error(e); }
    }
}

// =========================== 14. НАЗНАЧЕНИЕ ОБРАБОТЧИКОВ ===========================
if (registerBtn) registerBtn.onclick = e => { e.preventDefault(); registerWindow.classList.remove('close'); loginWindow.classList.add('close'); };
if (loginBtn) loginBtn.onclick = e => { e.preventDefault(); loginWindow.classList.remove('close'); registerWindow.classList.add('close'); };
if (enterBtn) enterBtn.onclick = enterChat;
if (regBtn) regBtn.onclick = registerUser;
if (exitBtn) exitBtn.onclick = logout;
if (exitMenuItem) exitMenuItem.onclick = logout;
if (exitDesktopBtn) exitDesktopBtn.onclick = logout;
if (sendButton) sendButton.addEventListener('click', sendMessage);

const addEnterHandler = (el, cb) => el?.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); cb(); } });
addEnterHandler(loginUsername, enterChat);
addEnterHandler(loginPassword, enterChat);
addEnterHandler(regUsername, registerUser);
addEnterHandler(regEmail, registerUser);
addEnterHandler(regPassword, registerUser);
addEnterHandler(messageInput, sendMessage);

if (messageInput) messageInput.addEventListener('focus', () => setTimeout(() => messagesContainer.scrollTop = messagesContainer.scrollHeight, 300));
const setMobileHeight = () => { const m = document.getElementById('messager'); if (m) m.style.height = window.innerHeight + 'px'; };
window.addEventListener('resize', setMobileHeight);
setMobileHeight();

// =========================== 15. ЗАГРУЗКА СТРАНИЦЫ ===========================
document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.getAttribute('data-tab'))));
    setupSearch();
    document.getElementById('newChatBtn')?.addEventListener('click', () => switchTab('users'));
    setupMobileTabs(); setupMobileSearch();
    const { data: { session } } = await window.sbClient.auth.getSession();
    if (session) {
        loginWindow?.classList.add('close'); registerWindow?.classList.add('close'); chatWindow?.classList.remove('close');
        await loadUsers(); await loadUserChats();
        subscribeToMessages(); subscribeToProfiles(); subscribeToStatus();
        startStatusTracking();
        await loadLastState();
    } else {
        loginWindow?.classList.remove('close'); registerWindow?.classList.add('close'); chatWindow?.classList.add('close');
    }
});