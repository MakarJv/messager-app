// ============================================================================
// ЕДИНСТВЕННОЕ ОБЪЯВЛЕНИЕ SUPABASE
// ============================================================================

const SUPABASE_CONFIG = {
    url: 'https://jdbezebvvrduevkdxvsh.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYmV6ZWJ2dnJkdWV2a2R4dnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5Mzg5OTQsImV4cCI6MjA5NDUxNDk5NH0.YgCK8_BapCOpB07qYWqO3JeFUT6mY5celJfXBrZ7I_0'
};

window.sbClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
console.log('Supabase client ready');

// ----------------------------------------------------------------------------
// ЭЛЕМЕНТЫ
// ----------------------------------------------------------------------------

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

// Глобальные переменные
let currentChatUser = null;
let currentChatId = null;
let allUsers = [];
let userChats = [];
let activeTab = 'chats';
let searchQuery = '';
let mobileActiveTab = 'chats';
let mobileSearchQuery = '';
let messagesSubscription = null;
let touchStartXGlobal = 0;

// ----------------------------------------------------------------------------
// ВРЕМЯ И HTML-ЗАЩИТА
// ----------------------------------------------------------------------------

function getShortTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ----------------------------------------------------------------------------
// РЕГИСТРАЦИЯ И ВХОД
// ----------------------------------------------------------------------------

async function registerUser() {
    const username = regUsername?.value.trim();
    const email = regEmail?.value.trim();
    const password = regPassword?.value;

    if (!email || !password || !username) {
        alert('Заполните все поля');
        return;
    }
    if (password.length < 4) {
        alert('Пароль минимум 4 символа');
        return;
    }

    const btn = regBtn;
    const originalText = btn.textContent;
    btn.textContent = 'Загрузка...';
    btn.disabled = true;

    const { data, error } = await window.sbClient.auth.signUp({
        email, password,
        options: { data: { username } }
    });

    btn.textContent = originalText;
    btn.disabled = false;

    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }

    if (data.session) {
        localStorage.setItem('currentUsername', username);
        loginWindow.classList.add('close');
        registerWindow.classList.add('close');
        chatWindow.classList.remove('close');
        regUsername.value = '';
        regEmail.value = '';
        regPassword.value = '';
        await loadUsers();
        await loadUserChats();
        console.log('Добро пожаловать,', username);
    } else {
        alert('Регистрация успешна! Подтвердите email и войдите.');
        loginWindow.classList.remove('close');
        registerWindow.classList.add('close');
    }
}

async function enterChat() {
    const email = loginUsername?.value.trim();
    const password = loginPassword?.value;

    if (!email || !password) {
        alert('Заполните все поля');
        return;
    }

    const btn = enterBtn;
    const originalText = btn.textContent;
    btn.textContent = 'Вход...';
    btn.disabled = true;

    const { data, error } = await window.sbClient.auth.signInWithPassword({ email, password });

    btn.textContent = originalText;
    btn.disabled = false;

    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }

    if (data.user) {
        localStorage.setItem('currentUsername', data.user.user_metadata?.username || 'Пользователь');
        loginWindow.classList.add('close');
        registerWindow.classList.add('close');
        chatWindow.classList.remove('close');
        loginUsername.value = '';
        loginPassword.value = '';
        await loadUsers();
        await loadUserChats();
    }
}

async function logout() {
    await window.sbClient.auth.signOut();
    loginWindow.classList.remove('close');
    registerWindow.classList.add('close');
    chatWindow.classList.add('close');
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('active');
    menuList?.classList.add('close');
    localStorage.removeItem('currentUsername');
    currentChatUser = null;
    currentChatId = null;
    if (messagesContainer) messagesContainer.innerHTML = '';
    localStorage.removeItem('lastChatUser');
    localStorage.removeItem('lastActiveTab');
}

// ----------------------------------------------------------------------------
// РАБОТА С ПОЛЬЗОВАТЕЛЯМИ И ЧАТАМИ
// ----------------------------------------------------------------------------

