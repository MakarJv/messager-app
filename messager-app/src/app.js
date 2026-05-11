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
sendBtn.addEventListener('click', function () {
    let value = message.value
    messageText.textContent = value
    messageText.classList.add('messageText')
})