// ========== ПОЛУЧАЕМ ССЫЛКИ НА ЭЛЕМЕНТЫ СТРАНИЦЫ ==========
// Кнопки и ссылки
let loginBtn = document.querySelector('#login')        // "Войти" в окне регистрации
let registerBtn = document.querySelector('#register')  // "Регистрация" в окне входа
let enterBtn = document.querySelector('#enterBtn')    // кнопка "Войти"
let regBtn = document.querySelector('#regBtn')        // кнопка "Зарегистрироваться"
let sendBtn = document.getElementById('sendBtn')      // кнопка отправки сообщения

// Контейнеры окон
let login = document.querySelector('.login')          // окно входа
let register = document.querySelector('.register')    // окно регистрации
let chat = document.querySelector('.chat')            // окно чата

// Элементы чата
let message = document.getElementById('message')      // поле ввода текста
let messageText = document.getElementById('messageText') // контейнер для сообщений

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
// Возвращает текущее время в формате "ЧЧ:ММ"
function getShortTime() {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
}

// ========== ПЕРЕКЛЮЧЕНИЕ МЕЖДУ ОКНАМИ (ВХОД / РЕГИСТРАЦИЯ) ==========
// Клик по "Регистрация" → скрываем окно входа, показываем окно регистрации
if (registerBtn) {
    registerBtn.onclick = function (event) {
        event.preventDefault()  // отменяем переход по ссылке
        register.classList.remove('close')  // показываем регистрацию
        login.classList.add('close')        // скрываем вход
    }
}

// Клик по "Войти" в окне регистрации → возвращаемся ко входу
if (loginBtn) {
    loginBtn.onclick = function (event) {
        event.preventDefault()
        login.classList.remove('close')
        register.classList.add('close')
    }
}

// Кнопка "Войти" → проверяем поля и открываем чат
if (enterBtn) {
    enterBtn.onclick = function () {
        let email = document.querySelector('.login input[type="email"]')?.value
        let password = document.querySelector('.login input[type="password"]')?.value

        if (!email || !password) {
            alert('Пожалуйста, заполните все поля')
            return
        }

        // Скрываем окна входа/регистрации и показываем чат
        login.classList.add('close')
        register.classList.add('close')
        chat.classList.remove('close')
    }
}

// Кнопка "Зарегистрироваться" → проверяем поля и открываем чат
if (regBtn) {
    regBtn.onclick = function () {
        let email = document.querySelector('.register input[type="email"]')?.value
        let password = document.querySelector('.register input[type="password"]')?.value

        if (!email || !password) {
            alert('Пожалуйста, заполните все поля')
            return
        }

        if (password.length < 4) {
            alert('Пароль должен быть не менее 4 символов')
            return
        }

        // Скрываем окна и открываем чат
        login.classList.add('close')
        register.classList.add('close')
        chat.classList.remove('close')
    }
}

// ========== ОТПРАВКА СООБЩЕНИЙ ==========
// Создаёт блок сообщения (текст + время) и добавляет в контейнер
function addToDiv() {
    let value = message.value.trim()
    if (value === '') return

    // Создаём контейнер одного сообщения
    let messageContainer = document.createElement('div')
    messageContainer.className = 'message-container'

    // Текст сообщения
    let messageSpan = document.createElement('span')
    messageSpan.className = 'message-content'
    messageSpan.textContent = value

    // Время отправки
    let timeSpan = document.createElement('span')
    timeSpan.className = 'message-time'
    timeSpan.textContent = getShortTime()

    // Собираем и добавляем
    messageContainer.appendChild(messageSpan)
    messageContainer.appendChild(timeSpan)
    messageText.appendChild(messageContainer)

    // Очищаем поле ввода
    message.value = ''

    // Прокручиваем вниз, чтобы новое сообщение было видно
    setTimeout(() => {
        messageText.scrollTop = messageText.scrollHeight
    }, 50)
}

// Отправка по кнопке
if (sendBtn) {
    sendBtn.addEventListener('click', addToDiv)
}

// Отправка по клавише Enter (с отменой стандартного поведения)
if (message) {
    message.addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault()
            addToDiv()
        }
    })
}

// ========== НАЧАЛЬНОЕ СОСТОЯНИЕ ПРИ ЗАГРУЗКЕ ==========
// Убеждаемся, что чат скрыт, а окно входа показано
document.addEventListener('DOMContentLoaded', function() {
    if (login) login.classList.add('close')      // скрываем вход (временно)
    if (register) register.classList.add('close') // скрываем регистрацию
    if (chat) chat.classList.remove('close')     // показываем чат (для теста)
})