async function loadUsers() {
    if (!window.sbClient) return;
    const { data: { user: currentUser } } = await window.sbClient.auth.getUser();
    if (!currentUser) return;

    const { data, error } = await window.sbClient
        .from('profiles')
        .select('id, username')
        .neq('id', currentUser.id);

    if (error) {
        console.error('Ошибка загрузки пользователей:', error);
        return;
    }
    allUsers = data || [];
    renderUsersList();
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

    if (!participants || participants.length === 0) {
        userChats = [];
        renderChatsList();
        return;
    }

    userChats = [];
    for (const p of participants) {
        const { data: otherParticipants } = await window.sbClient
            .from('chat_participants')
            .select('user_id')
            .eq('chat_id', p.chat_id)
            .neq('user_id', currentUser.id);

        if (!otherParticipants || otherParticipants.length === 0) continue;

        const otherUserId = otherParticipants[0].user_id;
        const { data: profile } = await window.sbClient
            .from('profiles')
            .select('username')
            .eq('id', otherUserId)
            .single();

        const { data: lastMessage } = await window.sbClient
            .from('messages')
            .select('text, created_at')
            .eq('chat_id', p.chat_id)
            .order('created_at', { ascending: false })
            .limit(1);

        userChats.push({
            chatId: p.chat_id,
            userId: otherUserId,
            username: profile?.username || 'Пользователь',
            lastMessage: lastMessage?.[0]?.text || 'Нет сообщений',
            lastTime: lastMessage?.[0]?.created_at || null
        });
    }
    renderChatsList();
}

function renderChatsList() {
    const container = document.getElementById('chatsList');
    if (!container) return;
    container.innerHTML = '';

    if (userChats.length === 0) {
        container.innerHTML = `<div class="empty-state"><ion-icon name="chatbubbles-outline"></ion-icon><span>Нет активных чатов</span></div>`;
        return;
    }

    const filteredChats = userChats.filter(chat => chat.username.toLowerCase().includes(searchQuery.toLowerCase()));

    filteredChats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        if (currentChatUser?.id === chat.userId) chatItem.classList.add('active');
        chatItem.setAttribute('data-user-id', chat.userId);
        chatItem.setAttribute('data-chat-id', chat.chatId);

        const timeStr = chat.lastTime ? new Date(chat.lastTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
        chatItem.innerHTML = `
            <div class="chat-avatar"><ion-icon name="person-outline"></ion-icon></div>
            <div class="chat-info">
                <div class="chat-name">${escapeHtml(chat.username)}</div>
                <div class="chat-last-message">${escapeHtml(chat.lastMessage.substring(0, 50))}</div>
            </div>
            <div class="chat-time">${timeStr}</div>
        `;
        chatItem.onclick = () => openChatWithUser(chat.userId, chat.username, chat.chatId);
        container.appendChild(chatItem);
    });
}

function renderUsersList() {
    const container = document.getElementById('usersListContainer');
    if (!container) return;
    container.innerHTML = '';

    const filteredUsers = allUsers.filter(user => user.username?.toLowerCase().includes(searchQuery.toLowerCase()));

    if (filteredUsers.length === 0) {
        container.innerHTML = `<div class="empty-state"><ion-icon name="people-outline"></ion-icon><span>Нет других пользователей</span></div>`;
        return;
    }

    filteredUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.setAttribute('data-user-id', user.id);
        userItem.innerHTML = `
            <div class="user-avatar"><ion-icon name="person-outline"></ion-icon></div>
            <div class="user-info"><div class="user-name">${escapeHtml(user.username || 'Пользователь')}</div></div>
            <div class="user-status"></div>
        `;
        userItem.onclick = () => openChatWithUser(user.id, user.username);
        container.appendChild(userItem);
    });
}

// Получение или создание ID чата (UUID версия)

