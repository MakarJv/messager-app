// simple-vapid-server.js
const express = require('express');
const app = express();

// Ваш публичный VAPID ключ
const VAPID_PUBLIC_KEY = 'BD-Cv932C5rP0_50uvVg102h85E5HTDY1ZgSYlMpgAG9HGLI1SuYr7D5yyAEgEiB0qvBMuOfQSq8_xVB6Wh0UoQ';

app.get('/api/vapid-public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.listen(3001, () => {
    console.log('VAPID сервер запущен на порту 3001');
});