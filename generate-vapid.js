const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('🔑 Public Key:');
console.log(vapidKeys.publicKey);
console.log('\n🔒 Private Key:');
console.log(vapidKeys.privateKey);