async function getOrCreateChatId(user1Id, user2Id) {
    console.log('Поиск чата между:', user1Id, user2Id);

    try {
        // 1. Находим все чаты первого пользователя
        const { data: user1Chats, error: error1 } = await window.sbClient
            .from('chat_participants')
            .select('chat_id')
            .eq('user_id', user1Id);

        if (error1) {
            console.error('Ошибка поиска чатов пользователя:', error1);
            return null;
        }

        // 2. Если есть чаты, проверяем есть ли общий со вторым пользователем
        if (user1Chats && user1Chats.length > 0) {
            const chatIds = user1Chats.map(c => c.chat_id);

            const { data: commonChats, error: error2 } = await window.sbClient
                .from('chat_participants')
                .select('chat_id')
                .eq('user_id', user2Id)
                .in('chat_id', chatIds);

            if (error2) {
                console.error('Ошибка поиска общих чатов:', error2);
            }

            if (commonChats && commonChats.length > 0) {
                console.log('Найден существующий чат:', commonChats[0].chat_id);
                return commonChats[0].chat_id;
            }
        }

        // 3. Создаём новый чат
        console.log('Создаём новый чат...');
        const { data: newChat, error: createError } = await window.sbClient
            .from('chats')
            .insert({})
            .select()
            .single();

        if (createError) {
            console.error('Ошибка создания чата:', createError);
            return null;
        }

        console.log('Чат создан:', newChat);

        // 4. Добавляем первого участника
        const { error: addError1 } = await window.sbClient
            .from('chat_participants')
            .insert({ chat_id: newChat.id, user_id: user1Id });

        if (addError1) {
            console.error('Ошибка добавления первого участника:', addError1);
        }

        // 5. Добавляем второго участника
        const { error: addError2 } = await window.sbClient
            .from('chat_participants')
            .insert({ chat_id: newChat.id, user_id: user2Id });

        if (addError2) {
            console.error('Ошибка добавления второго участника:', addError2);
        }

        return newChat.id;

    } catch (err) {
        console.error('Неожиданная ошибка:', err);
        return null;
    }
}

// ----------------------------------------------------------------------------
// ОТКРЫТИЕ ЧАТА И ЗАГРУЗКА СООБЩЕНИЙ
// ----------------------------------------------------------------------------

async function openChatWithUser(userId, userName, existingChatId = null) {
    const { data: { user: currentUser } } = await window.sbClient.auth.getUser();
    if (!currentUser) return;

    currentChatUser = { id: userId, name: userName };
    const chatTitle = document.getElementById('currentChatTitle');
    if (chatTitle) chatTitle.textContent = userName;

    // Получаем ID чата
    if (existingChatId) {
        currentChatId = existingChatId;
    } else {
        const chatId = await getOrCreateChatId(currentUser.id, userId);
        if (!chatId) {
            console.error('Не удалось получить ID чата');
            return;
        }
        currentChatId = chatId;
    }

    console.log('Открыт чат с ID:', currentChatId);
    await loadMessages();

    document.querySelectorAll('.chat-item, .user-item, .sidebar-chat-item, .sidebar-user-item').forEach(item => {
        item.classList.remove('active');
    });

    if (window.innerWidth <= 767) closeSidebar();
    saveCurrentState();
}

