let loginBtn = document.querySelector('#login')
let registerBtn = document.querySelector('#register')
let login = document.querySelector('.login')
let register = document.querySelector('.register')
let enterBtn = document.querySelector('#enterBtn')
let regBtn = document.querySelector('#regBtn')
let chat = document.querySelector('.chat')
let sendBtn = document.getElementById('sendBtn')
let message = document.getElementById('message')
let messageText = document.getElementById('messageText')

// Альтернативный формат (часы:минуты)
function getShortTime() {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
}

registerBtn.onclick = function () {
    register.classList.remove('close')
    login.classList.add('close')
}

loginBtn.onclick = function () {
    login.classList.remove('close')
    register.classList.add('close')
}

enterBtn.onclick = function () {
    login.classList.add('close')
    register.classList.add('close')
    chat.classList.remove('close')
}

regBtn.onclick = function () {
    login.classList.add('close')
    register.classList.add('close')
    chat.classList.remove('close')
}

function addToDiv() {
    let value = message.value.trim()
    if (value === '') return

    // Создаём контейнер для сообщения
    let messageContainer = document.createElement('div')
    messageContainer.className = 'message-container'

    // Создаём текст сообщения
    let messageSpan = document.createElement('span')
    messageSpan.className = 'message-content'
    messageSpan.textContent = value

    // Создаём время отправки
    let timeSpan = document.createElement('span')
    timeSpan.className = 'message-time'
    timeSpan.textContent = getShortTime() // или getShortTime()

    // Собираем сообщение
    messageContainer.appendChild(messageSpan)
    messageContainer.appendChild(timeSpan)

    // Добавляем в общий блок
    messageText.appendChild(messageContainer)

    // Очищаем поле ввода
    message.value = ''

    // Автопрокрутка к новому сообщению
    messageContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

sendBtn.addEventListener('click', addToDiv)

message.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault()
        addToDiv()
    }
})