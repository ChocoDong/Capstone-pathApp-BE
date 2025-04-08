const express = require('express');
const router = express.Router();
const authenticateFirebaseToken = require('../middleware/firebaseAuth');
const db = require('../database/db_connect');

router.get('/', authenticateFirebaseToken, (req, res) => {
    const firebaseUser = req.firebaseUser;
    const uid = firebaseUser.uid;
    const email = firebaseUser.email;

    const sql = `
        INSERT INTO member (firebase_uid, email)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE email = VALUES(email)
    `;

    db.query(sql, [uid, email], (err, result) => {
        if (err) {
            console.error('DB 저장 오류:', err);
            return res.status(500).json({ message: 'DB 저장 실패', error: err });
        }

        console.log('DB 저장 성공:', result);
        res.json({
            message: 'Firebase 유저 인증 및 DB 저장 완료',
            firebase_uid: uid,
            email,
        });
    });
});

module.exports = router;