async function loadMessages() {
    if (!currentChatId || !window.sbClient) return;

    const { data: { user: currentUser } } = await window.sbClient.auth.getUser();
    if (!currentUser) return;

    const { data, error } = await window.sbClient
        .from('messages')
        .select('*')
        .eq('chat_id', currentChatId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Ошибка загрузки сообщений:', error);
        return;
    }

    if (messagesContainer) messagesContainer.innerHTML = '';

    if (data && data.length > 0) {
        data.forEach(msg => {
            const isOwn = msg.sender_id === currentUser.id;
            displayMessage(msg.text, isOwn, msg.created_at, msg.id);
        });
    } else {
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'message-container system';
        welcomeMsg.innerHTML = `<span class="message-content">💬 Напишите первое сообщение ${currentChatUser?.name || 'собеседнику'}</span>`;
        messagesContainer?.appendChild(welcomeMsg);
    }

    setTimeout(() => {
        if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
}

function displayMessage(text, isOwn, createdAt, messageId) {
    const container = document.createElement('div');
    container.className = 'message-container';
    container.setAttribute('data-message-id', messageId);

    if (!isOwn) {
        container.classList.add('other');
    }

    let timeStr = '';
    if (createdAt) {
        const date = new Date(createdAt);
        timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else {
        timeStr = getShortTime();
    }

    // Базовое содержимое
    let innerHTML = `<span class="message-content">${escapeHtml(text)}</span>`;
    innerHTML += `<span class="message-time">${timeStr}</span>`;

    // Добавляем кнопку удаления только для своих сообщений
    if (isOwn) {
        innerHTML += `<button class="message-delete-btn" onclick="deleteMessage('${messageId}', this.parentElement)">✕</button>`;
    }

    container.innerHTML = innerHTML;
    messagesContainer?.appendChild(container);

    // Прокручиваем вниз
    setTimeout(() => {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, 50);
}

// ----------------------------------------------------------------------------
// ОТПРАВКА СООБЩЕНИЙ В БАЗУ ДАННЫХ
// ----------------------------------------------------------------------------

async function sendMessage() {
    const value = messageInput?.value.trim();
    if (!value) {
        alert('Введите сообщение');
        return;
    }
    if (!currentChatUser) {
        alert('Сначала выберите собеседника');
        return;
    }

    const { data: { user: currentUser } } = await window.sbClient.auth.getUser();
    if (!currentUser) return;

    if (!currentChatId) {
        const chatId = await getOrCreateChatId(currentUser.id, currentChatUser.id);
        if (!chatId) {
            alert('Ошибка создания чата');
            return;
        }
        currentChatId = chatId;
    }

    // Сохраняем текст сообщения
    const messageText = value;
    const currentChatIdCopy = currentChatId;

    // Отправляем сообщение и получаем ответ с данными
    const { data, error } = await window.sbClient
        .from('messages')
        .insert({
            chat_id: currentChatIdCopy,
            sender_id: currentUser.id,
            receiver_id: currentChatUser.id,
            text: messageText
        })
        .select()
        .single();

    if (error) {
        console.error('Ошибка отправки:', error);
        alert('Ошибка отправки: ' + error.message);
        return;
    }

    // СРАЗУ отображаем сообщение у отправителя с полученным ID
    if (data) {
        displayMessage(messageText, true, data.created_at, data.id);
    } else {
        displayMessage(messageText, true, new Date().toISOString(), null);
    }

    // Очищаем поле
    messageInput.value = '';

    // Обновляем списки чатов (последнее сообщение)
    await loadUserChats();
    if (window.innerWidth <= 767) await loadMobileChats();

    // Прокручиваем вниз
    setTimeout(() => {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, 50);
}

// ----------------------------------------------------------------------------
// REALTIME ПОДПИСКА НА НОВЫЕ СООБЩЕНИЯ
// ----------------------------------------------------------------------------

function subscribeToMessages() {
    // Удаляем старую подписку, если есть
    if (messagesSubscription) {
        window.sbClient.removeChannel(messagesSubscription);
    }

    // Создаём новую подписку на таблицу messages
    messagesSubscription = window.sbClient
        .channel('messages-realtime')
        // Обработка НОВЫХ сообщений (INSERT)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            },
            async (payload) => {
                const newMessage = payload.new;
                console.log('📨 Новое сообщение получено:', newMessage);

                const { data: { user: currentUser } } = await window.sbClient.auth.getUser();
                if (!currentUser) return;

                const isOwn = newMessage.sender_id === currentUser.id;

                if (newMessage.chat_id === currentChatId && !isOwn) {
                    displayMessage(newMessage.text, false, newMessage.created_at, newMessage.id);
                    setTimeout(() => {
                        if (messagesContainer) {
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }
                    }, 50);
                }

                if (!isOwn) {
                    await loadUserChats();
                    if (window.innerWidth <= 767) {
                        await loadMobileChats();
                    }
                }
            }
        )
        // ✅ ДОБАВЛЯЕМ ОБРАБОТКУ УДАЛЕНИЯ СООБЩЕНИЙ (DELETE)
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'messages'
            },
            async (payload) => {
                const deletedMessage = payload.old;
                console.log('🗑️ Сообщение удалено:', deletedMessage);

                // Находим и удаляем сообщение из DOM
                if (deletedMessage.id) {
                    const messageElement = document.querySelector(`.message-container[data-message-id="${deletedMessage.id}"]`);
                    if (messageElement) {
                        messageElement.remove();
                        console.log('✅ Сообщение удалено из DOM на ПК');
                    }
                }

                // Обновляем списки чатов
                await loadUserChats();
                if (window.innerWidth <= 767) {
                    await loadMobileChats();
                }

                // Если сообщений не осталось в текущем чате — показываем приветствие
                if (currentChatId === deletedMessage.chat_id && messagesContainer && messagesContainer.children.length === 0) {
                    const welcomeMsg = document.createElement('div');
                    welcomeMsg.className = 'message-container system';
                    welcomeMsg.innerHTML = `<span class="message-content">💬 Напишите первое сообщение ${currentChatUser?.name || 'собеседнику'}</span>`;
                    messagesContainer.appendChild(welcomeMsg);
                }
            }
        )
        .subscribe((status) => {
            console.log('Realtime статус подписки:', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Подписка на сообщения активна (INSERT + DELETE)');
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Ошибка подключения Realtime');
            }
        });
}

// ----------------------------------------------------------------------------
// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК И ПОИСК (DESKTOP)
// ----------------------------------------------------------------------------

function switchTab(tab) {
    activeTab = tab;
    const chatsList = document.getElementById('chatsList');
    const usersList = document.getElementById('usersListContainer');
    const tabs = document.querySelectorAll('.tab');

    tabs.forEach(t => t.classList.remove('active'));

    if (tab === 'chats') {
        document.querySelector('.tab[data-tab="chats"]')?.classList.add('active');
        chatsList?.classList.remove('hidden');
        usersList?.classList.add('hidden');
        renderChatsList();
    } else {
        document.querySelector('.tab[data-tab="users"]')?.classList.add('active');
        chatsList?.classList.add('hidden');
        usersList?.classList.remove('hidden');
        renderUsersList();
    }
    saveCurrentState();
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (activeTab === 'chats') renderChatsList();
        else renderUsersList();
    });
}

