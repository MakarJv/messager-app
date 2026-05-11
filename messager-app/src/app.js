let loginBtn = document.querySelector('#login')
let registerBtn = document.querySelector('#register')
let login = document.querySelector('.login')
let register = document.querySelector('.register')

registerBtn.onclick = function () {
    register.classList.remove('close')
    login.classList.add('close')
}
loginBtn.onclick = function () {
    login.classList.remove('close')
    register.classList.add('close')
}