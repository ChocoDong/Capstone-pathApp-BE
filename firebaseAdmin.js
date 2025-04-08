const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Firebase에서 받은 비공개 키

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