// ----------------------------------------------------------------------------
// БОКОВОЕ МЕНЮ (ДЛЯ ТЕЛЕФОНОВ)
// ----------------------------------------------------------------------------

function openSidebar() {
    sidebar?.classList.add('open');
    sidebarOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
    loadMobileChats();
    loadMobileUsers();
}

function closeSidebar() {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('active');
    document.body.style.overflow = '';
}

const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);

const burgerBtns = document.querySelectorAll('.menu-btn, #menuBtn');
burgerBtns.forEach(btn => {
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 767) openSidebar();
        });
    }
});

if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

function setupMobileTabs() {
    const tabs = document.querySelectorAll('.sidebar-tab');
    const chatsList = document.getElementById('sidebarChatsList');
    const usersList = document.getElementById('sidebarUsersList');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            mobileActiveTab = tabName;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (tabName === 'chats') {
                chatsList?.classList.remove('hidden');
                usersList?.classList.add('hidden');
                loadMobileChats();
            } else {
                chatsList?.classList.add('hidden');
                usersList?.classList.remove('hidden');
                loadMobileUsers();
            }
        });
    });
}

function setupMobileSearch() {
    const searchInput = document.getElementById('sidebarSearchInput');
    if (!searchInput) return;
    searchInput.addEventListener('input', (e) => {
        mobileSearchQuery = e.target.value.toLowerCase();
        if (mobileActiveTab === 'chats') loadMobileChats();
        else loadMobileUsers();
    });
}

async function loadMobileChats() {
    const container = document.getElementById('sidebarChatsList');
    if (!container) return;

    if (!window.sbClient) {
        container.innerHTML = '<div class="sidebar-empty"><span>Войдите в аккаунт</span></div>';
        return;
    }

    const { data: { user: currentUser } } = await window.sbClient.auth.getUser();
    if (!currentUser) return;

    const { data: participants } = await window.sbClient
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', currentUser.id);

    if (!participants || participants.length === 0) {
        container.innerHTML = '<div class="sidebar-empty"><ion-icon name="chatbubbles-outline"></ion-icon><span>Нет чатов</span></div>';
        return;
    }

    const mobileChats = [];
    for (const p of participants) {
        const { data: other } = await window.sbClient
            .from('chat_participants')
            .select('user_id')
            .eq('chat_id', p.chat_id)
            .neq('user_id', currentUser.id);

        if (other && other.length > 0) {
            const { data: profile } = await window.sbClient
                .from('profiles')
                .select('username')
                .eq('id', other[0].user_id)
                .single();

            const { data: lastMsg } = await window.sbClient
                .from('messages')
                .select('text, created_at')
                .eq('chat_id', p.chat_id)
                .order('created_at', { ascending: false })
                .limit(1);

            // Форматируем время для отображения
            let timeStr = '';
            if (lastMsg?.[0]?.created_at) {
                const date = new Date(lastMsg[0].created_at);
                const now = new Date();
                const isToday = date.toDateString() === now.toDateString();

                if (isToday) {
                    timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                } else {
                    timeStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
                }
            }

            mobileChats.push({
                chatId: p.chat_id,
                userId: other[0].user_id,
                username: profile?.username || 'Пользователь',
                lastMessage: lastMsg?.[0]?.text || 'Нет сообщений',
                lastTime: timeStr
            });
        }
    }

    const filtered = mobileChats.filter(chat => chat.username.toLowerCase().includes(mobileSearchQuery));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="sidebar-empty"><ion-icon name="search-outline"></ion-icon><span>Ничего не найдено</span></div>';
        return;
    }

    container.innerHTML = '';
    filtered.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'sidebar-chat-item';
        if (currentChatUser?.id === chat.userId) item.classList.add('active');

        item.innerHTML = `
            <div class="sidebar-chat-avatar"><ion-icon name="person-outline"></ion-icon></div>
            <div class="sidebar-chat-info">
                <div class="sidebar-chat-name">${escapeHtml(chat.username)}</div>
                <div class="sidebar-chat-last-message">${escapeHtml(chat.lastMessage.substring(0, 40))}</div>
            </div>
            <div class="sidebar-chat-time">${chat.lastTime}</div>
        `;
        item.onclick = () => { openChatWithUser(chat.userId, chat.username, chat.chatId); closeSidebar(); };
        container.appendChild(item);
    });
}

async function loadMobileUsers() {
    const container = document.getElementById('sidebarUsersList');
    if (!container) return;

    if (!window.sbClient) {
        container.innerHTML = '<div class="sidebar-empty"><span>Войдите в аккаунт</span></div>';
        return;
    }

    const { data: { user: currentUser } } = await window.sbClient.auth.getUser();
    if (!currentUser) return;

    const { data: users, error } = await window.sbClient
        .from('profiles')
        .select('id, username')
        .neq('id', currentUser.id);

    if (error || !users || users.length === 0) {
        container.innerHTML = '<div class="sidebar-empty"><ion-icon name="people-outline"></ion-icon><span>Нет других пользователей</span></div>';
        return;
    }

    const filtered = users.filter(user => user.username?.toLowerCase().includes(mobileSearchQuery));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="sidebar-empty"><ion-icon name="search-outline"></ion-icon><span>Ничего не найдено</span></div>';
        return;
    }

    container.innerHTML = '';
    filtered.forEach(user => {
        const item = document.createElement('div');
        item.className = 'sidebar-user-item';
        item.innerHTML = `
            <div class="sidebar-user-avatar"><ion-icon name="person-outline"></ion-icon></div>
            <div class="sidebar-user-info">
                <div class="sidebar-user-name">${escapeHtml(user.username || 'Пользователь')}</div>
                <div class="sidebar-user-status">Нажмите для чата</div>
            </div>
        `;
        item.onclick = () => { openChatWithUser(user.id, user.username); closeSidebar(); };
        container.appendChild(item);
    });
}

// Свайпы для телефонов
document.addEventListener('touchstart', (e) => { touchStartXGlobal = e.changedTouches[0].screenX; });
document.addEventListener('touchend', (e) => {
    if (window.innerWidth > 767) return;
    const swipeDistance = e.changedTouches[0].screenX - touchStartXGlobal;
    if (swipeDistance < -50 && sidebar?.classList.contains('open')) closeSidebar();
    if (swipeDistance > 50 && !sidebar?.classList.contains('open') && touchStartXGlobal < 50) openSidebar();
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 767) closeSidebar();
});

// ----------------------------------------------------------------------------
// МОДАЛЬНЫЕ ОКНА
// ----------------------------------------------------------------------------

profileMenuItem?.addEventListener('click', () => { if (window.innerWidth <= 767) closeSidebar(); showProfileModal(); });
settingsMenuItem?.addEventListener('click', () => { if (window.innerWidth <= 767) closeSidebar(); showSettingsModal(); });
profileDesktopBtn?.addEventListener('click', showProfileModal);
settingsDesktopBtn?.addEventListener('click', showSettingsModal);

function showProfileModal() {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `
        <div class="custom-modal-content">
            <div class="custom-modal-header"><ion-icon name="person-circle-outline"></ion-icon><h3>Профиль</h3><button class="modal-close-btn"><ion-icon name="close-outline" style="color: #ffffff"></ion-icon></button></div>
            <div class="custom-modal-body">
                <div class="profile-avatar"><ion-icon name="person-circle-outline"></ion-icon></div>
                <div class="profile-field"><label>Имя</label><input type="text" id="profileName" value="${localStorage.getItem('currentUsername') || 'Пользователь'}" readonly></div>
                <button id="editProfileBtn" class="modal-btn">Редактировать</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    const editBtn = modal.querySelector('#editProfileBtn');
    const nameInput = modal.querySelector('#profileName');
    editBtn.onclick = () => {
        if (editBtn.textContent === 'Редактировать') {
            nameInput.readOnly = false;
            nameInput.style.background = '#fff';
            editBtn.textContent = 'Сохранить';
            editBtn.style.background = '#43ca00';
        } else {
            localStorage.setItem('currentUsername', nameInput.value);
            nameInput.readOnly = true;
            editBtn.textContent = 'Редактировать';
            editBtn.style.background = '#250250';
            alert('Имя сохранено!');
        }
    };
}

function showSettingsModal() {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `
        <div class="custom-modal-content">
            <div class="custom-modal-header"><ion-icon name="settings-outline"></ion-icon><h3>Настройки</h3><button class="modal-close-btn"><ion-icon name="close-outline" style="color: #ffffff"></ion-icon></button></div>
            <div class="custom-modal-body">
                <div class="settings-item"><label>Уведомления</label><input type="checkbox" id="notificationsCheckbox" ${localStorage.getItem('notifications') !== 'false' ? 'checked' : ''}></div>
                <div class="settings-item"><label>Тёмная тема</label><input type="checkbox" id="darkThemeCheckbox" ${localStorage.getItem('darkTheme') === 'true' ? 'checked' : ''}></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.querySelector('#notificationsCheckbox').onchange = (e) => localStorage.setItem('notifications', e.target.checked);
    modal.querySelector('#darkThemeCheckbox').onchange = (e) => {
        localStorage.setItem('darkTheme', e.target.checked);
        document.body.style.background = e.target.checked ? '#1a1a2e' : '#250250';
    };
}

// ----------------------------------------------------------------------------
// НАЗНАЧЕНИЕ ОБРАБОТЧИКОВ
// ----------------------------------------------------------------------------

if (registerBtn) registerBtn.onclick = (e) => { e.preventDefault(); registerWindow.classList.remove('close'); loginWindow.classList.add('close'); };
if (loginBtn) loginBtn.onclick = (e) => { e.preventDefault(); loginWindow.classList.remove('close'); registerWindow.classList.add('close'); };
if (enterBtn) enterBtn.onclick = enterChat;
if (regBtn) regBtn.onclick = registerUser;
if (exitBtn) exitBtn.onclick = logout;
if (exitMenuItem) exitMenuItem.onclick = logout;
if (exitDesktopBtn) exitDesktopBtn.onclick = logout;
if (sendButton) sendButton.addEventListener('click', sendMessage);

function addEnterHandler(el, cb) { if (el) el.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); cb(); } }); }
addEnterHandler(loginUsername, enterChat);
addEnterHandler(loginPassword, enterChat);
addEnterHandler(regUsername, registerUser);
addEnterHandler(regEmail, registerUser);
addEnterHandler(regPassword, registerUser);
addEnterHandler(messageInput, sendMessage);

// iPhone fix
if (messageInput) messageInput.addEventListener('focus', () => setTimeout(() => messagesContainer.scrollTop = messagesContainer.scrollHeight, 300));

function setMobileHeight() {
    const messager = document.getElementById('messager');
    if (messager) messager.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', setMobileHeight);
setMobileHeight();

// ----------------------------------------------------------------------------
// ЗАГРУЗКА СТРАНИЦЫ
// ----------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    // Настройка вкладок
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
    });
    setupSearch();

    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) newChatBtn.addEventListener('click', () => switchTab('users'));

    // Мобильное меню
    setupMobileTabs();
    setupMobileSearch();

    // Проверка сессии
    const { data: { session } } = await window.sbClient.auth.getSession();
    if (session) {
        loginWindow?.classList.add('close');
        registerWindow?.classList.add('close');
        chatWindow?.classList.remove('close');
        await loadUsers();
        await loadUserChats();
        subscribeToMessages();

        // ✅ ЗАГРУЖАЕМ СОХРАНЁННОЕ СОСТОЯНИЕ
        await loadLastState();
    } else {
        loginWindow?.classList.remove('close');
        registerWindow?.classList.add('close');
        chatWindow?.classList.add('close');
    }
});
// ----------------------------------------------------------------------------
// СОХРАНЕНИЕ И ЗАГРУЗКА СОСТОЯНИЯ
// ----------------------------------------------------------------------------

// Сохранение текущего состояния
function saveCurrentState() {
    if (currentChatUser) {
        localStorage.setItem('lastChatUser', JSON.stringify({
            id: currentChatUser.id,
            name: currentChatUser.name
        }));
    }
    localStorage.setItem('lastActiveTab', activeTab);
}

// Загрузка сохранённого состояния

async function loadLastState() {
    const lastChatUserStr = localStorage.getItem('lastChatUser');
    const lastActiveTab = localStorage.getItem('lastActiveTab');

    // Восстанавливаем вкладку (без сохранения)
    if (lastActiveTab && (lastActiveTab === 'chats' || lastActiveTab === 'users')) {
        activeTab = lastActiveTab;
        const chatsList = document.getElementById('chatsList');
        const usersList = document.getElementById('usersListContainer');
        const tabs = document.querySelectorAll('.tab');

        tabs.forEach(t => t.classList.remove('active'));

        if (lastActiveTab === 'chats') {
            document.querySelector('.tab[data-tab="chats"]')?.classList.add('active');
            chatsList?.classList.remove('hidden');
            usersList?.classList.add('hidden');
            renderChatsList();
        } else {
            document.querySelector('.tab[data-tab="users"]')?.classList.add('active');
            chatsList?.classList.add('hidden');
            usersList?.classList.remove('hidden');
            renderUsersList();
        }
    }

    // Восстанавливаем последнего собеседника
    if (lastChatUserStr) {
        try {
            const lastUser = JSON.parse(lastChatUserStr);
            const userExists = allUsers.some(u => u.id === lastUser.id) ||
                userChats.some(c => c.userId === lastUser.id);

            if (userExists) {
                await openChatWithUser(lastUser.id, lastUser.name);
                console.log('Восстановлен чат с:', lastUser.name);
            } else {
                console.log('Сохранённый пользователь не найден');
                localStorage.removeItem('lastChatUser');
            }
        } catch (e) {
            console.error('Ошибка восстановления чата:', e);
        }
    }
}
// ----------------------------------------------------------------------------
// УДАЛЕНИЕ СООБЩЕНИЯ (БЕЗ ПОДТВЕРЖДЕНИЯ)
// ----------------------------------------------------------------------------

async function deleteMessage(messageId, messageElement) {
    if (!messageId) {
        console.error('Нет ID сообщения');
        return;
    }

    console.log('🗑️ Удаляем сообщение с ID:', messageId);

    // Удаляем из базы данных
    const { error } = await window.sbClient
        .from('messages')
        .delete()
        .eq('id', messageId);

    if (error) {
        console.error('❌ Ошибка удаления из БД:', error);
        return;
    }

    console.log('✅ Сообщение удалено из БД');

    // Удаляем элемент из DOM
    if (messageElement) {
        const msgContainer = messageElement.closest('.message-container');
        if (msgContainer) {
            msgContainer.remove();
        }
    }

    // Обновляем списки чатов
    await loadUserChats();
    if (window.innerWidth <= 767) {
        await loadMobileChats();
    }

    // Если сообщений не осталось — показываем приветствие
    if (messagesContainer && messagesContainer.children.length === 0) {
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'message-container system';
        welcomeMsg.innerHTML = `<span class="message-content">💬 Напишите первое сообщение ${currentChatUser?.name || 'собеседнику'}</span>`;
        messagesContainer.appendChild(welcomeMsg);
    }
}